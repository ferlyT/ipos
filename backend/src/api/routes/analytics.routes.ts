import { AnalyticsBIService } from "../../services/analytics-bi.service";
import type { ApiRouter } from "../router";

export function registerAnalyticsRoutes(router: ApiRouter) {
  // GET /api/analytics/dashboard?year=2026
  router.get("/api/analytics/dashboard", async (ctx) => {
    const year = ctx.query.year ? parseInt(ctx.query.year, 10) : 2026;
    const dashboard = await AnalyticsBIService.getExecutiveDashboard(year);
    return ctx.json(dashboard);
  });

  // GET /api/analytics/profitability/items?year=2026&limit=20
  router.get("/api/analytics/profitability/items", async (ctx) => {
    const year = ctx.query.year ? parseInt(ctx.query.year, 10) : 2026;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 20;
    const startDate = ctx.query.startDate || `${year}-01-01`;
    const items = await AnalyticsBIService.getItemProfitability(limit, startDate);
    return ctx.json(items);
  });

  // GET /api/analytics/profitability/categories?year=2026
  router.get("/api/analytics/profitability/categories", async (ctx) => {
    const year = ctx.query.year ? parseInt(ctx.query.year, 10) : 2026;
    const startDate = ctx.query.startDate || `${year}-01-01`;
    const categories = await AnalyticsBIService.getCategoryProfitability(startDate);
    return ctx.json(categories);
  });

  // GET /api/analytics/inventory/abc?year=2026
  router.get("/api/analytics/inventory/abc", async (ctx) => {
    const year = ctx.query.year ? parseInt(ctx.query.year, 10) : 2026;
    const startDate = ctx.query.startDate || `${year}-01-01`;
    const abc = await AnalyticsBIService.getABCInventoryAnalysis(startDate);
    return ctx.json(abc);
  });

  // GET /api/analytics/customers/retention?churnDays=90
  router.get("/api/analytics/customers/retention", async (ctx) => {
    const churnDays = ctx.query.churnDays ? parseInt(ctx.query.churnDays, 10) : 90;
    const retention = await AnalyticsBIService.getCustomerRetentionAnalytics(churnDays);
    return ctx.json(retention);
  });
}
