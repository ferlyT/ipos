import { db } from "../db";
import { sql } from "drizzle-orm";

export interface StockInParams {
  notransaksi: string;
  tanggal: Date | string;
  kodeitem: string;
  kodekantor?: string;
  jumlah: number;
  harga: number; // Harga per satuan dasar
  satuan?: string;
  tipe?: string; // 'BL' (Pembelian), 'IM' (Item Masuk), 'SA' (Saldo Awal), 'RJ' (Retur Jual), 'OP' (Opname)
}

export interface StockOutParams {
  notransaksi: string;
  tanggal: Date | string;
  kodeitem: string;
  kodekantor?: string;
  jumlah: number;
  satuan?: string;
  tipe?: string; // 'JL' (Penjualan), 'IK' (Item Keluar), 'RB' (Retur Beli), 'OP' (Opname)
  iddetailtrs?: string;
}

export interface FifoAllocationResult {
  kodeitem: string;
  totalQtyOut: number;
  totalHpp: number;
  avgHppPerUnit: number;
  isOutOfStockFallback: boolean;
  allocations: {
    iddetailim: string;
    batchNotransaksi: string;
    qtyAllocated: number;
    unitCost: number;
    subtotalHpp: number;
    isOutOfStock: boolean;
  }[];
}

export interface NegativeStockSummary {
  totalCurrentNegativeItems: number;
  totalCurrentNegativeQty: number;
  totalCurrentNegativeValuation: number;
  currentNegativeItems: {
    kodeitem: string;
    namaitem: string;
    kantor: string;
    stok: number;
    hargapokok: number;
    totalDefisitValuasi: number;
  }[];
  totalOutOfStockSalesCount: number;
  totalOutOfStockItemsCount: number;
  totalOutOfStockQty: number;
  totalOutOfStockHppDistortion: number;
  topOutOfStockItems: {
    kodeitem: string;
    namaitem: string;
    frekuensiTransaksi: number;
    totalQtyTerjualTanpaStok: number;
    avgHpp: number;
    totalNilaiDistorsi: number;
    transaksiTerakhir: string;
  }[];
}

export class FifoInventoryService {
  /**
   * 1. RECORD STOCK IN (Menambah Batch FIFO baru ke tbl_item_im dan update saldo stok)
   */
  static async recordStockIn(params: StockInParams): Promise<{ iddetail: string }> {
    const kodekantor = params.kodekantor || "UTM";
    const tipe = params.tipe || "BL";
    const satuan = params.satuan || "PCS";
    const tglStr = typeof params.tanggal === "string" ? params.tanggal : params.tanggal.toISOString();

    // Generate iddetail dengan format timestamp iPos 4: YYYYMMDD + 13 digit counter
    const now = new Date();
    const datePrefix = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    const iddetail = `${datePrefix}1000000000${Math.floor(Math.random() * 90000 + 10000)}`;

    // A. Insert ke tbl_item_im (Queue Batch FIFO)
    await db.execute(sql`
      INSERT INTO tbl_item_im (
        iddetail, iddetailtrs, notransaksi, kodekantor, tanggal,
        tipe, matauang, rate, kodeitem, jumlahdasar,
        satuandasar, hargadasar, masuk, keluar, sisa, flagavg, tgl_trs
      ) VALUES (
        ${iddetail}, ${iddetail}, ${params.notransaksi}, ${kodekantor}, ${tglStr}::timestamp,
        ${tipe}, 'IDR', 1, ${params.kodeitem}, ${params.jumlah},
        ${satuan}, ${params.harga}, ${params.jumlah}, 0, ${params.jumlah}, 0, NOW()
      );
    `);

    // B. Update stok di tbl_itemstok (per kantor)
    await db.execute(sql`
      INSERT INTO tbl_itemstok (kodeitem, kantor, stok)
      VALUES (${params.kodeitem}, ${kodekantor}, ${params.jumlah})
      ON CONFLICT (kodeitem, kantor) 
      DO UPDATE SET stok = tbl_itemstok.stok + ${params.jumlah};
    `);

    // C. Update total stok & hargapokok di tbl_item
    await db.execute(sql`
      UPDATE tbl_item 
      SET stok = COALESCE(stok, 0) + ${params.jumlah},
          hargapokok = ${params.harga},
          dateupd = NOW()
      WHERE kodeitem = ${params.kodeitem};
    `);

    return { iddetail };
  }

