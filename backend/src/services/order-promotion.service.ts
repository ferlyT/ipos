import { sql } from "drizzle-orm";
import { db } from "../db";

export interface OrderItemInput {
  kodeitem: string;
  jumlah: number;
  satuan: string;
  harga: number;
  potongan?: number;
  detinfo?: string;
}

export interface CreateOrderInput {
  notransaksi: string;
  tipe: "PO" | "SO";
  kodekantor: string;
  tanggal?: Date | string;
  tanggalkirim?: Date | string;
  kodesupel: string;
  keterangan?: string;
  potfaktur?: number;
  biayalain?: number;
  prpajak?: number;
  pajak?: number;
  dppesanan?: number;
  dppesananbyr?: number;
  acc_dppesanan?: string;
  acc_dpkas?: string;
  items: OrderItemInput[];
}

export interface FulfillmentItemInput {
  nobaris: number;
  kodeitem: string;
  qtyReceived: number;
}

export interface PromotionRuleInput {
  iddiskon: string;
  kodeitemd?: string;
  kodeitems?: string;
  jenis?: string;
  merek?: string;
  tgldari: Date | string;
  tglsampai: Date | string;
  jamdari?: Date | string;
  jamsampai?: Date | string;
  daysOfWeek?: {
    w1?: boolean; // Senin
    w2?: boolean; // Selasa
    w3?: boolean; // Rabu
    w4?: boolean; // Kamis
    w5?: boolean; // Jumat
    w6?: boolean; // Sabtu
    w7?: boolean; // Minggu
  };
  pot1?: number;
  pot2?: number;
  pot3?: number;
  pot4?: number;
  prioritas?: number;
  stsact?: boolean;
}

export interface QuantityTierDiscountInput {
  iddetail: string;
  kodeitem: string;
  kodegrup?: string;
  jumlah: number; // Minimal kuantitas
  pot1?: number;
  pot2?: number;
  pot3?: number;
  pot4?: number;
}

