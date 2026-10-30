import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkSubledgerRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. SUB_AR_DIFF: Rekonsiliasi Kartu Piutang Pelanggan vs Akun Piutang 1-1210
  const arSubledger = await db.execute<any>(sql`
    SELECT 
      COALESCE(SUM(jmlkredit - krd_jml_byr), 0)::float AS total_piutang_faktur
    FROM tbl_ikhd
    WHERE jmlkredit > krd_jml_byr;
  `);

  const arGeneralLedger = await db.execute<any>(sql`
    SELECT 
      COALESCE(SUM(debet - kredit), 0)::float AS total_piutang_buku_besar
    FROM tbl_accjurnal
    WHERE kodeacc = '1-1210';
  `);

  const arSubVal = arSubledger[0]?.total_piutang_faktur || 0;
  const arGlVal = arGeneralLedger[0]?.total_piutang_buku_besar || 0;
  const arDiff = Math.abs(arSubVal - arGlVal);

  if (arDiff > 100) {
    anomalies.push({
      id: "SUB_AR_DIFF",
      code: "SUB_AR_DIFF",
      category: "SUBLEDGER",
      severity: "CRITICAL",
      title: "Selisih Total Piutang Faktur vs Akun Piutang Usaha (1-1210)",
      description: `Total sisa piutang pada kartu faktur pelanggan adalah Rp ${arSubVal.toLocaleString("id-ID")}, sedangkan saldo akun Piutang Usaha (1-1210) di Buku Besar adalah Rp ${arGlVal.toLocaleString("id-ID")} (Selisih: Rp ${arDiff.toLocaleString("id-ID")}). Laporan Umur Piutang tidak cocok dengan Neraca.`,
      referenceKey: "1-1210",
      detectedValue: { kartu_piutang: arSubVal, buku_besar: arGlVal },
      discrepancy: arDiff,
      remediation: "Lakukan rekonsiliasi antara Laporan Buku Pembantu Piutang dengan Buku Besar Piutang. Periksa apakah ada faktur piutang yang dihapus/diedit tanpa membatalkan jurnal pelunasannya atau ada Jurnal Umum manual yang langsung memotong akun 1-1210 tanpa lewat modul pembayaran piutang.",
    });
  }

  // 2. SUB_AP_DIFF: Rekonsiliasi Kartu Hutang Supplier vs Akun Hutang 2-1101
  const apSubledger = await db.execute<any>(sql`
    SELECT 
      COALESCE(SUM(jmlkredit - krd_jml_byr), 0)::float AS total_hutang_faktur
    FROM tbl_imhd
    WHERE jmlkredit > krd_jml_byr;
  `);

  const apGeneralLedger = await db.execute<any>(sql`
    SELECT 
      COALESCE(SUM(kredit - debet), 0)::float AS total_hutang_buku_besar
    FROM tbl_accjurnal
    WHERE kodeacc = '2-1101';
  `);

  const apSubVal = apSubledger[0]?.total_hutang_faktur || 0;
  const apGlVal = apGeneralLedger[0]?.total_hutang_buku_besar || 0;
  const apDiff = Math.abs(apSubVal - apGlVal);

  if (apDiff > 100) {
    anomalies.push({
      id: "SUB_AP_DIFF",
      code: "SUB_AP_DIFF",
      category: "SUBLEDGER",
      severity: "CRITICAL",
      title: "Selisih Total Hutang Faktur vs Akun Hutang Usaha (2-1101)",
      description: `Total sisa hutang pada faktur pembelian supplier adalah Rp ${apSubVal.toLocaleString("id-ID")}, sedangkan saldo akun Hutang Usaha (2-1101) di Buku Besar adalah Rp ${apGlVal.toLocaleString("id-ID")} (Selisih: Rp ${apDiff.toLocaleString("id-ID")}). Laporan Buku Pembantu Hutang tidak cocok dengan Neraca.`,
      referenceKey: "2-1101",
      detectedValue: { kartu_hutang: apSubVal, buku_besar: apGlVal },
      discrepancy: apDiff,
      remediation: "Lakukan rekonsiliasi antara Laporan Buku Pembantu Hutang dengan Buku Besar Hutang. Periksa pembayaran hutang atau retur pembelian yang belum terjurnal dengan benar.",
    });
  }

  return anomalies;
}