  /**
   * 2. RECORD STOCK OUT DENGAN ALOKASI FIFO (Konsumsi batch tertua sisa > 0)
   * Menyerap stok dari tbl_item_im dan mencatat pemakaian ke tbl_item_ik
   */
  static async recordStockOut(params: StockOutParams): Promise<FifoAllocationResult> {
    const kodekantor = params.kodekantor || "UTM";
    const tipe = params.tipe || "JL";
    const satuan = params.satuan || "PCS";
    const tglStr = typeof params.tanggal === "string" ? params.tanggal : params.tanggal.toISOString();

    let remainingToConsume = params.jumlah;
    let totalHpp = 0;
    let isOutOfStockFallback = false;
    const allocations: FifoAllocationResult["allocations"] = [];

    // A. Ambil batch-batch FIFO yang masih memiliki sisa > 0 diurutkan berdasarkan tanggal ASC
    const availableBatches = await db.execute<any>(sql`
      SELECT iddetail, notransaksi, tanggal, hargadasar::float AS hargadasar, sisa::float AS sisa, keluar::float AS keluar
      FROM tbl_item_im
      WHERE kodeitem = ${params.kodeitem} 
        AND kodekantor = ${kodekantor}
        AND sisa > 0
      ORDER BY tanggal ASC, iddetail ASC;
    `);

    // B. Alokasikan konsumsi per batch
    for (const batch of availableBatches) {
      if (remainingToConsume <= 0) break;

      const takeQty = Math.min(batch.sisa, remainingToConsume);
      const subtotalHpp = takeQty * batch.hargadasar;
      totalHpp += subtotalHpp;

      // Update tbl_item_im (kurangi sisa batch, tambah keluar)
      await db.execute(sql`
        UPDATE tbl_item_im
        SET keluar = keluar + ${takeQty},
            sisa = sisa - ${takeQty}
        WHERE iddetail = ${batch.iddetail};
      `);

      // Insert ke tbl_item_ik (log alokasi FIFO)
      await db.execute(sql`
        INSERT INTO tbl_item_ik (
          iddetailim, notransaksi, kodekantor, tanggal, tipe,
          kodeitem, jumlahdasar, satuandasar, hargadasar, iddetailtrs
        ) VALUES (
          ${batch.iddetail}, ${params.notransaksi}, ${kodekantor}, ${tglStr}::timestamp, ${tipe},
          ${params.kodeitem}, ${takeQty}, ${satuan}, ${batch.hargadasar}, ${params.iddetailtrs || params.notransaksi}
        );
      `);

      allocations.push({
        iddetailim: batch.iddetail,
        batchNotransaksi: batch.notransaksi,
        qtyAllocated: takeQty,
        unitCost: batch.hargadasar,
        subtotalHpp,
        isOutOfStock: false,
      });

      remainingToConsume -= takeQty;
    }

    // C. Handling EDGE CASE: Stok habis tapi penjualan tetap terjadi (OUTOFSTOCK fallback ke Master HPP)
    if (remainingToConsume > 0) {
      isOutOfStockFallback = true;
      const itemMaster = await db.execute<any>(sql`
        SELECT hargapokok::float AS hargapokok FROM tbl_item WHERE kodeitem = ${params.kodeitem} LIMIT 1;
      `);
      const fallbackCost = itemMaster.length > 0 ? (itemMaster[0].hargapokok || 0) : 0;
      const subtotalHpp = remainingToConsume * fallbackCost;
      totalHpp += subtotalHpp;

      // Catat alokasi dengan flag OUTOFSTOCK (persis perilaku asli iPos 4.0!)
      await db.execute(sql`
        INSERT INTO tbl_item_ik (
          iddetailim, notransaksi, kodekantor, tanggal, tipe,
          kodeitem, jumlahdasar, satuandasar, hargadasar, iddetailtrs
        ) VALUES (
          'OUTOFSTOCK', ${params.notransaksi}, ${kodekantor}, ${tglStr}::timestamp, ${tipe},
          ${params.kodeitem}, ${remainingToConsume}, ${satuan}, ${fallbackCost}, ${params.iddetailtrs || params.notransaksi}
        );
      `);

      allocations.push({
        iddetailim: "OUTOFSTOCK",
        batchNotransaksi: "MASTER_DATA_FALLBACK",
        qtyAllocated: remainingToConsume,
        unitCost: fallbackCost,
        subtotalHpp,
        isOutOfStock: true,
      });
    }

    // D. Kurangi saldo stok di tbl_itemstok dan tbl_item
    await db.execute(sql`
      UPDATE tbl_itemstok 
      SET stok = stok - ${params.jumlah}
      WHERE kodeitem = ${params.kodeitem} AND kantor = ${kodekantor};
    `);

    await db.execute(sql`
      UPDATE tbl_item 
      SET stok = COALESCE(stok, 0) - ${params.jumlah},
          dateupd = NOW()
      WHERE kodeitem = ${params.kodeitem};
    `);

    const avgHppPerUnit = params.jumlah > 0 ? totalHpp / params.jumlah : 0;

    return {
      kodeitem: params.kodeitem,
      totalQtyOut: params.jumlah,
      totalHpp,
      avgHppPerUnit,
      isOutOfStockFallback,
      allocations,
    };
  }

