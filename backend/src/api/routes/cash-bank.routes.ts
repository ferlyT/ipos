import { sql } from "drizzle-orm";
import { client, db } from "../../db";
import { CashBankService } from "../../services/cash-bank.service";
import { PeriodClosingService } from "../../services/period-closing.service";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

const periodService = new PeriodClosingService(client);

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
    try {
      if (ctx.body.tanggal) {
        await periodService.assertPeriodNotClosed(ctx.body.tanggal);
      }
    } catch (err: any) {
      return ctx.error(err.message, 403);
    }
    const result = await CashBankService.recordCashIn(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/out - Kas Keluar Operasional / Biaya
  router.post("/api/cash-bank/out", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    try {
      if (ctx.body.tanggal) {
        await periodService.assertPeriodNotClosed(ctx.body.tanggal);
      }
    } catch (err: any) {
      return ctx.error(err.message, 403);
    }
    const result = await CashBankService.recordCashOut(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/cash-bank/transfer - Transfer Internal Antar Kas & Bank
  router.post("/api/cash-bank/transfer", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    try {
      if (ctx.body.tanggal) {
        await periodService.assertPeriodNotClosed(ctx.body.tanggal);
      }
    } catch (err: any) {
      return ctx.error(err.message, 403);
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

  // GET /api/cash-bank/drawers?limit=50&page=1 - Riwayat Shift Laci Kasir (Cash Drawers)
  router.get("/api/cash-bank/drawers", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM tbl_kaslaci;
    `);
    const total = Number((countRes[0] as any)?.count || 0);

    const rows = await db.execute(sql`
      SELECT 
        l.notransaksi,
        l.nama_user,
        l.shift,
        l.kas_awal::numeric,
        l.kas_masuk::numeric,
        l.kas_keluar::numeric,
        l.kas_akhir::numeric,
        l.wkt_mulai,
        l.wkt_akhir,
        l.login_flag,
        l.nama_komputer
      FROM tbl_kaslaci l
      ORDER BY l.wkt_mulai DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    const formatted = (rows as any[]).map((r) => {
      const kasAwal = Number(r.kas_awal || 0);
      const kasMasuk = Number(r.kas_masuk || 0);
      const kasKeluar = Number(r.kas_keluar || 0);
      const kasAkhirSistem = kasAwal + kasMasuk - kasKeluar;
      const isOpen = Boolean(r.login_flag);

      return {
        notransaksi: String(r.notransaksi).trim(),
        namaUser: String(r.nama_user || "KASIR").trim(),
        shift: String(r.shift || "1").trim(),
        namaKomputer: String(r.nama_komputer || "POS").trim(),
        wktMulai: r.wkt_mulai ? new Date(r.wkt_mulai).toISOString() : new Date().toISOString(),
        wktAkhir: r.wkt_akhir ? new Date(r.wkt_akhir).toISOString() : null,
        kasAwal,
        kasMasuk,
        kasKeluar,
        kasAkhirSistem,
        kasAkhirFisik: r.kas_akhir !== null ? Number(r.kas_akhir) : null,
        selisih: r.kas_akhir !== null ? Number(r.kas_akhir) - kasAkhirSistem : 0,
        isOpen,
      };
    });

    return ctx.json(formatPaginatedResponse(formatted, total, page, limit, isPaginated));
  });
}
