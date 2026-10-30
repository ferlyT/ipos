import { OrderPromotionService } from "../../services/order-promotion.service";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

export function registerOrderRoutes(router: ApiRouter) {
  // GET /api/orders/outstanding?type=PO|SO&page=1&limit=50 - Backlog Pesanan Belum Selesai
  router.get("/api/orders/outstanding", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const type = ctx.query.type as "PO" | "SO" | undefined;
    const orders = await OrderPromotionService.getOutstandingOrders(type);
    const total = orders.length;
    const paged = isPaginated ? orders.slice(offset, offset + limit) : orders;
    return ctx.json(formatPaginatedResponse(paged, total, page, limit, isPaginated));
  });

  // POST /api/orders - Buat Purchase Order (PO) atau Sales Order (SO)
  router.post("/api/orders", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await OrderPromotionService.createOrder(ctx.body);
    return ctx.json(result, 201);
  });

  // POST /api/orders/fulfill - Pemenuhan Barang Pesanan (Fulfillment Parsial / Penuh)
  router.post("/api/orders/fulfill", async (ctx) => {
    const { notransaksi, items } = ctx.body || {};
    if (!notransaksi || !Array.isArray(items)) {
      return ctx.error("Parameter 'notransaksi' dan array 'items' wajib disediakan", 400);
    }
    const result = await OrderPromotionService.fulfillOrder(notransaksi, items);
    return ctx.json(result);
  });

  // GET /api/orders/promotions/resolve?itemCode=...&qty=...&group=... - Resolusi Harga Promo & Tier Grosir
  router.get("/api/orders/promotions/resolve", async (ctx) => {
    const itemCode = ctx.query.itemCode;
    const qty = ctx.query.qty ? parseFloat(ctx.query.qty) : 1;
    const group = ctx.query.group;

    if (!itemCode) {
      return ctx.error("Parameter 'itemCode' wajib diisi", 400);
    }

    const price = await OrderPromotionService.resolvePromotionalPrice({
      kodeitem: itemCode,
      jumlah: qty,
      kodegrup: group,
    });
    return ctx.json(price);
  });
}
