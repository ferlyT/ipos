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
}
