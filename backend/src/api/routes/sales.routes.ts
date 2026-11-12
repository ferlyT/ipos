import { sql } from "drizzle-orm";
import { client, db } from "../../db";
import { ReceivableLoyaltyService } from "../../services/receivable-loyalty.service";
import { PeriodClosingService } from "../../services/period-closing.service";
import type { ApiRouter } from "../router";
import { parsePagination, formatPaginatedResponse } from "../pagination";

const receivableService = new ReceivableLoyaltyService(client);
const periodService = new PeriodClosingService(client);

export function registerSalesRoutes(router: ApiRouter) {
  // GET /api/sales/invoices?search=...&limit=50&type=JL|RJ&page=1 - Daftar Faktur Penjualan & Retur (tbl_ikhd)
  router.get("/api/sales/invoices", async (ctx) => {
    const { page, limit, offset, isPaginated } = parsePagination(ctx.query, 25);
    const search = ctx.query.search;
    const type = ctx.query.type;

    let whereClause = sql``;
    if (search && type) {
      whereClause = sql`WHERE (ik.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}) AND ik.tipe = ${type}`;
    } else if (search) {
      whereClause = sql`WHERE ik.notransaksi ILIKE ${'%' + search + '%'} OR sp.nama ILIKE ${'%' + search + '%'}`;
    } else if (type) {
      whereClause = sql`WHERE ik.tipe = ${type}`;
    }

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM tbl_ikhd ik
      LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode
      ${whereClause};
    `);
    const total = Number((countRes[0] as any)?.count || 0);

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
      LIMIT ${limit} OFFSET ${offset};
    `);

    return ctx.json(formatPaginatedResponse(invoices, total, page, limit, isPaginated));
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
    try {
      if (ctx.body.tanggal) {
        await periodService.assertPeriodNotClosed(ctx.body.tanggal);
      }
    } catch (err: any) {
      return ctx.error(err.message, 403);
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

  // POST /api/sales/receivables/match - Smart Invoice Matcher (Pencocokan Tagihan Otomatis)
  router.post("/api/sales/receivables/match", async (ctx) => {
    if (!ctx.body || typeof ctx.body.amount !== "number" || ctx.body.amount <= 0) {
      return ctx.error("Parameter 'amount' (nominal angka positif) wajib disertakan dalam payload", 400);
    }
    const result = await receivableService.matchInvoicesByAmount({
      amount: ctx.body.amount,
      customerQuery: ctx.body.customerQuery,
      year: ctx.body.year ? Number(ctx.body.year) : undefined,
      tolerance: ctx.body.tolerance ? Number(ctx.body.tolerance) : 0,
      office: ctx.body.office || "UTM"
    });
    return ctx.json(result);
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

  // GET /api/sales/tax-report - Laporan Detail Penjualan Berpajak & KPI Pajak
  router.get("/api/sales/tax-report", async (ctx) => {
    const { startDate, endDate, search, hasNofp, all } = ctx.query;
    const isAll = all === "true" || all === "1";
    const page = Math.max(1, parseInt(ctx.query.page || "1", 10));
    const limit = isAll ? 5000 : Math.max(1, Math.min(200, parseInt(ctx.query.limit || "25", 10)));
    const offset = (page - 1) * limit;

    const conditions: any[] = [sql`ik.pajak > 0`];

    if (startDate) {
      conditions.push(sql`ik.tanggal::date >= ${startDate}::date`);
    }
    if (endDate) {
      conditions.push(sql`ik.tanggal::date <= ${endDate}::date`);
    }
    if (hasNofp === "YES") {
      conditions.push(sql`(ik.nofp IS NOT NULL AND TRIM(ik.nofp) != '')`);
    } else if (hasNofp === "NO") {
      conditions.push(sql`(ik.nofp IS NULL OR TRIM(ik.nofp) = '')`);
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      conditions.push(sql`(
        ik.notransaksi ILIKE ${term} OR
        ik.nofp ILIKE ${term} OR
        sp.nama ILIKE ${term} OR
        sp.kode ILIKE ${term} OR
        EXISTS (
          SELECT 1 FROM tbl_ikdt dt 
          LEFT JOIN tbl_item it ON dt.kodeitem = it.kodeitem 
          WHERE dt.notransaksi = ik.notransaksi AND (dt.kodeitem ILIKE ${term} OR it.namaitem ILIKE ${term})
        )
      )`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    // 1. Ambil Summary Agregat (KPIs)
    const summaryRes = await db.execute<any>(sql`
      SELECT 
        COUNT(ik.notransaksi)::int AS total_invoices,
        COALESCE(SUM(ik.subtotal), 0)::float AS total_dpp,
        COALESCE(SUM(ik.pajak), 0)::float AS total_tax,
        COALESCE(SUM(ik.totalakhir), 0)::float AS total_grand
      FROM tbl_ikhd ik
      LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode
      ${whereClause};
    `);

    const summary = summaryRes[0] || {
      total_invoices: 0,
      total_dpp: 0,
      total_tax: 0,
      total_grand: 0,
    };

    const total = Number(summary.total_invoices || 0);
    const totalPages = isAll ? 1 : Math.ceil(total / limit) || 1;

    // 2. Ambil Daftar Header Faktur Berpajak
    const paginationClause = isAll ? sql`` : sql`LIMIT ${limit} OFFSET ${offset}`;
    const invoices = await db.execute<any>(sql`
      SELECT 
        ik.notransaksi,
        ik.tanggal::text AS tanggal,
        ik.kodekantor,
        ik.kodesupel,
        sp.nama AS namapelanggan,
        sp.alamat,
        sp.telepon,
        sp.npwp,
        sp.nama_npwp,
        sp.alamat_npwp,
        ik.subtotal::float AS dpp,
        COALESCE(ik.potnomfaktur, 0)::float AS potongan,
        COALESCE(ik.biayalain, 0)::float AS biayalain,
        COALESCE(ik.prpajak, 0)::float AS prpajak,
        ik.pajak::float AS pajak,
        ik.totalakhir::float AS totalakhir,
        COALESCE(ik.nofp, '') AS nofp,
        ik.carabayar,
        ik.user1 AS kasir,
        ik.keterangan
      FROM tbl_ikhd ik
      LEFT JOIN tbl_supel sp ON ik.kodesupel = sp.kode
      ${whereClause}
      ORDER BY ik.tanggal DESC
      ${paginationClause};
    `);

    // 3. Ambil Detail Item Barang jika ada faktur pada halaman ini
    if (invoices.length > 0) {
      const invoiceNumbers = invoices.map((inv: any) => inv.notransaksi);
      const items = await db.execute<any>(sql`
        SELECT 
          dt.iddetail,
          dt.notransaksi,
          dt.nobaris,
          dt.kodeitem,
          COALESCE(it.namaitem, dt.kodeitem) AS namaitem,
          dt.jumlah::float AS jumlah,
          dt.satuan,
          dt.harga::float AS harga,
          dt.potongan::float AS potongan,
          dt.total::float AS total
        FROM tbl_ikdt dt
        LEFT JOIN tbl_item it ON dt.kodeitem = it.kodeitem
        WHERE dt.notransaksi IN (${sql.join(invoiceNumbers.map((no: string) => sql`${no}`), sql`, `)})
        ORDER BY dt.notransaksi, dt.nobaris ASC;
      `);

      const itemsByInvoice = new Map<string, any[]>();
      for (const item of items) {
        if (!itemsByInvoice.has(item.notransaksi)) {
          itemsByInvoice.set(item.notransaksi, []);
        }
        itemsByInvoice.get(item.notransaksi)!.push(item);
      }

      for (const inv of invoices) {
        inv.details = itemsByInvoice.get(inv.notransaksi) || [];
      }
    }

    return ctx.json({
      summary: {
        totalInvoices: total,
        totalDpp: Number(summary.total_dpp || 0),
        totalTax: Number(summary.total_tax || 0),
        totalGrand: Number(summary.total_grand || 0),
      },
      items: invoices,
      pagination: {
        page,
        limit: isAll ? total : limit,
        total,
        totalPages,
      },
    });
  });
}
