import { db } from "../db";
import { sql } from "drizzle-orm";

export interface WmsZone {
  kodezone: string;
  kodekantor: string;
  namazone: string;
  deskripsi: string | null;
  total_bins?: number;
}

export interface WmsBin {
  kodebin: string;
  kodekantor: string;
  kodezone: string | null;
  namazone?: string;
  aisle: string;
  rack: string;
  tier: string;
  slot: string;
  kapasitas_max_qty: number;
  is_active: boolean;
  total_items?: number;
  total_qty?: number;
  occupancy_pct?: number;
}

export interface WmsBinStock {
  id: number;
  kodekantor: string;
  kodebin: string;
  kodeitem: string;
  namaitem?: string;
  satuan?: string;
  jumlah: number;
  batch_no: string | null;
  expired_date: string | null;
  updated_at: string;
}

export interface PutawayInput {
  notask?: string;
  kodekantor: string;
  kodebin: string;
  kodeitem: string;
  jumlah: number;
  batch_no?: string;
  expired_date?: string;
  operator: string;
}

export interface PickItemInput {
  notask: string;
  kodeitem: string;
  source_bin: string;
  jumlah: number;
  operator: string;
}

export interface RelocateInput {
  kodekantor: string;
  from_bin: string;
  to_bin: string;
  kodeitem: string;
  jumlah: number;
  operator: string;
  keterangan?: string;
}

export class WmsService {
  /**
   * Daftar Zona Gudang
   */
  static async listZones(kodekantor?: string): Promise<WmsZone[]> {
    const where = kodekantor ? sql`WHERE z.kodekantor = ${kodekantor}` : sql``;
    const rows = await db.execute(sql`
      SELECT 
        z.kodezone,
        z.kodekantor,
        z.namazone,
        z.deskripsi,
        COUNT(b.kodebin)::int AS total_bins
      FROM wms_zones z
      LEFT JOIN wms_bins b ON z.kodezone = b.kodezone
      ${where}
      GROUP BY z.kodezone, z.kodekantor, z.namazone, z.deskripsi
      ORDER BY z.kodezone;
    `);
    return rows as any[];
  }

  /**
   * Tambah Zona Baru
   */
  static async createZone(data: { kodezone: string; kodekantor: string; namazone: string; deskripsi?: string }) {
    await db.execute(sql`
      INSERT INTO wms_zones (kodezone, kodekantor, namazone, deskripsi)
      VALUES (${data.kodezone}, ${data.kodekantor}, ${data.namazone}, ${data.deskripsi || null});
    `);
    return { success: true, kodezone: data.kodezone };
  }

  /**
   * Daftar Master Rak & Bin dengan Metrik Keterisian (Occupancy Heatmap)
   */
  static async listBins(kodekantor?: string, aisle?: string): Promise<WmsBin[]> {
    let where = sql`WHERE b.is_active = TRUE`;
    if (kodekantor) {
      where = sql`${where} AND b.kodekantor = ${kodekantor}`;
    }
    if (aisle) {
      where = sql`${where} AND b.aisle = ${aisle}`;
    }

    const rows = await db.execute(sql`
      SELECT 
        b.kodebin,
        b.kodekantor,
        b.kodezone,
        z.namazone,
        b.aisle,
        b.rack,
        b.tier,
        b.slot,
        b.kapasitas_max_qty::float AS kapasitas_max_qty,
        b.is_active,
        COALESCE(COUNT(DISTINCT bs.kodeitem), 0)::int AS total_items,
        COALESCE(SUM(bs.jumlah), 0)::float AS total_qty,
        CASE 
          WHEN b.kapasitas_max_qty > 0 THEN 
            ROUND((COALESCE(SUM(bs.jumlah), 0) / b.kapasitas_max_qty * 100)::numeric, 1)::float
          ELSE 0 
        END AS occupancy_pct
      FROM wms_bins b
      LEFT JOIN wms_zones z ON b.kodezone = z.kodezone
      LEFT JOIN wms_bin_stocks bs ON b.kodebin = bs.kodebin
      ${where}
      GROUP BY b.kodebin, b.kodekantor, b.kodezone, z.namazone, b.aisle, b.rack, b.tier, b.slot, b.kapasitas_max_qty, b.is_active
      ORDER BY b.aisle ASC, b.rack ASC, b.tier ASC, b.slot ASC;
    `);
    return rows as any[];
  }

