import { db } from "../db";
import { sql } from "drizzle-orm";

export interface WarehouseInfo {
  kodekantor: string;
  namakantor: string;
  fungsi: string;
  alamat: string | null;
  notelepon: string | null;
  totalItemVarieties: number;
  totalPhysicalQty: number;
  totalValuation: number;
}

export interface ItemWarehouseStock {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  kantor: string;
  namakantor: string;
  stokGudang: number;
  stokGlobal: number;
  hargapokok: number;
  totalNilaiGudang: number;
}

export interface StockTransferItem {
  kodeitem: string;
  jumlah: number;
  satuan?: string;
  keterangan?: string;
}

export interface StockTransferInput {
  kantordari: string;
  kantortujuan: string;
  tanggal: Date | string;
  keterangan?: string;
  user: string;
  items: StockTransferItem[];
}

export interface StockTransferResult {
  notransaksi: string;
  tanggal: string;
  kantordari: string;
  kantortujuan: string;
  totalItems: number;
  totalQuantity: number;
  totalValuation: number;
  details: {
    kodeitem: string;
    namaitem: string;
    jumlah: number;
    satuan: string;
    unitCost: number;
    subtotal: number;
  }[];
}

export interface StockOpnameItemInput {
  kodeitem: string;
  jmlfisik: number;
  satuan?: string;
  kodeacc?: string; // Akun beban/pendapatan penyesuaian selisih
}

export interface StockOpnameInput {
  kodekantor: string;
  tanggal: Date | string;
  user: string;
  items: StockOpnameItemInput[];
}

export interface StockOpnameItemResult {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  jmlsebelum: number;
  jmlfisik: number;
  jmlselisih: number;
  status: "MATCH" | "SURPLUS" | "DEFICIT";
  unitCost: number;
  nilaiSelisih: number;
}

export interface StockOpnameResult {
  periode: string;
  tanggal: string;
  kodekantor: string;
  totalItemsAudited: number;
  totalItemsSurplus: number;
  totalItemsDeficit: number;
  totalItemsMatched: number;
  netAdjustmentValuation: number;
  items: StockOpnameItemResult[];
}

export interface ConsignmentInItemInput {
  kodeitem: string;
  jumlah: number;
  satuan: string;
  harga: number; // Harga kesepakatan konsinyasi
}

export interface ConsignmentInInput {
  kodesupel: string;
  kodekantor: string;
  tanggal: Date | string;
  keterangan?: string;
  user: string;
  items: ConsignmentInItemInput[];
}

export interface ConsignmentInResult {
  notransaksi: string;
  kodesupel: string;
  namasupel: string;
  kodekantor: string;
  tanggal: string;
  totalItems: number;
  totalNilaiKonsinyasi: number;
}

