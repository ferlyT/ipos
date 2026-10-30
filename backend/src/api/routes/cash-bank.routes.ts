import { CashBankService } from "../../services/cash-bank.service";
import type { ApiRouter } from "../router";

export function registerCashBankRoutes(router: ApiRouter) {
  // GET /api/cash-bank/accounts - Saldo Akun Kas & Bank
  router.get("/api/cash-bank/accounts", async (ctx) => {
    const accounts = await CashBankService.listCashBankAccounts();
    return ctx.json(accounts);
  });

  // POST /api/cash-bank/in - Kas Masuk Operasional / Pendapatan Lain
  router.post("/api/cash-bank/in", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.recordCashIn(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/out - Kas Keluar Operasional / Biaya
  router.post("/api/cash-bank/out", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.recordCashOut(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/transfer - Transfer Internal Antar Kas & Bank
  router.post("/api/cash-bank/transfer", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.transferCashBank(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/deposit - Titipan Deposit Pelanggan / Supplier
  router.post("/api/cash-bank/deposit", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.recordDeposit(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/drawer/open - Buka Shift Kasir
  router.post("/api/cash-bank/drawer/open", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.openCashDrawer(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/drawer/close - Tutup Shift Kasir
  router.post("/api/cash-bank/drawer/close", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await CashBankService.closeCashDrawer(ctx.body);
    return ctx.json(result);
  });

  // GET /api/cash-bank/drawers - Riwayat Shift Laci Kasir (Cash Drawers)
  router.get("/api/cash-bank/drawers", async (ctx) => {
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;
    const list = await CashBankService.listDrawerShifts(limit);
    return ctx.json(list);
  });
}
