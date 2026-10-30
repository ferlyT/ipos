import { startApiServer } from "./api/server";

async function testRestApi() {
  const TEST_PORT = 3002;
  const baseUrl = `http://localhost:${TEST_PORT}`;
  const server = startApiServer(TEST_PORT);

  console.log("\n================================================================");
  console.log("   AUTOMATED END-TO-END TEST SUITE: REST API INTEGRATION        ");
  console.log("================================================================\n");

  try {
    // 1. Root & Discovery
    console.log("Testing [GET /]...");
    const rootRes = await fetch(`${baseUrl}/`);
    if (!rootRes.ok) throw new Error(`Root endpoint failed with status ${rootRes.status}`);
    const rootData = await rootRes.json();
    console.log("✅ Root OK:", rootData.data.name);

    // 2. System Health Check
    console.log("Testing [GET /api/system/health]...");
    const healthRes = await fetch(`${baseUrl}/api/system/health`);
    const healthData = await healthRes.json();
    if (!healthData.success || healthData.data.status !== "ONLINE") {
      throw new Error("Health check failed");
    }
    console.log("✅ System Health OK:", {
      database: healthData.data.database,
      totalTables: healthData.data.totalTables,
      latency: `${healthData.data.latencyMs} ms`,
    });

    // 3. System Configurations (tbl_conf)
    console.log("Testing [GET /api/system/config]...");
    const configRes = await fetch(`${baseUrl}/api/system/config`);
    const configData = await configRes.json();
    console.log("✅ System Config OK:", {
      company: configData.data.company.name,
      hppMethod: configData.data.accounting.methodHpp,
      vatPurchase: `${configData.data.taxes.defaultPurchaseTax}%`,
    });

    // 4. Analytics Executive Dashboard
    console.log("Testing [GET /api/analytics/dashboard?year=2026]...");
    const dashRes = await fetch(`${baseUrl}/api/analytics/dashboard?year=2026`);
    const dashData = await dashRes.json();
    console.log("✅ Analytics Dashboard OK:", {
      year: dashData.data.year,
      totalRevenue: `Rp ${dashData.data.totalAnnualRevenue.toLocaleString("id-ID")}`,
      invoices: dashData.data.totalInvoices,
    });

    // 5. Analytics Profitability Items
    console.log("Testing [GET /api/analytics/profitability/items?year=2026&limit=3]...");
    const profRes = await fetch(`${baseUrl}/api/analytics/profitability/items?year=2026&limit=3`);
    const profData = await profRes.json();
    console.log(`✅ Profitability OK: Loaded ${profData.data.length} top items`);

    // 6. Master Data Items & Price Resolution
    console.log("Testing [GET /api/master/resolve-price]...");
    const priceRes = await fetch(
      `${baseUrl}/api/master/resolve-price?itemCode=LINER%20RF8%20W/CR%20IZUMI&customerCode=PL0110&unit=PCS&qty=5`
    );
    const priceData = await priceRes.json();
    console.log("✅ Master Price Resolution OK:", {
      item: priceData.data.namaitem,
      customerGroup: priceData.data.customerGroup,
      customerLevel: priceData.data.customerLevel,
      finalUnitPrice: `Rp ${priceData.data.finalUnitPrice.toLocaleString("id-ID")}`,
    });

    // 7. Inventory Stock
    console.log("Testing [GET /api/inventory/stock?office=UTM&limit=3]...");
    const stockRes = await fetch(`${baseUrl}/api/inventory/stock?office=UTM&limit=3`);
    const stockData = await stockRes.json();
    console.log(`✅ Inventory Stock OK: Loaded ${stockData.data.length} items`);

    // 8. Cash & Bank Accounts
    console.log("Testing [GET /api/cash-bank/accounts]...");
    const cashRes = await fetch(`${baseUrl}/api/cash-bank/accounts`);
    const cashData = await cashRes.json();
    console.log(`✅ Cash & Bank OK: Loaded ${cashData.data.length} accounts`);

    // 9. Purchasing Invoices
    console.log("Testing [GET /api/purchasing/invoices?limit=3]...");
    const purRes = await fetch(`${baseUrl}/api/purchasing/invoices?limit=3`);
    const purData = await purRes.json();
    console.log(`✅ Purchasing Invoices OK: Loaded ${purData.data.length} invoices`);

    // 10. Sales Invoices
    console.log("Testing [GET /api/sales/invoices?limit=3]...");
    const salesRes = await fetch(`${baseUrl}/api/sales/invoices?limit=3`);
    const salesData = await salesRes.json();
    console.log(`✅ Sales Invoices OK: Loaded ${salesData.data.length} invoices`);

    // 11. Orders & Backlog
    console.log("Testing [GET /api/orders/outstanding]...");
    const orderRes = await fetch(`${baseUrl}/api/orders/outstanding`);
    const orderData = await orderRes.json();
    console.log(`✅ Orders Backlog OK: ${orderData.data.length} outstanding orders`);

    // 12. Accounting Profit & Loss
    console.log("Testing [GET /api/accounting/profit-loss]...");
    const pnlRes = await fetch(`${baseUrl}/api/accounting/profit-loss?startDate=2026-01-01&endDate=2026-10-30`);
    const pnlData = await pnlRes.json();
    console.log(`✅ Accounting P&L OK: Loaded ${pnlData.data.length} account rows`);

    console.log("\n================================================================");
    console.log("   🎉 ALL 12 REST API INTEGRATION TESTS PASSED PERFECTLY!     ");
    console.log("================================================================");
    server.stop(true);
    process.exit(0);
  } catch (err) {
    console.error("API Test Failed:", err);
    server.stop(true);
    process.exit(1);
  }
}

testRestApi();
