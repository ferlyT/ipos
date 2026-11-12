import postgres from "postgres";

export interface ReceivablePaymentAllocation {
  notrsmasuk: string; // Nomor faktur JL yang dilunasi
  bayarNominal: number;
  potonganNominal: number;
}

export interface ReceivablePaymentInput {
  notransaksi: string; // Format: .../BP/...
  kodekantor: string;
  kodesupel: string;
  tanggal: Date;
  accBayar: string; // Akun Kas (1-1110) atau Bank (1-1120)
  carabayar: string; // 'TN', 'TF', 'BG'
  alokasi: ReceivablePaymentAllocation[];
  user: string;
}

export interface PointRedemptionInput {
  notransaksi: string;
  kodekantor: string;
  kodesupel: string;
  tanggal: Date;
  jmlpoint: number;
  hadiah: string;
  keterangan: string;
}

export interface SalesInvoiceItemInput {
  kodeitem: string;
  jumlah: number;
  satuan: string;
  harga: number;
  potongan?: number;
}

export interface SalesInvoiceInput {
  notransaksi?: string;
  kodekantor?: string;
  tanggal?: Date | string;
  kodesupel?: string;
  carabayar?: string;
  subtotal: number;
  potonganNota?: number;
  pajak?: number;
  biayalain?: number;
  totalakhir: number;
  jmltunai?: number;
  jmlkredit?: number;
  jmldebit?: number;
  user?: string;
  items: SalesInvoiceItemInput[];
}

export class ReceivableLoyaltyService {
  constructor(private sql: postgres.Sql) {}

  /**
   * 1. MENGAMBIL DAFTAR FAKTUR PENJUALAN BELUM LUNAS
   */
  async getOutstandingInvoices(customerCode?: string, kantor: string = "UTM") {
    return await this.sql`
      SELECT 
        i.notransaksi, i.tanggal, i.kodesupel, s.nama as namapelanggan,
        i.totalakhir, i.jmlkredit, i.krd_jml_byr, i.krd_jml_pot,
        (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) as sisapiutang,
        i.byr_krd_jt as jatuhtempo,
        CURRENT_DATE - COALESCE(i.byr_krd_jt::date, i.tanggal::date) as hariketerlambatan
      FROM tbl_ikhd i
      LEFT JOIN tbl_supel s ON i.kodesupel = s.kode
      WHERE i.tipe = 'JL' 
        AND i.kodekantor = ${kantor}
        AND (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) > 0
        ${customerCode ? this.sql`AND i.kodesupel = ${customerCode}` : this.sql``}
      ORDER BY i.tanggal DESC
    `;
  }