  /**
   * 3. SIMULASI FIFO SEBELUM CHECKOUT (Preview HPP & Margin untuk POS Kasir)
   * Tidak mengubah database, hanya menghitung estimasi HPP
   */
  static async simulateFifoDepletion(kodeitem: string, qtyToSell: number, kodekantor = "UTM"): Promise<FifoAllocationResult> {
    const availableBatches = await db.execute<any>(sql`
      SELECT iddetail, notransaksi, tanggal, hargadasar::float AS hargadasar, sisa::float AS sisa
      FROM tbl_item_im
      WHERE kodeitem = ${kodeitem} 
        AND kodekantor = ${kodekantor}
        AND sisa > 0
      ORDER BY tanggal ASC, iddetail ASC;
    `);

    let remaining = qtyToSell;
    let totalHpp = 0;
    let isOutOfStockFallback = false;
    const allocations: FifoAllocationResult["allocations"] = [];

    for (const batch of availableBatches) {
      if (remaining <= 0) break;
      const takeQty = Math.min(batch.sisa, remaining);
      const subtotalHpp = takeQty * batch.hargadasar;
      totalHpp += subtotalHpp;

      allocations.push({
        iddetailim: batch.iddetail,
        batchNotransaksi: batch.notransaksi,
        qtyAllocated: takeQty,
        unitCost: batch.hargadasar,
        subtotalHpp,
        isOutOfStock: false,
      });

      remaining -= takeQty;
    }

    if (remaining > 0) {
      isOutOfStockFallback = true;
      const itemMaster = await db.execute<any>(sql`
        SELECT hargapokok::float AS hargapokok FROM tbl_item WHERE kodeitem = ${kodeitem} LIMIT 1;
      `);
      const fallbackCost = itemMaster.length > 0 ? (itemMaster[0].hargapokok || 0) : 0;
      const subtotalHpp = remaining * fallbackCost;
      totalHpp += subtotalHpp;

      allocations.push({
        iddetailim: "OUTOFSTOCK",
        batchNotransaksi: "MASTER_DATA_FALLBACK",
        qtyAllocated: remaining,
        unitCost: fallbackCost,
        subtotalHpp,
        isOutOfStock: true,
      });
    }

    const avgHppPerUnit = qtyToSell > 0 ? totalHpp / qtyToSell : 0;

    return {
      kodeitem,
      totalQtyOut: qtyToSell,
      totalHpp,
      avgHppPerUnit,
      isOutOfStockFallback,
      allocations,
    };
  }

