import postgres from "postgres";

export interface PurchaseItemInput {
  kodeitem: string;
  jumlah: number;
  satuan: string;
  harga: number;
  potonganPersen: number;
}

export interface PurchaseInvoiceInput {
  notransaksi: string;
  kodekantor: string;
  kodesupel: string;
  tanggal: Date;
  items: PurchaseItemInput[];
  potonganNota: number;
  pajakPersen: number; // 0 atau 11
  biayalain: number;
  carabayar: "TN" | "KD"; // Tunai atau Kredit
  terminHari: number; // misal 30 hari
  user: string;
}

export interface DebtPaymentAllocation {
  notrsmasuk: string; // Nomor faktur BL yang dilunasi
  bayarNominal: number;
  potonganNominal: number;
}

export interface DebtPaymentInput {
  notransaksi: string; // Format: .../BH/...
  kodekantor: string;
  kodesupel: string;
  tanggal: Date;
  accBayar: string; // Akun Kas (1-1110) atau Bank (1-1120)
  carabayar: string; // 'TN', 'TF', 'BG'
  alokasi: DebtPaymentAllocation[];
  user: string;
}

export class PurchasingPayableService {
  constructor(private sql: postgres.Sql) {}

  /**
   * 1. MEMBUAT FAKTUR PEMBELIAN BARU (PURCHASE INVOICE)
   * Menyimpan tbl_imhd, tbl_imdt, menambah stok fisik, batch FIFO, dan menjurnal.
   */
  async createPurchaseInvoice(input: PurchaseInvoiceInput) {
    return await this.sql.begin(async (tx) => {
      // 1. Ambil Pengaturan Akun
      const settings = await tx`
        SELECT accsetting, kodeacc FROM tbl_perksetting WHERE acckantor = ${input.kodekantor}
      `;
      const accMap = new Map<string, string>();
      for (const s of settings) accMap.set(s.accsetting, s.kodeacc);

      let subtotal = 0;
      const detailInserts = [];

      // 2. Hitung Detail Item & Alokasikan ke Persediaan
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const lineNet = item.jumlah * item.harga * (1 - item.potonganPersen / 100);
        subtotal += lineNet;

        detailInserts.push({
          iddetail: `${input.notransaksi}-${i + 1}`,
          nobaris: i + 1,
          notransaksi: input.notransaksi,
          kodeitem: item.kodeitem,
          jumlah: item.jumlah,
          satuan: item.satuan,
          harga: item.harga,
          potongan: item.potonganPersen,
          total: lineNet,
        });

        // Update Stok Fisik
        await tx`
          UPDATE tbl_itemstok 
          SET jmlstok = jmlstok + ${item.jumlah}
          WHERE kodeitem = ${item.kodeitem} AND kodekantor = ${input.kodekantor}
        `;

        // Masukkan ke Batch Antrean Masuk FIFO
        await tx`
          INSERT INTO tbl_item_im (
            notransaksi, kodekantor, tanggal, kodeitem, jumlah, sisa, hargasatuan
          ) VALUES (
            ${input.notransaksi}, ${input.kodekantor}, ${input.tanggal}, 
            ${item.kodeitem}, ${item.jumlah}, ${item.jumlah}, ${item.harga}
          )
        `;
      }

      // Hitung Pajak dan Total Akhir
      const dpp = subtotal - input.potonganNota;
      const nilaiPajak = input.pajakPersen > 0 ? (dpp * input.pajakPersen) / 100 : 0;
      const totalakhir = dpp + nilaiPajak + input.biayalain;

      const isKredit = input.carabayar === "KD";
      const jmltunai = isKredit ? 0 : totalakhir;
      const jmlkredit = isKredit ? totalakhir : 0;
      const jatuhTempo = new Date(input.tanggal);
      jatuhTempo.setDate(jatuhTempo.getDate() + input.terminHari);

      // 3. Simpan Header tbl_imhd
      await tx`
        INSERT INTO tbl_imhd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, subtotal, potnomfaktur, 
          pajak, biayalain, totalakhir, carabayar, jmltunai, jmlkredit, byr_krd_jt, 
          krd_jml_byr, krd_jml_pot, user1
        ) VALUES (
          ${input.notransaksi}, ${input.kodekantor}, ${input.tanggal}, 'BL', 
          ${input.kodesupel}, ${subtotal}, ${input.potonganNota}, ${nilaiPajak}, 
          ${input.biayalain}, ${totalakhir}, ${input.carabayar}, ${jmltunai}, 
          ${jmlkredit}, ${isKredit ? jatuhTempo : null}, 0, 0, ${input.user}
        )
      `;

      // Simpan Baris Detail tbl_imdt
      for (const d of detailInserts) {
        await tx`
          INSERT INTO tbl_imdt (
            iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total
          ) VALUES (
            ${d.iddetail}, ${d.nobaris}, ${d.notransaksi}, ${d.kodeitem}, ${d.jumlah}, 
            ${d.satuan}, ${d.harga}, ${d.potongan}, ${d.total}
          )
        `;
      }

      // 4. Buat Jurnal Akuntansi Berimbang
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

      // [D] Persediaan Barang Dagang
      await insertJurnal(accMap.get("ACC_ITEM_PERS") || "1-1301", subtotal, 0, `Pembelian: ${input.notransaksi}`);
      // [D] PPN Masukan (jika ada)
      if (nilaiPajak > 0) {
        await insertJurnal(accMap.get("ACC_BELI_PAJAK") || "1-1410", nilaiPajak, 0, `PPN Masukan: ${input.notransaksi}`);
      }
      // [K] Hutang Dagang atau Kas
      const accLawan = isKredit ? (accMap.get("ACC_BELI_KREDIT") || "2-1101") : (accMap.get("ACC_BELI_TUNAI") || "1-1110");
      await insertJurnal(accLawan, 0, totalakhir, `Tagihan Pembelian: ${input.notransaksi}`);
      // [K] Potongan Pembelian
      if (input.potonganNota > 0) {
        await insertJurnal(accMap.get("ACC_BELI_POT") || "1-1390", 0, input.potonganNota, `Potongan Pembelian: ${input.notransaksi}`);
      }

      return {
        success: true,
        notransaksi: input.notransaksi,
        totalakhir,
        jatuhTempo: isKredit ? jatuhTempo : null
      };
    });
  }

  /**
   * 2. MENGAMBIL DAFTAR FAKTUR HUTANG YANG BELUM LUNAS
   */
  async getOutstandingInvoices(supplierCode?: string, kantor: string = "UTM") {
    return await this.sql`
      SELECT 
        i.notransaksi, i.tanggal, i.kodesupel, s.nama as namasupel,
        i.totalakhir, i.jmlkredit, i.krd_jml_byr, i.krd_jml_pot,
        (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) as sisahutang,
        i.byr_krd_jt as jatuhtempo,
        CURRENT_DATE - i.byr_krd_jt::date as hariketerlambatan
      FROM tbl_imhd i
      LEFT JOIN tbl_supel s ON i.kodesupel = s.kode
      WHERE i.tipe = 'BL' 
        AND i.kodekantor = ${kantor}
        AND (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) > 0
        ${supplierCode ? this.sql`AND i.kodesupel = ${supplierCode}` : this.sql``}
      ORDER BY i.byr_krd_jt ASC
    `;
  }

  /**
   * 3. PEMBAYARAN HUTANG KE SUPPLIER (PAY DEBT)
   */
  async paySupplierDebt(input: DebtPaymentInput) {
    return await this.sql.begin(async (tx) => {
      let totalBayar = 0;
      let totalPotongan = 0;

      for (const alok of input.alokasi) {
        totalBayar += alok.bayarNominal;
        totalPotongan += alok.potonganNominal;

        // Ambil saldo awal faktur
        const [faktur] = await tx`
          SELECT totalakhir, krd_jml_byr, krd_jml_pot 
          FROM tbl_imhd 
          WHERE notransaksi = ${alok.notrsmasuk}
          FOR UPDATE
        `;

        if (!faktur) throw new Error(`Faktur ${alok.notrsmasuk} tidak ditemukan.`);

        const saldoAwal = Number(faktur.totalakhir) - Number(faktur.krd_jml_byr) - Number(faktur.krd_jml_pot);
        const sisaAkhir = saldoAwal - alok.bayarNominal - alok.potonganNominal;

        // Simpan Detail Alokasi tbl_byrhutangdt
        await tx`
          INSERT INTO tbl_byrhutangdt (
            iddetail, notransaksi, notrsmasuk, tipe, matauang, ratetrs, 
            jmlkredit, krd_jml_pot, krd_total, krd_jml_byr
          ) VALUES (
            ${input.notransaksi + '-' + alok.notrsmasuk}, ${input.notransaksi}, 
            ${alok.notrsmasuk}, 'BL', 'IDR', 1.0, ${saldoAwal}, 
            ${alok.potonganNominal}, ${sisaAkhir}, ${alok.bayarNominal}
          )
        `;

        // Update Akumulasi Pembayaran di Faktur Pembelian tbl_imhd
        await tx`
          UPDATE tbl_imhd 
          SET krd_jml_byr = krd_jml_byr + ${alok.bayarNominal},
              krd_jml_pot = krd_jml_pot + ${alok.potonganNominal}
          WHERE notransaksi = ${alok.notrsmasuk}
        `;
      }

      // Simpan Header tbl_byrhutanghd
      await tx`
        INSERT INTO tbl_byrhutanghd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, totalbayar, 
          acc_bayar, carabayar, user1, stslunas
        ) VALUES (
          ${input.notransaksi}, ${input.kodekantor}, ${input.tanggal}, 'BH', 
          ${input.kodesupel}, ${totalBayar}, ${input.accBayar}, 
          ${input.carabayar}, ${input.user}, true
        )
      `;

      // Buat Jurnal Akuntansi Pelunasan Hutang
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

      // [D] Hutang Dagang (2-1101)
      await insertJurnal("2-1101", totalBayar + totalPotongan, 0, `Pembayaran Hutang: ${input.notransaksi}`);
      // [K] Kas / Bank Pembayar (1-1110 / 1-1120)
      await insertJurnal(input.accBayar, 0, totalBayar, `Kas Keluar Pelunasan: ${input.notransaksi}`);
      // [K] Potongan Hutang (5-1200) jika ada diskon pelunasan
      if (totalPotongan > 0) {
        await insertJurnal("5-1200", 0, totalPotongan, `Potongan Pelunasan Hutang: ${input.notransaksi}`);
      }

      return {
        success: true,
        notransaksi: input.notransaksi,
        totalBayar,
        totalPotongan
      };
    });
  }

  /**
   * 4. LAPORAN ANALISA UMUR HUTANG (AGING SCHEDULE)
   */
  async getAgingReport(asOfDate: Date = new Date(), kantor: string = "UTM") {
    return await this.sql`
      SELECT 
        s.kode as kodesupel,
        s.nama as namasupel,
        s.telepon,
        COALESCE(SUM(CASE WHEN (i.byr_krd_jt::date - ${asOfDate}::date) >= 0 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as belum_jatuh_tempo,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - i.byr_krd_jt::date) BETWEEN 1 AND 30 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_1_30,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - i.byr_krd_jt::date) BETWEEN 31 AND 60 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_31_60,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - i.byr_krd_jt::date) BETWEEN 61 AND 90 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as hari_61_90,
        COALESCE(SUM(CASE WHEN (${asOfDate}::date - i.byr_krd_jt::date) > 90 THEN (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) ELSE 0 END), 0) as lebih_90_hari,
        COALESCE(SUM(i.totalakhir - i.krd_jml_byr - i.krd_jml_pot), 0) as total_hutang
      FROM tbl_supel s
      JOIN tbl_imhd i ON s.kode = i.kodesupel
      WHERE i.tipe = 'BL' 
        AND i.kodekantor = ${kantor}
        AND (i.totalakhir - i.krd_jml_byr - i.krd_jml_pot) > 0
      GROUP BY s.kode, s.nama, s.telepon
      ORDER BY total_hutang DESC
    `;
  }
}