  /**
   * 2. PEMBAYARAN / PELUNASAN PIUTANG PELANGGAN (COLLECTION)
   */
  async payCustomerDebt(input: ReceivablePaymentInput) {
    return await this.sql.begin(async (tx) => {
      let totalBayar = 0;
      let totalPotongan = 0;

      for (const alok of input.alokasi) {
        totalBayar += alok.bayarNominal;
        totalPotongan += alok.potonganNominal;

        // Kunci baris faktur
        const [faktur] = await tx`
          SELECT totalakhir, krd_jml_byr, krd_jml_pot 
          FROM tbl_ikhd 
          WHERE notransaksi = ${alok.notrsmasuk}
          FOR UPDATE
        `;

        if (!faktur) throw new Error(`Faktur ${alok.notrsmasuk} tidak ditemukan.`);

        const saldoAwal = Number(faktur.totalakhir) - Number(faktur.krd_jml_byr) - Number(faktur.krd_jml_pot);
        const sisaAkhir = saldoAwal - alok.bayarNominal - alok.potonganNominal;

        // Simpan Detail Alokasi tbl_byrpiutangdt
        await tx`
          INSERT INTO tbl_byrpiutangdt (
            iddetail, notransaksi, notrsmasuk, tipe, matauang, ratetrs, 
            jmlkredit, krd_jml_pot, krd_total, krd_jml_byr
          ) VALUES (
            ${input.notransaksi + '-' + alok.notrsmasuk}, ${input.notransaksi}, 
            ${alok.notrsmasuk}, 'JL', 'IDR', 1.0, ${saldoAwal}, 
            ${alok.potonganNominal}, ${sisaAkhir}, ${alok.bayarNominal}
          )
        `;

        // Update Akumulasi Pembayaran di Faktur Penjualan tbl_ikhd
        await tx`
          UPDATE tbl_ikhd 
          SET krd_jml_byr = krd_jml_byr + ${alok.bayarNominal},
              krd_jml_pot = krd_jml_pot + ${alok.potonganNominal}
          WHERE notransaksi = ${alok.notrsmasuk}
        `;
      }

      // Simpan Header tbl_byrpiutanghd
      await tx`
        INSERT INTO tbl_byrpiutanghd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, totalbayar, 
          acc_bayar, carabayar, user1, stslunas
        ) VALUES (
          ${input.notransaksi}, ${input.kodekantor}, ${input.tanggal}, 'BP', 
          ${input.kodesupel}, ${totalBayar}, ${input.accBayar}, 
          ${input.carabayar}, ${input.user}, true
        )
      `;

      // Buat Jurnal Akuntansi Berimbang
      let urut = 1;
      const insertJurnal = async (kodeAcc: string, debet: number, kredit: number, ket: string) => {
        if (debet === 0 && kredit === 0) return;
        const idDetail = `${Date.now()}${String(urut).padStart(3, '0')}`;
        await tx`
          INSERT INTO tbl_accjurnal (
            iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis, 
            keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
          ) VALUES (
            ${idDetail}, ${urut++}, 'R', ${input.notransaksi}, ${input.tanggal}, 
            ${kodeAcc}, 'Jurnal', ${ket}, 'IDR', 1.0, ${debet > 0 ? debet : kredit}, 
            ${debet > 0 ? 'D' : 'K'}, ${debet}, ${kredit}, ${input.kodekantor}
          )
        `;
      };

      // [D] Kas atau Bank Penerima Uang (1-1110 / 1-1120)
      await insertJurnal(input.accBayar, totalBayar, 0, `Penerimaan Piutang: ${input.notransaksi}`);
      // [D] Potongan Pelunasan Piutang (5-2100) jika ada diskon
      if (totalPotongan > 0) {
        await insertJurnal("5-2100", totalPotongan, 0, `Potongan Pelunasan Piutang: ${input.notransaksi}`);
      }
      // [K] Piutang Usaha (1-1210) berkurang
      await insertJurnal("1-1210", 0, totalBayar + totalPotongan, `Pelunasan Piutang Pelanggan: ${input.notransaksi}`);

      return {
        success: true,
        notransaksi: input.notransaksi,
        totalBayar,
        totalPotongan
      };
    });
  }

  /**
   * 3. LAPORAN ANALISA UMUR PIUTANG (CUSTOMER AGING SCHEDULE)
   */
  async getAgingReport(asOfDate: Date = new Date(), kantor: string = "UTM") {
    return await this.sql`
      SELECT 
        s.kode as kodepelanggan,
        s.nama as namapelanggan,
        s.telepon,
        COALESCE(SUM(CASE WHEN (COALESCE(i.byr_krd_jt::date, i.tanggal::date) - ${asOfDate}::date) >= 0 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as belum_jatuh_tempo,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - COALESCE(i.byr_krd_jt::date, i.tanggal::date)) BETWEEN 1 AND 30 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_1_30,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - COALESCE(i.byr_krd_jt::date, i.tanggal::date)) BETWEEN 31 AND 60 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_31_60,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - COALESCE(i.byr_krd_jt::date, i.tanggal::date)) BETWEEN 61 AND 90 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_61_90,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - COALESCE(i.byr_krd_jt::date, i.tanggal::date)) > 90 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as lebih_90_hari,
        COALESCE(SUM(i.totalakhir - i.krd_jml_byr - i.krd_jml_pot), 0) as total_piutang
      FROM tbl_supel s
      JOIN tbl_ikhd i ON s.kode = i.kodesupel
      WHERE i.tipe = 'JL' 
        AND i.kodekantor = ${kantor}
        AND (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) > 0
      GROUP BY s.kode, s.nama, s.telepon
      ORDER BY total_piutang DESC
    `;
  }

  /**
   * 4. SALDO POIN LOYALITAS PELANGGAN
   */
  async getCustomerPointBalance(customerCode: string) {
    const [earned] = await this.sql`
      SELECT COALESCE(SUM(point_ik), 0) as total_earned 
      FROM tbl_ikhd 
      WHERE kodesupel = ${customerCode}
    `;
    const [redeemed] = await this.sql`
      SELECT COALESCE(SUM(jmlambil), 0) as total_redeemed 
      FROM tbl_pointambil 
      WHERE kodesupel = ${customerCode}
    `;
    const [sa] = await this.sql`
      SELECT COALESCE(SUM(point_ik), 0) as total_sa 
      FROM tbl_point_sa 
      WHERE kodesupel = ${customerCode}
    `;

    const balance = Number(sa.total_sa) + Number(earned.total_earned) - Number(redeemed.total_redeemed);
    return {
      kodesupel: customerCode,
      saldoAwal: Number(sa.total_sa),
      totalDiperoleh: Number(earned.total_earned),
      totalDitukar: Number(redeemed.total_redeemed),
      saldoPoinAktif: balance
    };
  }