export class OrderPromotionService {
  /**
   * 1. MEMBUAT PESANAN BARU (PO / SO)
   */
  static async createOrder(input: CreateOrderInput) {
    const tanggalStr = (input.tanggal ? new Date(input.tanggal) : new Date()).toISOString().slice(0, 19).replace("T", " ");
    const tanggalkirimStr = (input.tanggalkirim ? new Date(input.tanggalkirim) : new Date()).toISOString().slice(0, 19).replace("T", " ");
    const potfaktur = input.potfaktur || 0;
    const biayalain = input.biayalain || 0;
    const dppesanan = input.dppesanan || 0;
    const dppesananbyr = input.dppesananbyr || 0;

    let totalitem = 0;
    let subtotal = 0;

    const computedItems = input.items.map((item, idx) => {
      const potongan = item.potongan || 0;
      const lineTotal = item.jumlah * item.harga - potongan;
      totalitem += item.jumlah;
      subtotal += lineTotal;

      return {
        iddetail: `${input.notransaksi}-${input.kodekantor}-${Date.now()}-${idx + 1}`,
        nobaris: idx + 1,
        notransaksi: input.notransaksi,
        kodeitem: item.kodeitem,
        jumlah: item.jumlah,
        jmlterima: 0,
        satuan: item.satuan,
        harga: item.harga,
        potongan: potongan,
        total: lineTotal,
        pajak: 0,
        detinfo: item.detinfo || null,
      };
    });

    // Perhitungan Pajak PPN (Default 11% jika tidak dispesifikasikan)
    const prpajak = input.prpajak !== undefined ? input.prpajak : 11;
    const pajak = input.pajak !== undefined ? input.pajak : (subtotal - potfaktur) * (prpajak / 100);
    const totalakhir = subtotal - potfaktur + pajak + biayalain;

    // Default Akun Uang Muka (DP) jika belum diisi:
    // PO: 1-9100 (Uang Muka Beli), SO: 2-3100 (Uang Muka Jual)
    const acc_dppesanan = input.acc_dppesanan || (input.tipe === "PO" ? "1-9100" : "2-3100");
    const acc_dpkas = input.acc_dpkas || "1-1110"; // Default Kas Kecil (ACC_PO_KAS / ACC_SO_KAS)

    // Simpan Header Pesanan (tbl_pesanhd)
    await db.execute(sql`
      INSERT INTO tbl_pesanhd (
        notransaksi, kodekantor, tanggal, tanggalkirim, tipe,
        kodesupel, keterangan, totalitem, totalterima, subtotal,
        potfaktur, prpajak, pajak, biayalain, totalakhir,
        dppesanan, dppesananbyr, acc_dppesanan, acc_dpkas,
        rate, user1, dateupd
      ) VALUES (
        ${input.notransaksi}, ${input.kodekantor}, ${tanggalStr}::timestamp, ${tanggalkirimStr}::timestamp, ${input.tipe},
        ${input.kodesupel}, ${input.keterangan || ""}, ${totalitem}, 0, ${subtotal},
        ${potfaktur}, ${prpajak}, ${pajak}, ${biayalain}, ${totalakhir},
        ${dppesanan}, ${dppesananbyr}, ${acc_dppesanan}, ${acc_dpkas},
        1, 'ADMIN', NOW()
      );
    `);

    // Simpan Detail Pesanan (tbl_pesandt)
    for (const it of computedItems) {
      await db.execute(sql`
        INSERT INTO tbl_pesandt (
          iddetail, nobaris, notransaksi, kodeitem,
          jumlah, jmlterima, satuan, harga, potongan, total, pajak, detinfo, dateupd
        ) VALUES (
          ${it.iddetail}, ${it.nobaris}, ${it.notransaksi}, ${it.kodeitem},
          ${it.jumlah}, ${it.jmlterima}, ${it.satuan}, ${it.harga}, ${it.potongan}, ${it.total}, ${it.pajak}, ${it.detinfo}, NOW()
        );
      `);
    }

    // Jika ada pembayaran Uang Muka (DP) riil, buat Jurnal Akuntansi otomatis
    if (dppesananbyr > 0) {
      const nowStr = Date.now().toString();
      if (input.tipe === "PO") {
        // Pembayaran DP PO (Supplier): Debet Uang Muka Beli (1-9100), Kredit Kas/Bank (1-1110)
        await db.execute(sql`
          INSERT INTO tbl_accjurnal (
            iddetail, nourut, tipeinput, notransaksi, tanggal,
            kodeacc, jenis, keterangan, matauang, rate,
            jumlah, posisi, debet, kredit, kantor
          ) VALUES 
          (${nowStr + "-1"}, 1, 'R', ${input.notransaksi}, ${tanggalStr}::timestamp,
           ${acc_dppesanan}, 'Jurnal', ${'Uang Muka Pembelian ' + input.notransaksi}, 'IDR', 1,
           ${dppesananbyr}, 'D', ${dppesananbyr}, 0, ${input.kodekantor}),
          (${nowStr + "-2"}, 2, 'R', ${input.notransaksi}, ${tanggalStr}::timestamp,
           ${acc_dpkas}, 'Jurnal', ${'Kas Keluar Uang Muka ' + input.notransaksi}, 'IDR', 1,
           ${dppesananbyr}, 'K', 0, ${dppesananbyr}, ${input.kodekantor});
        `);
      } else {
        // Penerimaan DP SO (Customer): Debet Kas/Bank (1-1110), Kredit Uang Muka Jual (2-3100)
        await db.execute(sql`
          INSERT INTO tbl_accjurnal (
            iddetail, nourut, tipeinput, notransaksi, tanggal,
            kodeacc, jenis, keterangan, matauang, rate,
            jumlah, posisi, debet, kredit, kantor
          ) VALUES 
          (${nowStr + "-1"}, 1, 'R', ${input.notransaksi}, ${tanggalStr}::timestamp,
           ${acc_dpkas}, 'Jurnal', ${'Kas Masuk Uang Muka ' + input.notransaksi}, 'IDR', 1,
           ${dppesananbyr}, 'D', ${dppesananbyr}, 0, ${input.kodekantor}),
          (${nowStr + "-2"}, 2, 'R', ${input.notransaksi}, ${tanggalStr}::timestamp,
           ${acc_dppesanan}, 'Jurnal', ${'Uang Muka Penjualan ' + input.notransaksi}, 'IDR', 1,
           ${dppesananbyr}, 'K', 0, ${dppesananbyr}, ${input.kodekantor});
        `);
      }
    }

    return {
      notransaksi: input.notransaksi,
      tipe: input.tipe,
      totalitem,
      subtotal,
      pajak,
      totalakhir,
      dppesananbyr,
      itemCount: computedItems.length,
    };
  }

