# 🧭 MASTER INDEX & AI OPERATIONAL KNOWLEDGE BASE: iPos 4.0 ENTERPRISE

> **Tujuan Dokumen**: File ini dan seluruh modul di direktori `docs/ipos_knowledge/` adalah **Single Source of Truth (SSOT)** mengenai pemahaman menyeluruh sistem **iPos 4.0 (Desktop & Database Asli PostgreSQL/iPgSQL)** serta platform **Modernisasi Web Enterprise (Next.js 15, Bun, Drizzle ORM, WMS 2D)**.
> **Untuk AI Model Baru**: Bacalah dokumen ini terlebih dahulu sebagai peta navigasi kognitif sebelum membaca atau memodifikasi kode/database.

---

## 🤖 PANDUAN CEPAT & ATURAN SAKRAL BAGI AI MODEL (AI Golden Rules)

Bila Anda adalah model AI baru (Gemini, Claude, GPT, Llama, DeepSeek, dll.) yang bertugas membaca, menganalisis, atau mengembangkan sistem iPos 4.0 ini, **PATUHI 10 ATURAN SAKRAL BERIKUT TANPA PENGECUALIAN**:

1. **Prinsip Akuntansi Perpetual Double-Entry**:
   - Setiap transaksi mutasi finansial (penjualan, pembelian, retur, kas masuk/keluar, selisih opname) **WAJIB** menghasilkan baris jurnal berimbang di `tbl_accjurnal` (`SUM(debet) === SUM(kredit)`).
   - Jangan pernah membuat jurnal manual pada akun Header (`tbl_perkiraan.tipe = 'H'`). Jurnal hanya boleh diposting ke sub-akun Detail (`tbl_perkiraan.tipe = 'D'`).
2. **Integritas Antrean FIFO Persediaan**:
   - Pengurangan stok (penjualan `tbl_ikhd`, retur beli `tbl_returbelihd`, item keluar `tbl_item_ik`) **HARUS** mengambil alokasi dari batch masuk tertua di `tbl_item_im` yang field `sisa > 0`.
   - Update `tbl_itemstok` (stok fisik) dan alokasi `tbl_item_im` / `tbl_item_ik` harus berada dalam satu transaksi database (`BEGIN ... COMMIT`) yang atomik.
3. **Pantangan Stok Minus**:
   - Jangan pernah membiarkan stok fisik di `tbl_itemstok` bernilai negatif (< 0) tanpa mekanisme peringatan/flagging. Stok negatif merusak perhitungan HPP rata-rata dan membuat valuasi persediaan di Neraca Keuangan menjadi terdistorsi.
4. **Konvensi Database & Kompatibilitas PostgreSQL 8.4/9.x**:
   - Engine database asli iPos 4 adalah PostgreSQL 8.4 / 9.x (`iPgSQL` running default port `5444`).
   - Jangan menggunakan query modern PostgreSQL yang tidak didukung PostgreSQL 8.4 (misalnya: hindari `ON CONFLICT DO UPDATE / UPSERT` native; gunakan pola subquery `SELECT EXISTS` lalu `INSERT` atau `UPDATE`, atau `WITH UPSERT` yang kompatibel).
5. **Autonumbering & Format Nomor Transaksi**:
   - Nomor transaksi tidak boleh digenerate sembarangan secara acak string. Gunakan counter dan pola format pada `tbl_formatnotr` (misal: `JL/YYMM/...`, `BL/YYMM/...`, `KM/YYMM/...`).
6. **Hubungan Kontak Satu Pintu (`tbl_supel`)**:
   - Supplier dan Pelanggan disimpan dalam satu tabel induk: `tbl_supel`.
   - Gunakan filter kolom `tipe` atau flag boolean (`supplier = true`, `pelanggan = true`) untuk membedakan entitas.
7. **Pemisahan Header & Detail**:
   - Semua transaksi faktur mengikuti pola master-detail: `tbl_imhd` & `tbl_imdt` (Pembelian), `tbl_ikhd` & `tbl_ikdt` (Penjualan), `tbl_itrhd` & `tbl_itrdt` (Transfer Antar-Gudang), `tbl_acckashd` & `tbl_acckasdt` (Kas Masuk/Keluar).
8. **Multi-Satuan & Konversi Kuantitas**:
   - Stok fisik di `tbl_itemstok` selalu dihitung dan disimpan dalam **Satuan Terkecil / Satuan Dasar (Satuan 1)**.
   - Jika transaksi menggunakan Satuan 2 (Pack), Satuan 3 (Dus), atau Satuan 4 (Karton), kuantitas **WAJIB dikonversikan** ke Satuan 1 berdasarkan faktor pengali di `tbl_itemsatuanjml`.
9. **Koneksi Database & Lingkungan Kerja**:
   - Port `5444`: Instance Database Asli iPos 4 (PostgreSQL iPgSQL). User default `admin` / `postgres`.
   - Port `3001`: Backend Enterprise REST API (Bun runtime + Drizzle ORM).
   - Port `3000`: Frontend Web Application (Next.js 15 App Router + TailwindCSS + Zustand).
10. **Modul WMS Bersifat Non-Destruktif (Additive)**:
    - Modul Warehouse Management System (`wms_zones`, `wms_bins`, `wms_bin_stocks`, `wms_inbound_tasks`, `wms_outbound_tasks`) adalah tabel additif modern.
    - WMS membaca dan memperbarui data inti iPos tanpa merusak skema tabel asli desktop iPos 4.

---

## 🗺️ STRUKTUR DIREKTORI & MODUL KNOWLEDGE BASE

