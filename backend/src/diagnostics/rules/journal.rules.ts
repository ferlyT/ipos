import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkJournalRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. JUR_UNBALANCED: Cek jurnal tidak seimbang per notransaksi
  const unbalanced = await db.execute<any>(sql`
    SELECT 
      notransaksi,
      SUM(debet)::float AS tot_debet,
      SUM(kredit)::float AS tot_kredit,
      ABS(SUM(debet) - SUM(kredit))::float AS selisih,
      MIN(tanggal) AS tgl
    FROM tbl_accjurnal
    GROUP BY notransaksi
    HAVING ABS(SUM(debet) - SUM(kredit)) > 0.001
    ORDER BY selisih DESC
    LIMIT 50;
  `);

  for (const r of unbalanced) {
    const isRounding = r.selisih <= 10;
    anomalies.push({
      id: `JUR_UNBALANCED_${r.notransaksi}`,
      code: "JUR_UNBALANCED",
      category: "JOURNAL",
      severity: isRounding ? "INFO" : "CRITICAL",
      title: `Jurnal Tidak Seimbang (${r.notransaksi})`,
      description: `Transaksi ${r.notransaksi} (tgl: ${r.tgl}) memiliki total Debet Rp ${r.tot_debet.toLocaleString("id-ID")} dan Kredit Rp ${r.tot_kredit.toLocaleString("id-ID")} dengan selisih Rp ${r.selisih.toLocaleString("id-ID")}.`,
      referenceKey: r.notransaksi,
      detectedValue: { debet: r.tot_debet, kredit: r.tot_kredit },
      discrepancy: r.selisih,
      remediation: isRounding
        ? "Selisih kecil di bawah Rp 10 biasanya berasal dari selisih desimal pembulatan kasir. Buat jurnal penyesuaian selisih pembulatan atau sesuaikan digit pembulatan di opsi iPos."
        : "Perbaiki baris jurnal di modul terkait atau buat Jurnal Umum Penyesuaian agar posisi Debet dan Kredit seimbang sempurna.",
    });
  }

  // 2. JUR_HEADER_POST: Penjurnalan pada akun bertipe Header ('H')
  const headerPosts = await db.execute<any>(sql`
    SELECT 
      j.notransaksi,
      j.kodeacc,
      p.namaacc,
      j.debet::float AS debet,
      j.kredit::float AS kredit,
      j.tanggal
    FROM tbl_accjurnal j
    JOIN tbl_perkiraan p ON j.kodeacc = p.kodeacc
    WHERE p.tipe = 'H'
    LIMIT 30;
  `);

  for (const r of headerPosts) {
    anomalies.push({
      id: `JUR_HEADER_POST_${r.notransaksi}_${r.kodeacc}`,
      code: "JUR_HEADER_POST",
      category: "JOURNAL",
      severity: "CRITICAL",
      title: `Penjurnalan pada Akun Header (${r.kodeacc} - ${r.namaacc})`,
      description: `Transaksi ${r.notransaksi} memposting mutasi sebesar Rp ${(r.debet || r.kredit).toLocaleString("id-ID")} ke akun '${r.namaacc}' yang bertipe HEADER. Akun Header hanya untuk pengelompokan dan tidak boleh memiliki mutasi langsung.`,
      referenceKey: r.notransaksi,
      detectedValue: r.kodeacc,
      remediation: `Pindahkan mutasi jurnal transaksi ${r.notransaksi} dari akun header ${r.kodeacc} ke akun Detail ('D') yang sesuai di bawahnya agar subtotal dan detail laporan keuangan tidak rusak/ganda.`,
    });
  }

  // 3. JUR_ORPHAN_ACC: Akun jurnal yang tidak ada di master tbl_perkiraan
  const orphanAccounts = await db.execute<any>(sql`
    SELECT 
      j.notransaksi,
      j.kodeacc,
      j.tanggal,
      (j.debet + j.kredit)::float AS nominal
    FROM tbl_accjurnal j
    LEFT JOIN tbl_perkiraan p ON j.kodeacc = p.kodeacc
    WHERE p.kodeacc IS NULL
    LIMIT 30;
  `);

  for (const r of orphanAccounts) {
    anomalies.push({
      id: `JUR_ORPHAN_ACC_${r.notransaksi}_${r.kodeacc}`,
      code: "JUR_ORPHAN_ACC",
      category: "JOURNAL",
      severity: "CRITICAL",
      title: `Akun Jurnal Tidak Terdaftar di Master COA (${r.kodeacc})`,
      description: `Transaksi ${r.notransaksi} menggunakan kode akun '${r.kodeacc}', namun akun ini tidak ada di master tabel 'tbl_perkiraan'. Akibatnya mutasi ini hilang dari laporan Neraca / Laba Rugi.`,
      referenceKey: r.notransaksi,
      detectedValue: r.kodeacc,
      remediation: `Daftarkan kode akun '${r.kodeacc}' ke Master Data Perkiraan (COA) atau perbaiki kode akun transaksi terkait ke nomor akun yang benar.`,
    });
  }

  // 4. CFG_INVALID_MAP: Cek mapping akun default sistem di tbl_perksetting
  const invalidSettings = await db.execute<any>(sql`
    SELECT 
      s.accsetting,
      s.kodeacc,
      p.namaacc,
      p.kelompok
    FROM tbl_perksetting s
    LEFT JOIN tbl_perkiraan p ON s.kodeacc = p.kodeacc
    WHERE 
      (s.accsetting IN ('ACC_LABATAHAN', 'ACC_LABAJALAN', 'ACC_PRIVE', 'ACC_HISTORICAL') AND p.kelompok != '3')
      OR (s.accsetting IN ('ACC_ITEM_JUAL', 'ACC_ITEM_JASA') AND p.kelompok != '4')
      OR (s.accsetting IN ('ACC_ITEM_HPP') AND p.kelompok != '5')
      OR (s.accsetting IN ('ACC_JUAL_KREDIT', 'ACC_BELI_TUNAI', 'ACC_JUAL_TUNAI') AND p.kelompok != '1')
      OR (s.accsetting IN ('ACC_BELI_KREDIT') AND p.kelompok != '2')
    LIMIT 20;
  `);

  for (const r of invalidSettings) {
    anomalies.push({
      id: `CFG_INVALID_MAP_${r.accsetting}`,
      code: "CFG_INVALID_MAP",
      category: "JOURNAL",
      severity: "CRITICAL",
      title: `Konfigurasi Akun Sistem Keliru: ${r.accsetting}`,
      description: `Pengaturan '${r.accsetting}' diarahkan ke akun '${r.kodeacc} - ${r.namaacc || "Tidak Ditemukan"}' dengan kelompok '${r.kelompok || "Kosong"}'. Kelompok ini tidak sesuai dengan peruntukan akuntansinya.`,
      referenceKey: r.accsetting,
      detectedValue: { kodeacc: r.kodeacc, kelompok: r.kelompok },
      remediation: `Perbaiki pengaturan default akun '${r.accsetting}' melalui Pengaturan Akuntansi di iPos 4 agar mengarah ke akun dengan kelompok yang tepat.`,
    });
  }

  return anomalies;
}
