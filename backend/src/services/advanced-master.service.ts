import { db } from "../db";
import { sql } from "drizzle-orm";

export interface ItemUnit {
  satuan: string;
  jumlahkonv: number;
  tipe: "D" | "K" | string; // 'D' = Satuan Dasar, 'K' = Satuan Konversi
  kodebarcode: string | null;
  hargapokok: number;
  komisisales: number;
}

export interface CustomerProfile {
  kode: string;
  nama: string;
  tipe: string;
  kgrup: string | null;
  namaGrup: string;
  levelharga: number;
  potongan: number;
  kdwilayah: string | null;
  namaWilayah: string | null;
  kdsubwil: string | null;
  namaSubwilayah: string | null;
  limitjmlhupi: number;
  limitharihupi: number;
  telepon: string | null;
  alamat: string | null;
}

export interface PriceResolutionResult {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  isBaseUnit: boolean;
  conversionMultiplier: number;
  qty: number;
  baseHpp: number;
  unitHpp: number;
  pricingSystem: string; // 'O' (One Price), 'S' (Satuan), 'J' (Jumlah), 'L' (Level)
  standardUnitPrice: number;
  matchedTier: {
    tipe: string;
    level?: number;
    thresholdQty?: number;
    nominalPrice: number;
  } | null;
  customerGroup: string;
  customerLevel: number;
  customerDiscountPercent: number;
  finalUnitPrice: number;
  totalBeforeDiscount: number;
  totalDiscountAmount: number;
  grandTotal: number;
  estimatedMarginPercent: number;
}

export interface SerialInfo {
  noserial: string;
  kodeitem: string;
  namaitem: string;
  isInStock: boolean;
  stsmasuk: boolean;
  stskeluar: boolean;
  purchaseInvoice: string | null;
  salesInvoice: string | null;
  officeCode: string | null;
  lastUpdated: string | null;
  movementLogs: {
    transactionType: string;
    transactionNo: string;
    direction: "IN" | "OUT";
  }[];
}

export interface BOMComponent {
  kodeitemrakitan: string;
  namaitem: string;
  jumlah: number;
  satuan: string;
  estimasiHpp: number;
  subtotalCost: number;
  currentStock: number;
}

export interface AssemblyBOM {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  standardHpp: number;
  components: BOMComponent[];
  totalComponentCost: number;
}

export interface AssemblySimulation {
  parentItemCode: string;
  parentItemName: string;
  qtyToBuild: number;
  officeCode: string;
  canBuild: boolean;
  maxPossibleToBuild: number;
  totalProductionCost: number;
  unitProductionCost: number;
  componentRequirements: {
    kodeitem: string;
    namaitem: string;
    qtyPerUnit: number;
    qtyRequired: number;
    currentStock: number;
    isSufficient: boolean;
    shortage: number;
    unitCost: number;
    totalCost: number;
  }[];
}

export class AdvancedMasterService {
  /**
   * 1. GET ALL UNITS FOR AN ITEM (Multi-Satuan)
   * Mengembalikan seluruh satuan terdaftar untuk item, diurutkan satuan dasar ('D') pertama kali.
   */
  static async getItemUnits(itemCode: string): Promise<ItemUnit[]> {
    const rows = await db.execute(sql`
      SELECT 
        satuan, 
        jumlahkonv::numeric, 
        tipe, 
        kodebarcode, 
        hargapokok::numeric, 
        COALESCE(komisisales::numeric, 0) as komisisales
      FROM tbl_itemsatuanjml
      WHERE kodeitem = ${itemCode}
      ORDER BY CASE WHEN tipe = 'D' THEN 0 ELSE 1 END, jumlahkonv ASC;
    `);

    return (rows as any[]).map(r => ({
      satuan: String(r.satuan || "").trim(),
      jumlahkonv: Number(r.jumlahkonv || 1),
      tipe: String(r.tipe || "D").trim(),
      kodebarcode: r.kodebarcode ? String(r.kodebarcode).trim() : null,
      hargapokok: Number(r.hargapokok || 0),
      komisisales: Number(r.komisisales || 0)
    }));
  }

