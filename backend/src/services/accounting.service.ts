import { db } from "../db";
import { sql } from "drizzle-orm";

export interface ReportItem {
  urut: number;
  kodeacc: string;
  tipeacc: "H" | "D" | "TH";
  level: number;
  nama: string;
  nilai: number | null;
}

export class AccountingService {
  /**
   * Mengambil Laporan Laba Rugi dari database iPos 4
   */
  static async getLabaRugi(
    startDate: string,
    endDate: string,
    userId = `api_${Date.now()}`
  ): Promise<ReportItem[]> {
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    // 1. Eksekusi Stored Procedure Laba Rugi
    await db.execute(sql`
      SELECT acc_genrep_labarugi(
        ${start}::timestamp,
        ${start}::timestamp,
        ${start}::timestamp,
        ${end}::timestamp,
        ${userId},
        'IDR',
        1,
        2
      );
    `);

    // 2. Query hasil dari tabel sementara
    const rows = await db.execute<any>(sql`
      SELECT 
        urut,
        kodeacc,
        tipeacc,
        setsub as level,
        COALESCE(sub1, sub2, sub3, sub4, sub5, sub6, '') AS nama,
        nilai
      FROM tbl_acc_tmplrnr
      WHERE usergen = ${userId}
      ORDER BY urut;
    `);

    // 3. Bersihkan data temporer
    await db.execute(sql`DELETE FROM tbl_acc_tmplrnr WHERE usergen = ${userId};`);
    await db.execute(sql`DELETE FROM tbl_acctmpns WHERE usergen = ${userId};`);

    return rows.map((r: any) => ({
      urut: Number(r.urut),
      kodeacc: String(r.kodeacc || ""),
      tipeacc: r.tipeacc,
      level: Number(r.level || 1),
      nama: String(r.nama || ""),
      nilai: r.nilai !== null ? Number(r.nilai) : null,
    }));
  }

  /**
   * Mengambil Laporan Neraca dari database iPos 4
   */
  static async getNeraca(
    startDate: string,
    endDate: string,
    userId = `api_${Date.now()}`
  ): Promise<ReportItem[]> {
    const endYear = (endDate || startDate).substring(0, 4);
    const startYear = `${endYear}-01-01 00:00:00`;
    const endPeriod = `${endDate} 23:59:59`;

    // 1. Eksekusi Stored Procedure Neraca
    // Di iPos 4, neraca dihitung per tanggal akhir (endPeriod).
    // Parameter saakhir dan pawal harus menggunakan endPeriod agar stored procedure
    // proseslap_ns mengakumulasi pendapatan dan biaya tahun berjalan ke akun ACC_LABAJALAN (3-3000).
    await db.execute(sql`
      SELECT acc_genrep_neraca(
        ${startYear}::timestamp,
        ${endPeriod}::timestamp,
        ${endPeriod}::timestamp,
        ${endPeriod}::timestamp,
        ${userId},
        'IDR',
        1,
        2
      );
    `);

    // 2. Query hasil dari tabel sementara
    const rows = await db.execute<any>(sql`
      SELECT 
        urut,
        kodeacc,
        tipeacc,
        setsub as level,
        COALESCE(sub1, sub2, sub3, sub4, sub5, sub6, '') AS nama,
        nilai
      FROM tbl_acc_tmplrnr
      WHERE usergen = ${userId}
      ORDER BY urut;
    `);

    // 3. Bersihkan data temporer
    await db.execute(sql`DELETE FROM tbl_acc_tmplrnr WHERE usergen = ${userId};`);
    await db.execute(sql`DELETE FROM tbl_acctmpns WHERE usergen = ${userId};`);

    return rows.map((r: any) => ({
      urut: Number(r.urut),
      kodeacc: String(r.kodeacc || ""),
      tipeacc: r.tipeacc,
      level: Number(r.level || 1),
      nama: String(r.nama || ""),
      nilai: r.nilai !== null ? Number(r.nilai) : null,
    }));
  }

  /**
   * Mengambil Laporan Buku Besar untuk 1 akun
   */
  static async getBukuBesar(
    kodeacc: string,
    startDate: string,
    endDate: string
  ) {
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    // 1. Ambil info akun
    const accInfo = await db.execute<any>(sql`
      SELECT kodeacc, namaacc, kelompok, tipe
      FROM tbl_perkiraan
      WHERE kodeacc = ${kodeacc};
    `);

    if (accInfo.length === 0) {
      throw new Error(`Akun dengan kode ${kodeacc} tidak ditemukan.`);
    }

    const { kelompok } = accInfo[0];
    const isNormalDebit = ["1", "5", "6", "8"].includes(kelompok);

    // 2. Hitung Saldo Awal sebelum periode
    const saMaster = await db.execute<any>(sql`
      SELECT COALESCE(SUM(jumlah), 0) AS nominal
      FROM tbl_acc_sa
      WHERE kodeacc = ${kodeacc} AND tanggal < ${start}::timestamp;
    `);

    const mutasiLalu = await db.execute<any>(sql`
      SELECT 
        COALESCE(SUM(debet), 0) AS tot_debet,
        COALESCE(SUM(kredit), 0) AS tot_kredit
      FROM tbl_accjurnal
      WHERE kodeacc = ${kodeacc} AND tanggal < ${start}::timestamp;
    `);

    const debetLalu = Number(mutasiLalu[0].tot_debet);
    const kreditLalu = Number(mutasiLalu[0].tot_kredit);
    const saNominal = Number(saMaster[0].nominal);

    const saldoAwal = isNormalDebit
      ? saNominal + (debetLalu - kreditLalu)
      : saNominal + (kreditLalu - debetLalu);

    // 3. Ambil Mutasi Jurnal Periode
    const mutasi = await db.execute<any>(sql`
      SELECT 
        notransaksi,
        tanggal,
        keterangan,
        debet::float,
        kredit::float,
        jenis
      FROM tbl_accjurnal
      WHERE kodeacc = ${kodeacc} 
        AND tanggal BETWEEN ${start}::timestamp AND ${end}::timestamp
      ORDER BY tanggal, nourut;
    `);

    // 4. Hitung Running Balance
    let currentBalance = saldoAwal;
    const items = mutasi.map((m: any) => {
      const d = Number(m.debet);
      const k = Number(m.kredit);
      currentBalance += isNormalDebit ? d - k : k - d;
      return {
        ...m,
        saldo: currentBalance,
      };
    });

    return {
      akun: accInfo[0],
      saldoAwal,
      mutasi: items,
      saldoAkhir: currentBalance,
    };
  }
}
