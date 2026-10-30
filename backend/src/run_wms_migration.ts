import { client } from "./db";

async function runMigration() {
  console.log("🚀 Menjalankan migrasi WMS untuk iPos 4.0 (PostgreSQL 8.4 Compatible)...");
  try {
    // 1. wms_zones
    const hasZones = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_zones'`;
    if (hasZones.length === 0) {
      console.log("  -> Membuat tabel wms_zones...");
      await client.unsafe(`
        CREATE TABLE wms_zones (
          kodezone VARCHAR(50) PRIMARY KEY,
          kodekantor VARCHAR(50) NOT NULL,
          namazone VARCHAR(100) NOT NULL,
          deskripsi TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    }

    // 2. wms_bins
    const hasBins = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_bins'`;
    if (hasBins.length === 0) {
      console.log("  -> Membuat tabel wms_bins...");
      await client.unsafe(`
        CREATE TABLE wms_bins (
          kodebin VARCHAR(60) PRIMARY KEY,
          kodekantor VARCHAR(50) NOT NULL,
          kodezone VARCHAR(50),
          aisle VARCHAR(20) NOT NULL,
          rack VARCHAR(20) NOT NULL,
          tier VARCHAR(20) NOT NULL,
          slot VARCHAR(20) NOT NULL,
          kapasitas_max_qty NUMERIC(15,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX idx_wms_bins_kantor ON wms_bins(kodekantor);
        CREATE INDEX idx_wms_bins_routing ON wms_bins(aisle, rack, tier, slot);
      `);
    }

    // 3. wms_bin_stocks
    const hasStocks = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_bin_stocks'`;
    if (hasStocks.length === 0) {
      console.log("  -> Membuat tabel wms_bin_stocks...");
      await client.unsafe(`
        CREATE TABLE wms_bin_stocks (
          id SERIAL PRIMARY KEY,
          kodekantor VARCHAR(50) NOT NULL,
          kodebin VARCHAR(60) NOT NULL,
          kodeitem VARCHAR(50) NOT NULL,
          jumlah NUMERIC(15,2) NOT NULL DEFAULT 0,
          batch_no VARCHAR(50),
          expired_date DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT uq_wms_bin_stock UNIQUE (kodekantor, kodebin, kodeitem)
        );
        CREATE INDEX idx_wms_bin_stocks_item ON wms_bin_stocks(kodeitem);
        CREATE INDEX idx_wms_bin_stocks_bin ON wms_bin_stocks(kodebin);
      `);
    }

    // 4. wms_inbound_tasks
    const hasInbound = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_inbound_tasks'`;
    if (hasInbound.length === 0) {
      console.log("  -> Membuat tabel wms_inbound_tasks...");
      await client.unsafe(`
        CREATE TABLE wms_inbound_tasks (
          id SERIAL PRIMARY KEY,
          notask VARCHAR(60) UNIQUE NOT NULL,
          notransaksi_ref VARCHAR(100),
          kodekantor VARCHAR(50) NOT NULL,
          kodesupel VARCHAR(50),
          status VARCHAR(30) DEFAULT 'PENDING',
          keterangan TEXT,
          petugas VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );
      `);
    }

    // 5. wms_inbound_items
    const hasInboundItems = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_inbound_items'`;
    if (hasInboundItems.length === 0) {
      console.log("  -> Membuat tabel wms_inbound_items...");
      await client.unsafe(`
        CREATE TABLE wms_inbound_items (
          id SERIAL PRIMARY KEY,
          notask VARCHAR(60) NOT NULL,
          kodeitem VARCHAR(50) NOT NULL,
          namaitem VARCHAR(200),
          satuan VARCHAR(20),
          jumlah_order NUMERIC(15,2) NOT NULL,
          jumlah_received NUMERIC(15,2) DEFAULT 0,
          target_bin VARCHAR(60),
          status VARCHAR(30) DEFAULT 'PENDING'
        );
      `);
    }

    // 6. wms_outbound_tasks
    const hasOutbound = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_outbound_tasks'`;
    if (hasOutbound.length === 0) {
      console.log("  -> Membuat tabel wms_outbound_tasks...");
      await client.unsafe(`
        CREATE TABLE wms_outbound_tasks (
          id SERIAL PRIMARY KEY,
          notask VARCHAR(60) UNIQUE NOT NULL,
          notransaksi_ref VARCHAR(100),
          tipetransaksi VARCHAR(50) DEFAULT 'SALES',
          kodekantor VARCHAR(50) NOT NULL,
          tujuan VARCHAR(100),
          status VARCHAR(30) DEFAULT 'PENDING',
          priority VARCHAR(20) DEFAULT 'NORMAL',
          petugas VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );
      `);
    }

    // 7. wms_outbound_items
    const hasOutboundItems = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_outbound_items'`;
    if (hasOutboundItems.length === 0) {
      console.log("  -> Membuat tabel wms_outbound_items...");
      await client.unsafe(`
        CREATE TABLE wms_outbound_items (
          id SERIAL PRIMARY KEY,
          notask VARCHAR(60) NOT NULL,
          kodeitem VARCHAR(50) NOT NULL,
          namaitem VARCHAR(200),
          satuan VARCHAR(20),
          jumlah_order NUMERIC(15,2) NOT NULL,
          jumlah_picked NUMERIC(15,2) DEFAULT 0,
          source_bin VARCHAR(60),
          sequence_order INTEGER DEFAULT 0,
          status VARCHAR(30) DEFAULT 'PENDING'
        );
      `);
    }

    // 8. wms_stock_movements
    const hasMovements = await client`SELECT 1 FROM information_schema.tables WHERE table_name = 'wms_stock_movements'`;
    if (hasMovements.length === 0) {
      console.log("  -> Membuat tabel wms_stock_movements...");
      await client.unsafe(`
        CREATE TABLE wms_stock_movements (
          id SERIAL PRIMARY KEY,
          nomutasi VARCHAR(60) UNIQUE NOT NULL,
          tanggal TIMESTAMP DEFAULT NOW(),
          kodekantor VARCHAR(50) NOT NULL,
          kodeitem VARCHAR(50) NOT NULL,
          from_bin VARCHAR(60),
          to_bin VARCHAR(60),
          jumlah NUMERIC(15,2) NOT NULL,
          tipe VARCHAR(30) NOT NULL,
          notransaksi_ref VARCHAR(100),
          operator VARCHAR(50),
          keterangan TEXT
        );
        CREATE INDEX idx_wms_movements_item ON wms_stock_movements(kodeitem);
        CREATE INDEX idx_wms_movements_date ON wms_stock_movements(tanggal);
      `);
    }

    // Cek daftar tabel wms
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'wms_%'
      ORDER BY table_name;
    `;
    console.log("✅ Berhasil! Tabel WMS di PostgreSQL 8.4:");
    tables.forEach((t: any) => console.log("   -", t.table_name));

    // Masukkan data awal zona & rak default jika masih kosong
    const countBins = await client`SELECT count(*)::int AS count FROM wms_bins`;
    if (countBins[0].count === 0) {
      console.log("🌱 Melakukan seeding data awal Zona & Rak Gudang Utama...");
      // Ambil kode kantor pertama dari tbl_kantor
      const offices = await client`SELECT kodekantor FROM tbl_kantor LIMIT 1`;
      const kantor = offices.length > 0 ? offices[0].kodekantor : "GUDANG";

      // Insert zones
      await client.unsafe(`
        INSERT INTO wms_zones (kodezone, kodekantor, namazone, deskripsi) VALUES
        ('ZN-FAST', '${kantor}', 'Zona Fast Moving', 'Barang cepat laku dekat pintu keluar'),
        ('ZN-BULK', '${kantor}', 'Zona Bulk Storage', 'Penyimpanan barang karton/palet besar'),
        ('ZN-SLOW', '${kantor}', 'Zona General Storage', 'Penyimpanan rak umum');
      `);

      // Insert bins generator: Aisle A (Fast), B (Bulk), C (General)
      const aisles = [
        { aisle: "A", zone: "ZN-FAST", racks: ["01", "02"], tiers: ["1", "2", "3"], slots: ["01", "02"] },
        { aisle: "B", zone: "ZN-BULK", racks: ["01", "02"], tiers: ["1", "2"], slots: ["01", "02"] },
        { aisle: "C", zone: "ZN-SLOW", racks: ["01", "02", "03"], tiers: ["1", "2", "3"], slots: ["01"] },
      ];

      for (const a of aisles) {
        for (const r of a.racks) {
          for (const t of a.tiers) {
            for (const s of a.slots) {
              const kodebin = `BIN-${kantor}-${a.aisle}-${r}-${t}-${s}`;
              await client.unsafe(`
                INSERT INTO wms_bins (kodebin, kodekantor, kodezone, aisle, rack, tier, slot, kapasitas_max_qty)
                VALUES ('${kodebin}', '${kantor}', '${a.zone}', '${a.aisle}', '${r}', '${t}', '${s}', 500);
              `);
            }
          }
        }
      }
      console.log("✅ Berhasil membuat sampel lokasi Bin rak terstruktur.");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Gagal migrasi:", err);
    process.exit(1);
  }
}

runMigration();