  /**
   * Detail Rak / Bin beserta daftar barang fisik di dalamnya
   */
  static async getBinDetail(kodebin: string) {
    const binRows = await db.execute(sql`
      SELECT 
        b.kodebin,
        b.kodekantor,
        b.kodezone,
        z.namazone,
        b.aisle,
        b.rack,
        b.tier,
        b.slot,
        b.kapasitas_max_qty::float AS kapasitas_max_qty,
        b.is_active
      FROM wms_bins b
      LEFT JOIN wms_zones z ON b.kodezone = z.kodezone
      WHERE b.kodebin = ${kodebin}
      LIMIT 1;
    `);

    if ((binRows as any[]).length === 0) {
      return null;
    }

    const bin = (binRows as any[])[0];

    const stockRows = await db.execute(sql`
      SELECT 
        bs.id,
        bs.kodekantor,
        bs.kodebin,
        bs.kodeitem,
        it.namaitem,
        it.satuan,
        bs.jumlah::float AS jumlah,
        bs.batch_no,
        bs.expired_date::text AS expired_date,
        bs.updated_at::text AS updated_at
      FROM wms_bin_stocks bs
      LEFT JOIN tbl_item it ON bs.kodeitem = it.kodeitem
      WHERE bs.kodebin = ${kodebin} AND bs.jumlah > 0
      ORDER BY bs.updated_at DESC;
    `);

    const totalQty = (stockRows as any[]).reduce((sum, item) => sum + (item.jumlah || 0), 0);
    const occupancyPct = bin.kapasitas_max_qty > 0 
      ? Math.round((totalQty / bin.kapasitas_max_qty) * 100 * 10) / 10 
      : 0;

    return {
      bin: {
        ...bin,
        total_qty: totalQty,
        occupancy_pct: occupancyPct,
      },
      stocks: stockRows as any[],
    };
  }

  /**
   * Bulk Generator Bin: Buat deretan bin secara otomatis
   */
  static async generateBins(input: {
    kodekantor: string;
    kodezone: string;
    aisle: string;
    startRack: number;
    endRack: number;
    tiers: number;
    slots: number;
    maxQty?: number;
  }) {
    const created: string[] = [];
    const maxQty = input.maxQty || 500;

    for (let r = input.startRack; r <= input.endRack; r++) {
      const rackStr = String(r).padStart(2, "0");
      for (let t = 1; t <= input.tiers; t++) {
        const tierStr = String(t);
        for (let s = 1; s <= input.slots; s++) {
          const slotStr = String(s).padStart(2, "0");
          const kodebin = `BIN-${input.kodekantor}-${input.aisle}-${rackStr}-${tierStr}-${slotStr}`;

          const exists = await db.execute(sql`
            SELECT 1 FROM wms_bins WHERE kodebin = ${kodebin} LIMIT 1;
          `);
          if ((exists as any[]).length === 0) {
            await db.execute(sql`
              INSERT INTO wms_bins (kodebin, kodekantor, kodezone, aisle, rack, tier, slot, kapasitas_max_qty)
              VALUES (${kodebin}, ${input.kodekantor}, ${input.kodezone}, ${input.aisle}, ${rackStr}, ${tierStr}, ${slotStr}, ${maxQty});
            `);
          }
          created.push(kodebin);
        }
      }
    }
    return { success: true, count: created.length, bins: created };
  }

