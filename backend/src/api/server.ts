import { ApiRouter } from "./router";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerSystemRoutes } from "./routes/system.routes";
import { registerAnalyticsRoutes } from "./routes/analytics.routes";
import { registerInventoryRoutes } from "./routes/inventory.routes";
import { registerMasterRoutes } from "./routes/master.routes";
import { registerPurchasingRoutes } from "./routes/purchasing.routes";
import { registerSalesRoutes } from "./routes/sales.routes";
import { registerOrderRoutes } from "./routes/orders.routes";
import { registerCashBankRoutes } from "./routes/cash-bank.routes";
import { registerAccountingRoutes } from "./routes/accounting.routes";
import { registerWmsRoutes } from "./routes/wms.routes";

export function createApiApp(): ApiRouter {
  const router = new ApiRouter();

  // Root Welcome & Sitemap
  router.get("/", (ctx) => {
    return ctx.json({
      name: "iPos 4.0 Modern Enterprise REST API",
      version: "1.0.0",
      runtime: `Bun ${Bun.version}`,
      endpoints: {
        system: ["/api/system/health", "/api/system/config", "/api/system/users"],
        analytics: [
          "/api/analytics/dashboard",
          "/api/analytics/profitability/items",
          "/api/analytics/profitability/categories",
          "/api/analytics/inventory/abc",
          "/api/analytics/customers/retention",
        ],
        inventory: [
          "/api/inventory/warehouses",
          "/api/inventory/stock",
          "/api/inventory/card",
          "/api/inventory/transfer",
          "/api/inventory/opname",
          "/api/inventory/consignments/summary",
        ],
        master: [
          "/api/master/items",
          "/api/master/barcode",
          "/api/master/units",
          "/api/master/resolve-price",
          "/api/master/bom",
          "/api/master/customer-groups",
        ],
        purchasing: [
          "/api/purchasing/invoices",
          "/api/purchasing/payables/outstanding",
          "/api/purchasing/payables/aging",
          "/api/purchasing/payables/pay",
        ],
        sales: [
          "/api/sales/invoices",
          "/api/sales/receivables/outstanding",
          "/api/sales/receivables/aging",
          "/api/sales/receivables/pay",
          "/api/sales/loyalty",
        ],
        orders: [
          "/api/orders/outstanding",
          "/api/orders",
          "/api/orders/fulfill",
          "/api/orders/promotions/resolve",
        ],
        cashBank: [
          "/api/cash-bank/accounts",
          "/api/cash-bank/in",
          "/api/cash-bank/out",
          "/api/cash-bank/transfer",
          "/api/cash-bank/deposit",
          "/api/cash-bank/drawer/open",
          "/api/cash-bank/drawer/close",
        ],
        accounting: [
          "/api/accounting/profit-loss",
          "/api/accounting/balance-sheet",
          "/api/accounting/ledger",
        ],
      },
      documentation: "DOKUMENTASI_REST_API_IPOS4.md",
    });
  });

  // Register all module route groups
  registerAuthRoutes(router);
  registerSystemRoutes(router);
  registerAnalyticsRoutes(router);
  registerInventoryRoutes(router);
  registerMasterRoutes(router);
  registerPurchasingRoutes(router);
  registerSalesRoutes(router);
  registerOrderRoutes(router);
  registerCashBankRoutes(router);
  registerAccountingRoutes(router);
  registerWmsRoutes(router);

  return router;
}

export function startApiServer(port: number = 3001) {
  const app = createApiApp();

  const server = Bun.serve({
    port,
    async fetch(req) {
      return await app.handle(req);
    },
  });

  console.log("================================================================");
  console.log(`   🚀 iPos 4.0 Modern Enterprise REST API Server is RUNNING`);
  console.log(`   🌐 Server URL  : http://localhost:${server.port}`);
  console.log(`   📖 Health Check: http://localhost:${server.port}/api/system/health`);
  console.log(`   📊 BI Dashboard: http://localhost:${server.port}/api/analytics/dashboard`);
  console.log("================================================================");

  return server;
}
