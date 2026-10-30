# PANDUAN MULTI-GUDANG, TRANSFER ITEM, STOK OPNAME & KONSINYASI IPOS 4.0

Dokumen ini merupakan panduan arsitektur komprehensif mengenai tata kelola **Multi-Gudang (Cabang/Kantor), Mutasi Transfer Antar Gudang (`tbl_itrhd`/`dt`), Rekonsiliasi Stok Opname (`tbl_itemopname`), dan Alur Konsinyasi Masuk/Keluar** pada sistem iPos 4.0 dengan database PostgreSQL (`i4_barunatrial`).

---

## 1. Arsitektur Multi-Gudang & Multi-Cabang (`tbl_kantor`)

Dalam iPos 4.0, entitas gudang, toko, outlet, dan kantor pusat disimpan dalam tabel terpadu: `tbl_kantor`.

```
                  ┌──────────────────────┐
                  │      tbl_kantor      │
                  ├──────────────────────┤
                  │ kodekantor (PK)      │
                  │ namakantor           │
                  │ fungsi               │
                  │ alamat, notelepon    │
                  └──────────┬───────────┘
                             │ 1
                             │
                             │ N
                  ┌──────────┴───────────┐
                  │     tbl_itemstok     │
                  ├──────────────────────┤
                  │ kodeitem (FK)        │
                  │ kantor (FK)          │
                  │ stok (Saldo Fisik)   │
                  └──────────────────────┘
```

- **Fungsi Kantor**:
  - `Utama` (`UTM`): Kantor pusat / toko utama tempat kasir dan penjualan beroperasi.
  - `Gudang` (`GD`): Gudang transit / penyimpanan barang grosir.
  - `Cabang` (`CBG` / kode kustom): Toko cabang atau titik penjualan terpisah.
- **Isolasi Saldo Stok**:
  - Saldo stok fisik per lokasi disimpan di `tbl_itemstok (kodeitem, kantor, stok)`.
  - Saldo global perusahaan disimpan di `tbl_item.stok`, yang secara matematis adalah:
    $$\text{tbl\_item.stok} = \sum_{\text{kantor}} \text{tbl\_itemstok.stok}$$

---

## 2. Transfer Item Antar Gudang (`tbl_itrhd` & `tbl_itrdt`)

Fitur Transfer Item digunakan untuk memindahkan stok fisik dari satu lokasi gudang/cabang (`kantordari`) ke lokasi lain (`kantortujuan`) tanpa menimbulkan transaksi jual-beli.

### 2.1 Struktur Tabel Header & Detail
- **Header (`tbl_itrhd`)**:
  - `notransaksi`: Nomor bukti transfer (Format iPos: `[CNT]/TRF/[DEPT]/[BLNTHN]`, misal `0001/TRF/UTM/1026`).
  - `kodekantor`: Kantor pembuat transaksi.
  - `kantordari`: Gudang asal pengirim.
  - `kantortujuan`: Gudang tujuan penerima.
  - `tanggal`: Tanggal mutasi transfer.
  - `acc_persediaan`: Akun persediaan barang dagang (biasanya `1-1310`).
  - `totalitem`: Jumlah baris item yang ditransfer.
  - `user1`, `user2`: Petugas gudang pengirim dan penerima.
- **Detail (`tbl_itrdt`)**:
  - `iddetail`: ID unik baris transaksi.
  - `nobaris`: Nomor urut item.
  - `notransaksi`: FK ke `tbl_itrhd`.
  - `kodeitem`: FK ke `tbl_item`.
  - `jumlah`: Kuantitas barang yang ditransfer.
  - `satuan`: Satuan yang digunakan.
  - `harga`: Nilai HPP satuan saat ditransfer (diperoleh dari batch FIFO gudang asal).
  - `total`: `jumlah * harga`.

### 2.2 Dampak Transfer terhadap FIFO & Kartu Stok
Transfer item harus menjaga integritas HPP secara FIFO antar gudang:

```
[Gudang Asal (kantordari)]                       [Gudang Tujuan (kantortujuan)]
        │                                                     ▲
        ▼ (Pengeluaran Stok)                                  │ (Penerimaan Stok)
tbl_itemstok.stok -= qty                              tbl_itemstok.stok += qty
        │                                                     │
        ▼                                                     │
tbl_item_ik (tipe = 'TR')                             tbl_item_im (tipe = 'TR')
Alokasi batch FIFO lama                               Batch FIFO baru
(konsumsi sisa tbl_item_im) ─────────────────────────► Masuk dengan HPP dari batch asal
```

1. **Gudang Asal**:
   - `tbl_itemstok` untuk `kantordari` berkurang sejumlah `jumlah`.
   - Transaksi pengeluaran dicatat di `tbl_item_ik` dengan `tipe = 'TR'`.
   - Batch `tbl_item_im` gudang asal diserap secara FIFO.
2. **Gudang Tujuan**:
   - `tbl_itemstok` untuk `kantortujuan` bertambah sejumlah `jumlah`.
   - Batch penerimaan baru dicatat di `tbl_item_im` dengan `tipe = 'TR'` dan `kodekantor = kantortujuan`. Nilai `hargadasar` mewarisi HPP dari batch yang keluar dari gudang asal.
3. **Stok Global Perusahaan**:
   - Nilai `tbl_item.stok` **tidak berubah**, karena perpindahan bersifat internal.

---

## 3. Rekonsiliasi Stok Opname (`tbl_itemopname`)

Stok Opname adalah proses audit berkala untuk menyamakan saldo buku sistem dengan kondisi fisik nyata di rak/gudang.