  /**
   * 5. PENUKARAN POIN HADIAH PELANGGAN
   */
  async redeemCustomerPoints(input: Partial<PointRedemptionInput> & { kodesupel: string; jmlpoint: number }) {
    const balance = await this.getCustomerPointBalance(input.kodesupel);
    if (balance.saldoPoinAktif < input.jmlpoint) {
      throw new Error(`Poin tidak mencukupi. Saldo aktif: ${balance.saldoPoinAktif}, klaim: ${input.jmlpoint}`);
    }

    const notransaksi = input.notransaksi || `PA${Date.now().toString().slice(-8)}`;
    const now = new Date();
    const tglObj = input.tanggal instanceof Date ? input.tanggal : input.tanggal ? new Date(input.tanggal) : now;
    const tglStr = tglObj.toISOString().slice(0, 19).replace('T', ' ');

    await this.sql`
      INSERT INTO tbl_pointambil (
        notransaksi, tipe, tanggal, kodesupel, jmlambil, keterangan
      ) VALUES (
        ${notransaksi}, 'PA', ${tglStr}::timestamp, 
        ${input.kodesupel}, ${input.jmlpoint}, ${input.keterangan || input.hadiah || 'Penukaran Poin'}
      )
    `;

    return {
      success: true,
      notransaksi,
      kodesupel: input.kodesupel,
      jmlpoint: input.jmlpoint,
      sisaPoin: balance.saldoPoinAktif - input.jmlpoint
    };
  }

