# DOKUMENTASI REST API MODERN IPOS 4.0 ENTERPRISE

Backend iPos 4.0 telah dilengkapi dengan antarmuka **REST API HTTP** berkinerja tinggi yang berjalan langsung di atas runtime **Bun**. Seluruh layanan dan modul database PostgreSQL diintegrasikan ke dalam endpoint JSON standar dengan dukungan CORS otomatis untuk aplikasi web, mobile, maupun integrasi sistem pihak ketiga (*third-party ERP / eCommerce*).

---

## 1. Spesifikasi Server & Format Respons

- **Base URL Default:** `http://localhost:3001` (dapat dikonfigurasi melalui *environment variable* `PORT`).
- **Header Standar:** `Content-Type: application/json; charset=utf-8`
- **CORS:** Diaktifkan otomatis (`Access-Control-Allow-Origin: *`) untuk mendukung integrasi front-end modern (React, Next.js, Vue, Flutter, React Native, dll).

### Format Respons Sukses (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... }
}
```

### Format Respons Gagal (HTTP 400 / 404 / 500)
```json
{
  "success": false,
  "error": "Pesan deskripsi kesalahan"
}
```

---

## 2. Katalog Endpoint API

### 2.1 Modul Sistem & Kesehatan (`/api/system`)

| Metode | Endpoint | Deskripsi | Query / Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Root discovery & sitemap endpoint API. | - |
| `GET` | `/api/system/health` | Ping server, status koneksi database, dan latensi. | - |
| `GET` | `/api/system/config` | Konfigurasi sistem global iPos 4 (`tbl_conf`). | - |
| `GET` | `/api/system/users` | Daftar akun pengguna dan role otoritas (`tbl_user`). | - |

---

### 2.2 Modul Business Intelligence & Analitik Eksekutif (`/api/analytics`)

| Metode | Endpoint | Deskripsi | Query Parameter |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/dashboard` | Executive Dashboard: Omzet tahunan, bulanan, rasio kredit vs tunai, dan *basket size*. | `year` (default: 2026) |
| `GET` | `/api/analytics/profitability/items` | Analisa margin profitabilitas per barang (Revenue, HPP, GP, Margin %). | `year` (2026), `limit` (20) |
| `GET` | `/api/analytics/profitability/categories` | Laba kotor dan margin dikelompokkan berdasarkan kategori produk. | `year` (default: 2026) |
| `GET` | `/api/analytics/inventory/abc` | Klasifikasi inventaris Pareto ABC (Kelas A 80%, B 15%, C 5%) & deteksi *dead stock*. | `year` (default: 2026) |
| `GET` | `/api/analytics/customers/retention` | Analitik retensi, Customer Lifetime Value (LTV), dan deteksi *churn risk*. | `churnDays` (default: 90) |

---

### 2.3 Modul Inventaris & Multi-Gudang (`/api/inventory`)

| Metode | Endpoint | Deskripsi | Parameter / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/inventory/warehouses` | Daftar kantor / gudang cabang (`tbl_kantor`). | - |
| `GET` | `/api/inventory/stock` | Saldo stok fisik dan valuasi HPP per gudang. | `office` (e.g. `UTM`), `itemCode` |
| `GET` | `/api/inventory/card` | Kartu mutasi stok FIFO per item dan gudang. | `itemCode` (wajib), `office` |
| `POST` | `/api/inventory/transfer` | Mutasi transfer stok antar cabang/gudang (`tbl_itrhd`). | JSON transfer payload |
| `POST` | `/api/inventory/opname` | Penyesuaian stok fisik opname (`tbl_itemopname`). | JSON opname payload |
| `GET` | `/api/inventory/consignments/summary` | Rekapitulasi hutang barang konsinyasi masuk (KI). | `supplierCode` (opsional) |

---

### 2.4 Modul Master Data & Resolusi Harga (`/api/master`)

| Metode | Endpoint | Deskripsi | Parameter |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/master/items` | Pencarian barang/produk, barcode, dan satuan dasar. | `search`, `limit` (default: 50) |
| `GET` | `/api/master/barcode` | Pencarian barang instan berdasarkan kode barcode kasir. | `barcode` (wajib) |
| `GET` | `/api/master/units` | Daftar multi-satuan dan rasio konversi item. | `itemCode` (wajib) |
| `GET` | `/api/master/resolve-price` | Resolusi harga bertingkat pelanggan & grosir *real-time*. | `itemCode`, `unit`, `qty`, `customerCode` |
| `GET` | `/api/master/bom` | Bill of Materials (BOM) resep barang rakitan. | `itemCode` (wajib) |
| `GET` | `/api/master/customer-groups` | Daftar grup pelanggan (General, Grosir, dll). | - |

---

### 2.5 Modul Pembelian & Hutang Supplier (`/api/purchasing`)

