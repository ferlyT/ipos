import { db } from "../db";
import { sql } from "drizzle-orm";

export interface MonthlyPerformance {
  month: string;
  totalInvoices: number;
  totalRevenue: number;
  totalCash: number;
  totalCredit: number;
  averageBasketSize: number;
}

export interface ExecutiveDashboard {
  year: number;
  totalInvoices: number;
  totalAnnualRevenue: number;
  totalAnnualCash: number;
  totalAnnualCredit: number;
  creditRatioPercent: number;
  overallAverageBasketSize: number;
  monthlyTrend: MonthlyPerformance[];
}

export interface ItemProfitability {
  rank: number;
  kodeitem: string;
  namaitem: string;
  kategori: string;
  merek: string;
  qtySold: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  marginPercent: number;
}

export interface CategoryProfitability {
  kategori: string;
  itemCount: number;
  totalQtySold: number;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  marginPercent: number;
}

export interface ABCItemClassification {
  kodeitem: string;
  namaitem: string;
  kategori: string;
  totalRevenue: number;
  revenueSharePercent: number;
  cumulativeSharePercent: number;
  classification: "A" | "B" | "C";
}

export interface DeadStockItem {
  kodeitem: string;
  namaitem: string;
  kategori: string;
  merek: string;
  stokFisik: number;
  satuan: string;
  hargapokok: number;
  nilaiModalMengendap: number;
  lastSoldDate: string | null;
}

export interface ABCInventoryReport {
  totalItemsAnalyzed: number;
  totalClassAItems: number;
  totalClassBItems: number;
  totalClassCItems: number;
  classAItems: ABCItemClassification[];
  totalDeadStockSKUs: number;
  totalDeadStockCapital: number;
  topDeadStockItems: DeadStockItem[];
}

export interface CustomerRetentionMetric {
  kode: string;
  nama: string;
  grup: string;
  lifetimeSpend: number;
  totalInvoices: number;
  averageOrderValue: number;
  lastPurchaseDate: string;
  daysInactive: number;
  isChurnRisk: boolean;
}