  /**
   * 2. PEMENUHAN PESANAN (FULFILLMENT PARSIAL / PENUH)
   */
  static async fulfillOrder(notransaksi: string, fulfillments: FulfillmentItemInput[]) {
    let newlyReceivedTotal = 0;

    for (const ful of fulfillments) {
      await db.execute(sql`
        UPDATE tbl_pesandt
        SET jmlterima = COALESCE(jmlterima, 0) + ${ful.qtyReceived},
            dateupd = NOW()
        WHERE notransaksi = ${notransaksi}
          AND nobaris = ${ful.nobaris}
          AND kodeitem = ${ful.kodeitem};
      `);
      newlyReceivedTotal += ful.qtyReceived;
    }

    // Update akumulasi totalterima di Header
    await db.execute(sql`
      UPDATE tbl_pesanhd
      SET totalterima = COALESCE(totalterima, 0) + ${newlyReceivedTotal},
          dateupd = NOW()
      WHERE notransaksi = ${notransaksi};
    `);

    // Ambil status terbaru
    const headerRes = await db.execute(sql`
      SELECT notransaksi, tipe, totalitem, totalterima, (totalitem - totalterima) AS backlog
      FROM tbl_pesanhd
      WHERE notransaksi = ${notransaksi};
    `);

    const header = headerRes[0] as any;
    const isCompleted = Number(header.totalterima) >= Number(header.totalitem);

    const itemsRes = await db.execute(sql`
      SELECT nobaris, kodeitem, jumlah, jmlterima, (jumlah - jmlterima) AS sisa
      FROM tbl_pesandt
      WHERE notransaksi = ${notransaksi}
      ORDER BY nobaris ASC;
    `);

    return {
      notransaksi: header.notransaksi,
      tipe: header.tipe,
      totalPesan: Number(header.totalitem),
      totalTerima: Number(header.totalterima),
      backlog: Number(header.backlog),
      status: isCompleted ? "COMPLETED" : "PARTIAL",
      items: itemsRes.map((r: any) => ({
        nobaris: r.nobaris,
        kodeitem: r.kodeitem,
        jumlah: Number(r.jumlah),
        jmlterima: Number(r.jmlterima),
        sisa: Number(r.sisa),
      })),
    };
  }

  /**
   * 3. MONITORING OUTSTANDING ORDERS (BACKLOG PESANAN BELUM SELESAI)
   */
  static async getOutstandingOrders(tipe?: "PO" | "SO") {
    const whereClause = tipe ? sql`AND hd.tipe = ${tipe}` : sql``;

    const res = await db.execute(sql`
      SELECT 
        hd.notransaksi,
        hd.tipe,
        hd.tanggal::date AS tanggal,
        hd.tanggalkirim::date AS tanggalkirim,
        hd.kodesupel,
        sp.nama AS namasupel,
        hd.totalitem,
        hd.totalterima,
        (hd.totalitem - hd.totalterima) AS backlog_qty,
        hd.totalakhir,
        hd.dppesananbyr,
        ROUND((hd.totalterima / NULLIF(hd.totalitem, 0) * 100)::numeric, 1) AS progress_pct,
        (CURRENT_DATE - hd.tanggal::date) AS aging_days
      FROM tbl_pesanhd hd
      LEFT JOIN tbl_supel sp ON hd.kodesupel = sp.kode
      WHERE hd.totalterima < hd.totalitem
      ${whereClause}
      ORDER BY hd.tanggal ASC;
    `);

    return res.map((r: any) => ({
      notransaksi: r.notransaksi,
      tipe: r.tipe,
      tanggal: r.tanggal,
      tanggalkirim: r.tanggalkirim,
      kodesupel: r.kodesupel,
      namasupel: r.namasupel || "-",
      totalitem: Number(r.totalitem),
      totalterima: Number(r.totalterima),
      backlogQty: Number(r.backlog_qty),
      totalakhir: Number(r.totalakhir),
      dppesananbyr: Number(r.dppesananbyr),
      progressPct: Number(r.progress_pct || 0),
      agingDays: Number(r.aging_days || 0),
    }));
  }

