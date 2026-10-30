import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

export interface PeriodStatus {
  currentMonth: number;
  currentYear: number;
  startMonth: number;
  startYear: number;
  monthName: string;
  isYearEnd: boolean;
  totalRekapRows: number;
}

export interface PeriodSummary {
  month: number;
  year: number;
  salesCount: number;
  salesTotal: number;
  purchaseCount: number;
  purchaseTotal: number;
  transferCount: number;
  cashTransactionsCount: number;
  netProfitEstimate: number;
}

const MONTH_NAMES = [
  "",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export class PeriodClosingService {
  constructor(private sql: postgres.Sql) {}

  /**
   * 1. GET STATUS PERIODE AKTIF (tbl_conf)
   */
  async getPeriodStatus(): Promise<PeriodStatus> {
    const rows = await this.sql`
      SELECT confname, confvalue 
      FROM tbl_conf 
      WHERE confname IN ('ACC_CURRENT_MONTH', 'ACC_CURRENT_YEAR', 'ACC_START_MONTH', 'ACC_START_YEAR');
    `;

    const map: Record<string, number> = {
      ACC_CURRENT_MONTH: 10,
      ACC_CURRENT_YEAR: 2026,
      ACC_START_MONTH: 1,
      ACC_START_YEAR: 2022,
    };

    for (const r of rows) {
      if (r.confvalue !== null && !isNaN(Number(r.confvalue))) {
        map[String(r.confname).trim()] = Number(r.confvalue);
      }
    }

    const curMonth = map.ACC_CURRENT_MONTH || 10;
    const curYear = map.ACC_CURRENT_YEAR || 2026;

    const [rekap] = await this.sql`
      SELECT count(*)::int as count 
      FROM tbl_item_rekap 
      WHERE bulan = ${curMonth} AND tahun = ${curYear};
    `;

    return {
      currentMonth: curMonth,
      currentYear: curYear,
      startMonth: map.ACC_START_MONTH || 1,
      startYear: map.ACC_START_YEAR || 2022,
      monthName: MONTH_NAMES[curMonth] || `Bulan ${curMonth}`,
      isYearEnd: curMonth === 12,
      totalRekapRows: Number(rekap?.count || 0),
    };
  }

  /**
   * 2. GET RINGKASAN AKTIVITAS PERIODE BULANAN
   */
  async getPeriodSummary(month: number, year: number): Promise<PeriodSummary> {
    const [sales] = await this.sql`
      SELECT count(*)::int as count, COALESCE(SUM(totalakhir), 0)::numeric as total
      FROM tbl_ikhd
      WHERE date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    const [purchase] = await this.sql`
      SELECT count(*)::int as count, COALESCE(SUM(totalakhir), 0)::numeric as total
      FROM tbl_imhd
      WHERE date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    const [transfers] = await this.sql`
      SELECT count(*)::int as count
      FROM tbl_itrhd
      WHERE date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    const [cash] = await this.sql`
      SELECT count(*)::int as count
      FROM tbl_acckashd
      WHERE date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    // Laba Bersih Estimasi (Pendapatan 4, 8 - Beban 5, 6, 9)
    const [rev] = await this.sql`
      SELECT COALESCE(SUM(kredit - debet), 0)::numeric as revenue
      FROM tbl_accjurnal
      WHERE (kodeacc LIKE '4-%' OR kodeacc LIKE '8-%')
        AND date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    const [exp] = await this.sql`
      SELECT COALESCE(SUM(debet - kredit), 0)::numeric as expense
      FROM tbl_accjurnal
      WHERE (kodeacc LIKE '5-%' OR kodeacc LIKE '6-%' OR kodeacc LIKE '9-%')
        AND date_part('month', tanggal) = ${month} AND date_part('year', tanggal) = ${year};
    `;

    const netProfit = Number(rev?.revenue || 0) - Number(exp?.expense || 0);

    return {
      month,
      year,
      salesCount: Number(sales?.count || 0),
      salesTotal: Number(sales?.total || 0),
      purchaseCount: Number(purchase?.count || 0),
      purchaseTotal: Number(purchase?.total || 0),
      transferCount: Number(transfers?.count || 0),
      cashTransactionsCount: Number(cash?.count || 0),
      netProfitEstimate: netProfit,
    };
  }

  /**
   * 3. EKSEKUSI PROSES DATA BULANAN (MONTHLY CLOSING)
   */
  async executeMonthlyClosing(month: number, year: number, user: string = "ADMIN") {
    const startTime = performance.now();

    // 1. Eksekusi Stored Procedure Mutasi Barang
    await this.sql`SELECT proses_item_mutasi(${month}, ${year}, 2);`;

    // 2. Eksekusi Pemindahan Saldo Akhir FIFO ke Saldo Awal Bulan Berikutnya
    await this.sql`SELECT proseshppsaldoakhir(${month}, ${year});`;

    // 3. Hitung Periode Berikutnya
    let nextMonth = month + 1;
    let nextYear = year;
    if (month >= 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }

    // 4. Update Parameter Periode Aktif di tbl_conf
    await this.sql`
      UPDATE tbl_conf 
      SET confvalue = ${String(nextMonth)} 
      WHERE confname = 'ACC_CURRENT_MONTH';
    `;

    if (nextYear !== year) {
      await this.sql`
        UPDATE tbl_conf 
        SET confvalue = ${String(nextYear)} 
        WHERE confname = 'ACC_CURRENT_YEAR';
      `;
    }

    const elapsedMs = Number((performance.now() - startTime).toFixed(2));

    return {
      success: true,
      closedMonth: month,
      closedMonthName: MONTH_NAMES[month] || `Bulan ${month}`,
      closedYear: year,
      nextMonth,
      nextMonthName: MONTH_NAMES[nextMonth] || `Bulan ${nextMonth}`,
      nextYear,
      elapsedMs,
      executedBy: user,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 4. EKSEKUSI PROSES DATA TAHUNAN (YEARLY CLOSING)
   */
  async executeYearlyClosing(year: number, user: string = "ADMIN") {
    const startTime = performance.now();

    // 1. Backup Otomatis Database Sebelum Tutup Buku
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `backup_pre_yearend_${year}_${timestamp}.dump`;
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const filepath = path.join(backupDir, filename);

    const pgDumpPath = "c:\\Program Files (x86)\\Program Kreatif\\Program iPos 4.0\\dbutils\\pg_dump.exe";
    const proc = Bun.spawn([
      pgDumpPath,
      "-h", "localhost",
      "-p", "5444",
      "-U", "admin",
      "-F", "c",
      "-b",
      "-f", filepath,
      "i4_barunatrial",
    ], {
      env: { ...process.env, PGPASSWORD: "admin" },
    });
    await proc.exited;

    // 2. Hitung Laba/Rugi Bersih Kumulatif Tahun Berjalan
    const [rev] = await this.sql`
      SELECT COALESCE(SUM(kredit - debet), 0)::numeric as revenue
      FROM tbl_accjurnal
      WHERE (kodeacc LIKE '4-%' OR kodeacc LIKE '8-%')
        AND date_part('year', tanggal) = ${year};
    `;

    const [exp] = await this.sql`
      SELECT COALESCE(SUM(debet - kredit), 0)::numeric as expense
      FROM tbl_accjurnal
      WHERE (kodeacc LIKE '5-%' OR kodeacc LIKE '6-%' OR kodeacc LIKE '9-%')
        AND date_part('year', tanggal) = ${year};
    `;

    const netProfit = Number(rev?.revenue || 0) - Number(exp?.expense || 0);

    // 3. Buat Jurnal Penutup Akhir Tahun (Menutup Laba Berjalan 3-3000 ke Laba Ditahan 3-2000)
    const closingTrs = `JUR-CLOSE-${year}`;
    const closingDate = `${year}-12-31 23:59:59`;

    await this.sql.begin(async (tx) => {
      // Hapus jika sudah pernah dibuat untuk tahun yang sama
      await tx`DELETE FROM tbl_accjurnal WHERE notransaksi = ${closingTrs};`;

      if (netProfit !== 0) {
        if (netProfit > 0) {
          // Laba Bersih Positif: Debit 3-3000 (Laba Berjalan), Kredit 3-2000 (Laba Ditahan)
          await tx`
            INSERT INTO tbl_accjurnal (
              notransaksi, nobaris, tanggal, tipe, kodekantor, kodeacc, debet, kredit, keterangan, dateupd
            ) VALUES 
              (${closingTrs}, 1, ${closingDate}::timestamp, 'JU', 'UTM', '3-3000', ${netProfit}, 0, ${'Penutupan Akhir Tahun ' + year + ': Tutup Laba Berjalan'}, NOW()),
              (${closingTrs}, 2, ${closingDate}::timestamp, 'JU', 'UTM', '3-2000', 0, ${netProfit}, ${'Penutupan Akhir Tahun ' + year + ': Pindah ke Laba Ditahan'}, NOW());
          `;
        } else {
          // Rugi Bersih: Debit 3-2000 (Laba Ditahan), Kredit 3-3000 (Laba Berjalan)
          const absLoss = Math.abs(netProfit);
          await tx`
            INSERT INTO tbl_accjurnal (
              notransaksi, nobaris, tanggal, tipe, kodekantor, kodeacc, debet, kredit, keterangan, dateupd
            ) VALUES 
              (${closingTrs}, 1, ${closingDate}::timestamp, 'JU', 'UTM', '3-2000', ${absLoss}, 0, ${'Penutupan Akhir Tahun ' + year + ': Pengurangan Laba Ditahan karena Rugi'}, NOW()),
              (${closingTrs}, 2, ${closingDate}::timestamp, 'JU', 'UTM', '3-3000', 0, ${absLoss}, ${'Penutupan Akhir Tahun ' + year + ': Tutup Rugi Berjalan'}, NOW());
          `;
        }
      }

      // 4. Perbarui Saldo Awal Akun Neraca (Kelompok 1, 2, 3) di tbl_acc_sa untuk 1 Jan Tahun Baru
      const newYearDate = `${year + 1}-01-01`;
      await tx`DELETE FROM tbl_acc_sa WHERE tanggal = ${newYearDate}::date;`;

      const balanceSheetBalances = await tx`
        SELECT 
          p.kodeacc,
          COALESCE(
            CASE 
              WHEN p.kelompok IN ('1', '5', '6', '9') THEN SUM(j.debet - j.kredit)
              ELSE SUM(j.kredit - j.debet)
            END, 0
          )::numeric as saldo_akhir
        FROM tbl_perkiraan p
        LEFT JOIN tbl_accjurnal j ON p.kodeacc = j.kodeacc AND j.tanggal <= ${closingDate}::timestamp
        WHERE p.kelompok IN ('1', '2', '3') AND p.tipe = 'D'
        GROUP BY p.kodeacc, p.kelompok;
      `;

      for (const b of balanceSheetBalances) {
        const saldo = Number(b.saldo_akhir || 0);
        if (saldo !== 0) {
          await tx`
            INSERT INTO tbl_acc_sa (
              kodeacc, tanggal, matauang, rate, jumlah, user1, dateupd
            ) VALUES (
              ${b.kodeacc}, ${newYearDate}::date, 'IDR', 1, ${saldo}, ${user}, NOW()
            );
          `;
        }
      }

      // 5. Majukan Tahun Aktif di tbl_conf
      const newYear = year + 1;
      await tx`
        UPDATE tbl_conf SET confvalue = ${String(newYear)} WHERE confname = 'ACC_CURRENT_YEAR';
      `;
      await tx`
        UPDATE tbl_conf SET confvalue = '1' WHERE confname = 'ACC_CURRENT_MONTH';
      `;
    });

    const elapsedMs = Number((performance.now() - startTime).toFixed(2));

    return {
      success: true,
      closedYear: year,
      newYear: year + 1,
      netProfit,
      closingJournal: closingTrs,
      backupFile: filename,
      elapsedMs,
      executedBy: user,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 5. DAFTAR HISTORI MUTASI PERIODE (tbl_item_rekap)
   */
  async getClosingHistory(limit: number = 24) {
    const rows = await this.sql`
      SELECT 
        tahun,
        bulan,
        count(DISTINCT kodeitem)::int as total_sku,
        COALESCE(SUM(awal_total), 0)::numeric as total_nilai_awal,
        COALESCE(SUM(masuk_total), 0)::numeric as total_nilai_masuk,
        COALESCE(SUM(keluar_total), 0)::numeric as total_nilai_keluar,
        COALESCE(SUM(akhir_total), 0)::numeric as total_nilai_akhir
      FROM tbl_item_rekap
      GROUP BY tahun, bulan
      ORDER BY tahun DESC, bulan DESC
      LIMIT ${limit};
    `;

    return rows.map((r: any) => ({
      tahun: Number(r.tahun),
      bulan: Number(r.bulan),
      bulanNama: MONTH_NAMES[Number(r.bulan)] || `Bulan ${r.bulan}`,
      totalSku: Number(r.total_sku),
      totalNilaiAwal: Number(r.total_nilai_awal),
      totalNilaiMasuk: Number(r.total_nilai_masuk),
      totalNilaiKeluar: Number(r.total_nilai_keluar),
      totalNilaiAkhir: Number(r.total_nilai_akhir),
    }));
  }

  /**
   * 6. VALIDASI PROTEKSI PERIODE TERKUNCI (STRICT PERIOD LOCK)
   */
  async assertPeriodNotClosed(date: Date | string): Promise<void> {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return;
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    const status = await this.getPeriodStatus();
    if (year < status.currentYear || (year === status.currentYear && month < status.currentMonth)) {
      throw new Error(
        `Periode pembukuan ${MONTH_NAMES[month] || month} ${year} telah ditutup. Transaksi baru tidak diizinkan pada periode tertutup (Periode Aktif Berjalan: ${status.monthName} ${status.currentYear}).`
      );
    }
  }
}