  /**
   * 2. CONVERT QUANTITY BETWEEN UNITS
   * Konversi kuantitas dari fromUnit ke toUnit berbasis faktor konversi satuan dasar.
   */
  static async convertUnitQuantity(
    itemCode: string,
    qty: number,
    fromUnit: string,
    toUnit: string
  ): Promise<{ convertedQty: number; multiplierFrom: number; multiplierTo: number }> {
    const units = await this.getItemUnits(itemCode);
    if (units.length === 0) {
      return { convertedQty: qty, multiplierFrom: 1, multiplierTo: 1 };
    }

    const uFrom = units.find(u => u.satuan.toUpperCase() === fromUnit.trim().toUpperCase());
    const uTo = units.find(u => u.satuan.toUpperCase() === toUnit.trim().toUpperCase());

    const multFrom = uFrom ? uFrom.jumlahkonv : 1;
    const multTo = uTo ? uTo.jumlahkonv : 1;

    const baseQty = qty * multFrom;
    const convertedQty = multTo > 0 ? baseQty / multTo : baseQty;

    return {
      convertedQty: Math.round(convertedQty * 1000) / 1000,
      multiplierFrom: multFrom,
      multiplierTo: multTo
    };
  }

  /**
   * 3. FIND ITEM & UNIT BY BARCODE
   * Mencari item berdasarkan barcode di tbl_itemsatuanjml atau kodeitem di tbl_item.
   */
  static async findItemByBarcode(barcode: string): Promise<{
    kodeitem: string;
    namaitem: string;
    satuan: string;
    jumlahkonv: number;
    hargajual1: number;
    hargapokok: number;
    tipe: string;
  } | null> {
    const cleanBarcode = barcode.trim();

    // Cek di tbl_itemsatuanjml
    const rowsSatuan = await db.execute(sql`
      SELECT 
        s.kodeitem, 
        i.namaitem, 
        s.satuan, 
        s.jumlahkonv::numeric, 
        s.hargapokok::numeric as sat_hpp,
        i.hargapokok::numeric as base_hpp,
        i.hargajual1::numeric as base_hj,
        s.tipe
      FROM tbl_itemsatuanjml s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.kodebarcode = ${cleanBarcode}
      LIMIT 1;
    `);

    if ((rowsSatuan as any[]).length > 0) {
      const r = (rowsSatuan as any[])[0];
      const mult = Number(r.jumlahkonv || 1);
      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        satuan: String(r.satuan).trim(),
        jumlahkonv: mult,
        hargajual1: Number(r.base_hj || 0) * mult,
        hargapokok: Number(r.sat_hpp || (Number(r.base_hpp || 0) * mult)),
        tipe: String(r.tipe).trim()
      };
    }

    // Fallback: Cek apakah barcode adalah kodeitem langsung
    const rowsItem = await db.execute(sql`
      SELECT kodeitem, namaitem, satuan, hargapokok::numeric, hargajual1::numeric
      FROM tbl_item
      WHERE kodeitem = ${cleanBarcode}
      LIMIT 1;
    `);

