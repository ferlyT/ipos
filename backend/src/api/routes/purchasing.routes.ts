import { sql } from "drizzle-orm";
import { client, db } from "../../db";
import { PurchasingPayableService } from "../../services/purchasing-payable.service";
import { PeriodClosingService } from "../../services/period-closing.service";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

const purchasingService = new PurchasingPayableService(client);
const periodService = new PeriodClosingService(client);

export function registerPurchasingRoutes(router: ApiRouter) {
  // GET /api/purchasing/invoices?search=...&limit=50&type=BL|RB&page=1 - Daftar Faktur Pembelian & Retur (tbl_imhd)
  router.get("/api/purchasing/invoices", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const search = ctx.query.search;
    const type = ctx.query.type;

    let whereClause = sql``;
    if (search && type) {
      whereClause = sql`WHERE (im.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}) AND im.tipe = ${type}`;
    } else if (search) {
      whereClause = sql`WHERE im.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}`;
    } else if (type) {
      whereClause = sql`WHERE im.tipe = ${type}`;
    }

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM tbl_imhd im
      LEFT JOIN tbl_supel sp ON im.kodesupel = sp.kode
      ${whereClause};
    `);
    const total = Number((countRes[0] as any)?.count || 0);

    const invoices = await db.execute(sql`
      SELECT 
        im.notransaksi,
        im.tanggal::date AS tanggal,
        im.tipe,
        im.kodekantor,
        im.kodesupel,
        sp.nama AS namasupel,
        im.subtotal,
        im.pajak,
        im.totalakhir,
        im.carabayar,
        im.byr_krd_jt::date AS jatuhtempo,
        (im.totalakhir - im.krd_jml_byr - im.krd_jml_pot) AS sisahutang
      FROM tbl_imhd im
      LEFT JOIN tbl_supel sp ON im.kodesupel = sp.kode
      ${whereClause}
      ORDER BY im.tanggal DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return ctx.json(formatPaginatedResponse(invoices, total, page, limit, isPaginated));
  });

  // GET /api/purchasing/invoices/detail?notransaksi=... - Detail Faktur Pembelian & Baris Item
  router.get("/api/purchasing/invoices/detail", async (ctx) => {
    const notransaksi = ctx.query.notransaksi;
    if (!notransaksi) {
      return ctx.error("Parameter 'notransaksi' wajib diisi", 400);
    }

    const header = await db.execute(sql`
      SELECT 
        im.notransaksi,
        im.tanggal::date AS tanggal,
        im.kodekantor,
        im.kodesupel,
        sp.nama AS namasupel,
        sp.alamat,
        sp.telepon,
        im.subtotal,
        COALESCE(im.potnomfaktur, 0) AS potongan,
        im.biayalain,
        im.pajak,
        im.totalakhir,
        im.carabayar,
        im.user1 AS operator,
        im.byr_krd_jt::date AS jatuhtempo,
        (im.totalakhir - im.krd_jml_byr - im.krd_jml_pot) AS sisahutang
      FROM tbl_imhd im
      LEFT JOIN tbl_supel sp ON im.kodesupel = sp.kode
      WHERE im.notransaksi = ${notransaksi}
      LIMIT 1;
    `);

    if (header.length === 0) {
      return ctx.error(`Faktur pembelian '${notransaksi}' tidak ditemukan`, 404);
    }

    const items = await db.execute(sql`
      SELECT 
        d.nobaris,
        d.kodeitem,
        COALESCE(i.namaitem, d.kodeitem) AS namaitem,
        d.jumlah,
        d.satuan,
        d.harga,
        d.potongan,
        d.total
      FROM tbl_imdt d
      LEFT JOIN tbl_item i ON d.kodeitem = i.kodeitem
      WHERE d.notransaksi = ${notransaksi}
      ORDER BY d.nobaris ASC;
    `);

    return ctx.json({
      header: header[0],
      items
    });
  });

  // POST /api/purchasing/returns - Buat Transaksi Retur Pembelian (RB)
  router.post("/api/purchasing/returns", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    try {
      await periodService.assertPeriodNotClosed(new Date());
    } catch (err: any) {
      return ctx.error(err.message, 403);
    }
    const { refInvoice, kodesupel, items, user = "ADMIN", kodekantor = "UTM" } = ctx.body;
    if (!refInvoice || !items || !Array.isArray(items) || items.length === 0) {
      return ctx.error("Parameter 'refInvoice' dan 'items' wajib disediakan", 400);
    }

    const result = await client.begin(async (tx) => {
      const now = new Date();
      const tglStr = now.toISOString().slice(0, 19).replace("T", " ");
      const notransaksi = `00${Date.now().toString().slice(-4)}/RB/${kodekantor}/${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(-2)}`;

      let subtotal = 0;
      let totalQty = 0;
      for (const it of items) {
        subtotal += Number(it.jumlah || 0) * Number(it.harga || 0);
        totalQty += Number(it.jumlah || 0);
      }

      // 1. Insert header tbl_imhd tipe = 'RB'
      await tx`
        INSERT INTO tbl_imhd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, totalitem,
          subtotal, potnomfaktur, pajak, biayalain, totalakhir, carabayar,
          jmltunai, jmlkredit, jmltransfer, jmlbg, user1, compname
        ) VALUES (
          ${notransaksi}, ${kodekantor}, ${tglStr}::timestamp, 'RB', ${kodesupel || 'SU0001'}, ${totalQty},
          ${subtotal}, 0, 0, 0, ${subtotal}, 'TN',
          0, 0, 0, 0, ${user}, 'BACKOFFICE'
        )
      `;

      // 2. Insert detail tbl_imdt & kurangi stok gudang (stok keluar kembali ke supplier)
      let nobaris = 1;
      for (const it of items) {
        const iddetail = `${notransaksi}-${kodekantor}-${Date.now()}-${nobaris}`;
        const lineTotal = Number(it.jumlah || 0) * Number(it.harga || 0);

        await tx`
          INSERT INTO tbl_imdt (
            iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total, dateupd
          ) VALUES (
            ${iddetail}, ${nobaris++}, ${notransaksi}, ${it.kodeitem}, ${it.jumlah},
            ${it.satuan || 'PCS'}, ${it.harga}, 0, ${lineTotal}, NOW()
          )
        `;

        await tx`
          UPDATE tbl_itemstok
          SET stok = stok - ${it.jumlah}
          WHERE kodeitem = ${it.kodeitem} AND kantor = ${kodekantor}
        `;

        await tx`
          UPDATE tbl_item
          SET stok = stok - ${it.jumlah}
          WHERE kodeitem = ${it.kodeitem}
        `;
      }

      // 3. Catat di tbl_rb_hutang (pemotong hutang faktur pembelian asal)
      await tx`
        INSERT INTO tbl_rb_hutang (
          noretur, notrspot, jmlpot
        ) VALUES (
          ${notransaksi}, ${refInvoice}, ${subtotal}
        )
      `;

      // 4. Update krd_jml_pot di faktur asal tbl_imhd
      await tx`
        UPDATE tbl_imhd
        SET krd_jml_pot = COALESCE(krd_jml_pot, 0) + ${subtotal}
        WHERE notransaksi = ${refInvoice}
      `;

      return {
        success: true,
        notransaksi,
        refInvoice,
        totalakhir: subtotal,
        totalitem: totalQty,
      };
    });

    return ctx.json(result, 201);
  });

  // GET /api/purchasing/payables/outstanding?supplierCode=...&office=UTM - Hutang Belum Lunas
  router.get("/api/purchasing/payables/outstanding", async (ctx) => {
    const supplierCode = ctx.query.supplierCode;
    const office = ctx.query.office || "UTM";
    const outstanding = await purchasingService.getOutstandingInvoices(supplierCode, office);
    return ctx.json(outstanding);
  });

  // GET /api/purchasing/payables/aging?supplierCode=...&office=UTM - Analisa Umur Hutang
  router.get("/api/purchasing/payables/aging", async (ctx) => {
    const office = ctx.query.office || "UTM";
    const dateStr = ctx.query.date || new Date().toISOString().split("T")[0];
    const raw = await purchasingService.getAgingReport(dateStr as any, office);
    const aging = (raw as any[]).map((r) => ({
      kode: r.kodesupel,
      nama: r.namasupel,
      telepon: r.telepon,
      current: Number(r.belum_jatuh_tempo || 0),
      days1_30: Number(r.hari_1_30 || 0),
      days31_60: Number(r.hari_31_60 || 0),
      days61_90: Number(r.hari_61_90 || 0),
      daysOver90: Number(r.lebih_90_hari || 0),
      total: Number(r.total_hutang || 0),
    }));
    return ctx.json(aging);
  });

  // POST /api/purchasing/payables/pay - Pelunasan Hutang Supplier
  router.post("/api/purchasing/payables/pay", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    try {
      const payDate = ctx.body.tanggal ? new Date(ctx.body.tanggal) : new Date();
      await periodService.assertPeriodNotClosed(payDate);
    } catch (err: any) {
      return ctx.error(err.message, 403);
    }
    const result = await purchasingService.paySupplierDebt({
      ...ctx.body,
      tanggal: ctx.body.tanggal ? new Date(ctx.body.tanggal) : new Date(),
    });
    return ctx.json(result, 201);
  });

  // POST /api/purchasing/invoices - Buat Faktur Pembelian Baru
  router.post("/api/purchasing/invoices", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await purchasingService.createPurchaseInvoice({
      ...ctx.body,
      tanggal: ctx.body.tanggal ? new Date(ctx.body.tanggal) : new Date(),
    });
    return ctx.json(result, 201);
  });
}