  /**
   * 6. BUAT FAKTUR PENJUALAN KASIR / TEMPO (JL)
   */
  async createSalesInvoice(input: SalesInvoiceInput) {
    return await this.sql.begin(async (tx) => {
      const now = new Date();
      const tglObj = input.tanggal instanceof Date ? input.tanggal : input.tanggal ? new Date(input.tanggal) : now;
      const tglStr = tglObj.toISOString().slice(0, 19).replace('T', ' ');
      const kantor = input.kodekantor || "UTM";
      const user = input.user || "ADMIN";
      
      // Validasi customer foreign key di tbl_supel
      let customer = input.kodesupel || "PL0001";
      const [supelExists] = await tx`SELECT kode FROM tbl_supel WHERE kode = ${customer} LIMIT 1`;
      if (!supelExists) {
        customer = "PL0001";
      }

      const carabayar = (input.carabayar || "TN").toUpperCase();
      const notransaksi = input.notransaksi || `JL${Date.now().toString().slice(-8)}`;

      const subtotal = Number(input.subtotal || 0);
      const potNota = Number(input.potonganNota || 0);
      const pajak = Number(input.pajak || 0);
      const biayalain = Number(input.biayalain || 0);
      const totalakhir = Number(input.totalakhir || subtotal - potNota + pajak + biayalain);

      const isKredit = carabayar === "KD" || carabayar === "KREDIT";
      const isDebit = carabayar === "BCA" || carabayar === "MANDIRI" || carabayar === "DEBIT" || carabayar === "QRIS";
      const jmltunai = isKredit || isDebit ? 0 : totalakhir;
      const jmlkredit = isKredit ? totalakhir : 0;
      const jmldebit = isDebit ? totalakhir : 0;

      const point_ik = Math.floor(totalakhir / 10000);

      let totalitem = 0;
      for (const it of input.items) {
        totalitem += Number(it.jumlah || 0);
      }

      // 1. Simpan Header tbl_ikhd
      await tx`
        INSERT INTO tbl_ikhd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, totalitem,
          subtotal, potnomfaktur, pajak, biayalain, totalakhir, carabayar,
          jmltunai, jmlkredit, jmldebit, jmlkk, jmlemoney, point_ik, user1, compname
        ) VALUES (
          ${notransaksi}, ${kantor}, ${tglStr}::timestamp, 'JL', ${customer}, ${totalitem},
          ${subtotal}, ${potNota}, ${pajak}, ${biayalain}, ${totalakhir}, ${carabayar === 'KREDIT' ? 'KD' : carabayar.slice(0, 2)},
          ${jmltunai}, ${jmlkredit}, ${jmldebit}, 0, 0, ${point_ik}, ${user}, 'POS-01'
        )
      `;

      // 2. Simpan Detail Items tbl_ikdt & Update Stok
      let nobaris = 1;
      let totalHppCost = 0;

      for (const item of input.items) {
        const iddetail = `${notransaksi}-${nobaris}`;
        const linePot = Number(item.potongan || 0);
        const lineTotal = Number(item.jumlah) * Number(item.harga) - linePot;

        await tx`
          INSERT INTO tbl_ikdt (
            iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total
          ) VALUES (
            ${iddetail}, ${nobaris++}, ${notransaksi}, ${item.kodeitem}, ${item.jumlah},
            ${item.satuan}, ${item.harga}, ${linePot}, ${lineTotal}
          )
        `;

        const [itData] = await tx`
          SELECT COALESCE(hargapokok, 0) as hpp FROM tbl_item WHERE kodeitem = ${item.kodeitem} LIMIT 1
        `;
        const hpp = Number(itData?.hpp || 0);
        totalHppCost += hpp * Number(item.jumlah);

        await tx`
          UPDATE tbl_itemstok
          SET stok = stok - ${item.jumlah}
          WHERE kodeitem = ${item.kodeitem} AND kantor = ${kantor}
        `;

        await tx`
          UPDATE tbl_item
          SET stok = stok - ${item.jumlah}
          WHERE kodeitem = ${item.kodeitem}
        `;

        await tx`
          INSERT INTO tbl_item_ik (
            iddetailim, notransaksi, kodekantor, tanggal, tipe, kodeitem, jumlahdasar, satuandasar, hargadasar, iddetailtrs
          ) VALUES (
            ${'IM-OUT-' + iddetail}, ${notransaksi}, ${kantor}, ${tglStr}::timestamp, 'JL', ${item.kodeitem}, ${item.jumlah}, ${item.satuan}, ${item.harga}, ${iddetail}
          )
        `;
      }

      // 3. Jurnal Akuntansi Berimbang di tbl_accjurnal
      let urut = 1;
      const insertJurnal = async (kodeAcc: string, debet: number, kredit: number, ket: string) => {
        if (debet === 0 && kredit === 0) return;
        const idDetail = `${Date.now()}${String(urut).padStart(3, "0")}`;
        await tx`
          INSERT INTO tbl_accjurnal (
            iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
            keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
          ) VALUES (
            ${idDetail}, ${urut++}, 'R', ${notransaksi}, ${tglStr}::timestamp, ${kodeAcc}, 'Jurnal',
            ${ket}, 'IDR', 1.0, ${debet > 0 ? debet : kredit}, ${debet > 0 ? 'D' : 'K'},
            ${debet}, ${kredit}, ${kantor}
          )
        `;
      };

      const accPenerima = isKredit ? "1-1210" : isDebit ? (carabayar === "MANDIRI" ? "1-1121" : "1-1120") : "1-1110";
      await insertJurnal(accPenerima, totalakhir, 0, `Penerimaan Penjualan: ${notransaksi}`);

      if (potNota > 0) {
        await insertJurnal("4-1500", potNota, 0, `Potongan Penjualan: ${notransaksi}`);
      }

      await insertJurnal("4-1100", 0, subtotal, `Penjualan Barang: ${notransaksi}`);

      if (pajak > 0) {
        await insertJurnal("2-4110", 0, pajak, `PPN Keluaran: ${notransaksi}`);
      }

      if (totalHppCost > 0) {
        await insertJurnal("5-1100", totalHppCost, 0, `HPP Penjualan: ${notransaksi}`);
        await insertJurnal("1-1301", 0, totalHppCost, `Pengurangan Persediaan: ${notransaksi}`);
      }

      return {
        success: true,
        notransaksi,
        totalakhir,
        pointEarned: point_ik,
        itemCount: input.items.length,
      };
    });
  }