export class AnalyticsBIService {
  /**
   * 1. EXECUTIVE DASHBOARD (Annual & Monthly Revenue, Credit Ratio, Basket Size)
   */
  static async getExecutiveDashboard(year: number = 2026, client: any = db): Promise<ExecutiveDashboard> {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31 23:59:59`;

    const rows = await client.execute(sql`
      SELECT 
        TO_CHAR(tanggal, 'YYYY-MM') as month,
        COUNT(notransaksi)::int as total_invoices,
        COALESCE(SUM(totalakhir::numeric), 0) as total_revenue,
        COALESCE(SUM(jmltunai::numeric), 0) as total_cash,
        COALESCE(SUM(jmlkredit::numeric), 0) as total_credit
      FROM tbl_ikhd
      WHERE tipe = 'JL' AND tanggal BETWEEN ${startDate}::timestamp AND ${endDate}::timestamp
      GROUP BY TO_CHAR(tanggal, 'YYYY-MM')
      ORDER BY month ASC;
    `);

    let totalAnnualRevenue = 0;
    let totalAnnualCash = 0;
    let totalAnnualCredit = 0;
    let totalInvoices = 0;

    const monthlyTrend: MonthlyPerformance[] = (rows as any[]).map(r => {
      const invCount = Number(r.total_invoices || 0);
      const rev = Number(r.total_revenue || 0);
      const cash = Number(r.total_cash || 0);
      const credit = Number(r.total_credit || 0);

      totalAnnualRevenue += rev;
      totalAnnualCash += cash;
      totalAnnualCredit += credit;
      totalInvoices += invCount;

      return {
        month: String(r.month),
        totalInvoices: invCount,
        totalRevenue: Math.round(rev * 100) / 100,
        totalCash: Math.round(cash * 100) / 100,
        totalCredit: Math.round(credit * 100) / 100,
        averageBasketSize: invCount > 0 ? Math.round((rev / invCount) * 100) / 100 : 0
      };
    });

    const creditRatioPercent = totalAnnualRevenue > 0
      ? Math.round((totalAnnualCredit / totalAnnualRevenue) * 10000) / 100
      : 0;

    const overallAverageBasketSize = totalInvoices > 0
      ? Math.round((totalAnnualRevenue / totalInvoices) * 100) / 100
      : 0;

    return {
      year,
      totalInvoices,
      totalAnnualRevenue: Math.round(totalAnnualRevenue * 100) / 100,
      totalAnnualCash: Math.round(totalAnnualCash * 100) / 100,
      totalAnnualCredit: Math.round(totalAnnualCredit * 100) / 100,
      creditRatioPercent,
      overallAverageBasketSize,
      monthlyTrend
    };
  }

  /**
   * 2. ITEM PROFITABILITY ANALYSIS (Top Gross Profit Contributors & Margins)
   */
  static async getItemProfitability(
    limit: number = 20,
    startDateOrYear: string | number = "2026-01-01",
    client: any = db
  ): Promise<ItemProfitability[]> {
    const startDate = typeof startDateOrYear === "number" || (typeof startDateOrYear === "string" && /^\d{4}$/.test(startDateOrYear.trim()))
      ? `${String(startDateOrYear).trim()}-01-01`
      : startDateOrYear;

    const rows = await client.execute(sql`
      SELECT 
        d.kodeitem,
        i.namaitem,
        COALESCE(i.jenis, 'LAIN-LAIN') as kategori,
        COALESCE(i.merek, 'TIDAK ADA MEREK') as merek,
        COALESCE(SUM(d.jumlah::numeric), 0) as qty_sold,
        COALESCE(SUM(d.total::numeric), 0) as total_revenue,
        COALESCE(SUM(d.jumlah::numeric * COALESCE(i.hargapokok::numeric, 0)), 0) as total_cogs
      FROM tbl_ikdt d
      JOIN tbl_item i ON d.kodeitem = i.kodeitem
      JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
      WHERE h.tipe = 'JL' AND h.tanggal >= ${startDate}::timestamp
      GROUP BY d.kodeitem, i.namaitem, i.jenis, i.merek
      ORDER BY (COALESCE(SUM(d.total::numeric), 0) - COALESCE(SUM(d.jumlah::numeric * COALESCE(i.hargapokok::numeric, 0)), 0)) DESC
      LIMIT ${limit};
    `);

    return (rows as any[]).map((r, idx) => {
      const rev = Number(r.total_revenue || 0);
      const cogs = Number(r.total_cogs || 0);
      const profit = rev - cogs;
      const margin = rev > 0 ? Math.round((profit / rev) * 10000) / 100 : 0;

      return {
        rank: idx + 1,
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        kategori: String(r.kategori).trim(),
        merek: String(r.merek).trim(),
        qtySold: Number(r.qty_sold || 0),
        totalRevenue: Math.round(rev * 100) / 100,
        totalCogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(profit * 100) / 100,
        marginPercent: margin
      };
    });
  }

  /**
   * 3. CATEGORY PROFITABILITY ANALYSIS
   */
  static async getCategoryProfitability(startDateOrYear: string | number = "2026-01-01", client: any = db): Promise<CategoryProfitability[]> {
    const startDate = typeof startDateOrYear === "number" || (typeof startDateOrYear === "string" && /^\d{4}$/.test(startDateOrYear.trim()))
      ? `${String(startDateOrYear).trim()}-01-01`
      : startDateOrYear;

    const rows = await client.execute(sql`
      SELECT 
        COALESCE(i.jenis, 'LAIN-LAIN') as kategori,
        COUNT(DISTINCT d.kodeitem)::int as item_count,
        COALESCE(SUM(d.jumlah::numeric), 0) as total_qty_sold,
        COALESCE(SUM(d.total::numeric), 0) as total_revenue,
        COALESCE(SUM(d.jumlah::numeric * COALESCE(i.hargapokok::numeric, 0)), 0) as total_cogs
      FROM tbl_ikdt d
      JOIN tbl_item i ON d.kodeitem = i.kodeitem
      JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
      WHERE h.tipe = 'JL' AND h.tanggal >= ${startDate}::timestamp
      GROUP BY i.jenis
      ORDER BY total_revenue DESC
      LIMIT 15;
    `);

    return (rows as any[]).map(r => {
      const rev = Number(r.total_revenue || 0);
      const cogs = Number(r.total_cogs || 0);
      const profit = rev - cogs;
      const margin = rev > 0 ? Math.round((profit / rev) * 10000) / 100 : 0;

      return {
        kategori: String(r.kategori).trim(),
        itemCount: Number(r.item_count || 0),
        totalQtySold: Number(r.total_qty_sold || 0),
        totalRevenue: Math.round(rev * 100) / 100,
        totalCogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(profit * 100) / 100,
        marginPercent: margin
      };
    });
  }

  /**
   * 4. ABC INVENTORY CLASSIFICATION & DEAD STOCK IDENTIFIER
   */
  static async getABCInventoryAnalysis(startDateOrYear: string | number = "2026-01-01", client: any = db): Promise<ABCInventoryReport> {
    const startDate = typeof startDateOrYear === "number" || (typeof startDateOrYear === "string" && /^\d{4}$/.test(startDateOrYear.trim()))
      ? `${String(startDateOrYear).trim()}-01-01`
      : startDateOrYear;

    // 1. Ambil omzet penjualan per item
    const salesRows = await client.execute(sql`
      SELECT 
        d.kodeitem,
        i.namaitem,
        COALESCE(i.jenis, 'LAIN-LAIN') as kategori,
        COALESCE(SUM(d.total::numeric), 0) as total_revenue
      FROM tbl_ikdt d
      JOIN tbl_item i ON d.kodeitem = i.kodeitem
      JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
      WHERE h.tipe = 'JL' AND h.tanggal >= ${startDate}::timestamp
      GROUP BY d.kodeitem, i.namaitem, i.jenis
      ORDER BY total_revenue DESC;
    `);

    const totalRevAll = (salesRows as any[]).reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);

    let cumulativeRevenue = 0;
    let countA = 0;
    let countB = 0;
    let countC = 0;

    const classifiedItems: ABCItemClassification[] = (salesRows as any[]).map(r => {
      const rev = Number(r.total_revenue || 0);
      cumulativeRevenue += rev;
      const share = totalRevAll > 0 ? (rev / totalRevAll) * 100 : 0;
      const cumShare = totalRevAll > 0 ? (cumulativeRevenue / totalRevAll) * 100 : 0;

      let classification: "A" | "B" | "C" = "C";
      if (cumShare <= 80 || countA === 0) {
        classification = "A";
        countA++;
      } else if (cumShare <= 95) {
        classification = "B";
        countB++;
      } else {
        classification = "C";
        countC++;
      }

      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        kategori: String(r.kategori).trim(),
        totalRevenue: Math.round(rev * 100) / 100,
        revenueSharePercent: Math.round(share * 100) / 100,
        cumulativeSharePercent: Math.round(cumShare * 100) / 100,
        classification
      };
    });

    // 2. Deteksi Dead Stock (Stok fisik > 0, tetapi 0 transaksi penjualan sejak startDate)
    const deadRows = await client.execute(sql`
      SELECT 
        s.kodeitem,
        i.namaitem,
        COALESCE(i.jenis, 'LAIN-LAIN') as kategori,
        COALESCE(i.merek, 'TIDAK ADA MEREK') as merek,
        s.stok::numeric as stok_fisik,
        i.satuan,
        COALESCE(i.hargapokok::numeric, 0) as hargapokok,
        (s.stok::numeric * COALESCE(i.hargapokok::numeric, 0)) as modal_mengendap
      FROM tbl_itemstok s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.stok > 0 
        AND s.kodeitem NOT IN (
          SELECT DISTINCT d.kodeitem 
          FROM tbl_ikdt d 
          JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi 
          WHERE h.tipe = 'JL' AND h.tanggal >= ${startDate}::timestamp
        )
      ORDER BY modal_mengendap DESC
      LIMIT 20;
    `);

    let totalDeadCapital = 0;
    const topDeadItems: DeadStockItem[] = (deadRows as any[]).map(r => {
      const modal = Number(r.modal_mengendap || 0);
      totalDeadCapital += modal;

      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        kategori: String(r.kategori).trim(),
        merek: String(r.merek).trim(),
        stokFisik: Number(r.stok_fisik || 0),
        satuan: String(r.satuan || "PCS").trim(),
        hargapokok: Number(r.hargapokok || 0),
        nilaiModalMengendap: Math.round(modal * 100) / 100,
        lastSoldDate: null
      };
    });

    return {
      totalItemsAnalyzed: salesRows.length,
      totalClassAItems: countA,
      totalClassBItems: countB,
      totalClassCItems: countC,
      classAItems: classifiedItems.slice(0, 10), // Top 10 class A items
      totalDeadStockSKUs: deadRows.length,
      totalDeadStockCapital: Math.round(totalDeadCapital * 100) / 100,
      topDeadStockItems: topDeadItems.slice(0, 5)
    };
  }

  /**
   * 5. CUSTOMER RETENTION & CHURN RISK ANALYTICS
   */
  static async getCustomerRetentionAnalytics(
    dormantDaysThreshold: number = 90,
    limit: number = 10,
    client: any = db
  ): Promise<{
    totalActiveCustomers: number;
    totalDormantCustomers: number;
    topVipCustomers: CustomerRetentionMetric[];
    highRiskChurnCustomers: CustomerRetentionMetric[];
  }> {
    const rows = await client.execute(sql`
      SELECT 
        s.kode,
        s.nama,
        COALESCE(s.kgrup, 'General') as grup,
        COALESCE(SUM(h.totalakhir::numeric), 0) as lifetime_spend,
        COUNT(h.notransaksi)::int as total_invoices,
        MAX(h.tanggal) as last_purchase_date
      FROM tbl_supel s
      JOIN tbl_ikhd h ON s.kode = h.kodesupel
      WHERE s.tipe = 'PL' AND h.tipe = 'JL'
      GROUP BY s.kode, s.nama, s.kgrup
      ORDER BY lifetime_spend DESC;
    `);

    const now = new Date("2026-10-30T00:00:00Z"); // Patokan waktu sekarang

    let activeCount = 0;
    let dormantCount = 0;

    const allMetrics: CustomerRetentionMetric[] = (rows as any[]).map(r => {
      const lastDate = r.last_purchase_date ? new Date(r.last_purchase_date) : new Date(0);
      const diffMs = now.getTime() - lastDate.getTime();
      const daysInactive = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const isChurn = daysInactive >= dormantDaysThreshold;

      if (isChurn) dormantCount++;
      else activeCount++;

      const spend = Number(r.lifetime_spend || 0);
      const invCount = Number(r.total_invoices || 1);

      return {
        kode: String(r.kode).trim(),
        nama: String(r.nama).trim(),
        grup: String(r.grup).trim(),
        lifetimeSpend: Math.round(spend * 100) / 100,
        totalInvoices: invCount,
        averageOrderValue: Math.round((spend / invCount) * 100) / 100,
        lastPurchaseDate: lastDate.toISOString().split("T")[0],
        daysInactive,
        isChurnRisk: isChurn
      };
    });

    const highRiskChurn = allMetrics
      .filter(m => m.isChurnRisk)
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
      .slice(0, limit);

    const topVip = allMetrics.slice(0, limit);

    return {
      totalActiveCustomers: activeCount,
      totalDormantCustomers: dormantCount,
      topVipCustomers: topVip,
      highRiskChurnCustomers: highRiskChurn
    };
  }
}
