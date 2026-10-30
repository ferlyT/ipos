import { sql } from "drizzle-orm";
import { db } from "../../db";
import { AdvancedMasterService } from "../../services/advanced-master.service";
import type { ApiRouter } from "../router";

export function registerMasterRoutes(router: ApiRouter) {
  // GET /api/master/items?search=...&limit=50 - Cari Item / Master Barang
  router.get("/api/master/items", async (ctx) => {
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;

    const where = search
      ? sql`WHERE it.kodeitem ILIKE ${'%' + search + '%'} OR it.namaitem ILIKE ${'%' + search + '%'}`
      : sql``;

    const items = await db.execute(sql`
      SELECT 
        it.kodeitem,
        it.namaitem,
        it.jenis,
        it.merek,
        it.satuan,
        it.hargapokok,
        it.hargajual1 AS hargajual,
        it.tipe AS tipeitem
      FROM tbl_item it
      ${where}
      ORDER BY it.namaitem ASC
      LIMIT ${limit};
    `);

    return ctx.json(items);
  });

  // POST /api/master/items - Tambah Item Barang Baru
  router.post("/api/master/items", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const {
      kodeitem,
      namaitem,
      jenis,
      merek,
      satuan,
      hargapokok,
      hargajual,
      rak,
      tipe,
    } = ctx.body;

    if (!kodeitem || !namaitem) {
      return ctx.error("Parameter 'kodeitem' dan 'namaitem' wajib diisi", 400);
    }

    const hpp = Number(hargapokok || 0);
    const hj = Number(hargajual || 0);
    const sat = satuan || "PCS";
    const tip = tipe || "B";

    await db.execute(sql`
      INSERT INTO tbl_item (
        kodeitem, namaitem, jenis, merek, satuan, hargapokok, hargajual1, rak, tipe,
        stok, statusjual, statushapus, acc_hpp, acc_pendapatan, acc_persediaan, dateupd
      ) VALUES (
        ${kodeitem}, ${namaitem}, ${jenis || 'UMUM'}, ${merek || '-'}, ${sat}, ${hpp}, ${hj},
        ${rak || '-'}, ${tip}, 0, true, false, '5-1100', '4-1100', '1-1301', NOW()
      );
    `);

    // Inisialisasi stok 0 di gudang UTM dan CAB1
    try {
      await db.execute(sql`
        INSERT INTO tbl_itemstok (kodeitem, kantor, stok)
        VALUES (${kodeitem}, 'UTM', 0), (${kodeitem}, 'CAB1', 0);
      `);
    } catch {
      // Abaikan jika sudah ada
    }

    return ctx.json({ success: true, kodeitem, namaitem }, 201);
  });

  // GET /api/master/barcode?barcode=... - Cari Barang by Barcode
  router.get("/api/master/barcode", async (ctx) => {
    const barcode = ctx.query.barcode;
    if (!barcode) {
      return ctx.error("Parameter 'barcode' wajib diisi", 400);
    }
    const item = await AdvancedMasterService.findItemByBarcode(barcode);
    if (!item) {
      return ctx.error(`Barang dengan barcode '${barcode}' tidak ditemukan`, 404);
    }
    return ctx.json(item);
  });

  // GET /api/master/barcode-catalog?search=...&limit=50 - Katalog Barang untuk Label Barcode & Price Tag
  router.get("/api/master/barcode-catalog", async (ctx) => {
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;

    const where = search
      ? sql`WHERE it.kodeitem ILIKE ${'%' + search + '%'} OR it.namaitem ILIKE ${'%' + search + '%'} OR sat.kodebarcode ILIKE ${'%' + search + '%'}`
      : sql``;

    const items = await db.execute(sql`
      SELECT 
        it.kodeitem,
        it.namaitem,
        it.satuan,
        it.hargajual1 AS hargajual,
        it.hargapokok,
        COALESCE(sat.kodebarcode, it.kodeitem) AS barcode,
        it.jenis,
        it.merek,
        COALESCE(stk.stok, 0)::numeric AS stok
      FROM tbl_item it
      LEFT JOIN tbl_itemsatuanjml sat ON it.kodeitem = sat.kodeitem AND sat.tipe = 'D'
      LEFT JOIN tbl_itemstok stk ON it.kodeitem = stk.kodeitem AND stk.kantor = 'UTM'
      ${where}
      ORDER BY it.namaitem ASC
      LIMIT ${limit};
    `);

    return ctx.json(items);
  });

  // GET /api/master/units?itemCode=... - Daftar Multi-Satuan Item
  router.get("/api/master/units", async (ctx) => {
    const itemCode = ctx.query.itemCode;
    if (!itemCode) {
      return ctx.error("Parameter 'itemCode' wajib diisi", 400);
    }
    const units = await AdvancedMasterService.getItemUnits(itemCode);
    return ctx.json(units);
  });

  // GET /api/master/resolve-price?itemCode=...&customerCode=...&unit=...&qty=... - Hitung Harga Bertingkat
  router.get("/api/master/resolve-price", async (ctx) => {
    const itemCode = ctx.query.itemCode;
    const customerCode = ctx.query.customerCode;
    const unit = ctx.query.unit;
    const qty = ctx.query.qty ? parseFloat(ctx.query.qty) : 1;

    if (!itemCode || !customerCode || !unit) {
      return ctx.error("Parameter 'itemCode', 'customerCode', dan 'unit' wajib diisi", 400);
    }

    const price = await AdvancedMasterService.resolveItemPrice(itemCode, unit, qty, customerCode);
    return ctx.json(price);
  });

  // GET /api/master/bom?itemCode=... - BOM / Resep Item Rakitan
  router.get("/api/master/bom", async (ctx) => {
    const itemCode = ctx.query.itemCode;
    if (!itemCode) {
      return ctx.error("Parameter 'itemCode' wajib diisi", 400);
    }
    const bom = await AdvancedMasterService.getAssemblyBOM(itemCode);
    return ctx.json(bom);
  });

  // GET /api/master/bom-recipes - Daftar Seluruh Resep Rakitan
  router.get("/api/master/bom-recipes", async (ctx) => {
    const list = await AdvancedMasterService.listBOMRecipes();
    return ctx.json(list);
  });

  // POST /api/master/bom - Simpan/Update Formula BOM
  router.post("/api/master/bom", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { parentItemCode, components } = ctx.body;
    if (!parentItemCode || !components || !Array.isArray(components)) {
      return ctx.error("Parameter 'parentItemCode' dan array 'components' wajib diisi", 400);
    }
    await AdvancedMasterService.saveAssemblyBOM(parentItemCode, components);
    return ctx.json({ success: true, parentItemCode }, 201);
  });

  // POST /api/master/bom/simulate - Simulasi Produksi Perakitan
  router.post("/api/master/bom/simulate", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { parentItemCode, qtyToBuild, officeCode } = ctx.body;
    if (!parentItemCode) {
      return ctx.error("Parameter 'parentItemCode' wajib diisi", 400);
    }
    const qty = Number(qtyToBuild || 1);
    const office = officeCode || "UTM";
    const sim = await AdvancedMasterService.simulateAssembly(parentItemCode, qty, office);
    return ctx.json(sim);
  });

  // POST /api/master/bom/assemble - Eksekusi Perakitan (Potong Bahan Baku, Tambah Barang Jadi)
  router.post("/api/master/bom/assemble", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { parentItemCode, qtyToBuild, officeCode, user } = ctx.body;
    if (!parentItemCode) {
      return ctx.error("Parameter 'parentItemCode' wajib diisi", 400);
    }
    const qty = Number(qtyToBuild || 1);
    const office = officeCode || "UTM";
    const operator = user || "ADMIN";
    const result = await AdvancedMasterService.executeAssembly(parentItemCode, qty, office, operator);
    return ctx.json(result, 201);
  });

  // GET /api/master/customer-groups - Daftar Grup Pelanggan
  router.get("/api/master/customer-groups", async (ctx) => {
    const groups = await AdvancedMasterService.listCustomerGroups();
    return ctx.json(groups);
  });

  // GET /api/master/contacts?type=PL|SU&search=...&limit=50 - Daftar Pelanggan & Supplier
  router.get("/api/master/contacts", async (ctx) => {
    const type = ctx.query.type;
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;

    let whereClause = sql`WHERE 1=1`;
    if (type) {
      whereClause = sql`${whereClause} AND s.tipe = ${type}`;
    }
    if (search) {
      whereClause = sql`${whereClause} AND (s.kode ILIKE ${'%' + search + '%'} OR s.nama ILIKE ${'%' + search + '%'} OR s.kota ILIKE ${'%' + search + '%'})`;
    }

    const contacts = await db.execute(sql`
      SELECT 
        s.kode,
        s.nama,
        s.tipe,
        s.alamat,
        s.kota,
        s.telepon,
        s.kontak,
        s.email,
        COALESCE(s.limitjmlhupi::numeric, 0) as limitpiutang,
        COALESCE(s.limitharihupi, 0) as limithari,
        COALESCE(s.harijt, 0) as termin,
        COALESCE(s.kgrup, 'General') as grup
      FROM tbl_supel s
      ${whereClause}
      ORDER BY s.nama ASC
      LIMIT ${limit};
    `);

    return ctx.json(contacts);
  });

  // POST /api/master/contacts - Tambah Kontak Pelanggan / Supplier Baru
  router.post("/api/master/contacts", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { kode, tipe, nama, alamat, kota, telepon, kontak, email, limitpiutang, termin, grup } = ctx.body;
    if (!kode || !tipe || !nama) {
      return ctx.error("Parameter 'kode', 'tipe' (PL/SU), dan 'nama' wajib diisi", 400);
    }

    await db.execute(sql`
      INSERT INTO tbl_supel (
        kode, tipe, nama, alamat, kota, telepon, kontak, email, limitjmlhupi, harijt, kgrup
      ) VALUES (
        ${kode}, ${tipe}, ${nama}, ${alamat || ''}, ${kota || ''}, 
        ${telepon || ''}, ${kontak || ''}, ${email || ''}, 
        ${limitpiutang || 0}, ${termin || 0}, ${grup || 'General'}
      );
    `);

    return ctx.json({ success: true, kode, nama, tipe }, 201);
  });
}