  /**
   * 7. LIST ALL CUSTOMER LOYALTY POINTS (tbl_point_sa, tbl_ikhd, tbl_pointambil)
   */
  async listCustomerLoyalty(search?: string, limit: number = 50) {
    let whereClause = this.sql`WHERE s.tipe = 'PL'`;
    if (search) {
      whereClause = this.sql`${whereClause} AND (s.kode ILIKE ${'%' + search + '%'} OR s.nama ILIKE ${'%' + search + '%'} OR s.kota ILIKE ${'%' + search + '%'})`;
    }

    const rows = await this.sql`
      SELECT 
        s.kode,
        s.nama,
        s.telepon,
        s.kota,
        COALESCE(s.kgrup, 'General') as grup,
        COALESCE(sa.total_sa, 0)::numeric as saldo_awal,
        COALESCE(ik.total_earned, 0)::numeric as total_diperoleh,
        COALESCE(pa.total_redeemed, 0)::numeric as total_ditukar,
        (COALESCE(sa.total_sa, 0) + COALESCE(ik.total_earned, 0) - COALESCE(pa.total_redeemed, 0))::numeric as saldo_poin_aktif
      FROM tbl_supel s
      LEFT JOIN (
        SELECT kodesupel, SUM(point_ik) as total_sa FROM tbl_point_sa GROUP BY kodesupel
      ) sa ON s.kode = sa.kodesupel
      LEFT JOIN (
        SELECT kodesupel, SUM(point_ik) as total_earned FROM tbl_ikhd GROUP BY kodesupel
      ) ik ON s.kode = ik.kodesupel
      LEFT JOIN (
        SELECT kodesupel, SUM(jmlambil) as total_redeemed FROM tbl_pointambil GROUP BY kodesupel
      ) pa ON s.kode = pa.kodesupel
      ${whereClause}
      ORDER BY saldo_poin_aktif DESC, s.nama ASC
      LIMIT ${limit};
    `;

    return rows.map((r: any) => ({
      kode: String(r.kode).trim(),
      nama: String(r.nama).trim(),
      telepon: r.telepon ? String(r.telepon).trim() : "-",
      kota: r.kota ? String(r.kota).trim() : "-",
      grup: String(r.grup).trim(),
      saldoAwal: Number(r.saldo_awal || 0),
      totalDiperoleh: Number(r.total_diperoleh || 0),
      totalDitukar: Number(r.total_ditukar || 0),
      saldoPoinAktif: Number(r.saldo_poin_aktif || 0)
    }));
  }

