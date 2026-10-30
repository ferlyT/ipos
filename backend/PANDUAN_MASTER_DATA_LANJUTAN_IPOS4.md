# PANDUAN MASTER DATA LANJUTAN & ENTITAS RITEL KHUSUS IPOS 4.0

Dokumen ini merupakan panduan teknis dan spesifikasi arsitektur menyeluruh mengenai pengelolaan **Master Data Lanjutan & Entitas Ritel Khusus** pada iPos 4.0 beserta implementasinya pada database PostgreSQL (`i4_barunatrial`).

---

## 1. Arsitektur Multi-Satuan & Barcode Bertingkat

Dalam operasional perdagangan ritel dan grosir, suatu barang sering dibeli dalam kemasan besar (Dus/Karton/Box) dan dijual dalam kemasan lebih kecil (Pak/Lusin/Pcs) atau sebaliknya.

### 1.1 Struktur Tabel Multi-Satuan
Tabel utama penyimpan konversi satuan adalah `tbl_itemsatuanjml` dan `tbl_itemsatuan`.

```
                    ┌─────────────────────────┐
                    │        tbl_item         │
                    │  kodeitem (PK)          │
                    │  satuan (Satuan Dasar)  │
                    │  hargapokok (HPP Dasar) │
                    │  hargajual1             │
                    └────────────┬────────────┘
                                 │ 1
                                 │
                                 │ N
                    ┌────────────┴────────────┐
                    │    tbl_itemsatuanjml    │
                    ├─────────────────────────┤
                    │ iddetail (PK)           │
                    │ kodeitem (FK)           │
                    │ satuan                  │
                    │ jumlahkonv              │
                    │ kodebarcode             │
                    │ hargapokok              │
                    │ tipe ('D' / 'K')        │
                    │ komisisales             │
                    └─────────────────────────┘
```

- **Tipe Satuan**:
  - `'D'` (**Dasar / Terkecil**): Satuan terendah yang menjadi basis inventaris/kartu stok (misal `PCS`). Nilai `jumlahkonv` selalu `1.000`.
  - `'K'` (**Konversi / Turunan**): Satuan kemasan yang lebih besar (misal `SETS`, `DUS`, `PAK`). Nilai `jumlahkonv` adalah faktor pengali terhadap satuan dasar (misal `4.000` berarti 1 SETS = 4 PCS).
- **Barcode Unik per Kemasan**:
  - Kolom `kodebarcode` dapat diisi barcode berbeda untuk setiap satuan. Misalnya:
    - Barcode `8991234567890` -> 1 PCS
    - Barcode `8991234567899` -> 1 DUS (isi 24 PCS)
  - Mesin POS kasir secara otomatis mengidentifikasi satuan transaksi berdasarkan barcode yang dipindai.

### 1.2 Rumus Konversi Kuantitas
Untuk mengonversi kuantitas dari Satuan A ($S_A$) ke Satuan B ($S_B$):

$$\text{Qty Dasar} = \text{Qty}_A \times \text{jumlahkonv}_A$$

$$\text{Qty}_B = \frac{\text{Qty Dasar}}{\text{jumlahkonv}_B} = \text{Qty}_A \times \frac{\text{jumlahkonv}_A}{\text{jumlahkonv}_B}$$

---

## 2. Matriks Penetapan Harga Bertingkat & Grup Pelanggan

iPos 4.0 menyediakan sistem penetapan harga yang fleksibel untuk mengakomodasi berbagai skenario bisnis:

### 2.1 Konfigurasi Sistem Harga Jual (`tbl_item.sistemhargajual`)
Kolom `sistemhargajual` di `tbl_item` menentukan logika pencarian harga saat transaksi POS/Penjualan:

| Kode | Tipe Penetapan | Keterangan |
|---|---|---|
| `'O'` | **Satu Harga (One Price)** | Menggunakan `hargajual1` dasar dari tabel `tbl_item` tanpa tier kuantitas. |
| `'S'` | **Berdasarkan Satuan** | Harga disesuaikan per satuan di `tbl_itemsatuanjml` atau `tbl_itemhj`. |
| `'J'` | **Berdasarkan Jumlah (Tiered Qty)** | Harga grosir bertingkat berdasarkan kuantitas yang dibeli (disimpan di `tbl_itemhj` dengan `tipehj = 'J'`). |
| `'L'` | **Berdasarkan Level Harga Pelanggan** | Harga berbeda untuk tiap golongan pelanggan (Level 1, 2, 3, 4) di `tbl_itemhj` (`tipehj = 'L'`). |

### 2.2 Kelompok Pelanggan & Level Harga (`tbl_supelgrup`)
Setiap pelanggan (`tbl_supel`) dapat diklasifikasikan ke dalam suatu grup (`kgrup`):

```sql
SELECT kgrup, grup, levelharga, potongan FROM tbl_supelgrup ORDER BY levelharga;
```

Data bawaan sistem:
1. **General**: `levelharga = 1`, `potongan = 0%` (Konsumen umum / eceran)
2. **Bronze**: `levelharga = 1`, `potongan = 6%` (Member reguler)
3. **Silver**: `levelharga = 2`, `potongan = 8%` (Pelanggan semi-grosir)
4. **Gold**: `levelharga = 3`, `potongan = 10%` (Distributor / grosir utama)

### 2.3 Tabel Detail Harga Bertingkat (`tbl_itemhj`)
Tabel `tbl_itemhj` menampung aturan harga dinamis per item:
- `tipehj`: `'J'` (Berdasarkan rentang jumlah) atau `'L'` (Berdasarkan level harga 1-4).
- `jmlsampai`: Batas atas kuantitas untuk tier tersebut.
- `level`: Level harga (1, 2, 3, 4).
- `prosentase`: Persentase markup di atas HPP.
- `satuan`: Satuan yang berlaku.
- `hargajual`: Nominal harga jual fix untuk tier tersebut.