| Metode | Endpoint | Deskripsi | Parameter / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/purchasing/invoices` | Riwayat faktur pembelian barang (`tbl_imhd`). | `search`, `limit` (default: 50) |
| `GET` | `/api/purchasing/payables/outstanding` | Daftar faktur pembelian tempo yang belum lunas. | `supplierCode`, `office` |
| `GET` | `/api/purchasing/payables/aging` | Analisa umur hutang supplier (*aging schedule*). | `supplierCode`, `office` |
| `POST` | `/api/purchasing/payables/pay` | Pembayaran pelunasan hutang supplier (`tbl_byrhutanghd`). | JSON pembayaran hutang |
| `POST` | `/api/purchasing/invoices` | Pembuatan faktur pembelian baru (`tbl_imhd`). | JSON faktur beli |

---

### 2.6 Modul Penjualan & Piutang Pelanggan (`/api/sales`)

| Metode | Endpoint | Deskripsi | Parameter / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales/invoices` | Riwayat faktur penjualan kasir & invoice (`tbl_ikhd`). | `search`, `limit` (default: 50) |
| `GET` | `/api/sales/receivables/outstanding` | Daftar faktur penjualan kredit yang belum lunas. | `customerCode`, `office` |
| `GET` | `/api/sales/receivables/aging` | Analisa umur piutang pelanggan (*aging schedule*). | `customerCode`, `office` |
| `POST` | `/api/sales/receivables/pay` | Pembayaran pelunasan piutang pelanggan (`tbl_byrpiutanghd`). | JSON pelunasan piutang |
| `GET` | `/api/sales/loyalty` | Saldo dan riwayat poin loyalitas pelanggan. | `customerCode` (wajib) |
| `POST` | `/api/sales/loyalty/redeem` | Penukaran poin loyalitas pelanggan (`tbl_pointambil`). | JSON klaim hadiah poin |

---

### 2.7 Modul Pesanan (PO/SO) & Promosi Berkala (`/api/orders`)

| Metode | Endpoint | Deskripsi | Parameter / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/orders/outstanding` | Daftar *backlog* pesanan PO / SO yang belum tuntas dipenuhi. | `type` (`PO` atau `SO`) |
| `POST` | `/api/orders` | Pembuatan Purchase Order (PO) atau Sales Order (SO) baru. | JSON order payload |
| `POST` | `/api/orders/fulfill` | Pencatatan realisasi penerimaan/pengiriman barang pesanan. | JSON fulfillment items |
| `GET` | `/api/orders/promotions/resolve` | Simulasi diskon promosi berkala, Happy Hour, dan grosir. | `itemCode`, `qty`, `group` |

---

### 2.8 Modul Kas, Bank & Kasir (`/api/cash-bank`)

| Metode | Endpoint | Deskripsi | Parameter / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cash-bank/accounts` | Daftar akun kas & bank serta saldo buku besar aktif. | - |
| `POST` | `/api/cash-bank/in` | Pencatatan Kas Masuk operasional (`tbl_acckashd`). | JSON kas masuk |
| `POST` | `/api/cash-bank/out` | Pencatatan Kas Keluar operasional / beban biaya. | JSON kas keluar |
| `POST` | `/api/cash-bank/transfer` | Mutasi transfer internal antar akun kas & bank. | JSON mutasi bank |
| `POST` | `/api/cash-bank/deposit` | Pencatatan deposit titipan uang muka pelanggan/supplier. | JSON deposit |
| `POST` | `/api/cash-bank/drawer/open` | Pembukaan sesi shift kasir & modal laci (`tbl_kaslaci`). | JSON buka shift |
| `POST` | `/api/cash-bank/drawer/close` | Penutupan shift kasir, setoran riil, dan selisih kas. | JSON tutup shift |

---

### 2.9 Modul Akuntansi & Laporan Keuangan (`/api/accounting`)

| Metode | Endpoint | Deskripsi | Parameter |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/accounting/profit-loss` | Laporan Laba Rugi komprehensif periode tertentu. | `startDate`, `endDate` |
| `GET` | `/api/accounting/balance-sheet` | Laporan Neraca Keuangan (Aktiva vs Pasiva). | `startDate`, `endDate` |
| `GET` | `/api/accounting/ledger` | Buku Besar transaksi debit/kredit per akun perkiraan. | `accountCode` (wajib), `startDate`, `endDate` |

---

## 3. Cara Menjalankan Server & Uji Coba

Jalankan perintah berikut di folder `backend`:

```bash
# 1. Menjalankan Server REST API di port 3001
bun run start

# 2. Menjalankan Server dalam mode Hot-Reload (Pengembangan)
bun run dev

# 3. Menjalankan Automated End-to-End Test Suite REST API
bun run test:api
```
