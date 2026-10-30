import { sql } from "drizzle-orm";
import { db } from "../../db";
import { FifoInventoryService } from "../../services/fifo-inventory.service";
import { WarehouseConsignmentService } from "../../services/warehouse-consignment.service";
import type { ApiRouter } from "../router";

export function registerInventoryRoutes(router: ApiRouter) {
  // GET /api/inventory/warehouses - Daftar Gudang / Kantor
  router.get("/api/inventory/warehouses", async (ctx) => {
    const list = await WarehouseConsignmentService.listWarehouses();
    return ctx.json(list);
  });

  // GET /api/inventory/transfers - Daftar Riwayat Transfer Antar-Gudang
  router.get("/api/inventory/transfers", async (ctx) => {
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;

    const where = search
      ? sql`WHERE tr.notransaksi ILIKE ${'%' + search + '%'} OR tr.keterangan ILIKE ${'%' + search + '%'}`
      : sql``;

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
      LIMIT ${limit};
    `);

    return ctx.json(transfers);
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

  // GET /api/inventory/stock?office=UTM&itemCode=... - Stok Item per Gudang
  router.get("/api/inventory/stock", async (ctx) => {
    const office = ctx.query.office || "UTM";
    const itemCode = ctx.query.itemCode || ctx.query.search;
    const stock = await WarehouseConsignmentService.getWarehouseStock(office, itemCode);
    return ctx.json(stock);
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
