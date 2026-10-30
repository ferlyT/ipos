import { client } from "../../db";
import { PeriodClosingService } from "../../services/period-closing.service";
import type { ApiRouter } from "../router";

const periodService = new PeriodClosingService(client);

export function registerPeriodRoutes(router: ApiRouter) {
  // GET /api/system/period/status - Status Periode Aktif Sistem
  router.get("/api/system/period/status", async (ctx) => {
    const status = await periodService.getPeriodStatus();
    return ctx.json(status);
  });

  // GET /api/system/period/summary - Ringkasan Aktivitas Periode Tertentu
  router.get("/api/system/period/summary", async (ctx) => {
    const status = await periodService.getPeriodStatus();
    const month = ctx.query.month ? parseInt(ctx.query.month, 10) : status.currentMonth;
    const year = ctx.query.year ? parseInt(ctx.query.year, 10) : status.currentYear;

    const summary = await periodService.getPeriodSummary(month, year);
    return ctx.json(summary);
  });

  // POST /api/system/period/close-month - Eksekusi Tutup Buku Bulanan (Proses Data Bulanan)
  router.post("/api/system/period/close-month", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { month, year, user = "ADMIN" } = ctx.body;
    if (!month || !year) {
      return ctx.error("Parameter 'month' dan 'year' wajib diisi", 400);
    }

    const result = await periodService.executeMonthlyClosing(Number(month), Number(year), user);
    return ctx.json(result);
  });

  // POST /api/system/period/close-year - Eksekusi Tutup Buku Tahunan (Proses Data Tahunan)
  router.post("/api/system/period/close-year", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { year, user = "ADMIN" } = ctx.body;
    if (!year) {
      return ctx.error("Parameter 'year' wajib diisi", 400);
    }

    const result = await periodService.executeYearlyClosing(Number(year), user);
    return ctx.json(result);
  });

  // GET /api/system/period/history - Histori Mutasi & Periode Tutup Buku
  router.get("/api/system/period/history", async (ctx) => {
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 24;
    const history = await periodService.getClosingHistory(limit);
    return ctx.json(history);
  });
}
