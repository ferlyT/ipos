import postgres from "postgres";
import { PurchasingPayableService } from "./services/purchasing-payable.service";

const connStr = process.env.DATABASE_URL || "postgresql://admin:md51de468d6af1debdc21fe529310b29a3f@localhost:5444/i4_barunatrial";
const sql = postgres(connStr);

async function run() {
  try {
    const service = new PurchasingPayableService(sql);

    console.log("=== 1. TESTING GET OUTSTANDING INVOICES ===");
    const unpaid = await service.getOutstandingInvoices(undefined, "UTM");
    console.log(`Found ${unpaid.length} outstanding invoices.`);
    if (unpaid.length > 0) {
      console.log("Top 3 unpaid invoices:", unpaid.slice(0, 3));
    }

    console.log("\n=== 2. TESTING GET AGING REPORT ===");
    const aging = await service.getAgingReport(new Date(), "UTM");
    console.log(`Found ${aging.length} suppliers with aging balances.`);
    if (aging.length > 0) {
      console.log("Top 3 suppliers with largest debt:", aging.slice(0, 3));
    }

    console.log("\n>>> PurchasingPayableService TEST SUCCESSFUL! <<<");
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await sql.end();
  }
}

run();
