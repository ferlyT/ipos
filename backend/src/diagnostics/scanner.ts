import { db } from "../db";
import { sql } from "drizzle-orm";
import type { AuditSummary, AnomalyItem, AuditFinancialMetrics } from "./types";
import { checkJournalRules } from "./rules/journal.rules";
import { checkCashRules } from "./rules/cash.rules";
import { checkSalesRules } from "./rules/sales.rules";
import { checkPurchaseRules } from "./rules/purchase.rules";
import { checkSyncRules } from "./rules/sync.rules";
import { checkInventoryRules } from "./rules/inventory.rules";
import { checkSubledgerRules } from "./rules/subledger.rules";
import { checkDateRules } from "./rules/date.rules";

export class AnomalyScanner {
  /**
   * Menjalankan seluruh aturan audit diagnostik database secara berurutan dan mengagregasi metrik finansial
   */
  static async runFullAudit(): Promise<AuditSummary> {
    const dbInfo = await db.execute<any>(sql`SELECT current_database() as db_name`);
    const dbName = dbInfo[0]?.db_name || "i4_barunatrial";

    // 1. Hitung Metrik Keuangan Tingkat Tinggi untuk Ringkasan Eksekutif
    const [salesMeta, purchaseMeta, journalMeta, itemMeta, unpostedSalesMeta, unpostedBuyMeta, salesLossMeta, negCashMeta] =
      await Promise.all([
        db.execute<any>(sql`
          SELECT count(*)::int AS count, coalesce(sum(totalakhir), 0)::float AS total 
          FROM tbl_ikhd WHERE tipe = 'JL';
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count, coalesce(sum(totalakhir), 0)::float AS total 
          FROM tbl_imhd WHERE tipe = 'BL';
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count FROM tbl_accjurnal;
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count FROM tbl_item;
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count, coalesce(sum(ik.totalakhir), 0)::float AS total
          FROM tbl_ikhd ik
          LEFT JOIN tbl_accjurnal j ON ik.notransaksi = j.notransaksi
          WHERE j.notransaksi IS NULL AND ik.totalakhir > 0;
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count, coalesce(sum(im.totalakhir), 0)::float AS total
          FROM tbl_imhd im
          LEFT JOIN tbl_accjurnal j ON im.notransaksi = j.notransaksi
          WHERE j.notransaksi IS NULL AND im.totalakhir > 0 AND im.tipe IN ('BL', 'RB');
        `),
        db.execute<any>(sql`
          SELECT count(*)::int AS count, coalesce(sum((it.hargapokok - dt.harga) * dt.jumlah), 0)::float AS total_rugi
          FROM tbl_ikdt dt
          JOIN tbl_item it ON dt.kodeitem = it.kodeitem
          WHERE dt.harga < it.hargapokok AND it.hargapokok > 0 AND dt.harga > 0;
        `),
        db.execute<any>(sql`
          SELECT coalesce(sum(abs(saldo)), 0)::float AS total_negatif
          FROM (
            SELECT p.kodeacc, sum(j.debet - j.kredit) AS saldo
            FROM tbl_perkiraan p
            JOIN tbl_accjurnal j ON p.kodeacc = j.kodeacc
            WHERE p.kasbank = true AND p.tipe = 'D'
            GROUP BY p.kodeacc
            HAVING sum(j.debet - j.kredit) < 0
          ) q;
        `),
      ]);

    const metrics: AuditFinancialMetrics = {
      totalSalesCount: salesMeta[0]?.count || 0,
      totalSalesAmount: salesMeta[0]?.total || 0,
      totalPurchaseCount: purchaseMeta[0]?.count || 0,
      totalPurchaseAmount: purchaseMeta[0]?.total || 0,
      totalJournalCount: journalMeta[0]?.count || 0,
      totalItemCount: itemMeta[0]?.count || 0,
      unjournaledSalesCount: unpostedSalesMeta[0]?.count || 0,
      unjournaledSalesAmount: unpostedSalesMeta[0]?.total || 0,
      unjournaledPurchaseCount: unpostedBuyMeta[0]?.count || 0,
      unjournaledPurchaseAmount: unpostedBuyMeta[0]?.total || 0,
      salesBelowCostCount: salesLossMeta[0]?.count || 0,
      salesBelowCostLoss: salesLossMeta[0]?.total_rugi || 0,
      negativeCashAmount: negCashMeta[0]?.total_negatif || 0,
    };

    const allItems: AnomalyItem[] = [];

    // 2. Jalankan Setiap Modul Aturan Audit Substantif
    const [
      salesAnomalies,
      purchaseAnomalies,
      cashAnomalies,
      inventoryAnomalies,
      subledgerAnomalies,
      journalAnomalies,
      syncAnomalies,
      dateAnomalies,
    ] = await Promise.all([
      checkSalesRules(),
      checkPurchaseRules(),
      checkCashRules(),
      checkInventoryRules(),
      checkSubledgerRules(),
      checkJournalRules(),
      checkSyncRules(),
      checkDateRules(),
    ]);

    allItems.push(
      ...salesAnomalies,
      ...purchaseAnomalies,
      ...cashAnomalies,
      ...inventoryAnomalies,
      ...subledgerAnomalies,
      ...journalAnomalies,
      ...syncAnomalies,
      ...dateAnomalies
    );

    // 3. Klasifikasi Statistik Keparahan & Kategori
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    const categoryStats = {
      SALES: 0,
      PURCHASE: 0,
      CASH: 0,
      INVENTORY: 0,
      SUBLEDGER: 0,
      JOURNAL: 0,
      DATE: 0,
      SYNC: 0,
    };

    for (const item of allItems) {
      if (item.severity === "CRITICAL") criticalCount++;
      else if (item.severity === "WARNING") warningCount++;
      else if (item.severity === "INFO") infoCount++;

      if (categoryStats[item.category] !== undefined) {
        categoryStats[item.category]++;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      database: dbName,
      totalAnomalies: allItems.length,
      criticalCount,
      warningCount,
      infoCount,
      categoryStats,
      metrics,
      items: allItems,
    };
  }
}