Seluruh dokumentasi rinci dibagi ke dalam 11 sub-modul terstruktur di dalam folder `docs/ipos_knowledge/`:

| No | File Modul | Deskripsi & Cakupan Teknis |
|:---|:---|:---|
| **00** | [`00_OVERVIEW_AND_ARCHITECTURE.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/00_OVERVIEW_AND_ARCHITECTURE.md) | Arsitektur menyeluruh sistem iPos 4.0: Desktop vs Modern Web, topologi jaringan, spesifikasi port (5444, 3001, 3000), dan alur data end-to-end. |
| **01** | [`01_DATABASE_SCHEMA_DICTIONARY.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/01_DATABASE_SCHEMA_DICTIONARY.md) | Kamus data lengkap seluruh tabel utama (Master, Transaksi, Akuntansi, Kasir), tipe data kolom, primary key, relasi foreign key, dan indeks. |
| **02** | [`02_INVENTORY_FIFO_MUTATION.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/02_INVENTORY_FIFO_MUTATION.md) | Mekanisme mutasi stok fisik (`tbl_itemstok`), antrean batch FIFO (`tbl_item_im` & `tbl_item_ik`), kalkulasi HPP riil, stok opname, dan multi-satuan. |
| **03** | [`03_SALES_POS_TRANSACTIONS.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/03_SALES_POS_TRANSACTIONS.md) | Siklus transaksi kasir (POS), alur buka/tutup shift kas laci (`tbl_kaslaci`), multi-metode pembayaran, diskon bertingkat, PPN, dan pembulatan. |
| **04** | [`04_PURCHASING_AND_PAYABLES.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/04_PURCHASING_AND_PAYABLES.md) | Alur pengadaan barang, faktur pembelian (`tbl_imhd`/`tbl_imdt`), retur pembelian, pelunasan hutang supplier (`tbl_byrhutanghd`), dan analisa aging hutang. |
| **05** | [`05_RECEIVABLES_AND_LOYALTY.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/05_RECEIVABLES_AND_LOYALTY.md) | Pengelolaan piutang pelanggan, batas kredit/plafon, analisa umur piutang (Aging), retur penjualan, dan sistem poin reward loyalitas (`tbl_point_sa`, `tbl_pointambil`). |
| **06** | [`06_ACCOUNTING_DOUBLE_ENTRY.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/06_ACCOUNTING_DOUBLE_ENTRY.md) | Sistem akuntansi perpetual, bagan akun COA (`tbl_perkiraan`), pengaturan akun default (`tbl_perksetting`), buku jurnal umum (`tbl_accjurnal`), buku besar, neraca, laba rugi, dan proses tutup buku. |
| **07** | [`07_CASH_BANK_MANAGEMENT.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/07_CASH_BANK_MANAGEMENT.md) | Transaksi kas masuk/keluar non-operasional & operasional (`tbl_acckashd`), transfer antar-rekening bank, deposit uang titipan pelanggan/supplier, dan rekonsiliasi kas. |
| **08** | [`08_SECURITY_RBAC_AND_SETTINGS.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/08_SECURITY_RBAC_AND_SETTINGS.md) | Otentikasi pengguna (`tbl_user`), enkripsi sandi (MD5 iPos 4 vs SHA-256 modern), matriks hak akses RBAC, autonumbering (`tbl_formatnotr`), dan opsi sistem (`tbl_conf`). |
| **09** | [`09_MODERN_WEB_AND_WMS_EXTENSION.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/09_MODERN_WEB_AND_WMS_EXTENSION.md) | Arsitektur modernisasi web (Next.js 15, Bun, Drizzle ORM), denah gudang visual 2D, alur mobile PDA barcode scanner, serta script background automation. |
| **10** | [`10_ANOMALY_DETECTION_AND_AUDIT.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/10_ANOMALY_DETECTION_AND_AUDIT.md) | Sistem pendeteksi anomali data (stok minus, jurnal tidak seimbang, transaksi backdated, orphan records), query audit integritas, dan langkah remediasi. |

---

## 💡 BAGAIMANA CARA MENGGUNAKAN DOKUMENTASI INI

1. **Ketika Mendapat Tugas Perbaikan/Kueri Database**:
   - Buka [`01_DATABASE_SCHEMA_DICTIONARY.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/01_DATABASE_SCHEMA_DICTIONARY.md) untuk memastikan nama tabel, kolom, dan relasi yang valid.
2. **Ketika Mengembangkan Fitur Transaksi Kasir / Penjualan**:
   - Baca [`03_SALES_POS_TRANSACTIONS.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/03_SALES_POS_TRANSACTIONS.md) dan periksa efeknya pada persediaan ([`02_INVENTORY_FIFO_MUTATION.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/02_INVENTORY_FIFO_MUTATION.md)) serta penjurnalan otomatisnya ([`06_ACCOUNTING_DOUBLE_ENTRY.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/06_ACCOUNTING_DOUBLE_ENTRY.md)).
3. **Ketika Mengaudit Integritas Finansial & Persediaan**:
   - Pelajari aturan pemeriksaan pada [`10_ANOMALY_DETECTION_AND_AUDIT.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/10_ANOMALY_DETECTION_AND_AUDIT.md).
4. **Ketika Mengembangkan Frontend / Backend API Modern**:
   - Baca [`09_MODERN_WEB_AND_WMS_EXTENSION.md`](file:///c:/Program%20Files%20(x86)/Program%20Kreatif/Program%20iPos%204.0/docs/ipos_knowledge/09_MODERN_WEB_AND_WMS_EXTENSION.md).
