import { sql } from "drizzle-orm";
import { db } from "../../db";
import { FifoInventoryService } from "../../services/fifo-inventory.service";
import { WarehouseConsignmentService } from "../../services/warehouse-consignment.service";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

export function registerInventoryRoutes(router: ApiRouter) {
  // GET /api/inventory/warehouses - Daftar Gudang / Kantor
  router.get("/api/inventory/warehouses", async (ctx) => {
    const list = await WarehouseConsignmentService.listWarehouses();
    return ctx.json(list);
  });

  // GET /api/inventory/transfers?search=...&limit=50&page=1 - Daftar Riwayat Transfer Antar-Gudang
  router.get("/api/inventory/transfers", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const search = ctx.query.search;

    const where = search
      ? sql`WHERE tr.notransaksi ILIKE ${'%' + search + '%'} OR tr.keterangan ILIKE ${'%' + search + '%'}`
      : sql``;

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM tbl_itrhd tr ${where};
    `);
    const total = Number((countRes[0] as any)?.count || 0);

    const transfers = await db.execute(sql`
      SELECT 
        tr.notransaksi,
        tr.tanggal::date AS tanggal,
        tr.kodekantor,
        tr.kantordari,
        kd.namakantor AS namakantordari,
        tr.kantortujuan,
        kt.namakantor AS namakantortujuan,
        tr.keterangan,
        tr.totalitem,
        tr.user1 AS operator
      FROM tbl_itrhd tr
      LEFT JOIN tbl_kantor kd ON tr.kantordari = kd.kodekantor
      LEFT JOIN tbl_kantor kt ON tr.kantortujuan = kt.kodekantor
      ${where}
      ORDER BY tr.tanggal DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return ctx.json(formatPaginatedResponse(transfers, total, page, limit, isPaginated));
  });

  // GET /api/inventory/transfers/detail?notransaksi=... - Detail Transfer & Baris Item
  router.get("/api/inventory/transfers/detail", async (ctx) => {
    const notransaksi = ctx.query.notransaksi;
    if (!notransaksi) {
      return ctx.error("Parameter 'notransaksi' wajib diisi", 400);
    }

    const header = await db.execute(sql`
      SELECT 
        tr.notransaksi,
        tr.tanggal::date AS tanggal,
        tr.kodekantor,
        tr.kantordari,
        kd.namakantor AS namakantordari,
        tr.kantortujuan,
        kt.namakantor AS namakantortujuan,
        tr.keterangan,
        tr.totalitem,
        tr.user1 AS operator
      FROM tbl_itrhd tr
      LEFT JOIN tbl_kantor kd ON tr.kantordari = kd.kodekantor
      LEFT JOIN tbl_kantor kt ON tr.kantortujuan = kt.kodekantor
      WHERE tr.notransaksi = ${notransaksi}
      LIMIT 1;
    `);

    if (header.length === 0) {
      return ctx.error(`Transfer '${notransaksi}' tidak ditemukan`, 404);
    }

    const items = await db.execute(sql`
      SELECT 
        d.nobaris,
        d.kodeitem,
        COALESCE(i.namaitem, d.kodeitem) AS namaitem,
        d.jumlah,
        d.satuan,
        d.harga,
        d.total,
        d.detinfo
      FROM tbl_itrdt d
      LEFT JOIN tbl_item i ON d.kodeitem = i.kodeitem
      WHERE d.notransaksi = ${notransaksi}
      ORDER BY d.nobaris ASC;
    `);

    return ctx.json({
      header: header[0],
      items
    });
  });

  // GET /api/inventory/stock?office=UTM&itemCode=...&search=...&limit=50&page=1&negativeOnly=true - Stok Item per Gudang
  router.get("/api/inventory/stock", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const office = ctx.query.office || "UTM";
    const search = ctx.query.itemCode || ctx.query.search;
    const negativeOnly = ctx.query.negativeOnly === "true" || ctx.query.minus === "true";

    const whereSearch = search
      ? sql`AND (s.kodeitem ILIKE ${'%' + search + '%'} OR i.namaitem ILIKE ${'%' + search + '%'})`
      : sql``;

    const whereNegative = negativeOnly ? sql`AND s.stok < 0` : sql``;

    // Hitung ringkasan statistik gudang real-time
    const summaryRes = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_sku,
        COALESCE(SUM(s.stok), 0)::numeric AS total_qty,
        COALESCE(SUM(s.stok * i.hargapokok), 0)::numeric AS total_val,
        COUNT(CASE WHEN s.stok < 0 THEN 1 END)::int AS negative_sku,
        COALESCE(SUM(CASE WHEN s.stok < 0 THEN s.stok ELSE 0 END), 0)::numeric AS negative_qty
      FROM tbl_itemstok s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.kantor = ${office};
    `);
    const sRow = summaryRes[0] as any;
    const summary = {
      totalSKU: Number(sRow?.total_sku || 0),
      totalPhysicalQty: Number(sRow?.total_qty || 0),
      totalValuation: Number(sRow?.total_val || 0),
      negativeSKU: Number(sRow?.negative_sku || 0),
      negativeQty: Number(sRow?.negative_qty || 0),
    };

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM tbl_itemstok s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.kantor = ${office} ${whereSearch} ${whereNegative};
    `);
    const total = Number((countRes[0] as any)?.count || 0);

    const rows = await db.execute(sql`
      SELECT 
        s.kodeitem,
        i.namaitem,
        i.satuan,
        s.kantor,
        k.namakantor,
        s.stok::numeric as stok_gudang,
        COALESCE(i.stok::numeric, 0) as stok_global,
        COALESCE(i.hargapokok::numeric, 0) as hargapokok
      FROM tbl_itemstok s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      JOIN tbl_kantor k ON s.kantor = k.kodekantor
      WHERE s.kantor = ${office} ${whereSearch} ${whereNegative}
      ORDER BY ${negativeOnly ? sql`s.stok ASC` : sql`s.kodeitem ASC`}
      LIMIT ${limit} OFFSET ${offset};
    `);

    const formatted = (rows as any[]).map((r) => ({
      kodeitem: String(r.kodeitem).trim(),
      namaitem: String(r.namaitem).trim(),
      satuan: String(r.satuan || "PCS").trim(),
      kantor: String(r.kantor).trim(),
      namakantor: String(r.namakantor).trim(),
      stokGudang: Number(r.stok_gudang || 0),
      stokGlobal: Number(r.stok_global || 0),
      hargapokok: Number(r.hargapokok || 0),
    }));

    if (!isPaginated) {
      return ctx.json(formatted);
    }

    return ctx.json({
      items: formatted,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });

  // GET /api/inventory/card?itemCode=...&office=UTM - Kartu Stok FIFO
  router.get("/api/inventory/card", async (ctx) => {
    const itemCode = ctx.query.itemCode;
    if (!itemCode) {
      return ctx.error("Parameter 'itemCode' wajib diisi", 400);
    }
    const office = ctx.query.office || "UTM";
    const card = await FifoInventoryService.getItemStockCard(itemCode, office);
    return ctx.json(card);
  });

  // POST /api/inventory/transfer - Transfer Antar Gudang (ITR)
  router.post("/api/inventory/transfer", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await WarehouseConsignmentService.transferStock(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/inventory/opname - Penyesuaian Stok Opname
  router.post("/api/inventory/opname", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await WarehouseConsignmentService.executeStockOpname(ctx.body);
    return ctx.json(result, 201);
  });

  // GET /api/inventory/consignments/summary?supplierCode=...
  router.get("/api/inventory/consignments/summary", async (ctx) => {
    const supplierCode = ctx.query.supplierCode;
    const summary = await WarehouseConsignmentService.getConsignmentSummary(supplierCode);
    return ctx.json(summary);
  });
}