export class WarehouseConsignmentService {
  /**
   * Helper: Generate Transaction Number from tbl_formatnotr
   */
  private static async generateTransactionNumber(trid: string, kantor: string, client: any = db): Promise<string> {
    const rows = await client.execute(sql`
      SELECT trid, nomor::bigint, slot1, slot2, slot3, slot4, slot5, sep1, sep2, sep3, sep4, numdgt
      FROM tbl_formatnotr
      WHERE trid = ${trid} AND kantor = ${kantor}
      LIMIT 1;
    `);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const yyyy = String(now.getFullYear());
    const dd = String(now.getDate()).padStart(2, "0");

    if ((rows as any[]).length === 0) {
      // Fallback format jika konfigurasi kantor tidak ada
      const rand = Math.floor(Math.random() * 9000 + 1000);
      return `${rand}/${trid}/${kantor}/${mm}${yy}`;
    }

    const r = (rows as any[])[0];
    const nextNomor = Number(r.nomor || 0) + 1;
    const numdgt = Number(r.numdgt || 4);
    const cntStr = String(nextNomor).padStart(numdgt, "0");

    const resolveSlot = (slot: string | null) => {
      if (!slot) return "";
      let s = slot;
      s = s.replace(/\[CNT\]/gi, cntStr);
      s = s.replace(/\[DEPT\]/gi, kantor);
      s = s.replace(/\[BLNTHN\]/gi, `${mm}${yy}`);
      s = s.replace(/\[THNBLN\]/gi, `${yy}${mm}`);
      s = s.replace(/\[THN\]/gi, yy);
      s = s.replace(/\[THN4\]/gi, yyyy);
      s = s.replace(/\[BLN\]/gi, mm);
      s = s.replace(/\[HR\]/gi, dd);
      return s;
    };

    const s1 = resolveSlot(r.slot1);
    const s2 = resolveSlot(r.slot2);
    const s3 = resolveSlot(r.slot3);
    const s4 = resolveSlot(r.slot4);
    const s5 = resolveSlot(r.slot5);

    let notransaksi = s1;
    if (s2) notransaksi += (r.sep1 || "") + s2;
    if (s3) notransaksi += (r.sep2 || "") + s3;
    if (s4) notransaksi += (r.sep3 || "") + s4;
    if (s5) notransaksi += (r.sep4 || "") + s5;

    // Update counter di database
    await client.execute(sql`
      UPDATE tbl_formatnotr
      SET nomor = ${nextNomor}, notransaksi = ${notransaksi}
      WHERE trid = ${trid} AND kantor = ${kantor};
    `);

    return notransaksi;
  }

  /**
   * 1. LIST ALL REGISTERED WAREHOUSES & CURRENT INVENTORY VALUE
   */
  static async listWarehouses(client: any = db): Promise<WarehouseInfo[]> {
    const rows = await client.execute(sql`
      SELECT 
        k.kodekantor,
        k.namakantor,
        k.fungsi,
        k.alamat,
        k.notelepon,
        COUNT(s.kodeitem)::int as total_item_varieties,
        COALESCE(SUM(s.stok::numeric), 0) as total_physical_qty,
        COALESCE(SUM(s.stok::numeric * COALESCE(i.hargapokok::numeric, 0)), 0) as total_valuation
      FROM tbl_kantor k
      LEFT JOIN tbl_itemstok s ON k.kodekantor = s.kantor
      LEFT JOIN tbl_item i ON s.kodeitem = i.kodeitem
      GROUP BY k.kodekantor, k.namakantor, k.fungsi, k.alamat, k.notelepon
      ORDER BY k.kodekantor ASC;
    `);

    return (rows as any[]).map(r => ({
      kodekantor: String(r.kodekantor).trim(),
      namakantor: String(r.namakantor).trim(),
      fungsi: String(r.fungsi || "").trim(),
      alamat: r.alamat ? String(r.alamat).trim() : null,
      notelepon: r.notelepon ? String(r.notelepon).trim() : null,
      totalItemVarieties: Number(r.total_item_varieties || 0),
      totalPhysicalQty: Number(r.total_physical_qty || 0),
      totalValuation: Math.round(Number(r.total_valuation || 0) * 100) / 100
    }));
  }