  /**
   * 4. KARTU STOK FIFO (Riwayat mutasi keluar-masuk per item dengan running balance & HPP)
   */
  static async getItemStockCard(kodeitem: string, kodekantor = "UTM") {
    const mutations = await db.execute<any>(sql`
      SELECT 
        tanggal,
        notransaksi,
        tipe,
        'IN' as direction,
        masuk::float as qty,
        hargadasar::float as harga_satuan,
        (masuk * hargadasar)::float as total_nilai
      FROM tbl_item_im
      WHERE kodeitem = ${kodeitem} AND kodekantor = ${kodekantor}

      UNION ALL

      SELECT 
        tanggal,
        notransaksi,
        tipe,
        'OUT' as direction,
        jumlahdasar::float as qty,
        hargadasar::float as harga_satuan,
        (jumlahdasar * hargadasar)::float as total_nilai
      FROM tbl_item_ik
      WHERE kodeitem = ${kodeitem} AND kodekantor = ${kodekantor}

      ORDER BY tanggal ASC;
    `);

    let runningStock = 0;
    let runningValue = 0;

    return mutations.map(m => {
      if (m.direction === "IN") {
        runningStock += m.qty;
        runningValue += m.total_nilai;
      } else {
        runningStock -= m.qty;
        runningValue -= m.total_nilai;
      }

      return {
        ...m,
        saldo_akhir_qty: runningStock,
        saldo_akhir_nilai: runningValue,
        rata_rata_hpp: runningStock > 0 ? runningValue / runningStock : m.harga_satuan,
      };
    });
  }

  /**
   * 5. PROSES STOK OPNAME (Penyelarasan Fisik vs Sistem)
   */
  static async recordStockOpname(params: {
    notransaksi: string;
    tanggal: Date | string;
    kodeitem: string;
    kodekantor?: string;
    jmlFisik: number;
    user?: string;
  }) {
    const kodekantor = params.kodekantor || "UTM";
    const user = params.user || "admin";
    const tglStr = typeof params.tanggal === "string" ? params.tanggal : params.tanggal.toISOString();

    // Cek stok sistem saat ini
    const stokRecord = await db.execute<any>(sql`
      SELECT stok::float as stok FROM tbl_itemstok WHERE kodeitem = ${params.kodeitem} AND kantor = ${kodekantor} LIMIT 1;
    `);
    const jmlSebelum = stokRecord.length > 0 ? (stokRecord[0].stok || 0) : 0;
    const jmlSelisih = params.jmlFisik - jmlSebelum;

    if (jmlSelisih === 0) {
      return { status: "NO_DIFFERENCE", jmlSebelum, jmlFisik: params.jmlFisik, jmlSelisih: 0 };
    }

    // Ambil harga pokok item untuk valuasi selisih
    const itemMaster = await db.execute<any>(sql`
      SELECT hargapokok::float as hargapokok, satuan FROM tbl_item WHERE kodeitem = ${params.kodeitem} LIMIT 1;
    `);
    const hargapokok = itemMaster.length > 0 ? (itemMaster[0].hargapokok || 0) : 0;
    const satuan = itemMaster.length > 0 ? (itemMaster[0].satuan || "PCS") : "PCS";
    const totalSelisihNilai = Math.abs(jmlSelisih) * hargapokok;

    // Catat ke tabel tbl_itemopname
    await db.execute(sql`
      INSERT INTO tbl_itemopname (
        iddetail, periode, tanggal, kodeitem, kodekantor,
        satuan, jmlsebelum, jmlfisik, jmlselisih, kodeacc,
        user1, dateupd, harga, total, compname
      ) VALUES (
        ${params.notransaksi}, TO_CHAR(NOW(), 'YYYY-MM'), ${tglStr}::timestamp, ${params.kodeitem}, ${kodekantor},
        ${satuan}, ${jmlSebelum}, ${params.jmlFisik}, ${jmlSelisih}, '5-1200',
        ${user}, NOW(), ${hargapokok}, ${totalSelisihNilai}, 'SERVER'
      );
    `);

    // Jika surplus (Fisik > Sistem), masukkan sebagai batch FIFO baru
    if (jmlSelisih > 0) {
      await this.recordStockIn({
        notransaksi: params.notransaksi,
        tanggal: params.tanggal,
        kodeitem: params.kodeitem,
        kodekantor,
        jumlah: jmlSelisih,
        harga: hargapokok,
        satuan,
        tipe: "OP",
      });
    } else {
      // Jika defisit (Fisik < Sistem), potong stok via FIFO
      await this.recordStockOut({
        notransaksi: params.notransaksi,
        tanggal: params.tanggal,
        kodeitem: params.kodeitem,
        kodekantor,
        jumlah: Math.abs(jmlSelisih),
        satuan,
        tipe: "OP",
        iddetailtrs: params.notransaksi,
      });
    }

    return {
      status: jmlSelisih > 0 ? "SURPLUS" : "DEFICIT",
      jmlSebelum,
      jmlFisik: params.jmlFisik,
      jmlSelisih,
      totalSelisihNilai,
    };
  }

