import { db } from "../db";
import { sql } from "drizzle-orm";

export interface CashBankAccount {
  kodeacc: string;
  namaacc: string;
  kelompok: string;
  tipe: string;
  saldoAwal: number;
  totalDebet: number;
  totalKredit: number;
  saldoAkhir: number;
}

export interface CashInInput {
  kodekantor: string;
  kodeaccKasBank: string; // Rekening Kas/Bank tujuan penerimaan (Debit)
  kodeaccLawan: string;   // Akun pendapatan / modal / sumber penerimaan (Kredit)
  tanggal: Date | string;
  jumlah: number;
  keterangan: string;
  user: string;
}

export interface CashInResult {
  notransaksi: string;
  tanggal: string;
  kodekantor: string;
  kodeaccKasBank: string;
  namaKasBank: string;
  kodeaccLawan: string;
  namaLawan: string;
  jumlah: number;
  keterangan: string;
}

export interface CashOutInput {
  kodekantor: string;
  kodeaccKasBank: string; // Rekening Kas/Bank sumber dana (Kredit)
  kodeaccBiaya: string;   // Akun beban operasional / biaya (Debit)
  tanggal: Date | string;
  jumlah: number;
  keterangan: string;
  user: string;
}

export interface CashOutResult {
  notransaksi: string;
  tanggal: string;
  kodekantor: string;
  kodeaccKasBank: string;
  namaKasBank: string;
  kodeaccBiaya: string;
  namaBiaya: string;
  jumlah: number;
  keterangan: string;
}

export interface CashTransferInput {
  kodekantor: string;
  kodeaccAsal: string;   // Rekening Kas/Bank pengirim (Kredit)
  kodeaccTujuan: string; // Rekening Kas/Bank penerima (Debit)
  tanggal: Date | string;
  jumlah: number;
  keterangan?: string;
  user: string;
}

export interface CashTransferResult {
  notransaksi: string;
  tanggal: string;
  kodekantor: string;
  kodeaccAsal: string;
  namaAsal: string;
  kodeaccTujuan: string;
  namaTujuan: string;
  jumlah: number;
  keterangan: string;
}

export interface DepositInput {
  kodekantor: string;
  tipetrs: "DP" | "DB";  // DP = Deposit Pelanggan (Masuk), DB = Deposit Supplier (Keluar)
  kodesupel: string;
  kodeaccKasBank: string;
  tanggal: Date | string;
  jumlah: number;
  keterangan?: string;
  user: string;
}

export interface DepositResult {
  notransaksi: string;
  tipetrs: "DP" | "DB";
  kodesupel: string;
  namasupel: string;
  kodeaccKasBank: string;
  jumlah: number;
  keterangan: string;
}

export interface OpenDrawerInput {
  namaUser: string;
  shift: string;
  namaKomputer: string;
  kasAwal: number;
}

export interface CloseDrawerInput {
  notransaksi: string;
  kasFisik: number;
  user: string;
}

export interface DrawerShiftSummary {
  notransaksi: string;
  namaUser: string;
  shift: string;
  namaKomputer: string;
  wktMulai: string;
  wktAkhir: string | null;
  kasAwal: number;
  kasMasuk: number;
  kasKeluar: number;
  kasAkhirSistem: number;
  kasFisik: number | null;
  selisih: number | null;
  statusShift: "OPEN" | "CLOSED";
}