  /**
   * Rekomendasi Bin untuk Putaway (Barang Masuk)
   */
  static async findRecommendedPutawayBin(kodekantor: string, kodeitem: string, qty: number): Promise<string> {
    // 1. Cari bin yang sudah berisi item ini dan kapasitas masih cukup
    const existing = await db.execute(sql`
      SELECT b.kodebin
      FROM wms_bins b
      JOIN wms_bin_stocks bs ON b.kodebin = bs.kodebin
      WHERE b.kodekantor = ${kodekantor} AND b.is_active = TRUE AND bs.kodeitem = ${kodeitem}
        AND (b.kapasitas_max_qty = 0 OR (b.kapasitas_max_qty - bs.jumlah) >= ${qty})
      ORDER BY bs.jumlah DESC
      LIMIT 1;
    `);

    if ((existing as any[]).length > 0) {
      return (existing as any[])[0].kodebin;
    }

    // 2. Jika tidak ada, cari bin kosong di zona fast/general
    const emptyBin = await db.execute(sql`
      SELECT b.kodebin
      FROM wms_bins b
      LEFT JOIN wms_bin_stocks bs ON b.kodebin = bs.kodebin
      WHERE b.kodekantor = ${kodekantor} AND b.is_active = TRUE
      GROUP BY b.kodebin, b.aisle, b.rack, b.tier, b.slot
      HAVING COALESCE(SUM(bs.jumlah), 0) = 0
      ORDER BY b.aisle ASC, b.rack ASC, b.tier ASC, b.slot ASC
      LIMIT 1;
    `);

    if ((emptyBin as any[]).length > 0) {
      return (emptyBin as any[])[0].kodebin;
    }

    // Fallback: bin pertama yang aktif
    const anyBin = await db.execute(sql`
      SELECT kodebin FROM wms_bins WHERE kodekantor = ${kodekantor} AND is_active = TRUE LIMIT 1;
    `);
    return (anyBin as any[])[0]?.kodebin || `BIN-${kodekantor}-A-01-1-01`;
  }