    if ((rowsItem as any[]).length > 0) {
      const r = (rowsItem as any[])[0];
      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem).trim(),
        satuan: String(r.satuan).trim(),
        jumlahkonv: 1,
        hargajual1: Number(r.hargajual1 || 0),
        hargapokok: Number(r.hargapokok || 0),
        tipe: "D"
      };
    }

    return null;
  }

  /**
   * 4. GET CUSTOMER PROFILE (Group, Price Level, Discount, & Wilayah)
   */
  static async getCustomerProfile(customerCode: string): Promise<CustomerProfile | null> {
    const rows = await db.execute(sql`
      SELECT 
        s.kode, 
        s.nama, 
        s.tipe, 
        s.kgrup, 
        COALESCE(g.grup, s.kgrup, 'General') as nama_grup,
        COALESCE(g.levelharga, 1) as levelharga,
        COALESCE(g.potongan::numeric, 0) as potongan,
        s.kdwilayah,
        w.wilayah as nama_wilayah,
        s.kdsubwil,
        sw.subwilayah as nama_subwilayah,
        COALESCE(s.limitjmlhupi::numeric, 0) as limitjmlhupi,
        COALESCE(s.limitharihupi, 0) as limitharihupi,
        s.telepon,
        s.alamat
      FROM tbl_supel s
      LEFT JOIN tbl_supelgrup g ON s.kgrup = g.kgrup
      LEFT JOIN tbl_supel_wil w ON s.kdwilayah = w.kode
      LEFT JOIN tbl_supel_subwil sw ON s.kdsubwil = sw.kode
      WHERE s.kode = ${customerCode} AND s.tipe = 'PL'
      LIMIT 1;
    `);

    if ((rows as any[]).length === 0) return null;
    const r = (rows as any[])[0];

    return {
      kode: String(r.kode).trim(),
      nama: String(r.nama).trim(),
      tipe: String(r.tipe).trim(),
      kgrup: r.kgrup ? String(r.kgrup).trim() : null,
      namaGrup: String(r.nama_grup).trim(),
      levelharga: Number(r.levelharga || 1),
      potongan: Number(r.potongan || 0),
      kdwilayah: r.kdwilayah ? String(r.kdwilayah).trim() : null,
      namaWilayah: r.nama_wilayah ? String(r.nama_wilayah).trim() : null,
      kdsubwil: r.kdsubwil ? String(r.kdsubwil).trim() : null,
      namaSubwilayah: r.nama_subwilayah ? String(r.nama_subwilayah).trim() : null,
      limitjmlhupi: Number(r.limitjmlhupi || 0),
      limitharihupi: Number(r.limitharihupi || 0),
      telepon: r.telepon ? String(r.telepon).trim() : null,
      alamat: r.alamat ? String(r.alamat).trim() : null
    };
  }

  /**
   * 5. RESOLVE DYNAMIC ITEM PRICE
   * Menentukan harga jual per unit berdasarkan sistem harga item ('O', 'S', 'J', 'L'),
   * multi-satuan, tier kuantitas, dan diskon/level grup pelanggan.
   */
  static async resolveItemPrice(
    itemCode: string,
    unit: string,
    qty: number,
    customerCode?: string
  ): Promise<PriceResolutionResult> {
    // 1. Ambil data item
    const itemRows = await db.execute(sql`
      SELECT 
        kodeitem, 
        namaitem, 
        satuan, 
        hargapokok::numeric, 
        hargajual1::numeric, 
        COALESCE(sistemhargajual, 'O') as sistemhargajual
      FROM tbl_item
      WHERE kodeitem = ${itemCode}
      LIMIT 1;
    `);

    if ((itemRows as any[]).length === 0) {
      throw new Error(`Item dengan kode ${itemCode} tidak ditemukan.`);
    }

    const item = (itemRows as any[])[0];
    const baseSatuan = String(item.satuan || "").trim();
    const baseHpp = Number(item.hargapokok || 0);
    const baseHj1 = Number(item.hargajual1 || 0);
    const sistemHj = String(item.sistemhargajual || "O").trim().toUpperCase();

    // 2. Ambil informasi satuan terpilih
    const units = await this.getItemUnits(itemCode);
    const matchedUnit = units.find(u => u.satuan.toUpperCase() === unit.trim().toUpperCase());
    const mult = matchedUnit ? matchedUnit.jumlahkonv : 1;
    const isBaseUnit = matchedUnit ? matchedUnit.tipe === "D" : unit.toUpperCase() === baseSatuan.toUpperCase();
    const unitHpp = matchedUnit && matchedUnit.hargapokok > 0 ? matchedUnit.hargapokok : baseHpp * mult;

    // 3. Ambil data profil customer
    let custGroup = "General";
    let custLevel = 1;
    let custDiscountPct = 0;

    if (customerCode) {
      const cust = await this.getCustomerProfile(customerCode);
      if (cust) {
        custGroup = cust.namaGrup;
        custLevel = cust.levelharga;
        custDiscountPct = cust.potongan;
      }
    }

    // 4. Logika penentuan harga dasar satuan
    let standardUnitPrice = baseHj1 * mult;
    let matchedTier: PriceResolutionResult["matchedTier"] = null;

    // A. Sistem Level Pelanggan ('L')
    if (sistemHj === "L") {
      const tierRows = await db.execute(sql`
        SELECT level, hargajual::numeric
        FROM tbl_itemhj
        WHERE kodeitem = ${itemCode} AND tipehj = 'L' AND level = ${custLevel}
        LIMIT 1;
      `);
      if ((tierRows as any[]).length > 0) {
        const tierHj = Number((tierRows as any[])[0].hargajual || 0);
        if (tierHj > 0) {
          standardUnitPrice = tierHj * mult;
          matchedTier = {
            tipe: "L",
            level: custLevel,
            nominalPrice: standardUnitPrice
          };
        }
      }
    }
    // B. Sistem Jumlah / Grosir Bertingkat ('J')
    else if (sistemHj === "J") {
      const tierRows = await db.execute(sql`
        SELECT jmlsampai::numeric, hargajual::numeric
        FROM tbl_itemhj
        WHERE kodeitem = ${itemCode} AND tipehj = 'J' AND jmlsampai >= ${qty}
        ORDER BY jmlsampai ASC
        LIMIT 1;
      `);
      if ((tierRows as any[]).length > 0) {
        const tierHj = Number((tierRows as any[])[0].hargajual || 0);
        if (tierHj > 0) {
          standardUnitPrice = tierHj * mult;
          matchedTier = {
            tipe: "J",
            thresholdQty: Number((tierRows as any[])[0].jmlsampai),
            nominalPrice: standardUnitPrice
          };
        }
      }
    }

    // 5. Terapkan diskon kelompok pelanggan
    const totalBeforeDiscount = standardUnitPrice * qty;
    const totalDiscountAmount = (totalBeforeDiscount * custDiscountPct) / 100;
    const grandTotal = totalBeforeDiscount - totalDiscountAmount;
    const finalUnitPrice = qty > 0 ? grandTotal / qty : standardUnitPrice;

    // Estimasi margin kotor (%)
    const totalHpp = unitHpp * qty;
    const estimatedMarginPercent = totalBeforeDiscount > 0
      ? Math.round(((grandTotal - totalHpp) / grandTotal) * 10000) / 100
      : 0;

    return {
      kodeitem: String(item.kodeitem).trim(),
      namaitem: String(item.namaitem).trim(),
      satuan: unit.trim(),
      isBaseUnit,
      conversionMultiplier: mult,
      qty,
      baseHpp,
      unitHpp,
      pricingSystem: sistemHj,
      standardUnitPrice,
      matchedTier,
      customerGroup: custGroup,
      customerLevel: custLevel,
      customerDiscountPercent: custDiscountPct,
      finalUnitPrice: Math.round(finalUnitPrice * 100) / 100,
      totalBeforeDiscount: Math.round(totalBeforeDiscount * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      estimatedMarginPercent
    };
  }

  /**
   * 6. GET SERIAL NUMBER LIFECYCLE & AUDIT TRAIL
   */
  static async getSerialStatus(serialNumber: string): Promise<SerialInfo | null> {
    const cleanSn = serialNumber.trim();
    const rows = await db.execute(sql`
      SELECT 
        s.noserial,
        s.kodeitem,
        i.namaitem,
        s.stsada,
        s.stsmasuk,
        s.stskeluar,
        s.notrsm,
        s.notrsrk,
        s.kodekantor,
        s.dateupd
      FROM tbl_itemserial s
      LEFT JOIN tbl_item i ON s.kodeitem = i.kodeitem
      WHERE s.noserial = ${cleanSn}
      LIMIT 1;
    `);

    if ((rows as any[]).length === 0) return null;
    const r = (rows as any[])[0];

    // Ambil histori mutasi dari tbl_itemserialdt
    const logs = await db.execute(sql`
      SELECT 
        notransfin, notransfout, notrsrm, notrsk, notrskrakit, notrsm, notrsop
      FROM tbl_itemserialdt
      WHERE noserial = ${cleanSn};
    `);

    const movementLogs: SerialInfo["movementLogs"] = [];
    for (const l of logs as any[]) {
      if (l.notrsm) movementLogs.push({ transactionType: "PEMBELIAN_MASUK", transactionNo: l.notrsm, direction: "IN" });
      if (l.notransfin) movementLogs.push({ transactionType: "TRANSFER_MASUK", transactionNo: l.notransfin, direction: "IN" });
      if (l.notrsrm) movementLogs.push({ transactionType: "RETUR_JUAL_MASUK", transactionNo: l.notrsrm, direction: "IN" });
      if (l.notransfout) movementLogs.push({ transactionType: "TRANSFER_KELUAR", transactionNo: l.notransfout, direction: "OUT" });
      if (l.notrsk) movementLogs.push({ transactionType: "PENJUALAN_KELUAR", transactionNo: l.notrsk, direction: "OUT" });
      if (l.notrskrakit) movementLogs.push({ transactionType: "RAKITAN_KOMPONEN", transactionNo: l.notrskrakit, direction: "OUT" });
      if (l.notrsop) movementLogs.push({ transactionType: "OPNAME_PENYESUAIAN", transactionNo: l.notrsop, direction: "IN" });
    }

    return {
      noserial: String(r.noserial).trim(),
      kodeitem: String(r.kodeitem).trim(),
      namaitem: r.namaitem ? String(r.namaitem).trim() : "Unknown Item",
      isInStock: Boolean(r.stsada),
      stsmasuk: Boolean(r.stsmasuk),
      stskeluar: Boolean(r.stskeluar),
      purchaseInvoice: r.notrsm ? String(r.notrsm).trim() : null,
      salesInvoice: r.notrsrk ? String(r.notrsrk).trim() : null,
      officeCode: r.kodekantor ? String(r.kodekantor).trim() : null,
      lastUpdated: r.dateupd ? new Date(r.dateupd).toISOString() : null,
      movementLogs
    };
  }

  /**
   * 7. GET ASSEMBLY BILL OF MATERIALS (BOM)
   */
  static async getAssemblyBOM(parentItemCode: string): Promise<AssemblyBOM | null> {
    const parentRows = await db.execute(sql`
      SELECT kodeitem, namaitem, satuan, hargapokok::numeric
      FROM tbl_item
      WHERE kodeitem = ${parentItemCode}
      LIMIT 1;
    `);

    if ((parentRows as any[]).length === 0) return null;
    const parent = (parentRows as any[])[0];

    const compRows = await db.execute(sql`
      SELECT 
        r.kodeitemrakitan,
        i.namaitem,
        r.jumlah::numeric,
        r.satuan,
        COALESCE(r.harga::numeric, i.hargapokok::numeric, 0) as estimasi_hpp,
        COALESCE(s.stok::numeric, i.stok::numeric, 0) as current_stock
      FROM tbl_itemrakitan r
      JOIN tbl_item i ON r.kodeitemrakitan = i.kodeitem
      LEFT JOIN tbl_itemstok s ON r.kodeitemrakitan = s.kodeitem AND s.kantor = 'UTM'
      WHERE r.kodeitem = ${parentItemCode}
      ORDER BY r.kodeitemrakitan ASC;
    `);

    let totalComponentCost = 0;
    const components: BOMComponent[] = (compRows as any[]).map(c => {
      const qty = Number(c.jumlah || 1);
      const hpp = Number(c.estimasi_hpp || 0);
      const subtotal = qty * hpp;
      totalComponentCost += subtotal;

      return {
        kodeitemrakitan: String(c.kodeitemrakitan).trim(),
        namaitem: String(c.namaitem).trim(),
        jumlah: qty,
        satuan: String(c.satuan || "PCS").trim(),
        estimasiHpp: hpp,
        subtotalCost: subtotal,
        currentStock: Number(c.current_stock || 0)
      };
    });

    return {
      kodeitem: String(parent.kodeitem).trim(),
      namaitem: String(parent.namaitem).trim(),
      satuan: String(parent.satuan || "PCS").trim(),
      standardHpp: Number(parent.hargapokok || 0),
      components,
      totalComponentCost
    };
  }

  /**
   * 8. SIMULATE ASSEMBLY PRODUCTION RUN
   * Memvalidasi ketersediaan bahan baku di gudang dan menghitung batas kapasitas produksi rakitan.
   */
  static async simulateAssembly(
    parentItemCode: string,
    qtyToBuild: number,
    officeCode: string = "UTM"
  ): Promise<AssemblySimulation> {
    const bom = await this.getAssemblyBOM(parentItemCode);
    if (!bom || bom.components.length === 0) {
      throw new Error(`Item ${parentItemCode} bukan merupakan paket rakitan atau belum memiliki formula BOM.`);
    }

    let canBuild = true;
    let maxPossible = Infinity;
    let totalProductionCost = 0;

    const componentRequirements = bom.components.map(comp => {
      const qtyRequired = comp.jumlah * qtyToBuild;
      const isSufficient = comp.currentStock >= qtyRequired;
      const shortage = isSufficient ? 0 : qtyRequired - comp.currentStock;

      if (!isSufficient) canBuild = false;

      const possibleForThisComp = comp.jumlah > 0 ? Math.floor(comp.currentStock / comp.jumlah) : 0;
      if (possibleForThisComp < maxPossible) {
        maxPossible = possibleForThisComp;
      }

      const totalCost = qtyRequired * comp.estimasiHpp;
      totalProductionCost += totalCost;

      return {
        kodeitem: comp.kodeitemrakitan,
        namaitem: comp.namaitem,
        qtyPerUnit: comp.jumlah,
        qtyRequired,
        currentStock: comp.currentStock,
        isSufficient,
        shortage,
        unitCost: comp.estimasiHpp,
        totalCost
      };
    });

    if (maxPossible === Infinity) maxPossible = 0;

    return {
      parentItemCode: bom.kodeitem,
      parentItemName: bom.namaitem,
      qtyToBuild,
      officeCode,
      canBuild,
      maxPossibleToBuild: Math.max(0, maxPossible),
      totalProductionCost,
      unitProductionCost: qtyToBuild > 0 ? totalProductionCost / qtyToBuild : 0,
      componentRequirements
    };
  }

  /**
   * 9. LIST CUSTOMER GROUPS WITH STATS
   */
  static async listCustomerGroups(): Promise<{
    kgrup: string;
    grup: string;
    levelharga: number;
    potongan: number;
    memberCount: number;
  }[]> {
    const rows = await db.execute(sql`
      SELECT 
        g.kgrup, 
        g.grup, 
        g.levelharga, 
        g.potongan::numeric,
        COUNT(s.kode)::int as member_count
      FROM tbl_supelgrup g
      LEFT JOIN tbl_supel s ON g.kgrup = s.kgrup AND s.tipe = 'PL'
      GROUP BY g.kgrup, g.grup, g.levelharga, g.potongan
      ORDER BY g.levelharga ASC, g.potongan ASC;
    `);

    return (rows as any[]).map(r => ({
      kgrup: String(r.kgrup).trim(),
      grup: String(r.grup).trim(),
      levelharga: Number(r.levelharga || 1),
      potongan: Number(r.potongan || 0),
      memberCount: Number(r.member_count || 0)
    }));
  }

  /**
   * 10. LIST MULTI-UNIT ITEMS
   */
  static async listMultiUnitItems(limit: number = 20): Promise<{
    kodeitem: string;
    namaitem: string;
    baseUnit: string;
    totalUnits: number;
    units: string;
  }[]> {
    const rows = await db.execute(sql`
      SELECT 
        s.kodeitem,
        i.namaitem,
        i.satuan as base_unit,
        COUNT(s.satuan)::int as total_units,
        ARRAY_TO_STRING(ARRAY_AGG(s.satuan), ', ') as units
      FROM tbl_itemsatuanjml s
      JOIN tbl_item i ON s.kodeitem = i.kodeitem
      GROUP BY s.kodeitem, i.namaitem, i.satuan
      HAVING COUNT(s.satuan) > 1
      ORDER BY total_units DESC, s.kodeitem ASC
      LIMIT ${limit};
    `);

    return (rows as any[]).map(r => ({
      kodeitem: String(r.kodeitem).trim(),
      namaitem: String(r.namaitem).trim(),
      baseUnit: String(r.base_unit || "").trim(),
      totalUnits: Number(r.total_units || 1),
      units: String(r.units || "")
    }));
  }

  /**
   * 11. EXECUTE ASSEMBLY PRODUCTION RUN
   * Memotong stok bahan baku dari tbl_itemstok, menambah stok barang jadi rakitan,
   * dan mengupdate HPP barang jadi.
   */
  static async executeAssembly(
    parentItemCode: string,
    qtyToBuild: number,
    officeCode: string = "UTM",
    user: string = "ADMIN"
  ): Promise<{
    success: boolean;
    notransaksi: string;
    parentItemCode: string;
    parentItemName: string;
    qtyBuilt: number;
    unitCost: number;
    totalCost: number;
  }> {
    const sim = await this.simulateAssembly(parentItemCode, qtyToBuild, officeCode);
    if (!sim.canBuild) {
      throw new Error(`Stok bahan baku tidak mencukupi untuk merakit ${qtyToBuild} unit ${sim.parentItemName}.`);
    }

    const notransaksi = `RK${Date.now().toString().slice(-8)}`;

    // 1. Kurangi stok bahan baku komponen
    for (const req of sim.componentRequirements) {
      await db.execute(sql`
        UPDATE tbl_itemstok
        SET stok = stok - ${req.qtyRequired}
        WHERE kodeitem = ${req.kodeitem} AND kantor = ${officeCode};
      `);
      await db.execute(sql`
        UPDATE tbl_item
        SET stok = stok - ${req.qtyRequired}
        WHERE kodeitem = ${req.kodeitem};
      `);
    }

    // 2. Tambah stok barang jadi parent
    await db.execute(sql`
      UPDATE tbl_itemstok
      SET stok = stok + ${qtyToBuild}
      WHERE kodeitem = ${parentItemCode} AND kantor = ${officeCode};
    `);
    await db.execute(sql`
      UPDATE tbl_item
      SET stok = stok + ${qtyToBuild},
          hargapokok = ${sim.unitProductionCost}
      WHERE kodeitem = ${parentItemCode};
    `);

    return {
      success: true,
      notransaksi,
      parentItemCode,
      parentItemName: sim.parentItemName,
      qtyBuilt: qtyToBuild,
      unitCost: sim.unitProductionCost,
      totalCost: sim.totalProductionCost,
    };
  }

  /**
   * 12. SAVE / UPDATE BOM RECIPE (tbl_itemrakitan)
   */
  static async saveAssemblyBOM(
    parentItemCode: string,
    components: { kodeitemrakitan: string; jumlah: number; satuan: string; harga?: number }[]
  ): Promise<boolean> {
    await db.execute(sql`
      DELETE FROM tbl_itemrakitan WHERE kodeitem = ${parentItemCode};
    `);

    let totalComponentCost = 0;
    for (const c of components) {
      const hpp = Number(c.harga || 0);
      const subtotal = c.jumlah * hpp;
      totalComponentCost += subtotal;
      const iddetail = `BOM${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 9000 + 1000)}`;

      await db.execute(sql`
        INSERT INTO tbl_itemrakitan (
          iddetail, kodeitem, kodeitemrakitan, jumlah, satuan, harga, total, dateupd
        ) VALUES (
          ${iddetail}, ${parentItemCode}, ${c.kodeitemrakitan}, ${c.jumlah},
          ${c.satuan || 'PCS'}, ${hpp}, ${subtotal}, NOW()
        );
      `);
    }

    // Set item type = '4' (Rakitan) and update standard HPP
    await db.execute(sql`
      UPDATE tbl_item
      SET tipe = '4', hargapokok = ${totalComponentCost}
      WHERE kodeitem = ${parentItemCode};
    `);

    return true;
  }

  /**
   * 13. LIST ALL BOM RECIPES
   */
  static async listBOMRecipes(): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT 
        r.kodeitem,
        i.namaitem,
        i.satuan,
        i.hargapokok::numeric,
        i.hargajual1::numeric as hargajual,
        COUNT(r.kodeitemrakitan)::int as total_components,
        COALESCE(SUM(r.jumlah * r.harga)::numeric, 0) as total_estimated_cost
      FROM tbl_itemrakitan r
      JOIN tbl_item i ON r.kodeitem = i.kodeitem
      GROUP BY r.kodeitem, i.namaitem, i.satuan, i.hargapokok, i.hargajual1
      ORDER BY i.namaitem ASC;
    `);
    return rows as any[];
  }
}