  /**
   * Helper Subset Sum menggunakan Dynamic Programming (Knapsack DP)
   */
  private findExactSubsetDP(items: any[], target: number): any[] | null {
    if (items.length === 0 || target <= 0) return null;

    const valid = items.filter((it) => Math.round(Number(it.sisapiutang)) <= target);
    if (valid.length === 0) return null;

    const totalSum = valid.reduce((s, it) => s + Math.round(Number(it.sisapiutang)), 0);
    if (totalSum < target) return null;
    if (totalSum === target) return valid;

    function gcd(a: number, b: number): number {
      a = Math.abs(a);
      b = Math.abs(b);
      while (b) {
        const t = b;
        b = a % b;
        a = t;
      }
      return a;
    }

    let scale = target;
    for (const it of valid) {
      scale = gcd(scale, Math.round(Number(it.sisapiutang)));
      if (scale === 1) break;
    }
    if (scale <= 0) scale = 1;

    const scaledTarget = Math.round(target / scale);
    if (scaledTarget > 2_000_000) {
      return null;
    }

    const parent = new Int32Array(scaledTarget + 1);
    parent.fill(-1);
    parent[0] = -2;

    const reachable: number[] = [0];
    let found = false;

    for (let idx = 0; idx < valid.length; idx++) {
      const w = Math.round(Math.round(Number(valid[idx].sisapiutang)) / scale);
      if (w <= 0 || w > scaledTarget) continue;

      const rLen = reachable.length;
      for (let j = 0; j < rLen; j++) {
        const ns = reachable[j] + w;
        if (ns <= scaledTarget && parent[ns] === -1) {
          parent[ns] = idx;
          reachable.push(ns);
          if (ns === scaledTarget) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }

    if (!found) return null;

    let curr = scaledTarget;
    const result: any[] = [];
    while (curr > 0) {
      const pIdx = parent[curr];
      result.push(valid[pIdx]);
      curr -= Math.round(Math.round(Number(valid[pIdx].sisapiutang)) / scale);
    }
    return result;
  }

  /**
   * 8. SMART INVOICE MATCHER (PENCOCOKAN TAGIHAN OTOMATIS)
   */
  async matchInvoicesByAmount(params: {
    amount: number;
    customerQuery?: string;
    year?: number;
    tolerance?: number;
    office?: string;
  }) {
    const { amount, customerQuery, year, tolerance = 0, office = "UTM" } = params;
    const target = Math.round(Number(amount));

    let matchedCustCodes: string[] = [];
    if (customerQuery && customerQuery.trim()) {
      const q = customerQuery.trim().toLowerCase();
      const custRows = await this.sql`
        SELECT kode, nama FROM tbl_supel
        WHERE tipe = 'PL' AND (
          LOWER(nama) LIKE ${'%' + q + '%'} OR 
          LOWER(kode) LIKE ${'%' + q + '%'} OR
          LOWER(COALESCE(kontak, '')) LIKE ${'%' + q + '%'}
        )
      `;
      matchedCustCodes = custRows.map((c: any) => String(c.kode).trim());
    }

    // Ambil faktur belum lunas
    const rawInvoices = await this.sql`
      SELECT 
        i.notransaksi,
        i.tanggal::date as tanggal,
        i.kodesupel,
        COALESCE(s.nama, i.kodesupel) as namapelanggan,
        COALESCE(i.keterangan, '') as keterangan,
        i.totalakhir::numeric as totalakhir,
        COALESCE(i.krd_jml_byr, 0)::numeric as krd_jml_byr,
        COALESCE(i.krd_jml_pot, 0)::numeric as krd_jml_pot,
        (i.totalakhir - COALESCE(i.krd_jml_byr, 0) - COALESCE(i.krd_jml_pot, 0))::numeric as sisapiutang,
        i.byr_krd_jt::date as jatuhtempo
      FROM tbl_ikhd i
      LEFT JOIN tbl_supel s ON i.kodesupel = s.kode
      WHERE i.tipe = 'JL'
        AND i.kodekantor = ${office}
        AND (i.totalakhir - COALESCE(i.krd_jml_byr, 0) - COALESCE(i.krd_jml_pot, 0)) > 0
        ${year ? this.sql`AND EXTRACT(YEAR FROM i.tanggal) = ${year}` : this.sql``}
        ${
          matchedCustCodes.length > 0
            ? this.sql`AND (i.kodesupel IN ${this.sql(matchedCustCodes)} OR LOWER(COALESCE(i.keterangan, '')) LIKE ${'%' + customerQuery!.trim().toLowerCase() + '%'})`
            : customerQuery && customerQuery.trim()
            ? this.sql`AND (LOWER(COALESCE(s.nama, '')) LIKE ${'%' + customerQuery.trim().toLowerCase() + '%'} OR LOWER(COALESCE(i.keterangan, '')) LIKE ${'%' + customerQuery.trim().toLowerCase() + '%'})`
            : this.sql``
        }
      ORDER BY i.tanggal DESC, i.notransaksi DESC
    `;

    const invoices = rawInvoices.map((inv: any) => ({
      notransaksi: String(inv.notransaksi).trim(),
      tanggal: inv.tanggal ? String(inv.tanggal).slice(0, 10) : "-",
      kodesupel: String(inv.kodesupel).trim(),
      namapelanggan: String(inv.namapelanggan).trim(),
      keterangan: String(inv.keterangan || "").trim(),
      totalakhir: Number(inv.totalakhir || 0),
      krd_jml_byr: Number(inv.krd_jml_byr || 0),
      krd_jml_pot: Number(inv.krd_jml_pot || 0),
      sisapiutang: Number(inv.sisapiutang || 0),
      jatuhtempo: inv.jatuhtempo ? String(inv.jatuhtempo).slice(0, 10) : null
    }));

    const scenarios: any[] = [];

    // 1. Single Invoice Match (Tepat 100%)
    const singleMatches = invoices.filter((inv) => Math.round(inv.sisapiutang) === target);
    for (const sm of singleMatches) {
      scenarios.push({
        type: "SINGLE",
        title: `Faktur Tunggal: ${sm.notransaksi}`,
        description: `Nominal tepat cocok 100% dengan satu faktur penjualan pelanggan ${sm.namapelanggan}`,
        invoiceCount: 1,
        totalAmount: sm.sisapiutang,
        targetAmount: target,
        difference: 0,
        invoices: [sm]
      });
    }

    // 2. Exact Combination (Subset Sum 2-8 faktur)
    const candidates = invoices.filter((inv) => inv.sisapiutang <= target);
    const exactCombos: any[][] = [];
    const seenComboKeys = new Set<string>();
    let iterations = 0;
    const maxIterations = 25000;
    const startTime = Date.now();

    // Prioritaskan kombinasi kecil (2 s/d 6 faktur)
    function searchSubset(startIndex: number, currentSum: number, currentList: any[], maxLen: number) {
      if (currentSum === target) {
        const comboKey = currentList.map((x) => x.notransaksi).sort().join(",");
        if (!seenComboKeys.has(comboKey)) {
          seenComboKeys.add(comboKey);
          exactCombos.push([...currentList]);
        }
        return;
      }
      iterations++;
      if (iterations > maxIterations || (Date.now() - startTime) > 600) {
        return;
      }
      if (currentSum > target || currentList.length >= maxLen || exactCombos.length >= 6) {
        return;
      }
      for (let i = startIndex; i < candidates.length; i++) {
        const nextVal = Math.round(candidates[i].sisapiutang);
        if (currentSum + nextVal <= target) {
          searchSubset(i + 1, currentSum + nextVal, [...currentList, candidates[i]], maxLen);
          if (exactCombos.length >= 6 || iterations > maxIterations) break;
        }
      }
    }

    for (let len = 2; len <= 5; len++) {
      searchSubset(0, 0, [], len);
      if (exactCombos.length >= 5 || iterations > maxIterations) break;
    }

    for (const combo of exactCombos) {
      const sumVal = combo.reduce((s, it) => s + it.sisapiutang, 0);
      const isConsecutive = combo.length > 1 && combo.every((it, idx) => {
        if (idx === 0) return true;
        const prevNo = parseInt(combo[idx - 1].notransaksi.split("/")[0], 10);
        const currNo = parseInt(it.notransaksi.split("/")[0], 10);
        return !isNaN(prevNo) && !isNaN(currNo) && Math.abs(prevNo - currNo) <= 2;
      });

      scenarios.push({
        type: "EXACT_COMBINATION",
        title: `Kombinasi ${combo.length} Faktur (Tepat 100%) ${isConsecutive ? "• Nomor Berdampingan" : ""}`,
        description: `Kombinasi ${combo.length} faktur yang bila dijumlahkan menghasilkan nilai pas Rp ${sumVal.toLocaleString('id-ID')}`,
        invoiceCount: combo.length,
        totalAmount: sumVal,
        targetAmount: target,
        difference: 0,
        invoices: combo
      });
    }

    // 3. Monthly Batch Match (Rekapitulasi per Pelanggan per Bulan Kalender)
    const custMonthlyGroups: Record<string, { custKode: string; custNama: string; month: string; items: typeof invoices }> = {};
    for (const inv of invoices) {
      const m = inv.tanggal.slice(0, 7);
      const groupKey = `${inv.kodesupel}_${m}`;
      if (!custMonthlyGroups[groupKey]) {
        custMonthlyGroups[groupKey] = {
          custKode: inv.kodesupel,
          custNama: inv.namapelanggan,
          month: m,
          items: []
        };
      }
      custMonthlyGroups[groupKey].items.push(inv);
    }

    for (const group of Object.values(custMonthlyGroups)) {
      const mTotal = group.items.reduce((s, it) => s + it.sisapiutang, 0);
      const diff = Math.round(mTotal - target);

      if (diff === 0) {
        scenarios.push({
          type: "MONTHLY_BATCH",
          title: `Pelunasan 1 Bulan Penuh [${group.custNama}] - Periode ${group.month} (Tepat 100%)`,
          description: `Total seluruh ${group.items.length} faktur pelanggan ${group.custNama} pada bulan ${group.month} berjumlah pas Rp ${mTotal.toLocaleString('id-ID')}`,
          invoiceCount: group.items.length,
          totalAmount: mTotal,
          targetAmount: target,
          difference: 0,
          invoices: group.items
        });
      } else {
        // Cek apakah ada subset faktur dalam bulan ini yang pas dengan target menggunakan DP
        if (mTotal > target) {
          const matched = this.findExactSubsetDP(group.items, target);
          if (matched && matched.length > 0) {
            const sTotal = matched.reduce((s: number, it: any) => s + Math.round(Number(it.sisapiutang)), 0);
            const remainingMonthTotal = mTotal - sTotal;
            scenarios.push({
              type: "EXACT_COMBINATION",
              title: `Kombinasi ${matched.length} Faktur Bulan ${group.month} [${group.custNama}] (Tepat 100%)`,
              description: `Kombinasi ${matched.length} faktur dari periode ${group.month} yang bernilai pas Rp ${sTotal.toLocaleString('id-ID')}. Sisa tagihan bulan ini: Rp ${remainingMonthTotal.toLocaleString('id-ID')}`,
              invoiceCount: matched.length,
              totalAmount: sTotal,
              targetAmount: target,
              difference: 0,
              invoices: matched
            });
          }
        }

        if (Math.abs(diff) <= Math.max(tolerance, 50000)) {
          scenarios.push({
            type: "MONTHLY_BATCH",
            title: `Rekap Bulan ${group.month} [${group.custNama}] (Selisih Rp ${Math.abs(diff).toLocaleString('id-ID')})`,
            description: `Total seluruh ${group.items.length} faktur pelanggan ${group.custNama} bulan ${group.month} adalah Rp ${mTotal.toLocaleString('id-ID')} (${diff > 0 ? 'lebih tinggi' : 'lebih rendah'} Rp ${Math.abs(diff).toLocaleString('id-ID')})`,
            invoiceCount: group.items.length,
            totalAmount: mTotal,
            targetAmount: target,
            difference: diff,
            invoices: group.items
          });
        }
      }
    }

    // 4. Consecutive Block Match (Urutan Faktur Berurutan / FIFO)
    // Cek apakah ada rentang faktur berurutan dari pelanggan yang sama bernilai pas
    const byCustList: Record<string, typeof invoices> = {};
    for (const inv of invoices) {
      if (!byCustList[inv.kodesupel]) byCustList[inv.kodesupel] = [];
      byCustList[inv.kodesupel].push(inv);
    }

    for (const [cKode, cInvs] of Object.entries(byCustList)) {
      if (cInvs.length > 1) {
        const sorted = [...cInvs].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        for (let i = 0; i < sorted.length; i++) {
          let runningSum = 0;
          for (let j = i; j < sorted.length; j++) {
            runningSum += Math.round(sorted[j].sisapiutang);
            if (runningSum === target && (j - i + 1) >= 2) {
              const block = sorted.slice(i, j + 1);
              const alreadyExists = scenarios.some(
                (s) => s.invoiceCount === block.length && s.invoices[0]?.notransaksi === block[0]?.notransaksi
              );
              if (!alreadyExists) {
                scenarios.push({
                  type: "EXACT_COMBINATION",
                  title: `Urutan ${block.length} Faktur Berurutan [${block[0].namapelanggan}] (Tepat 100%)`,
                  description: `Rentang faktur berurutan dari tanggal ${block[0].tanggal} s/d ${block[block.length - 1].tanggal} berjumlah tepat Rp ${runningSum.toLocaleString('id-ID')}`,
                  invoiceCount: block.length,
                  totalAmount: runningSum,
                  targetAmount: target,
                  difference: 0,
                  invoices: block
                });
              }
              break;
            } else if (runningSum > target) {
              break;
            }
          }
        }
      }
    }

    // 4. Near Matches (Toleransi Selisih jika belum ada yang tepat atau dicari khusus)
    if (scenarios.length === 0 || tolerance > 0) {
      const effectiveTol = tolerance > 0 ? tolerance : 50000;
      // Single near
      for (const inv of invoices) {
        const diff = Math.round(inv.sisapiutang - target);
        if (Math.abs(diff) > 0 && Math.abs(diff) <= effectiveTol) {
          scenarios.push({
            type: "NEAR_MATCH",
            title: `Mendekati Faktur: ${inv.notransaksi}`,
            description: `Faktur nominal Rp ${inv.sisapiutang.toLocaleString('id-ID')} dengan selisih Rp ${Math.abs(diff).toLocaleString('id-ID')}`,
            invoiceCount: 1,
            totalAmount: inv.sisapiutang,
            targetAmount: target,
            difference: diff,
            invoices: [inv]
          });
        }
      }
    }

    // Urutkan skenario: Exact dulu (diff === 0), lalu invoiceCount terkecil
    scenarios.sort((a, b) => {
      if (Math.abs(a.difference) !== Math.abs(b.difference)) {
        return Math.abs(a.difference) - Math.abs(b.difference);
      }
      return a.invoiceCount - b.invoiceCount;
    });

    return {
      query: {
        amount: target,
        customerQuery: customerQuery || null,
        year: year || null,
        tolerance
      },
      totalUnpaidInvoicesFound: invoices.length,
      scenariosCount: scenarios.length,
      scenarios: scenarios.slice(0, 10),
      monthlyOverview: Object.values(custMonthlyGroups).map((g) => ({
        customer: g.custNama,
        month: g.month,
        invoiceCount: g.items.length,
        totalAmount: g.items.reduce((s, it) => s + it.sisapiutang, 0),
        differenceWithTarget: g.items.reduce((s, it) => s + it.sisapiutang, 0) - target
      }))
    };
  }
}
