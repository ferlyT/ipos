import { sql } from "drizzle-orm";
import { db } from "../../db";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

export function registerAuditRoutes(router: ApiRouter) {
  /**
   * GET /api/audit-logs
   * Mengambil daftar log audit delete & update dengan filter dan pagination
   */
  router.get("/api/audit-logs", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const modul = ctx.query.modul; // 'PENJUALAN' | 'PEMBELIAN'
    const action = ctx.query.action; // 'UPDATE' | 'DELETE'
    const notransaksi = ctx.query.notransaksi;
    const table_name = ctx.query.table;
    const user = ctx.query.user;
    const schema = ctx.query.schema;

    const conditions: any[] = [];
    if (schema) conditions.push(sql`schema_name = ${schema}`);
    if (modul) conditions.push(sql`modul = ${modul.toUpperCase()}`);
    if (action) conditions.push(sql`action_type = ${action.toUpperCase()}`);
    if (notransaksi) conditions.push(sql`notransaksi ILIKE ${'%' + notransaksi + '%'}`);
    if (table_name) conditions.push(sql`table_name = ${table_name}`);
    if (user) conditions.push(sql`user_app ILIKE ${'%' + user + '%'}`);

    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    // Total Count
    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM tbl_audit_log
      ${whereClause};
    `);
    const total = Number((countRes[0] as any)?.count || 0);

    // List logs
    const logs = await db.execute(sql`
      SELECT 
        id,
        schema_name,
        table_name,
        action_type,
        modul,
        notransaksi,
        iddetail,
        kodeitem,
        kodekantor,
        kodesupel,
        total_transaksi,
        user_app,
        user_db,
        ip_client,
        perubahan_kolom,
        created_at
      FROM tbl_audit_log
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return ctx.json(formatPaginatedResponse(logs, total, page, limit, isPaginated));
  });

  /**
   * GET /api/audit-logs/detail?id=...
   * Mengambil detail snapshot data_lama dan data_baru (JSON)
   */
  router.get("/api/audit-logs/detail", async (ctx) => {
    const id = ctx.query.id;
    if (!id) {
      return ctx.error("Parameter 'id' wajib diisi", 400);
    }

    const logRes = await db.execute(sql`
      SELECT *
      FROM tbl_audit_log
      WHERE id = ${Number(id)}
      LIMIT 1;
    `);

    if (logRes.length === 0) {
      return ctx.error(`Log audit dengan ID '${id}' tidak ditemukan`, 404);
    }

    const log = logRes[0] as any;
    let parsedOld = null;
    let parsedNew = null;

    try {
      if (log.data_lama) parsedOld = JSON.parse(log.data_lama);
    } catch {
      parsedOld = log.data_lama;
    }

    try {
      if (log.data_baru) parsedNew = JSON.parse(log.data_baru);
    } catch {
      parsedNew = log.data_baru;
    }

    return ctx.json({
      ...log,
      data_lama_parsed: parsedOld,
      data_baru_parsed: parsedNew,
    });
  });

  /**
   * GET /api/audit-logs/summary
   * Statistik rekapitulasi audit: berapa update, berapa delete, per modul
   */
  router.get("/api/audit-logs/summary", async (ctx) => {
    const stats = await db.execute(sql`
      SELECT 
        modul,
        action_type,
        COUNT(*)::int AS total
      FROM tbl_audit_log
      GROUP BY modul, action_type
      ORDER BY modul, action_type;
    `);

    const recentDeletions = await db.execute(sql`
      SELECT 
        id,
        schema_name,
        table_name,
        modul,
        notransaksi,
        user_app,
        perubahan_kolom,
        created_at
      FROM tbl_audit_log
      WHERE action_type = 'DELETE'
      ORDER BY id DESC
      LIMIT 10;
    `);

    return ctx.json({
      summary: stats,
      recentDeletions,
    });
  });
}
