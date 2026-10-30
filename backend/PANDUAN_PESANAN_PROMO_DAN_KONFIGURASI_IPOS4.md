# PANDUAN MODUL PESANAN (PO/SO), DISKON PROMOSI, & KONFIGURASI SISTEM GLOBAL IPOS 4.0

Dokumen ini melengkapi arsitektur fungsional iPos 4.0 dengan mendokumentasikan tiga komponen penting operasional perdagangan modern:
1. **Siklus Pemesanan (Purchase Order / PO & Sales Order / SO)** dengan pelacakan pemenuhan parsial (*partial fulfillment*) dan pemotongan uang muka (DP).
2. **Mesin Promosi & Diskon Berkala (*Periodic / Happy Hour Discounts*)** serta potongan kuantitas bertingkat (*Tiered Quantity Discounts*).
3. **Pusat Konfigurasi Sistem Operasional Global (`tbl_conf`)** yang mengatur *behavior* akuntansi, pembulatan harga, pajak, dan kontrol stok.

---

## 1. Arsitektur Siklus Pemesanan (PO & SO)

Pesanan pembelian dan penjualan tidak mempengaruhi kuantitas stok fisik maupun mutasi akuntansi persediaan secara langsung. Pesanan berfungsi sebagai komitmen dagang (*outstanding sales/purchase commitments*).

```
                      +-----------------------------+
                      |     PURCHASE ORDER (PO)     |
                      |   tbl_pesanhd (tipe = 'PO') |
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             |                                               |
             v                                               v
    [Pembayaran DP Pesanan]                       [Penerimaan Barang Parsial]
    Kas/Bank -> Uang Muka Beli                     tbl_imhd (Faktur Pembelian)
    (1-9100)                                       tbl_pesandt.jmlterima += Qty
             |                                               |
             +-----------------------+-----------------------+
                                     |
                                     v
                       [Faktur Pembelian Final]
                       - Potong Saldo Uang Muka DP
                       - Sisa Backlog PO Berkurang
                       - Jika jmlterima >= jumlah -> Status: Closed
```

### 1.1 Struktur Tabel Pesanan (`tbl_pesanhd` & `tbl_pesandt`)

| Kolom Header (`tbl_pesanhd`) | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `notransaksi` | VARCHAR(25) | Nomor transaksi unik (e.g. `PO-202610-0001`, `SO-202610-0001`) |
| `tipe` | VARCHAR(2) | `'PO'` = Pesanan Pembelian, `'SO'` = Pesanan Penjualan |
| `tanggal` | DATE / TIMESTAMP | Tanggal pemesanan dibuat |
| `tanggalkirim` | DATE / TIMESTAMP | Estimasi tanggal pengiriman / kedatangan barang (*due date*) |
| `kodesupel` | VARCHAR(20) | Kode Supplier (jika PO) atau Kode Pelanggan (jika SO) |
| `totalitem` | NUMERIC | Total kuantitas barang yang dipesan |
| `totalterima` | NUMERIC | Total kuantitas barang yang sudah terealisasi (*received / delivered*) |
| `subtotal` | NUMERIC | Total nilai pesanan sebelum potongan dan pajak |
| `potfaktur` | NUMERIC | Potongan diskon faktur global |
| `pajak` | NUMERIC | Nilai PPN (default 11% sesuai konfigurasi) |
| `dppesanan` | NUMERIC | Nilai Uang Muka (Down Payment) yang disepakati |
| `dppesananbyr` | NUMERIC | Nilai Uang Muka yang sudah dibayar/diterima secara riil |
| `acc_dppesanan`| VARCHAR(20) | Akun Uang Muka (`1-9100` untuk PO, `2-3100` untuk SO) |
| `acc_dpkas` | VARCHAR(20) | Akun Kas/Bank sumber penerimaan/pembayaran DP |

| Kolom Detail (`tbl_pesandt`) | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `iddetail` | BIGINT (PK) | Auto-increment ID detail pesanan |
| `notransaksi` | VARCHAR(25) | Foreign key ke `tbl_pesanhd.notransaksi` |
| `nobaris` | INTEGER | Urutan baris item (1, 2, 3...) |
| `kodeitem` | VARCHAR(30) | Kode barang yang dipesan |
| `jumlah` | NUMERIC | Kuantitas barang yang dipesan |
| `jmlterima` | NUMERIC | Kuantitas barang yang telah dipenuhi (*fulfilled*) |
| `satuan` | VARCHAR(10) | Satuan pemesanan (PCS, BOX, DLL) |
| `harga` | NUMERIC | Harga satuan beli/jual yang disepakati |
| `total` | NUMERIC | Subtotal baris = `(jumlah * harga) - potongan` |