  /**
   * 6. DETEKSI SALDO ITEM MINUS & PENJUALAN TANPA STOK (OUTOFSTOCK)
   * Mendeteksi:
   * A. Saldo fisik item yang bernilai negatif saat ini (tbl_itemstok)
   * B. Transaksi penjualan di masa lalu yang dilakukan saat stok habis/minus (iddetailim = 'OUTOFSTOCK' di tbl_item_ik)
   */
  static async detectNegativeStock(): Promise<NegativeStockSummary> {
    // 1. Cek saldo item saat ini yang bernilai negatif di tbl_itemstok
    const currentNegRows = await db.execute<any>(sql`
      SELECT 
        s.kodeitem, 
        i.namaitem, 
        s.kantor, 
        s.stok::float AS stok, 
        COALESCE(i.hargapokok, 0)::float AS hargapokok
      FROM tbl_itemstok s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.stok < 0
      ORDER BY s.stok ASC;
    `);

    let totalCurrentNegativeQty = 0;
    let totalCurrentNegativeValuation = 0;
    const currentNegativeItems = currentNegRows.map(r => {
      const defisitQty = Math.abs(r.stok);
      const totalDefisitValuasi = defisitQty * r.hargapokok;
      totalCurrentNegativeQty += defisitQty;
      totalCurrentNegativeValuation += totalDefisitValuasi;

      return {
        kodeitem: r.kodeitem,
        namaitem: r.namaitem,
        kantor: r.kantor,
        stok: r.stok,
        hargapokok: r.hargapokok,
        totalDefisitValuasi,
      };
    });

    // 2. Cek transaksi penjualan di mana stok saat itu minus (iddetailim = 'OUTOFSTOCK' di tbl_item_ik)
    const oosAgg = await db.execute<any>(sql`
      SELECT 
        COUNT(*)::int AS total_transaksi,
        COUNT(DISTINCT kodeitem)::int AS total_item,
        COALESCE(SUM(jumlahdasar), 0)::float AS total_qty,
        COALESCE(SUM(jumlahdasar * hargadasar), 0)::float AS total_hpp_distorsi
      FROM tbl_item_ik
      WHERE iddetailim = 'OUTOFSTOCK';
    `);

    // 3. Ambil top item dengan nilai penjualan saat stok minus terbesar
    const topOosRows = await db.execute<any>(sql`
      SELECT 
        ik.kodeitem,
        i.namaitem,
        COUNT(DISTINCT ik.notransaksi)::int AS frekuensi_transaksi,
        SUM(ik.jumlahdasar)::float AS total_qty,
        AVG(ik.hargadasar)::float AS avg_hpp,
        SUM(ik.jumlahdasar * ik.hargadasar)::float AS total_nilai_distorsi,
        MAX(ik.tanggal) AS transaksi_terakhir
      FROM tbl_item_ik ik
      JOIN tbl_item i ON ik.kodeitem = i.kodeitem
      WHERE ik.iddetailim = 'OUTOFSTOCK'
      GROUP BY ik.kodeitem, i.namaitem
      ORDER BY total_nilai_distorsi DESC
      LIMIT 25;
    `);

    const topOutOfStockItems = topOosRows.map(r => ({
      kodeitem: r.kodeitem,
      namaitem: r.namaitem,
      frekuensiTransaksi: r.frekuensi_transaksi,
      totalQtyTerjualTanpaStok: r.total_qty,
      avgHpp: r.avg_hpp,
      totalNilaiDistorsi: r.total_nilai_distorsi,
      transaksiTerakhir: String(r.transaksi_terakhir).split(".")[0],
    }));

    return {
      totalCurrentNegativeItems: currentNegativeItems.length,
      totalCurrentNegativeQty,
      totalCurrentNegativeValuation,
      currentNegativeItems,
      totalOutOfStockSalesCount: oosAgg[0]?.total_transaksi || 0,
      totalOutOfStockItemsCount: oosAgg[0]?.total_item || 0,
      totalOutOfStockQty: oosAgg[0]?.total_qty || 0,
      totalOutOfStockHppDistortion: oosAgg[0]?.total_hpp_distorsi || 0,
      topOutOfStockItems,
    };
  }
}
