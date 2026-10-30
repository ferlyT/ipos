import { AnalyticsBIService } from "./services/analytics-bi.service";

async function run() {
  console.log("================================================================");
  console.log("   TESTING BUSINESS INTELLIGENCE & EXECUTIVE ANALYTICS ENGINE");
  console.log("================================================================\n");

  try {
    // 1. Executive Dashboard (2026)
    console.log("--- [1] 2026 EXECUTIVE FINANCIAL DASHBOARD ---");
    const dashboard = await AnalyticsBIService.getExecutiveDashboard(2026);
    console.log({
      tahun: dashboard.year,
      totalFaktur: dashboard.totalInvoices,
      totalOmzet: `Rp ${dashboard.totalAnnualRevenue.toLocaleString("id-ID")}`,
      rasioKredit: `${dashboard.creditRatioPercent}% (Penjualan Tempo)`,
      rataRataNilaiFaktur: `Rp ${dashboard.overallAverageBasketSize.toLocaleString("id-ID")}`
    });
    console.log("\nTren Penjualan Bulanan 2026:");
    console.table(dashboard.monthlyTrend);

    // 2. Top Item Profitability
    console.log("\n--- [2] TOP 5 ITEM PROFITABILITY LEADERS (2026) ---");
    const itemProfits = await AnalyticsBIService.getItemProfitability(5, "2026-01-01");
    console.table(itemProfits);

    // 3. Top Category Profitability
    console.log("\n--- [3] CATEGORY PROFITABILITY & MARGIN BREAKDOWN ---");
    const catProfits = await AnalyticsBIService.getCategoryProfitability("2026-01-01");
    console.table(catProfits.slice(0, 5));

    // 4. ABC Inventory Analysis & Dead Stock Detection
    console.log("\n--- [4] ABC INVENTORY CLASSIFICATION & DEAD STOCK DETECTION ---");
    const abcReport = await AnalyticsBIService.getABCInventoryAnalysis("2026-01-01");
    console.log("Ringkasan Klasifikasi ABC:");
    console.log({
      totalItemDianalisis: abcReport.totalItemsAnalyzed,
      itemKelasA: `${abcReport.totalClassAItems} SKU (Pareto 80% Omzet)`,
      itemKelasB: `${abcReport.totalClassBItems} SKU (15% Omzet)`,
      itemKelasC: `${abcReport.totalClassCItems} SKU (5% Omzet)`
    });

    console.log("\nSampel Item Kelas A (Fast Moving):");
    console.table(abcReport.classAItems.slice(0, 5));

    console.log("\nDeteksi Dead Stock (Stok Mengendap / 0 Penjualan di 2026):");
    console.log(`Total Modal Mengendap di Dead Stock (Top 20): Rp ${abcReport.totalDeadStockCapital.toLocaleString("id-ID")}`);
    console.table(abcReport.topDeadStockItems);

    // 5. Customer Retention & Churn Risk Analytics
    console.log("\n--- [5] CUSTOMER INTELLIGENCE & CHURN RISK (Dormant > 90 Hari) ---");
    const custAnalytics = await AnalyticsBIService.getCustomerRetentionAnalytics(90, 5);
    console.log({
      pelangganAktif: custAnalytics.totalActiveCustomers,
      pelangganDormant: `${custAnalytics.totalDormantCustomers} (Tidak belanja > 90 hari)`
    });

    console.log("\nTop 5 VIP Customers (Berdasarkan Lifetime Value):");
    console.table(custAnalytics.topVipCustomers);

    console.log("\nTop 5 High-Risk Churn Customers (Pelanggan Besar yang Menghilang):");
    console.table(custAnalytics.highRiskChurnCustomers);

    console.log("\n================================================================");
    console.log("   ALL ANALYTICS & BI TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

run();
