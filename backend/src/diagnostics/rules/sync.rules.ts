import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkSyncRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. SYNC_PAYMENT_DIFF: Selisih pembayaran piutang header vs mutasi debet jurnal
  const arDiscrepancies = await db.execute<any>(sql`
    SELECT 
      p.notransaksi,
      p.tanggal,
      p.totalbayar::float AS total_bayar,
      SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.debet - j.kredit ELSE 0 END)::float AS kas_jurnal,
      ABS(p.totalbayar - SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.debet - j.kredit ELSE 0 END))::float AS selisih
    FROM tbl_byrpiutanghd p
    JOIN tbl_accjurnal j ON p.notransaksi = j.notransaksi
    GROUP BY p.notransaksi, p.tanggal, p.totalbayar
    HAVING ABS(p.totalbayar - SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.debet - j.kredit ELSE 0 END)) > 10
    ORDER BY selisih DESC
    LIMIT 20;
  `);

  for (const r of arDiscrepancies) {
    anomalies.push({
      id: `SYNC_AR_PAY_DIFF_${r.notransaksi}`,
      code: "SYNC_PAYMENT_DIFF",
      category: "SYNC",
      severity: "WARNING",
      title: `Selisih Nilai Bukti Bayar Piutang vs Jurnal Kas (${r.notransaksi})`,
      description: `Bukti bayar piutang ${r.notransaksi} mencatat total bayar Rp ${r.total_bayar.toLocaleString("id-ID")}, namun penerimaan kas di jurnal mencatat Rp ${r.kas_jurnal.toLocaleString("id-ID")} (Selisih: Rp ${r.selisih.toLocaleString("id-ID")}).`,
      referenceKey: r.notransaksi,
      detectedValue: { bukti_bayar: r.total_bayar, kas_jurnal: r.kas_jurnal },
      discrepancy: r.selisih,
      remediation: `Periksa rincian potongan piutang, denda, atau selisih pembulatan pada transaksi ${r.notransaksi} di menu Pembayaran Piutang. Lakukan posting ulang jika perlu.`,
    });
  }

  // 2. SYNC_AP_PAY_DIFF: Selisih pembayaran hutang header vs mutasi kredit kas jurnal
  const apDiscrepancies = await db.execute<any>(sql`
    SELECT 
      h.notransaksi,
      h.tanggal,
      h.totalbayar::float AS total_bayar,
      SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END)::float AS kas_jurnal,
      ABS(h.totalbayar - SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END))::float AS selisih
    FROM tbl_byrhutanghd h
    JOIN tbl_accjurnal j ON h.notransaksi = j.notransaksi
    GROUP BY h.notransaksi, h.tanggal, h.totalbayar
    HAVING ABS(h.totalbayar - SUM(CASE WHEN j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END)) > 10
    ORDER BY selisih DESC
    LIMIT 20;
  `);

  for (const r of apDiscrepancies) {
    anomalies.push({
      id: `SYNC_AP_PAY_DIFF_${r.notransaksi}`,
      code: "SYNC_PAYMENT_DIFF",
      category: "SYNC",
      severity: "WARNING",
      title: `Selisih Nilai Bukti Bayar Hutang vs Jurnal Kas (${r.notransaksi})`,
      description: `Bukti pembayaran hutang supplier ${r.notransaksi} mencatat total bayar Rp ${r.total_bayar.toLocaleString("id-ID")}, namun pengeluaran kas di jurnal mencatat Rp ${r.kas_jurnal.toLocaleString("id-ID")} (Selisih: Rp ${r.selisih.toLocaleString("id-ID")}).`,
      referenceKey: r.notransaksi,
      detectedValue: { bukti_bayar: r.total_bayar, kas_jurnal: r.kas_jurnal },
      discrepancy: r.selisih,
      remediation: `Periksa transaksi ${r.notransaksi} di menu Pembayaran Hutang dan verifikasi apakah ada potongan hutang atau beban admin bank.`,
    });
  }

  return anomalies;
}