### 2.4 Alur Resolusi Harga (Price Resolution Flow)
1. Periksa `kgrup` pelanggan -> dapatkan `levelharga` dan `potongan (%)`.
2. Jika item menggunakan `sistemhargajual = 'L'`: cari `tbl_itemhj` dengan `tipehj = 'L'` dan `level = customer.levelharga`.
3. Jika item menggunakan `sistemhargajual = 'J'`: cari `tbl_itemhj` dengan `tipehj = 'J'` di mana `qty <= jmlsampai` terendah yang mencakup qty.
4. Jika tidak ada tier khusus atau `sistemhargajual = 'O'`: gunakan `tbl_item.hargajual1 * jumlahkonv`.
5. Terapkan diskon kelompok pelanggan:
   $$\text{Harga Akhir} = \text{Harga Satuan} \times \left(1 - \frac{\text{potongan}}{100}\right)$$

---

## 3. Manajemen Nomor Seri / IMEI / SN Garansi

Untuk produk bernilai tinggi seperti elektronik, mesin, suku cadang spesifik, atau smartphone, iPos 4.0 melacak pergerakan unit secara individual menggunakan Nomor Seri (Serial Number / IMEI).

### 3.1 Struktur Data Nomor Seri
- Diaktifkan per item dengan flag `tbl_item.serial = 'Y'` (atau boolean).
- **Master Serial (`tbl_itemserial`)**:
  - `noserial`: Nomor seri / IMEI unik produk.
  - `kodeitem`: Referensi produk di `tbl_item`.
  - `stsada`: Status ketersediaan di gudang (`TRUE` = Ada di stok, `FALSE` = Sudah terjual/keluar).
  - `stsmasuk`: Status penerimaan barang.
  - `stskeluar`: Status pengeluaran barang.
  - `notrsm`: No Transaksi Masuk (Pembelian `tbl_belihd` atau Stok Awal `tbl_stokawalhd`).
  - `notrsrk`: No Retur Keluar (Retur Pembelian).
  - `notrsop`: No Stok Opname.
  - `kodekantor`: Kode cabang / kantor tempat serial berada.
- **Detail Mutasi Serial (`tbl_itemserialdt`)**:
  - Mencatat riwayat perpindahan lengkap: mutasi masuk (`notransfin`), mutasi keluar (`notransfout`), retur jual (`notrsrm`), penjualan (`notrsk`), rakitan (`notrskrakit`).

### 3.2 Siklus Hidup Nomor Seri (Lifecycle)
```
[Pembelian / Inflow]
       │
       ▼
tbl_itemserial (stsada = true, notrsm = 'BL...')
       │
       ├──────────────► [Transfer Gudang] ──► tbl_itemserialdt (notransfin/out)
       │
       ▼
[Penjualan / Kasir]
       │
       ▼
tbl_itemserial (stsada = false, notrsk = 'JL...')
       │
       ├──────────────► [Retur Jual] ────────► tbl_itemserial (stsada = true, notrsrm = 'RJ...')
       │
       ▼
[Klaim Garansi / Audit Trace]
Pencarian `noserial` menampilkan tanggal beli, tanggal jual, dan sisa masa garansi.
```

---

## 4. Paket Rakitan / Bundling / BOM Manufaktur Sederhana

iPos 4.0 mendukung fitur perakitan (Assembly / Bill of Materials) untuk memproduksi barang baru dari kumpulan komponen bahan baku (misal: Komputer Rakitan, Paket Parcel, atau Set Mesin).

### 4.1 Definisi Formula Rakitan (`tbl_itemrakitan`)
- `kodeitem`: Kode item induk (Barang Hasil Rakitan).
- `kodeitemrakitan`: Kode item anak (Bahan Baku / Komponen).
- `jumlah`: Kuantitas komponen yang dibutuhkan untuk menghasilkan 1 unit item induk.
- `satuan`: Satuan komponen.
- `harga`: Estimasi HPP komponen.
- `total`: `jumlah * harga`.

### 4.2 Proses Transaksi Perakitan
Saat transaksi perakitan diproses:
1. **Komponen Keluar (`tbl_ikrakitan`)**:
   Stok setiap bahan baku berkurang secara FIFO, kartu stok mencatat transaksi pengeluaran tipe `RAKIT-OUT`.
2. **Barang Jadi Masuk (`tbl_imrakitan`)**:
   Stok item induk bertambah sebanyak jumlah yang dirakit, kartu stok mencatat penerimaan tipe `RAKIT-IN` dengan HPP sebesar akumulasi total HPP bahan baku yang dipakai.

---

## 5. Zonasi Wilayah & Klasifikasi Wilayah Pelanggan

Untuk manajemen logistik, distribusi, dan sales kanvasing, pelanggan dapat dikelompokkan berdasarkan wilayah geografis:
- `tbl_supel_wil`: Menyimpan kode dan nama wilayah (contoh: DKI Jakarta, Jawa Barat, Jawa Timur).
- `tbl_supel_subwil`: Menyimpan sub-wilayah atau rayon distribusi (contoh: Jakarta Utara, Bandung Barat, Surabaya Timur).
- `tbl_supel`: Menyimpan asosiasi via kolom `kdwilayah` dan `kdsubwil`.

Hal ini memudahkan pelaporan penjualan per rayon, rute pengiriman barang, dan penugasan koordinator sales (`kdsales_kordinator`).