export class CashBankService {
  /**
   * Helper: Generate Transaction Number from tbl_formatnotr
   */
  private static async generateTransactionNumber(trid: string, kantor: string, client: any = db): Promise<string> {
    const rows = await client.execute(sql`
      SELECT trid, nomor::bigint, slot1, slot2, slot3, slot4, slot5, sep1, sep2, sep3, sep4, numdgt
      FROM tbl_formatnotr
      WHERE trid = ${trid} AND kantor = ${kantor}
      LIMIT 1;
    `);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const yyyy = String(now.getFullYear());
    const dd = String(now.getDate()).padStart(2, "0");

    if ((rows as any[]).length === 0) {
      const rand = Math.floor(Math.random() * 9000 + 1000);
      return `${rand}/${trid}/${kantor}/${mm}${yy}`;
    }

    const r = (rows as any[])[0];
    const nextNomor = Number(r.nomor || 0) + 1;
    const numdgt = Number(r.numdgt || 4);
    const cntStr = String(nextNomor).padStart(numdgt, "0");

    const resolveSlot = (slot: string | null) => {
      if (!slot) return "";
      let s = slot;
      s = s.replace(/\[CNT\]/gi, cntStr);
      s = s.replace(/\[DEPT\]/gi, kantor);
      s = s.replace(/\[BLNTHN\]/gi, `${mm}${yy}`);
      s = s.replace(/\[THNBLN\]/gi, `${yy}${mm}`);
      s = s.replace(/\[THN\]/gi, yy);
      s = s.replace(/\[THN4\]/gi, yyyy);
      s = s.replace(/\[BLN\]/gi, mm);
      s = s.replace(/\[HR\]/gi, dd);
      return s;
    };

    const s1 = resolveSlot(r.slot1);
    const s2 = resolveSlot(r.slot2);
    const s3 = resolveSlot(r.slot3);
    const s4 = resolveSlot(r.slot4);
    const s5 = resolveSlot(r.slot5);

    let notransaksi = s1;
    if (s2) notransaksi += (r.sep1 || "") + s2;
    if (s3) notransaksi += (r.sep2 || "") + s3;
    if (s4) notransaksi += (r.sep3 || "") + s4;
    if (s5) notransaksi += (r.sep4 || "") + s5;

    // Update counter di tbl_formatnotr
    await client.execute(sql`
      UPDATE tbl_formatnotr
      SET nomor = ${nextNomor}, notransaksi = ${notransaksi}
      WHERE trid = ${trid} AND kantor = ${kantor};
    `);

    return notransaksi;
  }

  /**
   * 1. LIST CASH & BANK ACCOUNTS WITH REAL-TIME BALANCES
   */
  static async listCashBankAccounts(client: any = db): Promise<CashBankAccount[]> {
    const rows = await client.execute(sql`
      WITH latest_sa AS (
        SELECT DISTINCT ON (kodeacc) kodeacc, jumlah
        FROM tbl_acc_sa
        ORDER BY kodeacc, tanggal DESC
      ),
      jurnal_totals AS (
        SELECT 
          kodeacc, 
          COALESCE(SUM(debet::numeric), 0) as total_debet, 
          COALESCE(SUM(kredit::numeric), 0) as total_kredit
        FROM tbl_accjurnal
        GROUP BY kodeacc
      )
      SELECT 
        p.kodeacc,
        p.namaacc,
        p.kelompok,
        p.tipe,
        COALESCE(sa.jumlah::numeric, 0) as saldo_awal,
        COALESCE(j.total_debet, 0) as total_debet,
        COALESCE(j.total_kredit, 0) as total_kredit
      FROM tbl_perkiraan p
      LEFT JOIN latest_sa sa ON p.kodeacc = sa.kodeacc
      LEFT JOIN jurnal_totals j ON p.kodeacc = j.kodeacc
      WHERE p.kodeacc LIKE '1-11%'
        AND p.tipe = 'D'
      ORDER BY p.kodeacc ASC;
    `);

    return (rows as any[]).map(r => {
      const sa = Number(r.saldo_awal || 0);
      const debet = Number(r.total_debet || 0);
      const kredit = Number(r.total_kredit || 0);
      const saldoAkhir = sa + debet - kredit;

      return {
        kodeacc: String(r.kodeacc).trim(),
        namaacc: String(r.namaacc).trim(),
        kelompok: String(r.kelompok).trim(),
        tipe: String(r.tipe).trim(),
        saldoAwal: Math.round(sa * 100) / 100,
        totalDebet: Math.round(debet * 100) / 100,
        totalKredit: Math.round(kredit * 100) / 100,
        saldoAkhir: Math.round(saldoAkhir * 100) / 100
      };
    });
  }

