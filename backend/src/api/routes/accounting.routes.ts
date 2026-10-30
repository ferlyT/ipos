import { AccountingService } from "../../services/accounting.service";
import type { ApiRouter } from "../router";
import { parsePagination } from "../pagination";

export function registerAccountingRoutes(router: ApiRouter) {
  // GET /api/accounting/profit-loss?startDate=2026-01-01&endDate=2026-12-31 - Laporan Laba Rugi
  router.get("/api/accounting/profit-loss", async (ctx) => {
    const startDate = ctx.query.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = ctx.query.endDate || new Date().toISOString().slice(0, 10);

    const report = await AccountingService.getLabaRugi(startDate, endDate);
    return ctx.json(report);
  });

  // GET /api/accounting/balance-sheet?startDate=2026-01-01&endDate=2026-12-31 - Laporan Neraca
  router.get("/api/accounting/balance-sheet", async (ctx) => {
    const startDate = ctx.query.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = ctx.query.endDate || new Date().toISOString().slice(0, 10);

    const report = await AccountingService.getNeraca(startDate, endDate);
    return ctx.json(report);
  });

  // GET /api/accounting/ledger?accountCode=1-1110&startDate=2026-01-01&endDate=2026-12-31&page=1&limit=50 - Buku Besar
  router.get("/api/accounting/ledger", async (ctx) => {
    const accountCode = ctx.query.accountCode;
    if (!accountCode) {
      return ctx.error("Parameter 'accountCode' wajib diisi", 400);
    }
    const startDate = ctx.query.startDate || `${new Date().getFullYear()}-01-01`;
    const endDate = ctx.query.endDate || new Date().toISOString().slice(0, 10);

    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const ledger = await AccountingService.getBukuBesar(accountCode, startDate, endDate);

    if (!isPaginated) {
      return ctx.json(ledger);
    }

    const total = ledger.mutasi.length;
    const pagedMutasi = ledger.mutasi.slice(offset, offset + limit);

    return ctx.json({
      ...ledger,
      mutasi: pagedMutasi,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });
}
