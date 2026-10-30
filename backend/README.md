# Backend - PostgreSQL Connection with Bun & Drizzle ORM

Proyek backend ini menggunakan **[Bun](https://bun.sh)** dan **[Drizzle ORM](https://orm.drizzle.team)** untuk menghubungkan aplikasi ke database PostgreSQL.

---

## 📁 Struktur Folder

```text
backend/
├── src/
│   ├── db/
│   │   ├── index.ts        # Inisialisasi koneksi PostgreSQL & Drizzle ORM
│   │   └── schema.ts       # Definisi skema tabel database
│   ├── api/
│   │   ├── router.ts             # Light type-safe REST router dengan CORS & Error Handler
│   │   ├── routes/               # Modular route handlers (system, analytics, inventory, master, purchasing, sales, orders, cash-bank, accounting)
│   │   └── server.ts             # Bootstrap HTTP Server Bun
│   ├── services/
│   │   ├── accounting.service.ts         # Service siap pakai untuk Neraca, Laba Rugi, & Buku Besar
│   │   ├── fifo-inventory.service.ts     # 📦 Service Mutasi Stok & Penilaian HPP FIFO Real-Time
│   │   ├── purchasing-payable.service.ts # 💳 Service Pembelian, Pelunasan Hutang & Analisa Aging Hutang
│   │   ├── receivable-loyalty.service.ts # 💰 Service Pelunasan Piutang, Aging Piutang & Poin Loyalitas
│   │   ├── advanced-master.service.ts    # 🏷️ Service Multi-Satuan, Level Harga Pelanggan, Serial & BOM Rakitan
│   │   ├── warehouse-consignment.service.ts # 🏢 Service Multi-Gudang, Transfer Cabang, Stok Opname & Konsinyasi
│   │   ├── cash-bank.service.ts          # 💵 Service Kas Masuk/Keluar, Transfer Bank, Deposit & Kas Laci Kasir
│   │   ├── analytics-bi.service.ts       # 📊 Service Business Intelligence (BI), Profitabilitas, ABC Analysis & Customer Retention
│   │   └── order-promotion.service.ts    # 📝 Service Purchase Order (PO), Sales Order (SO), Diskon Promosi & Konfigurasi Sistem
│   └── index.ts            # Entry point REST API Server
├── DOKUMENTASI_REST_API_IPOS4.md # 🌐 Dokumentasi Lengkap Endpoint REST API HTTP Enterprise
├── PANDUAN_PESANAN_PROMO_DAN_KONFIGURASI_IPOS4.md # 📝 Panduan Siklus Pemesanan (PO/SO), Diskon Promosi/Happy Hour & Konfigurasi Global
├── PANDUAN_LAPORAN_ANALITIK_DAN_BI_EKSEKUTIF_IPOS4.md # 📊 Panduan Business Intelligence (BI), Laporan Profitabilitas & Analitik Eksekutif
├── PANDUAN_MANAJEMEN_KAS_BANK_DAN_KASIR_IPOS4.md # 💵 Panduan Kas & Bank, Biaya Operasional, Deposit & Laci Kasir
├── PANDUAN_MULTI_GUDANG_TRANSFER_DAN_KONSINYASI_IPOS4.md # 🏢 Panduan Multi-Gudang, Transfer Cabang, Stok Opname & Konsinyasi
├── PANDUAN_MASTER_DATA_LANJUTAN_IPOS4.md # 🏷️ Panduan Multi-Satuan, Level Harga Pelanggan, Serial SN, & BOM Rakitan
├── PANDUAN_MODUL_PIUTANG_DAN_POIN_IPOS4.md # 💰 Panduan Piutang Pelanggan, Retur Jual & Poin Loyalitas
├── PANDUAN_MODUL_PEMBELIAN_DAN_HUTANG_IPOS4.md # 📦 Panduan Lengkap Pembelian, Retur Beli, & Hutang Supplier
├── PANDUAN_SISTEM_POS_DAN_AKUNTANSI_IPOS4.md # 🛒 Panduan & Arsitektur Lengkap Sistem POS (Kasir) & Akuntansi Terintegrasi
├── PANDUAN_SISTEM_LOGIN_ROLE_SETTING_IPOS4.md # 🔐 Panduan Sistem Login, Role (RBAC), Format Penomoran, & Konfigurasi
├── PANDUAN_ENGINE_FIFO_MUTASI_STOK.md # 📦 Panduan & Spesifikasi Lengkap Engine Mutasi Stok & FIFO
├── PANDUAN_LAPORAN_AKUNTANSI_IPOS4.md # 📖 Panduan Lengkap Laporan Akuntansi iPos 4
├── .env                    # File konfigurasi koneksi database
├── .env.example            # Contoh konfigurasi environment
├── drizzle.config.ts       # Konfigurasi Drizzle Kit (migrasi & studio)
├── package.json
└── tsconfig.json
```

---

## ⚙️ Konfigurasi Database (`.env`)

Sesuaikan parameter koneksi di file `.env`:

```env
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE_NAME>"
```

### Contoh Konfigurasi Umum:
- **Default PostgreSQL (port 5432):**
  ```env
  DATABASE_URL="postgresql://postgres:password123@localhost:5432/postgres"
  ```
- **PostgreSQL iPos 4 / iPgSQL (port 5444):**
  ```env
  DATABASE_URL="postgresql://postgres:admin@localhost:5444/nama_database_ipos"
  ```

---

## 🚀 Perintah yang Tersedia

Jalankan perintah berikut di dalam folder `backend`:

- **Menjalankan / Tes Koneksi:**
  ```bash
  bun run start
  ```
- **Mode Development (Hot-Reload / Watch mode):**
  ```bash
  bun run dev
  ```
- **Audit & Uji Coba Modul:**
  - Audit database & integritas stok:
    ```bash
    bun run audit
    ```
  - Deteksi saldo stok minus:
    ```bash
    bun run detect:stock-minus
    ```
  - Uji Coba Modul Pembelian & Analisa Aging Hutang:
    ```bash
    bun run test:purchasing
    ```
  - Uji Coba Modul Piutang, Aging Pelanggan & Poin Loyalitas:
    ```bash
    bun run test:receivables
    ```
  - Uji Coba Master Data Lanjutan, Multi-Satuan & Resolusi Harga:
    ```bash
    bun run test:advanced-master
    ```
  - Uji Coba Multi-Gudang, Transfer Cabang, Stok Opname & Konsinyasi:
    ```bash
    bun run test:warehouse
    ```
  - Uji Coba Kas & Bank, Biaya Operasional, Deposit & Laci Kasir:
    ```bash
    bun run test:cash-bank
    ```
  - Uji Coba Business Intelligence (BI), Profitabilitas & Analitik Eksekutif:
    ```bash
    bun run test:analytics
    ```
  - Uji Coba Modul Pesanan (PO/SO), Diskon Promosi & Konfigurasi Sistem:
    ```bash
    bun run test:order-promotion
    ```
  - Uji Coba Integrasi Seluruh Endpoint REST API HTTP:
    ```bash
    bun run test:api
    ```
- **Drizzle Kit (Migrasi & Skema):**
  - Buat file migrasi SQL dari skema TypeScript:
    ```bash
    bun run db:generate
    ```
  - Jalankan migrasi ke database:
    ```bash
    bun run db:migrate
    ```
  - Push skema langsung ke database (tanpa file migrasi):
    ```bash
    bun run db:push
    ```
  - Buka Drizzle Studio (GUI Web Database Browser):
    ```bash
    bun run db:studio
    ```
