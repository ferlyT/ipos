import { WmsService } from "../../services/wms.service";
import type { ApiRouter } from "../router";

export function registerWmsRoutes(router: ApiRouter) {
  // GET /api/wms/zones - Daftar Zona Gudang
  router.get("/api/wms/zones", async (ctx) => {
    const office = ctx.query.office;
    const zones = await WmsService.listZones(office);
    return ctx.json(zones);
  });

  // POST /api/wms/zones - Tambah Zona Baru
  router.post("/api/wms/zones", async (ctx) => {
    if (!ctx.body || !ctx.body.kodezone || !ctx.body.namazone) {
      return ctx.error("Field 'kodezone' dan 'namazone' wajib diisi", 400);
    }
    const result = await WmsService.createZone(ctx.body);
    return ctx.json(result, 201);
  });

  // GET /api/wms/bins - Daftar Rak & Bin
  router.get("/api/wms/bins", async (ctx) => {
    const office = ctx.query.office;
    const aisle = ctx.query.aisle;
    const bins = await WmsService.listBins(office, aisle);
    return ctx.json(bins);
  });

  // GET /api/wms/bins/detail?kodebin=... - Detail Rak & Daftar Barang
  router.get("/api/wms/bins/detail", async (ctx) => {
    const kodebin = ctx.query.kodebin;
    if (!kodebin) {
      return ctx.error("Parameter 'kodebin' wajib diisi", 400);
    }
    const detail = await WmsService.getBinDetail(kodebin);
    if (!detail) {
      return ctx.error(`Bin '${kodebin}' tidak ditemukan`, 404);
    }
    return ctx.json(detail);
  });

  // POST /api/wms/bins/generate - Bulk Generator Bin
  router.post("/api/wms/bins/generate", async (ctx) => {
    const { kodekantor, kodezone, aisle, startRack, endRack, tiers, slots, maxQty } = ctx.body || {};
    if (!kodekantor || !kodezone || !aisle || !startRack || !endRack || !tiers || !slots) {
      return ctx.error("Parameter generator bin belum lengkap", 400);
    }
    const result = await WmsService.generateBins({
      kodekantor,
      kodezone,
      aisle,
      startRack: Number(startRack),
      endRack: Number(endRack),
      tiers: Number(tiers),
      slots: Number(slots),
      maxQty: maxQty ? Number(maxQty) : 500,
    });
    return ctx.json(result, 201);
  });

  // GET /api/wms/visual-map?office=... - Peta Denah Visual 2D Gudang
  router.get("/api/wms/visual-map", async (ctx) => {
    const office = ctx.query.office || "UTM";
    const map = await WmsService.getWarehouseVisualMap(office);
    return ctx.json(map);
  });

  // GET /api/wms/inbound/tasks - Daftar Tugas Inbound
  router.get("/api/wms/inbound/tasks", async (ctx) => {
    const office = ctx.query.office;
    const status = ctx.query.status;
    const tasks = await WmsService.listInboundTasks(office, status);
    return ctx.json(tasks);
  });

  // GET /api/wms/inbound/tasks/detail?notask=... - Detail Tugas Inbound
  router.get("/api/wms/inbound/tasks/detail", async (ctx) => {
    const notask = ctx.query.notask;
    if (!notask) {
      return ctx.error("Parameter 'notask' wajib diisi", 400);
    }
    const detail = await WmsService.getInboundTaskDetail(notask);
    if (!detail) {
      return ctx.error(`Tugas Inbound '${notask}' tidak ditemukan`, 404);
    }
    return ctx.json(detail);
  });

  // POST /api/wms/inbound/create-from-purchase - Buat Tugas Inbound dari Faktur Beli
  router.post("/api/wms/inbound/create-from-purchase", async (ctx) => {
    const { notransaksi, operator } = ctx.body || {};
    if (!notransaksi) {
      return ctx.error("Parameter 'notransaksi' faktur pembelian wajib diisi", 400);
    }
    try {
      const res = await WmsService.createInboundFromPurchase(notransaksi, operator || "SCANNER_USER");
      return ctx.json(res, 201);
    } catch (err: any) {
      return ctx.error(err.message || "Gagal membuat tugas inbound", 400);
    }
  });

  // POST /api/wms/inbound/putaway - Konfirmasi Putaway (Menaruh Barang ke Rak)
  router.post("/api/wms/inbound/putaway", async (ctx) => {
    const { notask, kodekantor, kodebin, kodeitem, jumlah, batch_no, expired_date, operator } = ctx.body || {};
    if (!kodekantor || !kodebin || !kodeitem || !jumlah) {
      return ctx.error("Field kodekantor, kodebin, kodeitem, dan jumlah wajib diisi", 400);
    }
    try {
      const res = await WmsService.executePutaway({
        notask,
        kodekantor,
        kodebin,
        kodeitem,
        jumlah: Number(jumlah),
        batch_no,
        expired_date,
        operator: operator || "SCANNER_USER",
      });
      return ctx.json(res);
    } catch (err: any) {
      return ctx.error(err.message || "Gagal melakukan putaway", 400);
    }
  });

  // GET /api/wms/outbound/tasks - Daftar Tugas Outbound
  router.get("/api/wms/outbound/tasks", async (ctx) => {
    const office = ctx.query.office;
    const status = ctx.query.status;
    const tasks = await WmsService.listOutboundTasks(office, status);
    return ctx.json(tasks);
  });

  // GET /api/wms/outbound/tasks/detail?notask=... - Detail Tugas Outbound
  router.get("/api/wms/outbound/tasks/detail", async (ctx) => {
    const notask = ctx.query.notask;
    if (!notask) {
      return ctx.error("Parameter 'notask' wajib diisi", 400);
    }
    const detail = await WmsService.getOutboundTaskDetail(notask);
    if (!detail) {
      return ctx.error(`Tugas Outbound '${notask}' tidak ditemukan`, 404);
    }
    return ctx.json(detail);
  });

  // POST /api/wms/outbound/create-from-sales - Buat Tugas Outbound dari Faktur Jual
  router.post("/api/wms/outbound/create-from-sales", async (ctx) => {
    const { notransaksi, operator } = ctx.body || {};
    if (!notransaksi) {
      return ctx.error("Parameter 'notransaksi' penjualan wajib diisi", 400);
    }
    try {
      const res = await WmsService.createOutboundFromSales(notransaksi, operator || "SCANNER_USER");
      return ctx.json(res, 201);
    } catch (err: any) {
      return ctx.error(err.message || "Gagal membuat tugas outbound", 400);
    }
  });

  // POST /api/wms/outbound/pick - Konfirmasi Picking Item dari Rak
  router.post("/api/wms/outbound/pick", async (ctx) => {
    const { notask, kodeitem, source_bin, jumlah, operator } = ctx.body || {};
    if (!notask || !kodeitem || !source_bin || !jumlah) {
      return ctx.error("Field notask, kodeitem, source_bin, dan jumlah wajib diisi", 400);
    }
    try {
      const res = await WmsService.executePickItem({
        notask,
        kodeitem,
        source_bin,
        jumlah: Number(jumlah),
        operator: operator || "SCANNER_USER",
      });
      return ctx.json(res);
    } catch (err: any) {
      return ctx.error(err.message || "Gagal memproses picking", 400);
    }
  });

  // POST /api/wms/relocate - Relokasi Antar-Bin
  router.post("/api/wms/relocate", async (ctx) => {
    const { kodekantor, from_bin, to_bin, kodeitem, jumlah, operator, keterangan } = ctx.body || {};
    if (!kodekantor || !from_bin || !to_bin || !kodeitem || !jumlah) {
      return ctx.error("Field kodekantor, from_bin, to_bin, kodeitem, dan jumlah wajib diisi", 400);
    }
    try {
      const res = await WmsService.executeRelocation({
        kodekantor,
        from_bin,
        to_bin,
        kodeitem,
        jumlah: Number(jumlah),
        operator: operator || "SCANNER_USER",
        keterangan,
      });
      return ctx.json(res);
    } catch (err: any) {
      return ctx.error(err.message || "Gagal relokasi barang", 400);
    }
  });
}
