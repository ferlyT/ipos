# PANDUAN BUSINESS INTELLIGENCE (BI), LAPORAN PROFITABILITAS & ANALITIK EKSEKUTIF IPOS 4.0

Dokumen ini merupakan panduan arsitektur analitis tingkat tinggi dan *Business Intelligence (BI)* untuk sistem iPos 4.0, mengolah data transaksional dari database PostgreSQL (`i4_barunatrial`) menjadi wawasan strategis eksekutif: **Profitabilitas Riil, Klasifikasi Inventaris ABC, Deteksi Dead Stock, dan Retensi Pelanggan (Churn Risk)**.

---

## 1. Analisis Profitabilitas Riil (Gross Profit & Margin Engine)

Laporan laba kotor di iPos 4.0 membandingkan omzet riil penjualan bersih terhadap Harga Pokok Penjualan (HPP) berbasis metode penilaian persediaan FIFO.

### 1.1 Formula Matematis Profitabilitas

$$\text{Omzet Bersih} = \sum (\text{jumlah} \times \text{harga}) - \text{potongan} - \text{potfaktur}$$

$$\text{HPP Riil (COGS)} = \sum (\text{jumlah} \times \text{hargapokok})$$

$$\text{Laba Kotor (Gross Profit)} = \text{Omzet Bersih} - \text{HPP Riil}$$

$$\text{Margin Laba Kotor (\%)} = \left( \frac{\text{Laba Kotor}}{\text{Omzet Bersih}} \right) \times 100\%$$

### 1.2 Dimensi Analisis Profitabilitas
1. **Per Item Produk**: Mengetahui produk mana yang menjadi *Star* (omzet tinggi, margin tinggi), *Cash Cow* (omzet tinggi, margin rendah), dan *Dog/Loss Leader* (margin tipis atau minus).
2. **Per Kategori / Jenis Barang (`tbl_itemjenis`)**: Mengukur kontribusi lini produk (misal: `LINER` menyumbang margin rata-rata 52.9%, sedangkan `ELEMENT OIL COOLER` 36.2%).
3. **Per Merek (`tbl_itemmerek`)**: Membandingkan profitabilitas suku cadang OEM (Mitsubishi, Nissan) vs aftermarket (Titan, NPR, Izumi).

---

## 2. Klasifikasi Inventaris ABC & Deteksi Dead Stock (Stok Mati)

Prinsip Pareto (Aturan 80/20) diterapkan pada perputaran inventaris toko untuk mengoptimalkan modal kerja (*Working Capital*).

```
                      ┌───────────────────────────────────────┐
                      │    Klasifikasi Inventaris ABC         │
                      └──────────────────┬────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
     [Kelas A]                       [Kelas B]                       [Kelas C]
  Top 80% Omzet                   Berikutnya 15% Omzet            Sisa 5% Omzet & Dead Stock
  ~10-20% Jumlah SKU              ~20-30% Jumlah SKU              ~50-70% Jumlah SKU
  • Fast Moving                   • Medium Moving                 • Slow Moving / Dead Stock
  • Stok pengaman tinggi          • Stok pengaman moderat         • Stop reorder, cuci gudang
```

### 2.1 Deteksi Dead Stock (Stok Mati Mengendap)
Item dikategorikan sebagai **Dead Stock** jika:
1. Saldo stok fisik di gudang $> 0$ (`tbl_itemstok.stok > 0`).
2. Tidak memiliki transaksi penjualan sama sekali dalam kurun waktu $\ge 180$ hari terakhir.
3. **Modal Mengendap (Trapped Capital)** dihitung sebagai:
   $$\text{Trapped Capital} = \text{Stok Fisik} \times \text{HPP Terakhir}$$

Rekomendasi tindakan eksekutif untuk Dead Stock:
- Diskon cuci gudang (*clearance sale*).
- Bundling / rakitan paket dengan item Kelas A.
- Negosiasi retur konsinyasi ke supplier.

---

## 3. Customer Intelligence & Churn Risk Analytics

Dalam bisnis suku cadang dan perdagangan b2b/grosir, mempertahankan pelanggan setia bernilai jauh lebih tinggi daripada mengakuisisi pelanggan baru (*Customer Acquisition Cost* vs *Retention*).

### 3.1 Metrik Pelanggan Kunci
1. **Customer Lifetime Value (CLV)**: Total akumulasi omzet belanja pelanggan sepanjang sejarah transaksi (`lifetime_spend`).
2. **Average Order Value (AOV / Basket Size)**: Rata-rata nilai belanja per transaksi:
   $$\text{AOV} = \frac{\text{Total Omzet Belanja}}{\text{Frekuensi Faktur}}$$
3. **Days Since Last Purchase (Recency)**: Jumlah hari sejak tanggal transaksi terakhir hingga hari ini.

### 3.2 Deteksi Pelanggan Berisiko Hilang (Churn Risk / Dormant)
Pelanggan VIP yang memiliki kontribusi omzet tinggi namun tidak melakukan pembelian dalam $> 90$ hari terakhir diklasifikasikan sebagai **High Churn Risk**.

Sistem memberikan daftar prioritas kepada tim sales kanvas untuk segera melakukan tindak lanjut:
- Pengecekan kepuasan layanan dan ketersediaan barang.
- Penawaran harga tier khusus atau penyesuaian plafon kredit.
- Penagihan sisa saldo piutang tertunggak jika ada.
