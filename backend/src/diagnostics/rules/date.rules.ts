import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkDateRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. DAT_FUTURE_TRANS: Transaksi di masa depan (> hari ini + 1 hari toleransi zona waktu)
  const futureTrans = await db.execute<any>(sql`
    SELECT 
      notransaksi, 
      tanggal, 
      kodeacc, 
      keterangan, 
      (debet + kredit)::float AS nominal
    FROM tbl_accjurnal
    WHERE tanggal > NOW() + INTERVAL '1 day'
    ORDER BY tanggal DESC
    LIMIT 20;
  `);

  for (const r of futureTrans) {
    anomalies.push({
      id: `DAT_FUTURE_TRANS_${r.notransaksi}`,
      code: "DAT_FUTURE_TRANS",
      category: "DATE",
      severity: "WARNING",
      title: `Transaksi Bertanggal Masa Depan (${r.notransaksi})`,
      description: `Transaksi ${r.notransaksi} memiliki tanggal ${r.tanggal} yang berada di masa depan relatif terhadap waktu sistem saat ini. Transaksi ini tidak akan masuk ke dalam laporan keuangan periode berjalan saat ini.`,
      referenceKey: r.notransaksi,
      detectedValue: r.tanggal,
      remediation: `Periksa tanggal jam pada komputer kasir/server saat transaksi diinput. Koreksi tanggal transaksi ${r.notransaksi} ke tanggal riil transaksi.`,
    });
  }

  // 2. DAT_OUT_OF_PERIOD: Transaksi bertanggal lampau tidak wajar (< tahun 2010)
  const oldTrans = await db.execute<any>(sql`
    SELECT 
      notransaksi, 
      tanggal, 
      kodeacc, 
      keterangan, 
      (debet + kredit)::float AS nominal
    FROM tbl_accjurnal
    WHERE tanggal < '2010-01-01 00:00:00'::timestamp
    ORDER BY tanggal ASC
    LIMIT 20;
  `);

  for (const r of oldTrans) {
    anomalies.push({
      id: `DAT_OUT_OF_PERIOD_${r.notransaksi}`,
      code: "DAT_OUT_OF_PERIOD",
      category: "DATE",
      severity: "WARNING",
      title: `Transaksi Bertanggal Tidak Wajar (< 2010): ${r.notransaksi}`,
      description: `Transaksi ${r.notransaksi} memiliki tanggal ${r.tanggal}. Tanggal yang terlalu lampau dapat mengacaukan akumulasi saldo awal dan perhitungan Laba Ditahan tahunan.`,
      referenceKey: r.notransaksi,
      detectedValue: r.tanggal,
      remediation: `Koreksi tanggal transaksi ${r.notransaksi} ke periode tahun buku yang benar.`,
    });
  }

  return anomalies;
}
