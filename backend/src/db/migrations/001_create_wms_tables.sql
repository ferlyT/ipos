-- =========================================================================
-- WMS (Warehouse Management System) Additive Tables for iPos 4.0
-- Database: PostgreSQL 8.4 Compatible (Safe, Non-Destructive Extension)
-- =========================================================================

-- 1. Zona Gudang
CREATE TABLE IF NOT EXISTS wms_zones (
    kodezone VARCHAR(50) PRIMARY KEY,
    kodekantor VARCHAR(50) NOT NULL,
    namazone VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Master Rak & Bin Lokasi
CREATE TABLE IF NOT EXISTS wms_bins (
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

CREATE INDEX IF NOT EXISTS idx_wms_bins_kantor ON wms_bins(kodekantor);
CREATE INDEX IF NOT EXISTS idx_wms_bins_routing ON wms_bins(aisle, rack, tier, slot);

-- 3. Stok Barang per Bin Lokasi
CREATE TABLE IF NOT EXISTS wms_bin_stocks (
    id SERIAL PRIMARY KEY,
    kodekantor VARCHAR(50) NOT NULL,
    kodebin VARCHAR(60) NOT NULL REFERENCES wms_bins(kodebin) ON UPDATE CASCADE ON DELETE CASCADE,
    kodeitem VARCHAR(50) NOT NULL,
    jumlah NUMERIC(15,2) NOT NULL DEFAULT 0,
    batch_no VARCHAR(50),
    expired_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_wms_bin_stock UNIQUE (kodekantor, kodebin, kodeitem)
);

CREATE INDEX IF NOT EXISTS idx_wms_bin_stocks_item ON wms_bin_stocks(kodeitem);
CREATE INDEX IF NOT EXISTS idx_wms_bin_stocks_bin ON wms_bin_stocks(kodebin);

-- 4. Tugas Inbound (Penerimaan & Putaway)
CREATE TABLE IF NOT EXISTS wms_inbound_tasks (
    id SERIAL PRIMARY KEY,
    notask VARCHAR(60) UNIQUE NOT NULL,
    notransaksi_ref VARCHAR(100),
    kodekantor VARCHAR(50) NOT NULL,
    kodesupel VARCHAR(50),
    status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, RECEIVING, COMPLETED, CANCELLED
    keterangan TEXT,
    petugas VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_inbound_items (
    id SERIAL PRIMARY KEY,
    notask VARCHAR(60) NOT NULL REFERENCES wms_inbound_tasks(notask) ON UPDATE CASCADE ON DELETE CASCADE,
    kodeitem VARCHAR(50) NOT NULL,
    namaitem VARCHAR(200),
    satuan VARCHAR(20),
    jumlah_order NUMERIC(15,2) NOT NULL,
    jumlah_received NUMERIC(15,2) DEFAULT 0,
    target_bin VARCHAR(60),
    status VARCHAR(30) DEFAULT 'PENDING' -- PENDING, STORED
);

-- 5. Tugas Outbound (Picking & Packing)
CREATE TABLE IF NOT EXISTS wms_outbound_tasks (
    id SERIAL PRIMARY KEY,
    notask VARCHAR(60) UNIQUE NOT NULL,
    notransaksi_ref VARCHAR(100),
    tipetransaksi VARCHAR(50) DEFAULT 'SALES', -- SALES, TRANSFER, CONSIGNMENT
    kodekantor VARCHAR(50) NOT NULL,
    tujuan VARCHAR(100),
    status VARCHAR(30) DEFAULT 'PENDING', -- PENDING, PICKING, PACKED, SHIPPED, CANCELLED
    priority VARCHAR(20) DEFAULT 'NORMAL', -- HIGH, NORMAL, LOW
    petugas VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_outbound_items (
    id SERIAL PRIMARY KEY,
    notask VARCHAR(60) NOT NULL REFERENCES wms_outbound_tasks(notask) ON UPDATE CASCADE ON DELETE CASCADE,
    kodeitem VARCHAR(50) NOT NULL,
    namaitem VARCHAR(200),
    satuan VARCHAR(20),
    jumlah_order NUMERIC(15,2) NOT NULL,
    jumlah_picked NUMERIC(15,2) DEFAULT 0,
    source_bin VARCHAR(60),
    sequence_order INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'PENDING' -- PENDING, PICKED
);

-- 6. Log Jejak Mutasi & Audit Trail Rak (Movements)
CREATE TABLE IF NOT EXISTS wms_stock_movements (
    id SERIAL PRIMARY KEY,
    nomutasi VARCHAR(60) UNIQUE NOT NULL,
    tanggal TIMESTAMP DEFAULT NOW(),
    kodekantor VARCHAR(50) NOT NULL,
    kodeitem VARCHAR(50) NOT NULL,
    from_bin VARCHAR(60),
    to_bin VARCHAR(60),
    jumlah NUMERIC(15,2) NOT NULL,
    tipe VARCHAR(30) NOT NULL, -- INBOUND, OUTBOUND, RELOCATION, OPNAME_ADJUST
    notransaksi_ref VARCHAR(100),
    operator VARCHAR(50),
    keterangan TEXT
);

CREATE INDEX IF NOT EXISTS idx_wms_movements_item ON wms_stock_movements(kodeitem);
CREATE INDEX IF NOT EXISTS idx_wms_movements_date ON wms_stock_movements(tanggal);