---

## 2. Mesin Promosi, Happy Hour & Diskon Kuantitas

iPos 4.0 menyediakan engine promosi fleksibel melalui dua mekanisme utama:

### 2.1 Diskon Berkala & Happy Hour (`tbl_itemdisp`)
Digunakan untuk promosi musiman, *flash sale*, atau diskon hari tertentu:
- `tgldari` & `tglsampai`: Batang rentang tanggal promo berlaku.
- `jamdari` & `jamsampai`: Filter jam berlaku promo (contoh: `14:00:00` s/d `17:00:00` untuk *Happy Hour*).
- `w1` s/d `w7`: Flag boolean untuk hari (w1=Senin, w2=Selasa, ..., w7=Minggu). Nilai `1` menandakan promo aktif di hari tersebut.
- `pot1`, `pot2`, `pot3`, `pot4`: Diskon bertingkat (contoh `pot1 = 10`, `pot2 = 5` berarti $10\% + 5\%$).
- `prioritas`: Jika satu item terkena lebih dari satu promo, promo dengan angka prioritas tertinggi yang akan dimenangkan.

### 2.2 Potongan Kuantitas Bertingkat (`tbl_itempotongan`)
Digunakan untuk *wholesale / volume pricing* berdasarkan grup pelanggan dan ambang kuantitas:
- `kodeitem`: Kode item yang diberi potongan kuantitas.
- `kodegrup`: Grup pelanggan (e.g. `'General'`, `'Grosir'`, `'Reseller'`).
- `jumlah`: Minimum kuantitas pembelian untuk membuka tier diskon.
- Formula Diskon Bertingkat:
  $$\text{Harga Setelah Diskon} = \text{Harga} \times (1 - \frac{\text{pot1}}{100}) \times (1 - \frac{\text{pot2}}{100})$$

---

## 3. Konfigurasi Sistem Operasional Global (`tbl_conf`)

Tabel `tbl_conf` menyimpan 56 parameter inti yang mengontrol perilaku aplikasi iPos 4.0:

| Kunci Konfigurasi (`confname`) | Nilai Database | Arti & Dampak Operasional |
| :--- | :--- | :--- |
| `CMP_NAMA` | `CV. BARUNA ARTHA LESTARI` | Nama resmi entitas perusahaan yang dicetak pada faktur & laporan. |
| `CMP_ALAMAT1` | `JL. CUMI RAYA BLOK B NO.1...` | Baris alamat 1 faktur/nota. |
| `METHOD_HPP` | `FIFO` | Metode valuasi persediaan resmi (`FIFO` / `AVERAGE`). |
| `DEFAULT_PAJAK_BELI` | `11` | Tarif default PPN Masukan (11%). |
| `DEFAULT_PAJAK_JUAL` | `11` | Tarif default PPN Keluaran (11%). |
| `DEF_JATUH_TEMPO` | `10` | Default masa kredit penjualan/pembelian tempo (10 hari). |
| `DEF_PEL_UMUM` | `UMUM` | Kode pelanggan tunai kasir (*walk-in customer*). |
| `STOK_CEK` | `3` | Kebijakan kontrol stok minus (3 = peringatan & pembatasan kasir). |
| `TRS_JUAL_KONFIRM_HP` | `1` | Wajib konfirmasi jika kasir menjual di bawah harga pokok/HPP. |
| `CFG_AKTIF_PEMBULATAN` | `1` | Mengaktifkan aturan pembulatan nominal total belanja kasir. |
| `PIL_OPSI_NILAI_PEMBULATAN` | `3` | Opsi pembulatan (e.g. pembulatan ke ratusan terdekat). |
| `ACC_MU_UTAMA` | `IDR` | Mata uang dasar pembukuan akuntansi. |
| `ACC_START_YEAR` / `CURRENT`| `2022` / `2027` | Rentang tahun buku pembukuan aktif. |

---

## 4. Kesimpulan Rekonstruksi

Dengan selesainya implementasi modul pemesanan (PO/SO), mesin promo berkala, dan parser konfigurasi global ini, seluruh spektrum fungsionalitas dan arsitektur database iPos 4.0 telah **100% tuntas dipetakan, diuji, dan direkonstruksi** ke dalam antarmuka TypeScript / Bun / Drizzle ORM modern.