  /**
   * 2. GET ITEM STOCK IN SPECIFIC WAREHOUSE
   */
  static async getWarehouseStock(warehouseCode: string, itemCode?: string, client: any = db): Promise<ItemWarehouseStock[]> {
    let query = sql`
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
      WHERE s.kantor = ${warehouseCode}
    `;

    if (itemCode) {
      query = sql`${query} AND s.kodeitem = ${itemCode}`;
    }

    query = sql`${query} ORDER BY s.kodeitem ASC LIMIT 50;`;

    const rows = await client.execute(query);

    return (rows as any[]).map(r => {
      const stokG = Number(r.stok_gudang || 0);
      const hpp = Number(r.hargapokok || 0);
      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        satuan: String(r.satuan || "PCS").trim(),
        kantor: String(r.kantor).trim(),
        namakantor: String(r.namakantor).trim(),
        stokGudang: stokG,
        stokGlobal: Number(r.stok_global || 0),
        hargapokok: hpp,
        totalNilaiGudang: Math.round(stokG * hpp * 100) / 100
      };
    });
  }

  /**
   * 3. TRANSFER STOCK BETWEEN WAREHOUSES (tbl_itrhd & tbl_itrdt)
   * Mengurangi stok di gudang asal (kantordari) dan menambah stok di gudang tujuan (kantortujuan).
   * Alokasi FIFO dicatat di tbl_item_ik (asal) dan tbl_item_im (tujuan).
   */
  static async transferStock(input: StockTransferInput, client: any = db): Promise<StockTransferResult> {
    if (input.kantordari.trim() === input.kantortujuan.trim()) {
      throw new Error("Gudang asal dan gudang tujuan transfer tidak boleh sama.");
    }
    if (!input.items || input.items.length === 0) {
      throw new Error("Daftar item transfer tidak boleh kosong.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber("TR", input.kantordari, client);
    const tglStr = tgl.toISOString();

    // 1. Validasi awal & pre-kalkulasi semua baris item
    let totalTransferValuation = 0;
    let totalQtyAll = 0;
    const preparedItems: {
      it: StockTransferItem;
      nobaris: number;
      namaitem: string;
      satuan: string;
      unitCost: number;
      subtotal: number;
      iddetailDt: string;
    }[] = [];

    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");

    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      const nobaris = i + 1;

      // Cek stok asal di tbl_itemstok
      const stockRows = await client.execute(sql`
        SELECT s.stok::numeric, i.namaitem, i.satuan, i.hargapokok::numeric
        FROM tbl_itemstok s
        JOIN tbl_item i ON s.kodeitem = i.kodeitem
        WHERE s.kodeitem = ${it.kodeitem} AND s.kantor = ${input.kantordari}
        LIMIT 1;
      `);

      if ((stockRows as any[]).length === 0) {
        throw new Error(`Item ${it.kodeitem} tidak terdaftar di gudang asal (${input.kantordari}).`);
      }

      const st = (stockRows as any[])[0];
      const currentOriginStock = Number(st.stok || 0);
      const namaitem = String(st.namaitem).trim();
      const satuan = it.satuan || String(st.satuan || "PCS").trim();
      const unitCost = Number(st.hargapokok || 0);

      if (currentOriginStock < it.jumlah) {
        throw new Error(`Stok item ${it.kodeitem} di gudang ${input.kantordari} tidak mencukupi (Tersedia: ${currentOriginStock}, Diminta: ${it.jumlah}).`);
      }

      const subtotal = Math.round(it.jumlah * unitCost * 100) / 100;
      totalTransferValuation += subtotal;
      totalQtyAll += it.jumlah;

      const iddetailDt = `${datePrefix}TR${Math.floor(Math.random() * 900000000 + 100000000)}`;

      preparedItems.push({
        it,
        nobaris,
        namaitem,
        satuan,
        unitCost,
        subtotal,
        iddetailDt
      });
    }

    // 2. Simpan HEADER transfer terlebih dahulu (karena ada FK tbl_itrdt -> tbl_itrhd)
    await client.execute(sql`
      INSERT INTO tbl_itrhd (
        notransaksi, kodekantor, kantordari, kantortujuan, tanggal, tipe, keterangan,
        acc_persediaan, totalitem, user1, user2, dateupd, shiftkerja
      ) VALUES (
        ${notransaksi}, ${input.kantordari}, ${input.kantordari}, ${input.kantortujuan},
        ${tglStr}::timestamp, 'TR', ${input.keterangan || "Transfer Antar Gudang"},
        '1-1301', ${input.items.length}, ${input.user}, ${input.user}, NOW(), 1
      );
    `);

    // 3. Simpan DETAIL dan mutasi stok / kartu stok
    const detailsResult: StockTransferResult["details"] = [];

    for (const prep of preparedItems) {
      // A. Simpan baris detail ke tbl_itrdt
      await client.execute(sql`
        INSERT INTO tbl_itrdt (
          iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, dateupd, detinfo, harga, total
        ) VALUES (
          ${prep.iddetailDt}, ${prep.nobaris}, ${notransaksi}, ${prep.it.kodeitem}, ${prep.it.jumlah},
          ${prep.satuan}, NOW(), ${prep.it.keterangan || ""}, ${prep.unitCost}, ${prep.subtotal}
        );
      `);

      // B. Kurangi stok gudang asal di tbl_itemstok
      await client.execute(sql`
        UPDATE tbl_itemstok
        SET stok = stok - ${prep.it.jumlah}
        WHERE kodeitem = ${prep.it.kodeitem} AND kantor = ${input.kantordari};
      `);

      // C. Tambah stok gudang tujuan di tbl_itemstok (PostgreSQL 8.4 compatible check-and-insert/update)
      const existsTujuan = await client.execute(sql`
        SELECT 1 FROM tbl_itemstok WHERE kodeitem = ${prep.it.kodeitem} AND kantor = ${input.kantortujuan} LIMIT 1;
      `);
      if ((existsTujuan as any[]).length === 0) {
        await client.execute(sql`
          INSERT INTO tbl_itemstok (kodeitem, kantor, stok)
          VALUES (${prep.it.kodeitem}, ${input.kantortujuan}, ${prep.it.jumlah});
        `);
      } else {
        await client.execute(sql`
          UPDATE tbl_itemstok
          SET stok = stok + ${prep.it.jumlah}
          WHERE kodeitem = ${prep.it.kodeitem} AND kantor = ${input.kantortujuan};
        `);
      }

      // D. Catat pengeluaran mutasi FIFO di tbl_item_ik (Asal)
      const batchRows = await client.execute(sql`
        SELECT iddetail, hargadasar::numeric, sisa::numeric
        FROM tbl_item_im
        WHERE kodeitem = ${prep.it.kodeitem} AND kodekantor = ${input.kantordari} AND sisa > 0
        ORDER BY tanggal ASC, iddetail ASC
        LIMIT 1;
      `);
      const batchId = (batchRows as any[]).length > 0 ? String((batchRows as any[])[0].iddetail) : `${datePrefix}IM-FALLBACK`;
      if ((batchRows as any[]).length > 0) {
        await client.execute(sql`
          UPDATE tbl_item_im
          SET sisa = GREATEST(0, sisa - ${prep.it.jumlah}), keluar = keluar + ${prep.it.jumlah}
          WHERE iddetail = ${batchId};
        `);
      }

      await client.execute(sql`
        INSERT INTO tbl_item_ik (
          iddetailim, notransaksi, kodekantor, tanggal, tipe,
          kodeitem, jumlahdasar, satuandasar, hargadasar, iddetailtrs
        ) VALUES (
          ${batchId}, ${notransaksi}, ${input.kantordari}, ${tglStr}::timestamp,
          'TR', ${prep.it.kodeitem}, ${prep.it.jumlah}, ${prep.satuan}, ${prep.unitCost}, ${prep.iddetailDt}
        );
      `);

      // E. Catat pemasukan batch FIFO baru di tbl_item_im (Tujuan)
      const iddetailIm = `${datePrefix}IM${Math.floor(Math.random() * 900000000 + 100000000)}`;
      await client.execute(sql`
        INSERT INTO tbl_item_im (
          iddetail, iddetailtrs, notransaksi, kodekantor, tanggal, tipe, matauang, rate,
          kodeitem, jumlahdasar, satuandasar, hargadasar, masuk, keluar, sisa, flagavg, tgl_trs
        ) VALUES (
          ${iddetailIm}, ${prep.iddetailDt}, ${notransaksi}, ${input.kantortujuan}, ${tglStr}::timestamp,
          'TR', 'IDR', 1, ${prep.it.kodeitem}, ${prep.it.jumlah}, ${prep.satuan}, ${prep.unitCost},
          ${prep.it.jumlah}, 0, ${prep.it.jumlah}, 0, NOW()
        );
      `);

      detailsResult.push({
        kodeitem: prep.it.kodeitem,
        namaitem: prep.namaitem,
        jumlah: prep.it.jumlah,
        satuan: prep.satuan,
        unitCost: prep.unitCost,
        subtotal: prep.subtotal
      });
    }

    return {
      notransaksi,
      tanggal: tglStr,
      kantordari: input.kantordari,
      kantortujuan: input.kantortujuan,
      totalItems: input.items.length,
      totalQuantity: totalQtyAll,
      totalValuation: Math.round(totalTransferValuation * 100) / 100,
      details: detailsResult
    };
  }

  /**
   * 4. EXECUTE STOCK OPNAME (tbl_itemopname)
   * Menyesuaikan perbedaan saldo buku sistem vs fisik riil di rak gudang.
   * Surplus menambah saldo dan batch FIFO ('OP'); Defisit mengurangi saldo dan menyerap FIFO ('OP').
   */
  static async executeStockOpname(input: StockOpnameInput, client: any = db): Promise<StockOpnameResult> {
    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const periode = tgl.getFullYear().toString() + String(tgl.getMonth() + 1).padStart(2, "0");
    const tglStr = tgl.toISOString();

    let itemsSurplus = 0;
    let itemsDeficit = 0;
    let itemsMatched = 0;
    let netAdjustmentValuation = 0;
    const auditItems: StockOpnameItemResult[] = [];

    for (const it of input.items) {
      // Ambil stok sistem saat ini
      const itemRows = await client.execute(sql`
        SELECT 
          i.kodeitem,
          i.namaitem,
          i.satuan,
          COALESCE(i.hargapokok::numeric, 0) as hargapokok,
          COALESCE(s.stok::numeric, 0) as stok_gudang
        FROM tbl_item i
        LEFT JOIN tbl_itemstok s ON i.kodeitem = s.kodeitem AND s.kantor = ${input.kodekantor}
        WHERE i.kodeitem = ${it.kodeitem}
        LIMIT 1;
      `);

      if ((itemRows as any[]).length === 0) {
        throw new Error(`Item ${it.kodeitem} tidak ditemukan di master database.`);
      }

      const row = (itemRows as any[])[0];
      const jmlsebelum = Number(row.stok_gudang || 0);
      const jmlfisik = it.jmlfisik;
      const jmlselisih = jmlfisik - jmlsebelum;
      const hpp = Number(row.hargapokok || 0);
      const nilaiSelisih = Math.round(jmlselisih * hpp * 100) / 100;
      netAdjustmentValuation += nilaiSelisih;

      let status: "MATCH" | "SURPLUS" | "DEFICIT" = "MATCH";
      if (jmlselisih > 0) status = "SURPLUS";
      else if (jmlselisih < 0) status = "DEFICIT";

      const datePrefix = tgl.getFullYear().toString() +
        String(tgl.getMonth() + 1).padStart(2, "0") +
        String(tgl.getDate()).padStart(2, "0");
      const iddetailOp = `${datePrefix}OP${Math.floor(Math.random() * 900000000 + 100000000)}`;

      // 1. Simpan pencatatan ke tbl_itemopname
      await client.execute(sql`
        INSERT INTO tbl_itemopname (
          iddetail, periode, tanggal, kodeitem, kodekantor, satuan,
          jmlsebelum, jmlfisik, jmlselisih, kodeacc, user1, user2,
          dateupd, harga, total, compname
        ) VALUES (
          ${iddetailOp}, ${periode}, ${tglStr}::timestamp, ${it.kodeitem}, ${input.kodekantor},
          ${it.satuan || String(row.satuan || "PCS").trim()}, ${jmlsebelum}, ${jmlfisik}, ${jmlselisih},
          ${it.kodeacc || (jmlselisih >= 0 ? "7-3000" : "8-1000")}, ${input.user}, ${input.user},
          NOW(), ${hpp}, ${nilaiSelisih}, 'SERVER'
        );
      `);

      // 2. Sesuaikan saldo stok fisik di tbl_itemstok & tbl_item
      if (jmlselisih !== 0) {
        const existsStok = await client.execute(sql`
          SELECT 1 FROM tbl_itemstok WHERE kodeitem = ${it.kodeitem} AND kantor = ${input.kodekantor} LIMIT 1;
        `);
        if ((existsStok as any[]).length === 0) {
          await client.execute(sql`
            INSERT INTO tbl_itemstok (kodeitem, kantor, stok)
            VALUES (${it.kodeitem}, ${input.kodekantor}, ${jmlfisik});
          `);
        } else {
          await client.execute(sql`
            UPDATE tbl_itemstok
            SET stok = ${jmlfisik}
            WHERE kodeitem = ${it.kodeitem} AND kantor = ${input.kodekantor};
          `);
        }

        await client.execute(sql`
          UPDATE tbl_item
          SET stok = stok + ${jmlselisih}, dateupd = NOW()
          WHERE kodeitem = ${it.kodeitem};
        `);

        // A. SURPLUS: Buat batch FIFO masuk baru di tbl_item_im
        if (jmlselisih > 0) {
          itemsSurplus++;
          const iddetailIm = `${datePrefix}OPIM${Math.floor(Math.random() * 90000000 + 10000000)}`;
          await client.execute(sql`
            INSERT INTO tbl_item_im (
              iddetail, iddetailtrs, notransaksi, kodekantor, tanggal, tipe, matauang, rate,
              kodeitem, jumlahdasar, satuandasar, hargadasar, masuk, keluar, sisa, flagavg, tgl_trs
            ) VALUES (
              ${iddetailIm}, ${iddetailOp}, ${iddetailOp}, ${input.kodekantor}, ${tglStr}::timestamp,
              'OP', 'IDR', 1, ${it.kodeitem}, ${jmlselisih}, ${row.satuan}, ${hpp},
              ${jmlselisih}, 0, ${jmlselisih}, 0, NOW()
            );
          `);
        }
        // B. DEFISIT: Catat konsumsi/pengurangan FIFO di tbl_item_ik
        else {
          itemsDeficit++;
          const defQty = Math.abs(jmlselisih);
          const batchRows = await client.execute(sql`
            SELECT iddetail, hargadasar::numeric, sisa::numeric
            FROM tbl_item_im
            WHERE kodeitem = ${it.kodeitem} AND kodekantor = ${input.kodekantor} AND sisa > 0
            ORDER BY tanggal ASC, iddetail ASC
            LIMIT 1;
          `);
          const batchId = (batchRows as any[]).length > 0 ? String((batchRows as any[])[0].iddetail) : `${datePrefix}OPIM-FALLBACK`;
          if ((batchRows as any[]).length > 0) {
            await client.execute(sql`
              UPDATE tbl_item_im
              SET sisa = GREATEST(0, sisa - ${defQty}), keluar = keluar + ${defQty}
              WHERE iddetail = ${batchId};
            `);
          }

          await client.execute(sql`
            INSERT INTO tbl_item_ik (
              iddetailim, notransaksi, kodekantor, tanggal, tipe,
              kodeitem, jumlahdasar, satuandasar, hargadasar, iddetailtrs
            ) VALUES (
              ${batchId}, ${iddetailOp}, ${input.kodekantor}, ${tglStr}::timestamp,
              'OP', ${it.kodeitem}, ${defQty}, ${row.satuan}, ${hpp}, ${iddetailOp}
            );
          `);
        }
      } else {
        itemsMatched++;
      }

      auditItems.push({
        kodeitem: it.kodeitem,
        namaitem: String(row.namaitem).trim(),
        satuan: String(row.satuan || "PCS").trim(),
        jmlsebelum,
        jmlfisik,
        jmlselisih,
        status,
        unitCost: hpp,
        nilaiSelisih
      });
    }

    return {
      periode,
      tanggal: tglStr,
      kodekantor: input.kodekantor,
      totalItemsAudited: input.items.length,
      totalItemsSurplus: itemsSurplus,
      totalItemsDeficit: itemsDeficit,
      totalItemsMatched: itemsMatched,
      netAdjustmentValuation: Math.round(netAdjustmentValuation * 100) / 100,
      items: auditItems
    };
  }

  /**
   * 5. RECEIVE CONSIGNMENT IN GOODS (tbl_imhd & tbl_imdt with tipe = 'KI')
   * Menerima barang titipan dari supplier konsinyasi ke gudang toko.
   */
  static async recordConsignmentIn(input: ConsignmentInInput, client: any = db): Promise<ConsignmentInResult> {
    if (!input.items || input.items.length === 0) {
      throw new Error("Daftar item konsinyasi masuk tidak boleh kosong.");
    }

    const tgl = typeof input.tanggal === "string" ? new Date(input.tanggal) : input.tanggal;
    const notransaksi = await this.generateTransactionNumber("KI", input.kodekantor, client);
    const tglStr = tgl.toISOString();

    // Dapatkan data supplier
    const supRows = await client.execute(sql`
      SELECT nama FROM tbl_supel WHERE kode = ${input.kodesupel} AND tipe = 'SU' LIMIT 1;
    `);
    const namasupel = (supRows as any[]).length > 0 ? String((supRows as any[])[0].nama).trim() : "Supplier Konsinyasi";

    let subtotal = 0;
    const datePrefix = tgl.getFullYear().toString() +
      String(tgl.getMonth() + 1).padStart(2, "0") +
      String(tgl.getDate()).padStart(2, "0");

    // Pre-calculate subtotal
    for (const it of input.items) {
      subtotal += Math.round(it.jumlah * it.harga * 100) / 100;
    }

    // 1. Simpan HEADER di tbl_imhd terlebih dahulu (foreign key requirement)
    await client.execute(sql`
      INSERT INTO tbl_imhd (
        notransaksi, kodekantor, kantortujuan, tanggal, tipe, kodesupel, matauang, rate,
        keterangan, totalitem, subtotal, totalakhir, carabayar, user1, user2, dateupd, shiftkerja
      ) VALUES (
        ${notransaksi}, ${input.kodekantor}, ${input.kodekantor}, ${tglStr}::timestamp,
        'KI', ${input.kodesupel}, 'IDR', 1, ${input.keterangan || "Konsinyasi Masuk"},
        ${input.items.length}, ${subtotal}, ${subtotal}, 'KD', ${input.user}, ${input.user}, NOW(), 1
      );
    `);

    // 2. Simpan DETAIL di tbl_imdt dan mutasi stok
    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      const nobaris = i + 1;
      const lineTotal = Math.round(it.jumlah * it.harga * 100) / 100;

      const iddetailDt = `${datePrefix}KIDT${Math.floor(Math.random() * 90000000 + 10000000)}`;

      // A. Simpan detail di tbl_imdt
      await client.execute(sql`
        INSERT INTO tbl_imdt (
          iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, total, dateupd
        ) VALUES (
          ${iddetailDt}, ${nobaris}, ${notransaksi}, ${it.kodeitem}, ${it.jumlah},
          ${it.satuan}, ${it.harga}, ${lineTotal}, NOW()
        );
      `);

      // B. Tambah stok fisik di tbl_itemstok & tbl_item
      const existsKonsin = await client.execute(sql`
        SELECT 1 FROM tbl_itemstok WHERE kodeitem = ${it.kodeitem} AND kantor = ${input.kodekantor} LIMIT 1;
      `);
      if ((existsKonsin as any[]).length === 0) {
        await client.execute(sql`
          INSERT INTO tbl_itemstok (kodeitem, kantor, stok)
          VALUES (${it.kodeitem}, ${input.kodekantor}, ${it.jumlah});
        `);
      } else {
        await client.execute(sql`
          UPDATE tbl_itemstok
          SET stok = stok + ${it.jumlah}
          WHERE kodeitem = ${it.kodeitem} AND kantor = ${input.kodekantor};
        `);
      }

      await client.execute(sql`
        UPDATE tbl_item
        SET stok = COALESCE(stok, 0) + ${it.jumlah}, dateupd = NOW()
        WHERE kodeitem = ${it.kodeitem};
      `);

      // C. Catat batch FIFO penerimaan di tbl_item_im ('KI')
      const iddetailIm = `${datePrefix}KIIM${Math.floor(Math.random() * 90000000 + 10000000)}`;
      await client.execute(sql`
        INSERT INTO tbl_item_im (
          iddetail, iddetailtrs, notransaksi, kodekantor, tanggal, tipe, matauang, rate,
          kodeitem, jumlahdasar, satuandasar, hargadasar, masuk, keluar, sisa, flagavg, tgl_trs
        ) VALUES (
          ${iddetailIm}, ${iddetailDt}, ${notransaksi}, ${input.kodekantor}, ${tglStr}::timestamp,
          'KI', 'IDR', 1, ${it.kodeitem}, ${it.jumlah}, ${it.satuan}, ${it.harga},
          ${it.jumlah}, 0, ${it.jumlah}, 0, NOW()
        );
      `);
    }

    return {
      notransaksi,
      kodesupel: input.kodesupel,
      namasupel,
      kodekantor: input.kodekantor,
      tanggal: tglStr,
      totalItems: input.items.length,
      totalNilaiKonsinyasi: Math.round(subtotal * 100) / 100
    };
  }

  /**
   * 6. SUMMARY OF CONSIGNMENT LIABILITIES (Barang Konsinyasi Laku vs Belum Dilunasi)
   */
  static async getConsignmentSummary(supplierCode?: string, client: any = db): Promise<{
    supplierCode: string;
    supplierName: string;
    totalReceivedQty: number;
    totalReceivedValuation: number;
    totalSoldQty: number;
    totalSoldValuation: number;
    totalPaidValuation: number;
    pendingPaymentLiability: number;
  }[]> {
    let query = sql`
      SELECT 
        h.kodesupel,
        s.nama as supplier_name,
        COALESCE(SUM(d.jumlah::numeric), 0) as total_received_qty,
        COALESCE(SUM(d.total::numeric), 0) as total_received_val
      FROM tbl_imhd h
      JOIN tbl_imdt d ON h.notransaksi = d.notransaksi
      JOIN tbl_supel s ON h.kodesupel = s.kode
      WHERE h.tipe = 'KI'
    `;

    if (supplierCode) {
      query = sql`${query} AND h.kodesupel = ${supplierCode}`;
    }

    query = sql`${query} GROUP BY h.kodesupel, s.nama ORDER BY h.kodesupel ASC;`;

    const rows = await client.execute(query);

    return (rows as any[]).map(r => ({
      supplierCode: String(r.kodesupel).trim(),
      supplierName: String(r.supplier_name).trim(),
      totalReceivedQty: Number(r.total_received_qty || 0),
      totalReceivedValuation: Math.round(Number(r.total_received_val || 0) * 100) / 100,
      totalSoldQty: 0,
      totalSoldValuation: 0,
      totalPaidValuation: 0,
      pendingPaymentLiability: 0
    }));
  }
}
