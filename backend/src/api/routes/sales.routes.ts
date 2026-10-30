import { sql } from "drizzle-orm";
import { client, db } from "../../db";
import { ReceivableLoyaltyService } from "../../services/receivable-loyalty.service";
import type { ApiRouter } from "../router";

const receivableService = new ReceivableLoyaltyService(client);

export function registerSalesRoutes(router: ApiRouter) {
  // GET /api/sales/invoices?search=...&limit=50&type=JL|RJ - Daftar Faktur Penjualan & Retur (tbl_ikhd)
  router.get("/api/sales/invoices", async (ctx) => {
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;
    const type = ctx.query.type;

    let whereClause = sql``;
    if (search && type) {
      whereClause = sql`WHERE (ik.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}) AND ik.tipe = ${type}`;
    } else if (search) {
      whereClause = sql`WHERE ik.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}`;
    } else if (type) {
      whereClause = sql`WHERE ik.tipe = ${type}`;
    }

    const invoices = await db.execute(sql`
      SELECT 
        ik.notransaksi,
        ik.tanggal::date AS tanggal,
        ik.tipe,
        ik.kodekantor,
        ik.kodesupel,
        sp.nama AS namapelanggan,
        ik.subtotal,
        ik.pajak,
        ik.totalakhir,
        ik.carabayar,
        ik.byr_krd_jt::date AS jatuhtempo,
        (ik.totalakhir - ik.krd_jml_byr - ik.krd_jml_pot) AS sisapiutang
      FROM tbl_ikhd ik
      LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode
      ${whereClause}
      ORDER BY ik.tanggal DESC
      LIMIT ${limit};
    `);

    return ctx.json(invoices);
  });

  // GET /api/sales/invoices/detail?notransaksi=... - Detail Faktur Penjualan & Baris Item
  router.get("/api/sales/invoices/detail", async (ctx) => {
    const notransaksi = ctx.query.notransaksi;
    if (!notransaksi) {
      return ctx.error("Parameter 'notransaksi' wajib diisi", 400);
    }

    const header = await db.execute(sql`
      SELECT 
        ik.notransaksi,
        ik.tanggal::date AS tanggal,
        ik.kodekantor,
        ik.kodesupel,
        sp.nama AS namapelanggan,
        sp.alamat,
        sp.telepon,
        ik.subtotal,
        COALESCE(ik.potnomfaktur, 0) AS potongan,
        ik.biayalain,
        ik.pajak,
        ik.totalakhir,
        ik.carabayar,
        ik.user1 AS kasir,
        ik.byr_krd_jt::date AS jatuhtempo,
        (ik.totalakhir - ik.krd_jml_byr - ik.krd_jml_pot) AS sisapiutang
      FROM tbl_ikhd ik
      LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode
      WHERE ik.notransaksi = ${notransaksi}
      LIMIT 1;
    `);

    if (header.length === 0) {
      return ctx.error(`Faktur penjualan '${notransaksi}' tidak ditemukan`, 404);
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
      FROM tbl_ikdt d
      LEFT JOIN tbl_item i ON d.kodeitem = i.kodeitem
      WHERE d.notransaksi = ${notransaksi}
      ORDER BY d.nobaris ASC;
    `);

    return ctx.json({
      header: header[0],
      items
    });
  });

  // POST /api/sales/invoices - Buat Faktur Penjualan Baru (POS Kasir / Grosir)
  router.post("/api/sales/invoices", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await receivableService.createSalesInvoice({
      ...ctx.body,
      tanggal: ctx.body.tanggal || new Date().toISOString(),
    });
    return ctx.json(result, 201);
  });

  // POST /api/sales/returns - Buat Transaksi Retur Penjualan (RJ)
  router.post("/api/sales/returns", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const { refInvoice, kodesupel, items, user = "ADMIN", kodekantor = "UTM" } = ctx.body;
    if (!refInvoice || !items || !Array.isArray(items) || items.length === 0) {
      return ctx.error("Parameter 'refInvoice' dan 'items' wajib disediakan", 400);
    }

    const result = await client.begin(async (tx) => {
      const now = new Date();
      const tglStr = now.toISOString().slice(0, 19).replace("T", " ");
      const notransaksi = `00${Date.now().toString().slice(-4)}/RJ/${kodekantor}/${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(-2)}`;

      let subtotal = 0;
      let totalQty = 0;
      for (const it of items) {
        subtotal += Number(it.jumlah || 0) * Number(it.harga || 0);
        totalQty += Number(it.jumlah || 0);
      }

      // 1. Insert header tbl_ikhd tipe = 'RJ'
      await tx`
        INSERT INTO tbl_ikhd (
          notransaksi, kodekantor, tanggal, tipe, kodesupel, totalitem,
          subtotal, potnomfaktur, pajak, biayalain, totalakhir, carabayar,
          jmltunai, jmlkredit, jmldebit, jmlkk, jmlemoney, point_ik, user1, compname
        ) VALUES (
          ${notransaksi}, ${kodekantor}, ${tglStr}::timestamp, 'RJ', ${kodesupel || 'PL0001'}, ${totalQty},
          ${subtotal}, 0, 0, 0, ${subtotal}, 'TN',
          0, 0, 0, 0, 0, 0, ${user}, 'BACKOFFICE'
        )
      `;

      // 2. Insert detail tbl_ikdt & kembalikan stok ke gudang (stok bertambah)
      let nobaris = 1;
      for (const it of items) {
        const iddetail = `${notransaksi}-${kodekantor}-${Date.now()}-${nobaris}`;
        const lineTotal = Number(it.jumlah || 0) * Number(it.harga || 0);

        await tx`
          INSERT INTO tbl_ikdt (
            iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total, dateupd
          ) VALUES (
            ${iddetail}, ${nobaris++}, ${notransaksi}, ${it.kodeitem}, ${it.jumlah},
            ${it.satuan || 'PCS'}, ${it.harga}, 0, ${lineTotal}, NOW()
          )
        `;

        await tx`
          UPDATE tbl_itemstok
          SET stok = stok + ${it.jumlah}
          WHERE kodeitem = ${it.kodeitem} AND kantor = ${kodekantor}
        `;

        await tx`
          UPDATE tbl_item
          SET stok = stok + ${it.jumlah}
          WHERE kodeitem = ${it.kodeitem}
        `;
      }

      // 3. Catat di tbl_rj_piutang (pemotong piutang faktur asal)
      await tx`
        INSERT INTO tbl_rj_piutang (
          noretur, notrspot, jmlpot
        ) VALUES (
          ${notransaksi}, ${refInvoice}, ${subtotal}
        )
      `;

      // 4. Update krd_jml_pot di faktur asal tbl_ikhd
      await tx`
        UPDATE tbl_ikhd
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

  // GET /api/sales/receivables/outstanding?customerCode=...&office=UTM - Piutang Belum Lunas
  router.get("/api/sales/receivables/outstanding", async (ctx) => {
    const customerCode = ctx.query.customerCode;
    const office = ctx.query.office || "UTM";
    const outstanding = await receivableService.getOutstandingInvoices(customerCode, office);
    return ctx.json(outstanding);
  });

  // GET /api/sales/receivables/aging?customerCode=...&office=UTM - Analisa Umur Piutang
  router.get("/api/sales/receivables/aging", async (ctx) => {
    const office = ctx.query.office || "UTM";
    const dateStr = ctx.query.date || new Date().toISOString().split("T")[0];
    const raw = await receivableService.getAgingReport(dateStr as any, office);
    const aging = (raw as any[]).map((r) => ({
      kode: r.kodepelanggan,
      nama: r.namapelanggan,
      telepon: r.telepon,
      current: Number(r.belum_jatuh_tempo || 0),
      days1_30: Number(r.hari_1_30 || 0),
      days31_60: Number(r.hari_31_60 || 0),
      days61_90: Number(r.hari_61_90 || 0),
      daysOver90: Number(r.lebih_90_hari || 0),
      total: Number(r.total_piutang || 0),
    }));
    return ctx.json(aging);
  });

  // POST /api/sales/receivables/pay - Pelunasan Piutang Pelanggan
  router.post("/api/sales/receivables/pay", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await receivableService.payCustomerDebt({
      ...ctx.body,
      tanggal: ctx.body.tanggal ? new Date(ctx.body.tanggal) : new Date(),
    });
    return ctx.json(result, 201);
  });

  // GET /api/sales/loyalty/members?search=...&limit=50 - Daftar Member & Peringkat Loyalitas
  router.get("/api/sales/loyalty/members", async (ctx) => {
    const search = ctx.query.search;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit, 10) : 50;
    const members = await receivableService.listCustomerLoyalty(search, limit);
    return ctx.json(members);
  });

  // GET /api/sales/loyalty?customerCode=... - Saldo Poin Loyalitas Pelanggan
  router.get("/api/sales/loyalty", async (ctx) => {
    const customerCode = ctx.query.customerCode;
    if (!customerCode) {
      return ctx.error("Parameter 'customerCode' wajib diisi", 400);
    }
    const points = await receivableService.getCustomerPointBalance(customerCode);
    return ctx.json(points);
  });

  // POST /api/sales/loyalty/redeem - Tukar Poin Loyalitas
  router.post("/api/sales/loyalty/redeem", async (ctx) => {
    if (!ctx.body) {
      return ctx.error("Payload JSON wajib disediakan", 400);
    }
    const result = await receivableService.redeemCustomerPoints({
      ...ctx.body,
      jmlpoint: Number(ctx.body.jmlpoint || ctx.body.jmlambil || 0),
      tanggal: ctx.body.tanggal ? new Date(ctx.body.tanggal) : new Date(),
    });
    return ctx.json(result, 201);
  });
}