  /**
   * 4. DAFTARKAN ATURAN PROMOSI / HAPPY HOUR (tbl_itemdisp)
   */
  static async registerPromotion(input: PromotionRuleInput) {
    const tgldariStr = new Date(input.tgldari).toISOString().slice(0, 19).replace("T", " ");
    const tglsampaiStr = new Date(input.tglsampai).toISOString().slice(0, 19).replace("T", " ");
    const jamdariStr = input.jamdari ? new Date(input.jamdari).toISOString().slice(0, 19).replace("T", " ") : null;
    const jamsampaiStr = input.jamsampai ? new Date(input.jamsampai).toISOString().slice(0, 19).replace("T", " ") : null;
    const days = input.daysOfWeek || {};

    await db.execute(sql`
      INSERT INTO tbl_itemdisp (
        iddiskon, kodeitemd, kodeitems, jenis, merek,
        tgldari, tglsampai, jamdari, jamsampai,
        w1, w2, w3, w4, w5, w6, w7,
        pot1, pot2, pot3, pot4,
        prioritas, stsact
      ) VALUES (
        ${input.iddiskon}, ${input.kodeitemd || null}, ${input.kodeitems || null}, ${input.jenis || null}, ${input.merek || null},
        ${tgldariStr}::timestamp, ${tglsampaiStr}::timestamp, ${jamdariStr ? sql`${jamdariStr}::timestamp` : null}, ${jamsampaiStr ? sql`${jamsampaiStr}::timestamp` : null},
        ${days.w1 ?? true}, ${days.w2 ?? true}, ${days.w3 ?? true}, ${days.w4 ?? true}, ${days.w5 ?? true}, ${days.w6 ?? true}, ${days.w7 ?? true},
        ${input.pot1 || 0}, ${input.pot2 || 0}, ${input.pot3 || 0}, ${input.pot4 || 0},
        ${input.prioritas || 1}, ${input.stsact ?? true}
      );
    `);

    return { iddiskon: input.iddiskon, success: true };
  }

  /**
   * 5. DAFTARKAN POTONGAN KUANTITAS BERTINGKAT (tbl_itempotongan)
   */
  static async registerQuantityTierDiscount(input: QuantityTierDiscountInput) {
    await db.execute(sql`
      INSERT INTO tbl_itempotongan (
        iddetail, kodeitem, kodegrup, jumlah,
        pot1, pot2, pot3, pot4, dateupd
      ) VALUES (
        ${input.iddetail}, ${input.kodeitem}, ${input.kodegrup || null}, ${input.jumlah},
        ${input.pot1 || 0}, ${input.pot2 || 0}, ${input.pot3 || 0}, ${input.pot4 || 0}, NOW()
      );
    `);

    return { iddetail: input.iddetail, success: true };
  }