  /**
   * Eksekusi Putaway: Menaruh barang ke Bin & mencatat mutasi
   */
  static async executePutaway(input: PutawayInput) {
    const expiredDate = input.expired_date ? input.expired_date : null;
    const batchNo = input.batch_no || null;

    // 1. Upsert ke wms_bin_stocks (PG 8.4 compatible)
    const existingStock = await db.execute(sql`
      SELECT id, jumlah::float AS jumlah, batch_no, expired_date
      FROM wms_bin_stocks
      WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.kodebin} AND kodeitem = ${input.kodeitem}
      LIMIT 1;
    `);

    if ((existingStock as any[]).length > 0) {
      await db.execute(sql`
        UPDATE wms_bin_stocks
        SET jumlah = jumlah + ${input.jumlah},
            batch_no = COALESCE(${batchNo}, batch_no),
            expired_date = COALESCE(${expiredDate}::date, expired_date),
            updated_at = NOW()
        WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.kodebin} AND kodeitem = ${input.kodeitem};
      `);
    } else {
      await db.execute(sql`
        INSERT INTO wms_bin_stocks (kodekantor, kodebin, kodeitem, jumlah, batch_no, expired_date, updated_at)
        VALUES (${input.kodekantor}, ${input.kodebin}, ${input.kodeitem}, ${input.jumlah}, ${batchNo}, ${expiredDate}::date, NOW());
      `);
    }

    // 2. Catat mutasi wms_stock_movements
    const nomutasi = `MOV-INB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(sql`
      INSERT INTO wms_stock_movements (nomutasi, kodekantor, kodeitem, from_bin, to_bin, jumlah, tipe, notransaksi_ref, operator, keterangan)
      VALUES (${nomutasi}, ${input.kodekantor}, ${input.kodeitem}, 'DOCK/RECEIVING', ${input.kodebin}, ${input.jumlah}, 'INBOUND', ${input.notask || null}, ${input.operator}, 'Putaway barang masuk ke bin');
    `);

    // 3. Jika ada notask inbound, update item
    if (input.notask) {
      await db.execute(sql`
        UPDATE wms_inbound_items
        SET jumlah_received = jumlah_received + ${input.jumlah},
            target_bin = ${input.kodebin},
            status = CASE WHEN (jumlah_received + ${input.jumlah}) >= jumlah_order THEN 'STORED' ELSE 'RECEIVING' END
        WHERE notask = ${input.notask} AND kodeitem = ${input.kodeitem};
      `);

      // Cek apakah semua item sudah STORED
      const pendingItems = await db.execute(sql`
        SELECT COUNT(*)::int AS remaining
        FROM wms_inbound_items
        WHERE notask = ${input.notask} AND status != 'STORED';
      `);
      if ((pendingItems as any[])[0]?.remaining === 0) {
        await db.execute(sql`
          UPDATE wms_inbound_tasks
          SET status = 'COMPLETED', completed_at = NOW()
          WHERE notask = ${input.notask};
        `);
      } else {
        await db.execute(sql`
          UPDATE wms_inbound_tasks
          SET status = 'RECEIVING'
          WHERE notask = ${input.notask} AND status = 'PENDING';
        `);
      }
    }

    return { success: true, nomutasi, kodebin: input.kodebin, jumlah: input.jumlah };
  }

  /**
   * Eksekusi Relokasi Barang Antar-Bin
   */
  static async executeRelocation(input: RelocateInput) {
    if (input.from_bin === input.to_bin) {
      throw new Error("Bin asal dan Bin tujuan tidak boleh sama");
    }

    // Cek stok asal
    const src = await db.execute(sql`
      SELECT jumlah::float AS jumlah, batch_no, expired_date
      FROM wms_bin_stocks
      WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.from_bin} AND kodeitem = ${input.kodeitem}
      LIMIT 1;
    `);

    const curQty = (src as any[])[0]?.jumlah || 0;
    if (curQty < input.jumlah) {
      throw new Error(`Stok di bin asal (${input.from_bin}) tidak mencukupi. Tersedia: ${curQty}, diminta: ${input.jumlah}`);
    }

    const batchNo = (src as any[])[0]?.batch_no;
    const expiredDate = (src as any[])[0]?.expired_date;

    // Kurangi dari bin asal
    await db.execute(sql`
      UPDATE wms_bin_stocks
      SET jumlah = jumlah - ${input.jumlah}, updated_at = NOW()
      WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.from_bin} AND kodeitem = ${input.kodeitem};
    `);

    // Tambahkan ke bin tujuan (PG 8.4 compatible)
    const destStock = await db.execute(sql`
      SELECT id FROM wms_bin_stocks
      WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.to_bin} AND kodeitem = ${input.kodeitem}
      LIMIT 1;
    `);

    if ((destStock as any[]).length > 0) {
      await db.execute(sql`
        UPDATE wms_bin_stocks
        SET jumlah = jumlah + ${input.jumlah}, updated_at = NOW()
        WHERE kodekantor = ${input.kodekantor} AND kodebin = ${input.to_bin} AND kodeitem = ${input.kodeitem};
      `);
    } else {
      await db.execute(sql`
        INSERT INTO wms_bin_stocks (kodekantor, kodebin, kodeitem, jumlah, batch_no, expired_date, updated_at)
        VALUES (${input.kodekantor}, ${input.to_bin}, ${input.kodeitem}, ${input.jumlah}, ${batchNo}, ${expiredDate}, NOW());
      `);
    }

    // Catat mutasi
    const nomutasi = `MOV-REL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(sql`
      INSERT INTO wms_stock_movements (nomutasi, kodekantor, kodeitem, from_bin, to_bin, jumlah, tipe, operator, keterangan)
      VALUES (${nomutasi}, ${input.kodekantor}, ${input.kodeitem}, ${input.from_bin}, ${input.to_bin}, ${input.jumlah}, 'RELOCATION', ${input.operator}, ${input.keterangan || 'Relokasi antar rak'});
    `);

    return { success: true, nomutasi, from_bin: input.from_bin, to_bin: input.to_bin, jumlah: input.jumlah };
  }

  /**
   * Daftar Tugas Inbound
   */
  static async listInboundTasks(kodekantor?: string, status?: string) {
    let where = sql`WHERE 1=1`;
    if (kodekantor) where = sql`${where} AND t.kodekantor = ${kodekantor}`;
    if (status) where = sql`${where} AND t.status = ${status}`;

    const tasks = await db.execute(sql`
      SELECT 
        t.id,
        t.notask,
        t.notransaksi_ref,
        t.kodekantor,
        t.kodesupel,
        sp.nama AS namasupel,
        t.status,
        t.keterangan,
        t.petugas,
        t.created_at::text AS created_at,
        t.completed_at::text AS completed_at,
        COUNT(ti.id)::int AS total_items,
        COALESCE(SUM(ti.jumlah_order), 0)::float AS total_qty_order,
        COALESCE(SUM(ti.jumlah_received), 0)::float AS total_qty_received
      FROM wms_inbound_tasks t
      LEFT JOIN tbl_supel sp ON t.kodesupel = sp.kode
      LEFT JOIN wms_inbound_items ti ON t.notask = ti.notask
      ${where}
      GROUP BY t.id, t.notask, t.notransaksi_ref, t.kodekantor, t.kodesupel, sp.nama, t.status, t.keterangan, t.petugas, t.created_at, t.completed_at
      ORDER BY t.created_at DESC;
    `);

    return tasks as any[];
  }

  /**
   * Detail Tugas Inbound dengan Items
   */
  static async getInboundTaskDetail(notask: string) {
    const header = await db.execute(sql`
      SELECT 
        t.id, t.notask, t.notransaksi_ref, t.kodekantor, t.kodesupel, sp.nama AS namasupel,
        t.status, t.keterangan, t.petugas, t.created_at::text AS created_at, t.completed_at::text AS completed_at
      FROM wms_inbound_tasks t
      LEFT JOIN tbl_supel sp ON t.kodesupel = sp.kode
      WHERE t.notask = ${notask}
      LIMIT 1;
    `);

    if ((header as any[]).length === 0) return null;

    const items = await db.execute(sql`
      SELECT 
        ti.id, ti.notask, ti.kodeitem, ti.namaitem, ti.satuan,
        ti.jumlah_order::float AS jumlah_order,
        ti.jumlah_received::float AS jumlah_received,
        ti.target_bin,
        ti.status,
        COALESCE(sat.kodebarcode, it.kodeitem) AS barcode
      FROM wms_inbound_items ti
      LEFT JOIN tbl_item it ON ti.kodeitem = it.kodeitem
      LEFT JOIN tbl_itemsatuanjml sat ON ti.kodeitem = sat.kodeitem AND sat.tipe = 'D'
      WHERE ti.notask = ${notask}
      ORDER BY ti.id ASC;
    `);

    return {
      task: (header as any[])[0],
      items: items as any[],
    };
  }

  /**
   * Buat Inbound Task dari Transaksi Pembelian iPos 4.0
   */
  static async createInboundFromPurchase(notransaksi: string, operator: string = "ADMIN") {
    // Ambil header pembelian (tbl_imhd)
    let beliHd = await db.execute(sql`
      SELECT notransaksi, tanggal, kodesupel, kodekantor, keterangan
      FROM tbl_imhd
      WHERE notransaksi = ${notransaksi}
      LIMIT 1;
    `);

    if ((beliHd as any[]).length === 0) {
      // Fallback
      beliHd = await db.execute(sql`
        SELECT notransaksi, tanggal, kodesupel, kodekantor, keterangan
        FROM tbl_pembelian
        WHERE notransaksi = ${notransaksi}
        LIMIT 1;
      `);
    }

    if ((beliHd as any[]).length === 0) {
      throw new Error(`Faktur pembelian '${notransaksi}' tidak ditemukan`);
    }

    const h = (beliHd as any[])[0];
    const notask = `INB-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    await db.execute(sql`
      INSERT INTO wms_inbound_tasks (notask, notransaksi_ref, kodekantor, kodesupel, status, keterangan, petugas)
      VALUES (${notask}, ${h.notransaksi}, ${h.kodekantor}, ${h.kodesupel}, 'PENDING', ${'Penerimaan dari faktur ' + h.notransaksi}, ${operator});
    `);

    // Ambil detail barang (tbl_imdt)
    let details = await db.execute(sql`
      SELECT d.kodeitem, it.namaitem, d.satuan, d.jumlah::float AS jumlah
      FROM tbl_imdt d
      LEFT JOIN tbl_item it ON d.kodeitem = it.kodeitem
      WHERE d.notransaksi = ${notransaksi};
    `);

    if ((details as any[]).length === 0) {
      details = await db.execute(sql`
        SELECT d.kodeitem, it.namaitem, d.satuan, d.jumlah::float AS jumlah
        FROM tbl_pembeliandtl d
        LEFT JOIN tbl_item it ON d.kodeitem = it.kodeitem
        WHERE d.notransaksi = ${notransaksi};
      `);
    }

    for (const d of details as any[]) {
      const recBin = await this.findRecommendedPutawayBin(h.kodekantor, d.kodeitem, d.jumlah);
      await db.execute(sql`
        INSERT INTO wms_inbound_items (notask, kodeitem, namaitem, satuan, jumlah_order, jumlah_received, target_bin, status)
        VALUES (${notask}, ${d.kodeitem}, ${d.namaitem}, ${d.satuan}, ${d.jumlah}, 0, ${recBin}, 'PENDING');
      `);
    }

    return { success: true, notask, items_count: (details as any[]).length };
  }

  /**
   * Daftar Tugas Outbound (Picking & Packing)
   */
  static async listOutboundTasks(kodekantor?: string, status?: string) {
    let where = sql`WHERE 1=1`;
    if (kodekantor) where = sql`${where} AND t.kodekantor = ${kodekantor}`;
    if (status) where = sql`${where} AND t.status = ${status}`;

    const tasks = await db.execute(sql`
      SELECT 
        t.id,
        t.notask,
        t.notransaksi_ref,
        t.tipetransaksi,
        t.kodekantor,
        t.tujuan,
        t.status,
        t.priority,
        t.petugas,
        t.created_at::text AS created_at,
        t.completed_at::text AS completed_at,
        COUNT(ti.id)::int AS total_items,
        COALESCE(SUM(ti.jumlah_order), 0)::float AS total_qty_order,
        COALESCE(SUM(ti.jumlah_picked), 0)::float AS total_qty_picked
      FROM wms_outbound_tasks t
      LEFT JOIN wms_outbound_items ti ON t.notask = ti.notask
      ${where}
      GROUP BY t.id, t.notask, t.notransaksi_ref, t.tipetransaksi, t.kodekantor, t.tujuan, t.status, t.priority, t.petugas, t.created_at, t.completed_at
      ORDER BY 
        CASE WHEN t.priority = 'HIGH' THEN 1 ELSE 2 END,
        t.created_at DESC;
    `);

    return tasks as any[];
  }

  /**
   * Detail Tugas Outbound dengan Rute Pengambilan Cerdas (Smart Path Routing)
   */
  static async getOutboundTaskDetail(notask: string) {
    const header = await db.execute(sql`
      SELECT 
        t.id, t.notask, t.notransaksi_ref, t.tipetransaksi, t.kodekantor, t.tujuan,
        t.status, t.priority, t.petugas, t.created_at::text AS created_at, t.completed_at::text AS completed_at
      FROM wms_outbound_tasks t
      WHERE t.notask = ${notask}
      LIMIT 1;
    `);

    if ((header as any[]).length === 0) return null;

    // Ambil baris item yang diurutkan menurut rute lorong (Aisle ASC, Rack ASC, Tier ASC)
    const items = await db.execute(sql`
      SELECT 
        ti.id, ti.notask, ti.kodeitem, ti.namaitem, ti.satuan,
        ti.jumlah_order::float AS jumlah_order,
        ti.jumlah_picked::float AS jumlah_picked,
        ti.source_bin,
        ti.sequence_order,
        ti.status,
        COALESCE(sat.kodebarcode, it.kodeitem) AS barcode,
        b.aisle, b.rack, b.tier, b.slot
      FROM wms_outbound_items ti
      LEFT JOIN tbl_item it ON ti.kodeitem = it.kodeitem
      LEFT JOIN tbl_itemsatuanjml sat ON ti.kodeitem = sat.kodeitem AND sat.tipe = 'D'
      LEFT JOIN wms_bins b ON ti.source_bin = b.kodebin
      WHERE ti.notask = ${notask}
      ORDER BY ti.sequence_order ASC, b.aisle ASC, b.rack ASC, b.tier ASC, b.slot ASC;
    `);

    return {
      task: (header as any[])[0],
      items: items as any[],
    };
  }

  /**
   * Buat Outbound Task dari Penjualan / SO / Transfer dengan Smart Routing
   */
  static async createOutboundFromSales(notransaksi: string, operator: string = "ADMIN") {
    // Ambil header penjualan (tbl_ikhd)
    let jualHd = await db.execute(sql`
      SELECT notransaksi, tanggal, kodesupel, kodekantor, keterangan
      FROM tbl_ikhd
      WHERE notransaksi = ${notransaksi}
      LIMIT 1;
    `);

    if ((jualHd as any[]).length === 0) {
      jualHd = await db.execute(sql`
        SELECT notransaksi, tanggal, kodepdf AS kodesupel, kodekantor, keterangan
        FROM tbl_penjualan
        WHERE notransaksi = ${notransaksi}
        LIMIT 1;
      `);
    }

    if ((jualHd as any[]).length === 0) {
      throw new Error(`Faktur penjualan '${notransaksi}' tidak ditemukan`);
    }

    const h = (jualHd as any[])[0];
    const notask = `OUT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    await db.execute(sql`
      INSERT INTO wms_outbound_tasks (notask, notransaksi_ref, tipetransaksi, kodekantor, tujuan, status, priority, petugas)
      VALUES (${notask}, ${h.notransaksi}, 'SALES', ${h.kodekantor}, ${h.kodesupel || 'PELANGGAN'}, 'PENDING', 'NORMAL', ${operator});
    `);

    // Ambil detail barang (tbl_ikdt)
    let details = await db.execute(sql`
      SELECT d.kodeitem, it.namaitem, d.satuan, d.jumlah::float AS jumlah
      FROM tbl_ikdt d
      LEFT JOIN tbl_item it ON d.kodeitem = it.kodeitem
      WHERE d.notransaksi = ${notransaksi};
    `);

    if ((details as any[]).length === 0) {
      details = await db.execute(sql`
        SELECT d.kodeitem, it.namaitem, d.satuan, d.jumlah::float AS jumlah
        FROM tbl_penjualandtl d
        LEFT JOIN tbl_item it ON d.kodeitem = it.kodeitem
        WHERE d.notransaksi = ${notransaksi};
      `);
    }

    let seq = 1;
    for (const d of details as any[]) {
      // Cari bin dengan stok FIFO (tanggal masuk terlama)
      const stockBin = await db.execute(sql`
        SELECT bs.kodebin, bs.jumlah::float AS stok, b.aisle, b.rack
        FROM wms_bin_stocks bs
        JOIN wms_bins b ON bs.kodebin = b.kodebin
        WHERE bs.kodekantor = ${h.kodekantor} AND bs.kodeitem = ${d.kodeitem} AND bs.jumlah > 0
        ORDER BY bs.created_at ASC
        LIMIT 1;
      `);

      const sourceBin = (stockBin as any[])[0]?.kodebin || `BIN-${h.kodekantor}-A-01-1-01`;

      await db.execute(sql`
        INSERT INTO wms_outbound_items (notask, kodeitem, namaitem, satuan, jumlah_order, jumlah_picked, source_bin, sequence_order, status)
        VALUES (${notask}, ${d.kodeitem}, ${d.namaitem}, ${d.satuan}, ${d.jumlah}, 0, ${sourceBin}, ${seq++}, 'PENDING');
      `);
    }

    return { success: true, notask, items_count: (details as any[]).length };
  }

  /**
   * Eksekusi Pick Item: Operator mengambil barang dari Bin & konfirmasi barcode
   */
  static async executePickItem(input: PickItemInput) {
    // 1. Validasi stok di source_bin
    const curStock = await db.execute(sql`
      SELECT jumlah::float AS jumlah, kodekantor
      FROM wms_bin_stocks
      WHERE kodebin = ${input.source_bin} AND kodeitem = ${input.kodeitem}
      LIMIT 1;
    `);

    const currentQty = (curStock as any[])[0]?.jumlah || 0;
    const kodekantor = (curStock as any[])[0]?.kodekantor || "GUDANG";

    if (currentQty < input.jumlah) {
      throw new Error(`Stok di bin ${input.source_bin} tidak mencukupi untuk item ${input.kodeitem}. Tersedia: ${currentQty}`);
    }

    // 2. Kurangi stok di bin
    await db.execute(sql`
      UPDATE wms_bin_stocks
      SET jumlah = jumlah - ${input.jumlah}, updated_at = NOW()
      WHERE kodebin = ${input.source_bin} AND kodeitem = ${input.kodeitem};
    `);

    // 3. Catat pergerakan stok
    const nomutasi = `MOV-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.execute(sql`
      INSERT INTO wms_stock_movements (nomutasi, kodekantor, kodeitem, from_bin, to_bin, jumlah, tipe, notransaksi_ref, operator, keterangan)
      VALUES (${nomutasi}, ${kodekantor}, ${input.kodeitem}, ${input.source_bin}, 'STAGING/DISPATCH', ${input.jumlah}, 'OUTBOUND', ${input.notask}, ${input.operator}, 'Picking barang untuk pesanan outbound');
    `);

    // 4. Update status item di outbound task
    await db.execute(sql`
      UPDATE wms_outbound_items
      SET jumlah_picked = jumlah_picked + ${input.jumlah},
          status = CASE WHEN (jumlah_picked + ${input.jumlah}) >= jumlah_order THEN 'PICKED' ELSE 'PICKING' END
      WHERE notask = ${input.notask} AND kodeitem = ${input.kodeitem} AND source_bin = ${input.source_bin};
    `);

    // 5. Cek apakah seluruh task selesai
    const remaining = await db.execute(sql`
      SELECT COUNT(*)::int AS pending_count
      FROM wms_outbound_items
      WHERE notask = ${input.notask} AND status != 'PICKED';
    `);

    if ((remaining as any[])[0]?.pending_count === 0) {
      await db.execute(sql`
        UPDATE wms_outbound_tasks
        SET status = 'PACKED', completed_at = NOW()
        WHERE notask = ${input.notask};
      `);
    } else {
      await db.execute(sql`
        UPDATE wms_outbound_tasks
        SET status = 'PICKING'
        WHERE notask = ${input.notask} AND status = 'PENDING';
      `);
    }

    return { success: true, nomutasi, source_bin: input.source_bin, jumlah: input.jumlah };
  }

  /**
   * Peta Denah Visual 2D Gudang (Warehouse Heatmap Map)
   */
  static async getWarehouseVisualMap(kodekantor: string) {
    const bins = await this.listBins(kodekantor);

    // Kelompokkan berdasarkan Aisle -> Rack
    const aislesMap: Record<string, Record<string, WmsBin[]>> = {};

    bins.forEach((b) => {
      if (!aislesMap[b.aisle]) aislesMap[b.aisle] = {};
      if (!aislesMap[b.aisle][b.rack]) aislesMap[b.aisle][b.rack] = [];
      aislesMap[b.aisle][b.rack].push(b);
    });

    const totalBins = bins.length;
    const occupiedBins = bins.filter((b) => (b.total_qty || 0) > 0).length;
    const totalCapacity = bins.reduce((sum, b) => sum + (b.kapasitas_max_qty || 0), 0);
    const totalCurrentQty = bins.reduce((sum, b) => sum + (b.total_qty || 0), 0);

    return {
      kodekantor,
      summary: {
        total_bins: totalBins,
        occupied_bins: occupiedBins,
        empty_bins: totalBins - occupiedBins,
        occupancy_rate: totalCapacity > 0 ? Math.round((totalCurrentQty / totalCapacity) * 100 * 10) / 10 : 0,
        total_qty: totalCurrentQty,
      },
      aisles: aislesMap,
    };
  }
}