  /**
   * 2. RECORD CASH IN (KASI / KSIN)
   * Penerimaan kas/bank dari pendapatan lain, setoran modal, dll.
   */
  static async recordCashIn(input: CashInInput, client: any = db): Promise<CashInResult> {
    if (input.jumlah <= 0) {
      throw new Error("Nominal kas masuk harus lebih besar dari 0.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber("KASI", input.kodekantor, client);
    const tglStr = tgl.toISOString();

    // Validasi akun
    const accRows = await client.execute(sql`
      SELECT kodeacc, namaacc FROM tbl_perkiraan WHERE kodeacc IN (${input.kodeaccKasBank}, ${input.kodeaccLawan});
    `);
    const accMap = new Map((accRows as any[]).map(a => [String(a.kodeacc).trim(), String(a.namaacc).trim()]));
    const namaKasBank = accMap.get(input.kodeaccKasBank) || "Kas/Bank";
    const namaLawan = accMap.get(input.kodeaccLawan) || "Akun Lawan";

    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");
    const iddetailDt = `${datePrefix}KSIN${Math.floor(Math.random() * 90000000 + 10000000)}`;

    // 1. Simpan Header tbl_acckashd
    await client.execute(sql`
      INSERT INTO tbl_acckashd (
        notransaksi, kodekantor, kodeacc, tanggal, matauang, rate,
        tipe, jumlah, subtotal, keterangan, user1, dateupd, shiftkerja
      ) VALUES (
        ${notransaksi}, ${input.kodekantor}, ${input.kodeaccKasBank}, ${tglStr}::timestamp,
        'IDR', 1, 'KASI', ${input.jumlah}, ${input.jumlah}, ${input.keterangan},
        ${input.user}, NOW(), ''
      );
    `);

    // 2. Simpan Detail tbl_acckasdt
    await client.execute(sql`
      INSERT INTO tbl_acckasdt (
        iddetail, nobaris, notransaksi, kodeacc, matauang, rate, jumlah, dateupd
      ) VALUES (
        ${iddetailDt}, 1, ${notransaksi}, ${input.kodeaccLawan}, 'IDR', 1, ${input.jumlah}, NOW()
      );
    `);

    // 3. Posting Jurnal ke tbl_accjurnal
    // Line 1: [Dr] Kas/Bank
    const jId1 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId1}, 1, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccKasBank}, 'Jurnal',
        ${input.keterangan || "Kas Masuk"}, 'IDR', 1, ${input.jumlah}, 'D', ${input.jumlah}, 0, ${input.kodekantor}
      );
    `);

    // Line 2: [Cr] Akun Lawan
    const jId2 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId2}, 2, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccLawan}, 'Jurnal',
        ${input.keterangan || "Kas Masuk"}, 'IDR', 1, ${input.jumlah}, 'K', 0, ${input.jumlah}, ${input.kodekantor}
      );
    `);

    return {
      notransaksi,
      tanggal: tglStr,
      kodekantor: input.kodekantor,
      kodeaccKasBank: input.kodeaccKasBank,
      namaKasBank,
      kodeaccLawan: input.kodeaccLawan,
      namaLawan,
      jumlah: input.jumlah,
      keterangan: input.keterangan
    };
  }

  /**
   * 3. RECORD CASH OUT (KASO)
   * Pengeluaran biaya operasional (listrik, air, gaji, bensin, dll).
   */
  static async recordCashOut(input: CashOutInput, client: any = db): Promise<CashOutResult> {
    if (input.jumlah <= 0) {
      throw new Error("Nominal kas keluar harus lebih besar dari 0.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber("KASO", input.kodekantor, client);
    const tglStr = tgl.toISOString();

    // Validasi akun
    const accRows = await client.execute(sql`
      SELECT kodeacc, namaacc FROM tbl_perkiraan WHERE kodeacc IN (${input.kodeaccKasBank}, ${input.kodeaccBiaya});
    `);
    const accMap = new Map((accRows as any[]).map(a => [String(a.kodeacc).trim(), String(a.namaacc).trim()]));
    const namaKasBank = accMap.get(input.kodeaccKasBank) || "Kas/Bank";
    const namaBiaya = accMap.get(input.kodeaccBiaya) || "Beban Operasional";

    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");
    const iddetailDt = `${datePrefix}KASO${Math.floor(Math.random() * 90000000 + 10000000)}`;

    // 1. Simpan Header tbl_acckashd
    await client.execute(sql`
      INSERT INTO tbl_acckashd (
        notransaksi, kodekantor, kodeacc, tanggal, matauang, rate,
        tipe, jumlah, subtotal, keterangan, user1, dateupd, shiftkerja
      ) VALUES (
        ${notransaksi}, ${input.kodekantor}, ${input.kodeaccKasBank}, ${tglStr}::timestamp,
        'IDR', 1, 'KASO', ${input.jumlah}, ${input.jumlah}, ${input.keterangan},
        ${input.user}, NOW(), ''
      );
    `);

    // 2. Simpan Detail tbl_acckasdt
    await client.execute(sql`
      INSERT INTO tbl_acckasdt (
        iddetail, nobaris, notransaksi, kodeacc, matauang, rate, jumlah, dateupd
      ) VALUES (
        ${iddetailDt}, 1, ${notransaksi}, ${input.kodeaccBiaya}, 'IDR', 1, ${input.jumlah}, NOW()
      );
    `);

    // 3. Posting Jurnal ke tbl_accjurnal
    // Line 1: [Dr] Biaya Operasional
    const jId1 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId1}, 1, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccBiaya}, 'Jurnal',
        ${input.keterangan || "Kas Keluar"}, 'IDR', 1, ${input.jumlah}, 'D', ${input.jumlah}, 0, ${input.kodekantor}
      );
    `);

    // Line 2: [Cr] Kas/Bank
    const jId2 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId2}, 2, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccKasBank}, 'Jurnal',
        ${input.keterangan || "Kas Keluar"}, 'IDR', 1, ${input.jumlah}, 'K', 0, ${input.jumlah}, ${input.kodekantor}
      );
    `);

    return {
      notransaksi,
      tanggal: tglStr,
      kodekantor: input.kodekantor,
      kodeaccKasBank: input.kodeaccKasBank,
      namaKasBank,
      kodeaccBiaya: input.kodeaccBiaya,
      namaBiaya,
      jumlah: input.jumlah,
      keterangan: input.keterangan
    };
  }

  /**
   * 4. TRANSFER CASH & BANK (KASTR)
   * Mutasi dana antar rekening (misal: Kas Toko -> Rekening BCA).
   */
  static async transferCashBank(input: CashTransferInput, client: any = db): Promise<CashTransferResult> {
    if (input.kodeaccAsal.trim() === input.kodeaccTujuan.trim()) {
      throw new Error("Rekening kas asal dan tujuan transfer tidak boleh sama.");
    }
    if (input.jumlah <= 0) {
      throw new Error("Nominal mutasi kas/bank harus lebih besar dari 0.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber("KASTR", input.kodekantor, client);
    const tglStr = tgl.toISOString();

    const accRows = await client.execute(sql`
      SELECT kodeacc, namaacc FROM tbl_perkiraan WHERE kodeacc IN (${input.kodeaccAsal}, ${input.kodeaccTujuan});
    `);
    const accMap = new Map((accRows as any[]).map(a => [String(a.kodeacc).trim(), String(a.namaacc).trim()]));
    const namaAsal = accMap.get(input.kodeaccAsal) || "Rekening Asal";
    const namaTujuan = accMap.get(input.kodeaccTujuan) || "Rekening Tujuan";

    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");
    const iddetailDt = `${datePrefix}KASTR${Math.floor(Math.random() * 90000000 + 10000000)}`;

    // 1. Simpan Header tbl_acckashd
    await client.execute(sql`
      INSERT INTO tbl_acckashd (
        notransaksi, kodekantor, kodeacc, tanggal, matauang, rate,
        tipe, jumlah, subtotal, keterangan, user1, dateupd, shiftkerja
      ) VALUES (
        ${notransaksi}, ${input.kodekantor}, ${input.kodeaccAsal}, ${tglStr}::timestamp,
        'IDR', 1, 'KASTR', ${input.jumlah}, ${input.jumlah}, ${input.keterangan || "Transfer Kas/Bank"},
        ${input.user}, NOW(), ''
      );
    `);

    // 2. Simpan Detail tbl_acckasdt
    await client.execute(sql`
      INSERT INTO tbl_acckasdt (
        iddetail, nobaris, notransaksi, kodeacc, matauang, rate, jumlah, dateupd
      ) VALUES (
        ${iddetailDt}, 1, ${notransaksi}, ${input.kodeaccTujuan}, 'IDR', 1, ${input.jumlah}, NOW()
      );
    `);

    // 3. Posting Jurnal ke tbl_accjurnal
    // Line 1: [Dr] Rekening Penerima
    const jId1 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId1}, 1, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccTujuan}, 'Jurnal',
        ${input.keterangan || "Mutasi Kas/Bank"}, 'IDR', 1, ${input.jumlah}, 'D', ${input.jumlah}, 0, ${input.kodekantor}
      );
    `);

    // Line 2: [Cr] Rekening Pengirim
    const jId2 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
    await client.execute(sql`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis,
        keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor
      ) VALUES (
        ${jId2}, 2, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccAsal}, 'Jurnal',
        ${input.keterangan || "Mutasi Kas/Bank"}, 'IDR', 1, ${input.jumlah}, 'K', 0, ${input.jumlah}, ${input.kodekantor}
      );
    `);

    return {
      notransaksi,
      tanggal: tglStr,
      kodekantor: input.kodekantor,
      kodeaccAsal: input.kodeaccAsal,
      namaAsal,
      kodeaccTujuan: input.kodeaccTujuan,
      namaTujuan,
      jumlah: input.jumlah,
      keterangan: input.keterangan || "Transfer Kas/Bank"
    };
  }

  /**
   * 5. RECORD DEPOSIT (DP Pelanggan / DB Supplier)
   */
  static async recordDeposit(input: DepositInput, client: any = db): Promise<DepositResult> {
    if (input.jumlah <= 0) {
      throw new Error("Nominal deposit harus lebih besar dari 0.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber(input.tipetrs, input.kodekantor, client);
    const tglStr = tgl.toISOString();

    const supRows = await client.execute(sql`
      SELECT nama FROM tbl_supel WHERE kode = ${input.kodesupel} LIMIT 1;
    `);
    const namasupel = (supRows as any[]).length > 0 ? String((supRows as any[])[0].nama).trim() : "Mitra";

    // Akun penampung uang muka (Uang Muka Pesanan Penjualan '2-3100' atau Uang Muka Pesanan Pembelian '1-9100')
    const accDeposit = input.tipetrs === "DP" ? "2-3100" : "1-9100";
    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");
    const iddetailDt = `${datePrefix}DEP${Math.floor(Math.random() * 90000000 + 10000000)}`;

    // 1. Simpan Header tbl_accdeposithd
    await client.execute(sql`
      INSERT INTO tbl_accdeposithd (
        notransaksi, kodekantor, kodeacc, tanggal, matauang, rate,
        tipe, jumlah, keterangan, user1, dateupd, shiftkerja, kodesupel, tipetrs, bc_trf_sts
      ) VALUES (
        ${notransaksi}, ${input.kodekantor}, ${input.kodeaccKasBank}, ${tglStr}::timestamp,
        'IDR', 1, ${input.tipetrs}, ${input.jumlah}, ${input.keterangan || "Deposit"},
        ${input.user}, NOW(), '', ${input.kodesupel}, ${input.tipetrs}, false
      );
    `);

    // 2. Simpan Detail tbl_accdepositdt
    await client.execute(sql`
      INSERT INTO tbl_accdepositdt (
        iddetail, nobaris, notransaksi, kodeacc, matauang, rate, jumlah, dateupd
      ) VALUES (
        ${iddetailDt}, 1, ${notransaksi}, ${accDeposit}, 'IDR', 1, ${input.jumlah}, NOW()
      );
    `);

    // 3. Posting Jurnal
    if (input.tipetrs === "DP") {
      // Pelanggan setor DP: [Dr] Kas/Bank, [Cr] Hutang DP Pelanggan
      const j1 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
      const j2 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
      await client.execute(sql`
        INSERT INTO tbl_accjurnal (iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis, keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor)
        VALUES (${j1}, 1, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccKasBank}, 'Jurnal', 'Deposit Pelanggan', 'IDR', 1, ${input.jumlah}, 'D', ${input.jumlah}, 0, ${input.kodekantor});
      `);
      await client.execute(sql`
        INSERT INTO tbl_accjurnal (iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis, keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor)
        VALUES (${j2}, 2, 'R', ${notransaksi}, ${tglStr}::timestamp, ${accDeposit}, 'Jurnal', 'Deposit Pelanggan', 'IDR', 1, ${input.jumlah}, 'K', 0, ${input.jumlah}, ${input.kodekantor});
      `);
    } else {
      // Toko bayar DP ke supplier: [Dr] Uang Muka Beli, [Cr] Kas/Bank
      const j1 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
      const j2 = `${datePrefix}JUR${Math.floor(Math.random() * 90000000 + 10000000)}`;
      await client.execute(sql`
        INSERT INTO tbl_accjurnal (iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis, keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor)
        VALUES (${j1}, 1, 'R', ${notransaksi}, ${tglStr}::timestamp, ${accDeposit}, 'Jurnal', 'Deposit Supplier', 'IDR', 1, ${input.jumlah}, 'D', ${input.jumlah}, 0, ${input.kodekantor});
      `);
      await client.execute(sql`
        INSERT INTO tbl_accjurnal (iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc, jenis, keterangan, matauang, rate, jumlah, posisi, debet, kredit, kantor)
        VALUES (${j2}, 2, 'R', ${notransaksi}, ${tglStr}::timestamp, ${input.kodeaccKasBank}, 'Jurnal', 'Deposit Supplier', 'IDR', 1, ${input.jumlah}, 'K', 0, ${input.jumlah}, ${input.kodekantor});
      `);
    }

    return {
      notransaksi,
      tipetrs: input.tipetrs,
      kodesupel: input.kodesupel,
      namasupel,
      kodeaccKasBank: input.kodeaccKasBank,
      jumlah: input.jumlah,
      keterangan: input.keterangan || "Deposit"
    };
  }

  /**
   * 6. OPEN CASH DRAWER (Buka Shift Kasir dengan Modal Awal)
   */
  static async openCashDrawer(input: OpenDrawerInput, client: any = db): Promise<DrawerShiftSummary> {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const notransaksi = `SHF-${yy}${mm}-${rand}`;

    await client.execute(sql`
      INSERT INTO tbl_kaslaci (
        nama_user, shift, kas_awal, kas_masuk, kas_keluar, kas_akhir,
        wkt_mulai, wkt_akhir, login_flag, nama_komputer, notransaksi
      ) VALUES (
        ${input.namaUser}, ${input.shift}, ${input.kasAwal}, 0, 0, ${input.kasAwal},
        NOW(), null, true, ${input.namaKomputer}, ${notransaksi}
      );
    `);

    return {
      notransaksi,
      namaUser: input.namaUser,
      shift: input.shift,
      namaKomputer: input.namaKomputer,
      wktMulai: now.toISOString(),
      wktAkhir: null,
      kasAwal: input.kasAwal,
      kasMasuk: 0,
      kasKeluar: 0,
      kasAkhirSistem: input.kasAwal,
      kasFisik: null,
      selisih: null,
      statusShift: "OPEN"
    };
  }

  /**
   * 7. CLOSE CASH DRAWER & RECONCILE (Tutup Shift Kasir & Hitung Selisih Fisik)
   */
  static async closeCashDrawer(input: CloseDrawerInput, client: any = db): Promise<DrawerShiftSummary> {
    const rows = await client.execute(sql`
      SELECT * FROM tbl_kaslaci WHERE notransaksi = ${input.notransaksi} LIMIT 1;
    `);

    if ((rows as any[]).length === 0) {
      throw new Error(`Sesi laci kasir dengan notransaksi ${input.notransaksi} tidak ditemukan.`);
    }

    const row = (rows as any[])[0];
    const kasAwal = Number(row.kas_awal || 0);
    const kasMasuk = Number(row.kas_masuk || 0);
    const kasKeluar = Number(row.kas_keluar || 0);
    const kasAkhirSistem = kasAwal + kasMasuk - kasKeluar;
    const selisih = input.kasFisik - kasAkhirSistem;

    const now = new Date();

    await client.execute(sql`
      UPDATE tbl_kaslaci
      SET 
        kas_akhir = ${kasAkhirSistem},
        wkt_akhir = NOW(),
        login_flag = false
      WHERE notransaksi = ${input.notransaksi};
    `);

    return {
      notransaksi: String(row.notransaksi).trim(),
      namaUser: String(row.nama_user).trim(),
      shift: String(row.shift || "1").trim(),
      namaKomputer: String(row.nama_komputer || "POS").trim(),
      wktMulai: row.wkt_mulai ? new Date(row.wkt_mulai).toISOString() : now.toISOString(),
      wktAkhir: now.toISOString(),
      kasAwal,
      kasMasuk,
      kasKeluar,
      kasAkhirSistem: Math.round(kasAkhirSistem * 100) / 100,
      kasFisik: Math.round(input.kasFisik * 100) / 100,
      selisih: Math.round(selisih * 100) / 100,
      statusShift: "CLOSED"
    };
  }

  /**
   * 8. LIST HISTORICAL CASH DRAWER SHIFTS
   */
  static async listDrawerShifts(limit: number = 50): Promise<DrawerShiftSummary[]> {
    const rows = await db.execute(sql`
      SELECT 
        l.notransaksi,
        l.nama_user,
        l.shift,
        l.kas_awal::numeric,
        l.kas_masuk::numeric,
        l.kas_keluar::numeric,
        l.kas_akhir::numeric,
        l.wkt_mulai,
        l.wkt_akhir,
        l.login_flag,
        l.nama_komputer
      FROM tbl_kaslaci l
      ORDER BY l.wkt_mulai DESC
      LIMIT ${limit};
    `);

    return (rows as any[]).map(r => {
      const kasAwal = Number(r.kas_awal || 0);
      const kasMasuk = Number(r.kas_masuk || 0);
      const kasKeluar = Number(r.kas_keluar || 0);
      const kasAkhirSistem = kasAwal + kasMasuk - kasKeluar;
      const isOpen = Boolean(r.login_flag);

      return {
        notransaksi: String(r.notransaksi).trim(),
        namaUser: String(r.nama_user || "KASIR").trim(),
        shift: String(r.shift || "1").trim(),
        namaKomputer: String(r.nama_komputer || "POS").trim(),
        wktMulai: r.wkt_mulai ? new Date(r.wkt_mulai).toISOString() : new Date().toISOString(),
        wktAkhir: r.wkt_akhir ? new Date(r.wkt_akhir).toISOString() : null,
        kasAwal,
        kasMasuk,
        kasKeluar,
        kasAkhirSistem,
        kasFisik: r.wkt_akhir ? Number(r.kas_akhir || 0) : null,
        selisih: r.wkt_akhir ? Number(r.kas_akhir || 0) - kasAkhirSistem : null,
        statusShift: isOpen ? "OPEN" : "CLOSED"
      };
    });
  }
}