  /**
   * 6. RESOLUSI HARGA PROMOSI & DISKON KUANTITAS REAL-TIME
   */
  static async resolvePromotionalPrice(params: {
    kodeitem: string;
    jumlah: number;
    kodegrup?: string;
    now?: Date;
  }) {
    const timestamp = params.now || new Date();
    const timestampStr = timestamp.toISOString().slice(0, 19).replace("T", " ");
    const dayOfWeek = timestamp.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    const dayCol = dayOfWeek === 0 ? "w7" : `w${dayOfWeek}`;

    // 1. Ambil Harga Pokok & Harga Jual Dasar
    const itemRes = await db.execute(sql`
      SELECT it.kodeitem, it.namaitem, it.jenis, it.merek, it.hargapokok, it.hargajual1 AS hargajual
      FROM tbl_item it
      WHERE it.kodeitem = ${params.kodeitem};
    `);

    if (itemRes.length === 0) {
      throw new Error(`Item ${params.kodeitem} tidak ditemukan.`);
    }

    const item = itemRes[0] as any;
    const basePrice = Number(item.hargajual || 0);

    // 2. Evaluasi Potongan Kuantitas Bertingkat (tbl_itempotongan)
    const tierRes = await db.execute(sql`
      SELECT pot1, pot2, pot3, pot4, jumlah
      FROM tbl_itempotongan
      WHERE kodeitem = ${params.kodeitem}
        AND (${params.kodegrup ? sql`kodegrup = ${params.kodegrup} OR kodegrup IS NULL` : sql`kodegrup IS NULL`})
        AND jumlah <= ${params.jumlah}
      ORDER BY jumlah DESC, pot1 DESC
      LIMIT 1;
    `);

    let tierDiscountPercent = 0;
    if (tierRes.length > 0) {
      const t = tierRes[0] as any;
      tierDiscountPercent = Number(t.pot1 || 0);
    }

    // 3. Evaluasi Diskon Promosi Periode / Happy Hour (tbl_itemdisp)
    const promoRes = await db.execute(sql`
      SELECT iddiskon, pot1, pot2, prioritas
      FROM tbl_itemdisp
      WHERE stsact = true
        AND tgldari <= ${timestampStr}::timestamp
        AND tglsampai >= ${timestampStr}::timestamp
        AND (
          (kodeitemd IS NULL AND kodeitems IS NULL AND jenis IS NULL AND merek IS NULL)
          OR (kodeitemd = ${params.kodeitem} OR kodeitems = ${params.kodeitem})
          OR (jenis = ${item.jenis})
          OR (merek = ${item.merek})
        )
      ORDER BY prioritas DESC, pot1 DESC
      LIMIT 1;
    `);

    let promoDiscountPercent = 0;
    let promoId: string | null = null;
    if (promoRes.length > 0) {
      const p = promoRes[0] as any;
      promoDiscountPercent = Number(p.pot1 || 0);
      promoId = p.iddiskon;
    }

    // Terapkan Diskon Terbaik (atau komposit)
    const effectiveDiscountPercent = Math.max(tierDiscountPercent, promoDiscountPercent);
    const unitDiscountNominal = basePrice * (effectiveDiscountPercent / 100);
    const netUnitPrice = basePrice - unitDiscountNominal;
    const totalPrice = netUnitPrice * params.jumlah;

    return {
      kodeitem: item.kodeitem,
      namaitem: item.namaitem,
      basePrice,
      qty: params.jumlah,
      tierDiscountPercent,
      promoDiscountPercent,
      promoId,
      effectiveDiscountPercent,
      unitDiscountNominal,
      netUnitPrice,
      totalPrice,
    };
  }

  /**
   * 7. AMBIL KONFIGURASI SISTEM GLOBAL IPOS 4 (tbl_conf)
   */
  static async getSystemConfigurations() {
    const res = await db.execute(sql`
      SELECT confname, confvalue
      FROM tbl_conf
      ORDER BY confname ASC;
    `);

    const dict: Record<string, string> = {};
    for (const row of res as any[]) {
      if (row.confname) {
        dict[row.confname] = row.confvalue ?? "";
      }
    }

    return {
      company: {
        name: dict["CMP_NAMA"] || "-",
        address1: dict["CMP_ALAMAT1"] || "-",
        address2: dict["CMP_ALAMAT2"] || "-",
        npwp: dict["CMP_NPWP"] || "-",
        phone: dict["CMP_TELP"] || "-",
      },
      accounting: {
        methodHpp: dict["METHOD_HPP"] || "FIFO",
        baseCurrency: dict["ACC_MU_UTAMA"] || "IDR",
        startYear: Number(dict["ACC_START_YEAR"] || 2022),
        currentYear: Number(dict["ACC_CURRENT_YEAR"] || 2027),
        currentMonth: Number(dict["ACC_CURRENT_MONTH"] || 1),
      },
      taxes: {
        defaultPurchaseTax: Number(dict["DEFAULT_PAJAK_BELI"] || 11),
        defaultSalesTax: Number(dict["DEFAULT_PAJAK_JUAL"] || 11),
        purchaseTaxMode: Number(dict["TRS_PAJAK_BELI"] || 2),
        salesTaxMode: Number(dict["TRS_PAJAK_JUAL"] || 2),
      },
      salesPolicy: {
        defaultDueDays: Number(dict["DEF_JATUH_TEMPO"] || 10),
        defaultWalkInCustomer: dict["DEF_PEL_UMUM"] || "UMUM",
        stockCheckMode: Number(dict["STOK_CEK"] || 3),
        warnUnderHpp: dict["TRS_JUAL_KONFIRM_HP"] === "1",
        enableRounding: dict["CFG_AKTIF_PEMBULATAN"] === "1",
        roundingOption: Number(dict["PIL_OPSI_NILAI_PEMBULATAN"] || 3),
      },
      rawConfigCount: Object.keys(dict).length,
    };
  }
}
