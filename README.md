# iPos 4.0 Modern Enterprise Platform

[![Platform](https://img.shields.io/badge/Platform-Web%20Enterprise-blue.svg)](https://github.com/ferlyT/ipos)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2015%20%7C%20TailwindCSS%20%7C%20Zustand-000000.svg)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-Bun%201.3%20%7C%20Drizzle%20ORM-F472B6.svg)](https://bun.sh/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)

Modernisasi dan transformasi arsitektur web terintegrasi untuk ekosistem **iPos 4.0**. Dirancang untuk menggantikan keterbatasan desktop tradisional dengan antarmuka web modern, performa tinggi, realtime POS, visual Warehouse Management System (WMS), akuntansi double-entry otomatis, serta sistem analitik eksekutif.

---

## 🌟 Fitur Utama

### 1. Web POS (Point of Sale) & Kasir Modern
- **Keyboard-First Interface**: Dukungan penuh tombol shortcut POS (F1-F12, Space, Enter, ESC).
- **Multi-Metode Pembayaran**: Tunai, EDC/Kartu Debit/Kredit, QRIS, Split Payment, dan Piutang Jatuh Tempo.
- **Manajemen Kas & Shift**: Pembukaan kas laci kasir (Modal Awal), setoran kas tengah hari, dan penutupan shift kasir dengan rekonsiliasi selisih kas fisik.
- **Thermal Receipt Printing**: Struk belanja 58mm / 80mm dengan auto-cut dan cetak barcode nota.
- **Diskon Bertingkat & Happy Hour**: Validasi otomatis diskon promo, minimal belanja, dan batas waktu promo.

### 2. Warehouse Management System (WMS)
- **Interactive 2D Visual Warehouse Layout**: Denah grid visual gudang (Rak, Aisles, Zona Suhu, Loading Dock) dengan color-coded kapasitas okupansi.
- **Mobile PDA & Barcode Scanner (`/wms/scanner`)**: UI mobile-first untuk penanganan alur Putaway (Penerimaan), Picking (Pengambilan SO), dan Transfer Antar-Gudang secara realtime.
- **Bin Allocation & Kapasitas Rak**: Pelacakan posisi barang per lorong (*Aisle*), rak (*Rack*), tingkat (*Level*), dan kotak (*Bin*).

### 3. Master Data & Penjualan / Pembelian Lanjutan
- **Multi-Satuan & Konversi Otomatis**: Mendukung konversi bertingkat (PCS, PACK, DUS, KARTON) dengan level harga grosir per satuan.
- **Level Harga Pelanggan**: Harga jual bertingkat (Umum, Silver, Gold, Platinum).
- **Bill of Materials (BOM) & Perakitan**: Komposisi bahan rakitan (*assembly item*) dengan penghitungan HPP otomatis.
- **Siklus Pemesanan (PO & SO)**: Purchase Order ke Supplier dan Sales Order Pelanggan dengan pelacakan sisa backlog dan fulfillment status.

### 4. Akuntansi & Manajemen Keuangan Lengkap
- **Jurnal Otomatis Double-Entry**: Setiap transaksi pembelian, penjualan, mutasi stok, kas keluar, dan penyesuaian otomatis membentuk jurnal umum.
- **Buku Besar, Neraca Saldo, & Laba Rugi**: Menampilkan laporan keuangan periodik secara realtime.
- **Aging Hutang & Piutang**: Pengelompokan umur piutang/hutang (0-30 hari, 31-60 hari, 61-90 hari, >90 hari) dengan reminder jatuh tempo.
- **Sistem Kas & Bank**: Mutasi kas operasional, transfer antar-bank, deposit pelanggan, dan voucher kas masuk/keluar.

### 5. Engine Mutasi Stok & Penilaian FIFO Real-Time
- **Metode FIFO Otomatis**: Alokasi batch barang masuk pertama keluar pertama dengan pencatatan HPP akurat hingga pecahan terkecil.
- **Stok Opname**: Perekaman fisik stok harian/bulanan dengan kalkulasi otomatis selisih lebih/kurang stok (*Variance*).

### 6. Administrasi Sistem & Keamanan (RBAC)
- **Role-Based Access Control (RBAC)**: Pengaturan hak akses granular untuk Superadmin, Kasir, Staff Gudang, Akuntan, dan Manajer.
- **Automated Database Backup**: Pencadangan database PostgreSQL via REST API langsung dari antarmuka web.
- **Audit Trail & Anomali Scanner**: Mesin pendeteksi integritas data (stok minus, jurnal tidak seimbang, anomali tanggal transaksi).

---

## 🏗️ Arsitektur Proyek

Repository ini mengadopsi struktur monorepo terpisah untuk frontend dan backend:

```text
ipos/
├── frontend/                     # Modern Web Application (Next.js 15)
│   ├── app/
│   │   ├── pos/                  # Layar Kasir Web POS
│   │   ├── wms/scanner/          # Layar Barcode Scanner Mobile/PDA
│   │   ├── admin/                # Panel Administrasi & Dashboard
│   │   │   ├── dashboard/        # Executive Dashboard & KPI
│   │   │   ├── master/           # Master Data (Item, BOM, Kontak, Barcode)
│   │   │   ├── sales/            # Invoice Penjualan & Loyalitas
│   │   │   ├── purchasing/       # Faktur Pembelian & Hutang
│   │   │   ├── orders/           # Backlog PO/SO & Promo Diskon
│   │   │   ├── inventory/        # Stok Realtime, Transfer & Opname
│   │   │   ├── wms/              # Layout Visual 2D, Bins & Tugas WMS
│   │   │   ├── cash-bank/        # Kasir Laci, Akun Bank & Transaksi
│   │   │   ├── accounting/       # Buku Besar & Laba Rugi
│   │   │   └── system/           # Pengguna, Hak Akses, Backup & Audit
│   │   ├── layout.tsx
│   │   └── page.tsx              # Portal Utama Sistem
│   ├── components/               # Komponen UI Reusable (Modal, Tender, Print)
│   ├── stores/                   # Global State Management (Zustand)
│   ├── lib/api-client.ts         # HTTP Client ke REST API Backend
│   └── package.json
│
├── backend/                      # High-Performance REST API (Bun + Drizzle)
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/           # Modular Endpoints (POS, WMS, Master, Finance, dll)
│   │   │   ├── router.ts         # Type-safe REST Router
│   │   │   └── server.ts         # Bun Native HTTP Server
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle Schema Relasional PostgreSQL iPos 4.0
│   │   │   └── index.ts          # Database Connection Pool
│   │   ├── services/             # Core Business Logic (FIFO, Accounting, WMS, dll)
│   │   ├── diagnostics/          # Diagnostic Scanner & Rule Engine
│   │   └── index.ts              # Entry Point Server (Port 3001)
│   ├── DOKUMENTASI_REST_API_IPOS4.md # Dokumentasi Lengkap Endpoint REST API
│   ├── package.json
│   └── tsconfig.json
│
├── start-ipos4-enterprise.bat     # Windows 1-Click Launcher
├── stop-ipos4-enterprise.bat      # Windows 1-Click Stopper
├── PRD_FRONTEND_IPOS4_ENTERPRISE.md
├── ALUR_FRONTEND_IPOS4_LENGKAP.md
├── README.md
└── .gitignore
```

---

## 🚀 Panduan Memulai (Quick Start)

### Prasyarat
1. **[Bun](https://bun.sh)** (v1.1+ atau v1.3+)
2. **[PostgreSQL](https://www.postgresql.org)** (Port default iPos 4.0 PostgreSQL: `5444` atau standard `5432`)
3. **Web Browser Modern** (Google Chrome, Microsoft Edge, atau Firefox)

---

### Langkah 1: Clone Repository
```bash
git clone https://github.com/ferlyT/ipos.git
cd ipos
```

---

### Langkah 2: Konfigurasi Backend
Masuk ke folder `backend`, buat file `.env` berdasarkan contoh:
```bash
cd backend
cp .env.example .env
```
Sesuaikan konfigurasi database string di dalam `backend/.env`:
```env
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
DATABASE_URL="postgresql://postgres:admin@localhost:5444/i4_barunatrial"
```

Install dependensi backend:
```bash
bun install
```

Jalankan backend server:
```bash
bun run dev
```
> Server REST API akan aktif di `http://localhost:3001`. Cek status: `http://localhost:3001/api/system/health`.

---

### Langkah 3: Konfigurasi Frontend
Buka terminal baru, masuk ke folder `frontend`:
```bash
cd frontend
cp .env.example .env.local
```
Install dependensi frontend:
```bash
bun install
```

Jalankan development server:
```bash
bun run dev
```
> Aplikasi web frontend akan aktif di `http://localhost:3000`.

---

### ⚡ Menjalankan di Windows (1-Click Launcher)
Tersedia skrip batch otomatis untuk pengguna Windows:
- **Menjalankan Seluruh Sistem**: Jalankan file `start-ipos4-enterprise.bat`. Skrip akan otomatis mengaktifkan backend, frontend, dan membuka browser di antarmuka Kasir.
- **Menghentikan Seluruh Sistem**: Jalankan file `stop-ipos4-enterprise.bat`.

---

## 🌐 Rute Navigasi Aplikasi

| URL Antarmuka | Deskripsi Halaman |
|---|---|
| `http://localhost:3000/` | Portal Launchpad & Ringkasan Status Layanan |
| `http://localhost:3000/pos` | Layar Kasir Web POS (Barcode, Tender, Print Nota) |
| `http://localhost:3000/wms/scanner` | Mobile PDA Scanner (Putaway, Picking, Transfer) |
| `http://localhost:3000/admin/dashboard` | Dashboard Eksekutif & Grafik Penjualan |
| `http://localhost:3000/admin/wms/layout` | Visual 2D Grid Denah Gudang & Monitoring Rak |
| `http://localhost:3000/admin/master/items` | Master Item, Multi-Satuan & Level Harga |
| `http://localhost:3000/admin/master/bom` | Bill of Materials (BOM) & Perakitan Barang |
| `http://localhost:3000/admin/accounting/ledger` | Buku Besar Akuntansi (General Ledger) |
| `http://localhost:3000/admin/accounting/profit-loss` | Laporan Laba Rugi Komprehensif |
| `http://localhost:3000/admin/system/database` | Backup Database PostgreSQL & Riwayat Dump |

---

## 📖 Dokumentasi Lengkap

Dokumentasi detail mengenai alur logika, endpoint API, dan panduan teknis tersedia di dalam repository:
- 🌐 [Dokumentasi Lengkap REST API](file:///backend/DOKUMENTASI_REST_API_IPOS4.md)
- 🛒 [Panduan Sistem POS & Akuntansi](file:///backend/PANDUAN_SISTEM_POS_DAN_AKUNTANSI_IPOS4.md)
- 🏢 [Panduan Multi-Gudang & Konsinyasi](file:///backend/PANDUAN_MULTI_GUDANG_TRANSFER_DAN_KONSINYASI_IPOS4.md)
- 📦 [Panduan Engine FIFO & Mutasi Stok](file:///backend/PANDUAN_ENGINE_FIFO_MUTASI_STOK.md)
- 📝 [Panduan Siklus PO/SO & Promosi](file:///backend/PANDUAN_PESANAN_PROMO_DAN_KONFIGURASI_IPOS4.md)
- 📊 [Panduan Business Intelligence (BI) & Analitik](file:///backend/PANDUAN_LAPORAN_ANALITIK_DAN_BI_EKSEKUTIF_IPOS4.md)

---

## 👨‍💻 Kontributor

- **Ferly Trianderi** - [@ferlyT](https://github.com/ferlyT)
- Platform dikembangkan untuk integrasi dan modernisasi sistem **CV. Baruna Artha Lestari** / **iPos 4.0**.
