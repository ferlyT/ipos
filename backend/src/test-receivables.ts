import postgres from "postgres";
import { ReceivableLoyaltyService } from "./services/receivable-loyalty.service";

const connStr = process.env.DATABASE_URL || "postgresql://admin:md51de468d6af1debdc21fe529310b29a3f@localhost:5444/i4_barunatrial";
const sql = postgres(connStr);

async function run() {
  try {
    const service = new ReceivableLoyaltyService(sql);

    console.log("=== 1. TESTING GET OUTSTANDING CUSTOMER INVOICES ===");
    const unpaid = await service.getOutstandingInvoices(undefined, "UTM");
    console.log(`Found ${unpaid.length} unpaid customer invoices.`);
    if (unpaid.length > 0) {
      console.log("Top 3 unpaid invoices:", unpaid.slice(0, 3));
    }

    console.log("\n=== 2. TESTING GET CUSTOMER AGING REPORT ===");
    const aging = await service.getAgingReport(new Date(), "UTM");
    console.log(`Found ${aging.length} customers with outstanding receivables.`);
    if (aging.length > 0) {
      console.log("Top 3 customers with highest receivables:", aging.slice(0, 3));
    }

    console.log("\n=== 3. TESTING CUSTOMER POINT BALANCE ===");
    const topCust = aging[0]?.kodepelanggan || "PL0110";
    const pointBal = await service.getCustomerPointBalance(topCust);
    console.log(`Customer ${topCust} Point Balance:`, pointBal);

    console.log("\n>>> ReceivableLoyaltyService TEST SUCCESSFUL! <<<");
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await sql.end();
  }
}

run();