### 3.1 Struktur Tabel `tbl_itemopname`
- `iddetail`: ID unik pencatatan opname.
- `periode`: Periode bulan/tahun opname (misal: `202610`).
- `tanggal`: Tanggal eksekusi opname.
- `kodeitem`: Kode item yang dihitung.
- `kodekantor`: Lokasi fisik gudang yang diopname.
- `satuan`: Satuan hitung.
- `jmlsebelum`: Saldo stok sistem sebelum opname (`tbl_itemstok.stok`).
- `jmlfisik`: Hasil penghitungan fisik riil di gudang.
- `jmlselisih`: $\text{jmlfisik} - \text{jmlsebelum}$.
- `harga`: HPP satuan item.
- `total`: $\text{jmlselisih} \times \text{harga}$ (Nilai penyesuaian moneter).
- `kodeacc`: Akun penyeimbang jurnal (biasanya `5-1999` Beban Selisih Stok atau `8-1100` Pendapatan Selisih Stok).
- `user1`, `user2`: Petugas pencatat dan verifikator.

### 3.2 Logika Penyesuaian Selisih Stok
$$\Delta = \text{jmlfisik} - \text{jmlsebelum}$$

```
                           ┌─────────────────────────┐
                           │      Stok Opname        │
                           │ Δ = jmlfisik - jmlsebelum│
                           └────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼ (Δ > 0)                                     ▼ (Δ < 0)
        [SURPLUS / LEBIH]                             [DEFISIT / KURANG]
  Fisik lebih banyak dari sistem                Fisik lebih sedikit dari sistem
                 │                                             │
  • tbl_itemstok.stok += Δ                      • tbl_itemstok.stok -= |Δ|
  • tbl_item.stok += Δ                          • tbl_item.stok -= |Δ|
  • Buat batch baru di tbl_item_im              • Alokasi FIFO di tbl_item_ik
    (tipe = 'OP', qty = Δ)                        (tipe = 'OP', qty = |Δ|)
                 │                                             │
  JURNAL:                                       JURNAL:
  [Dr] Persediaan Barang                        [Dr] Beban Selisih/Kerusakan Stok
  [Cr] Pendapatan Selisih Persediaan            [Cr] Persediaan Barang
```

---

## 4. Alur Konsinyasi Masuk & Pembayaran Barang Laku (`KI`, `BHKI`, `RKI`)

Konsinyasi Masuk adalah skema titip jual di mana supplier (konsinyor) menitipkan barang dagangannya ke toko (konsinyi). Toko **hanya berhutang dan membayar atas barang yang telah laku terjual**.

### 4.1 Identifikasi Item Konsinyasi
- Di `tbl_item`, item konsinyasi ditandai dengan `konsinyasi = 'Y'`.
- Kolom `supplier1` mencatat kode supplier pemilik barang konsinyasi.

### 4.2 Tiga Tahap Transaksi Konsinyasi

```
                    1. Penerimaan Barang Titipan
              Supplier ───────────► tbl_imhd (tipe = 'KI')
                                    Format: [CNT]/KIN/[DEPT]/[BLNTHN]
                                    • Stok fisik bertambah
                                    • BELUM timbul hutang dagang
                                          │
                                          ▼
                                2. Penjualan ke Konsumen
                                    tbl_ikhd (tipe = 'JL')
                                    • Kasir menjual item konsinyasi
                                    • Stok fisik berkurang
                                          │
                                          ▼
                                3. Rekonsiliasi & Pembayaran
                                    tbl_byrhutangitem (jmllaku, jmlretur)
                                    tbl_byrhutanghd (tipe = 'BHKI')
                                    Format: [CNT]/HKI/[DEPT]/[BLNTHN]
                                    • Pembayaran hanya atas kuantitas laku
                                    • Sisa barang rusak/tidak laku diretur via RKI
```

1. **Penerimaan Konsinyasi Masuk (`KI`)**:
   - Bukti transaksi: `tbl_imhd` & `tbl_imdt` dengan `tipe = 'KI'` (Kode transaksi: `KIN`).
   - Saldo stok fisik masuk ke `tbl_itemstok` dan `tbl_item_im`.
   - Tidak ada jurnal hutang dagang pada saat barang diterima, karena kepemilikan barang masih berada pada supplier.
2. **Penjualan Kasir POS (`JL`)**:
   - Konsumen membeli barang konsinyasi melalui POS biasa (`tbl_ikhd` / `tbl_ikdt`).
   - Sistem mencatat pengurangan stok fisik dan akumulasi kuantitas penjualan item konsinyasi.
3. **Penyelesaian Pembayaran Konsinyasi (`BHKI`)**:
   - Dilakukan secara periodik (misal mingguan atau bulanan).
   - Sistem merekap total penjualan item konsinyasi:
     $$\text{Total Hutang Laku} = \sum (\text{jmllaku} \times \text{Harga Pokok Beli Konsinyasi})$$
   - Disimpan di:
     - `tbl_byrhutanghd`: Header pembayaran (tipe `BHKI`, `acc_bayar` = Kas/Bank).
     - `tbl_byrhutangdt`: Detail faktur penerimaan konsinyasi yang diselesaikan.
     - `tbl_byrhutangitem`: Rincian item per baris (`kodeitem`, `jmllaku`, `jmlretur`).
4. **Retur Konsinyasi Masuk (`RKI`)**:
   - Mengembalikan barang titipan yang tidak laku atau rusak ke supplier.
   - Mengurangi stok fisik di gudang tanpa mengurangi saldo kas/hutang pokok.
