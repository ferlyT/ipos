# Laporan Hasil Audit Diagnostik Database iPos 4.0

- **Database**: `i4_barunatrial`
- **Tanggal Audit**: 2026-10-30T06:50:06.773Z
- **Total Anomali Terdeteksi**: **47**
  - **CRITICAL**: 35 (Penyebab Neraca / Laba Rugi Rusak atau Tidak Seimbang)
  - **WARNING**: 10 (Distorsi Nilai / HPP / Saldo Kas Minus)
  - **INFO**: 2 (Selisih Pembulatan Minor)

---

## Ringkasan Finansial Populasi Data

| Parameter Finansial | Nilai Audit |
| :--- | :--- |
| **Total Omset Penjualan (5.457 Faktur)** | Rp 20.515.203.818,49 |
| **Total Nilai Pembelian (3.057 Faktur)** | Rp 14.600.433.187,64 |
| **Akumulasi Saldo Kas/Bank Minus** | Rp 1.143.514.430,45 |
| **Potensi Margin Hilang (Jual Rugi)** | Rp 226.631.529,3 (1293 baris) |
| **Faktur Beli Belum Terjurnal** | Rp 0 (0 faktur) |

---

## Ringkasan per Domain Audit

| Domain | Jumlah Temuan |
| :--- | :---: |
| **1. Audit Penjualan (Sales)** | 22 |
| **2. Audit Pembelian (Purchases)** | 5 |
| **3. Audit Kas & Bank (Likuiditas & Flag Akun)** | 14 |
| **4. Integritas Persediaan & HPP** | 4 |
| **5. Rekonsiliasi Buku Pembantu Piutang / Hutang** | 2 |
| **6. Integritas Jurnal & Bagan Akun (COA)** | 0 |
| **7. Sinkronisasi Pembayaran Kas** | 0 |
| **8. Validitas Periode & Tanggal Transaksi** | 0 |

---

## 1. Temuan Audit Penjualan
| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |
| :---: | :---: | :--- | :--- | :--- |
| 1 | INFO | `SALES_EMPTY_DETAIL` | **113 Faktur Penjualan Kosong / Saldo Awal Terbengkalai**<br>Ditemukan 113 faktur penjualan dengan total Rp 0 dan tanpa detail item barang (sebagian besar transaksi historis/setup awal sebelum 2022). Tidak mempengaruhi nominal uang di neraca namun mengotori nomor urut faktur. | Lakukan pembersihan data historis atau biarkan jika diperlukan untuk kontinuitas nomor faktur terdahulu. |
| 2 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 S (0044/JL/UTM/0122)**<br>Item 'TANK HO LONG 160 S' dijual seharga Rp 18.700.000 padahal HPP tercatat Rp 23.357.900 (Selisih minus: Rp 4.657.900/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 4.657.900. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 3 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 L (0167/JL/UTM/0322)**<br>Item 'TANK HO LONG 160 L' dijual seharga Rp 21.000.000 padahal HPP tercatat Rp 22.550.000 (Selisih minus: Rp 1.550.000/satuan). Jumlah terjual: 3. Total potensi kerugian kotor pada baris ini: Rp 4.650.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 4 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 S (0015/JL/UTM/0122)**<br>Item 'TANK HO LONG 160 S' dijual seharga Rp 19.000.000 padahal HPP tercatat Rp 23.357.900 (Selisih minus: Rp 4.357.900/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 4.357.900. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 5 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: ISI TANK 190 L (1917/JL/UTM/1023)**<br>Item 'ISI TANK 190 L' dijual seharga Rp 14.300.000 padahal HPP tercatat Rp 18.150.000 (Selisih minus: Rp 3.850.000/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 3.850.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 6 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: YANMAR TF300H (4169/JL/UTM/0925)**<br>Item 'YANMAR TF300H' dijual seharga Rp 43.738.738 padahal HPP tercatat Rp 47.500.000 (Selisih minus: Rp 3.761.262/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 3.761.262. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 7 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 S (2425/JL/UTM/0524)**<br>Item 'TANK HO LONG 160 S' dijual seharga Rp 19.800.000 padahal HPP tercatat Rp 23.357.900 (Selisih minus: Rp 3.557.900/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 3.557.900. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 8 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 S (1439/JL/UTM/0623)**<br>Item 'TANK HO LONG 160 S' dijual seharga Rp 20.000.000 padahal HPP tercatat Rp 23.357.900 (Selisih minus: Rp 3.357.900/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 3.357.900. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 9 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 160 S (1391/JL/UTM/0523)**<br>Item 'TANK HO LONG 160 S' dijual seharga Rp 21.000.000 padahal HPP tercatat Rp 23.357.900 (Selisih minus: Rp 2.357.900/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 2.357.900. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 10 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: CLUTCH DISC SET D300(KAMPAS) (2327/JL/UTM/0424)**<br>Item 'CLUTCH DISC SET D300(KAMPAS)' dijual seharga Rp 1.370.000 padahal HPP tercatat Rp 1.750.000 (Selisih minus: Rp 380.000/satuan). Jumlah terjual: 5. Total potensi kerugian kotor pada baris ini: Rp 1.900.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 11 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: LINER EK100 F/W NPR (1916/JL/UTM/1023)**<br>Item 'LINER EK100 F/W NPR' dijual seharga Rp 950.000 padahal HPP tercatat Rp 1.100.000 (Selisih minus: Rp 150.000/satuan). Jumlah terjual: 12. Total potensi kerugian kotor pada baris ini: Rp 1.800.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 12 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 190L (0015/JL/UTM/0122)**<br>Item 'TANK HO LONG 190L' dijual seharga Rp 29.000.000 padahal HPP tercatat Rp 30.800.000 (Selisih minus: Rp 1.800.000/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.800.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 13 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 190L (0239/JL/UTM/0322)**<br>Item 'TANK HO LONG 190L' dijual seharga Rp 29.000.000 padahal HPP tercatat Rp 30.800.000 (Selisih minus: Rp 1.800.000/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.800.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 14 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 190L (0459/JL/UTM/0622)**<br>Item 'TANK HO LONG 190L' dijual seharga Rp 29.000.000 padahal HPP tercatat Rp 30.800.000 (Selisih minus: Rp 1.800.000/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.800.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 15 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: TANK HO LONG 190L (0371/JL/UTM/0522)**<br>Item 'TANK HO LONG 190L' dijual seharga Rp 29.000.000 padahal HPP tercatat Rp 30.800.000 (Selisih minus: Rp 1.800.000/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.800.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 16 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: WATER TANK CAP HL 160 POLOS (2337/JL/UTM/0424)**<br>Item 'WATER TANK CAP HL 160 POLOS' dijual seharga Rp 900.000 padahal HPP tercatat Rp 2.678.800 (Selisih minus: Rp 1.778.800/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.778.800. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 17 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: WATER TANK CAP HL 160 POLOS (1995/JL/UTM/1223)**<br>Item 'WATER TANK CAP HL 160 POLOS' dijual seharga Rp 900.000 padahal HPP tercatat Rp 2.678.800 (Selisih minus: Rp 1.778.800/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.778.800. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 18 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: WATER TANK CAP HL 160 POLOS (1758/JL/UTM/0923)**<br>Item 'WATER TANK CAP HL 160 POLOS' dijual seharga Rp 900.000 padahal HPP tercatat Rp 2.678.800 (Selisih minus: Rp 1.778.800/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.778.800. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 19 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: WATER COOLER KH400 ADV (0996/JL/UTM/1222)**<br>Item 'WATER COOLER KH400 ADV' dijual seharga Rp 10.800.000 padahal HPP tercatat Rp 12.566.400 (Selisih minus: Rp 1.766.400/satuan). Jumlah terjual: 1. Total potensi kerugian kotor pada baris ini: Rp 1.766.400. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 20 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: POMPA KEONG 2'' PC8000 KIRI (2383/JL/UTM/0424)**<br>Item 'POMPA KEONG 2'' PC8000 KIRI' dijual seharga Rp 2.475.000 padahal HPP tercatat Rp 3.350.000 (Selisih minus: Rp 875.000/satuan). Jumlah terjual: 2. Total potensi kerugian kotor pada baris ini: Rp 1.750.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 21 | **CRITICAL** | `SALES_BELOW_COST` | **Penjualan di Bawah HPP: POMPA KEONG 2'' PC8000 KIRI (2537/JL/UTM/0624)**<br>Item 'POMPA KEONG 2'' PC8000 KIRI' dijual seharga Rp 2.500.000 padahal HPP tercatat Rp 3.350.000 (Selisih minus: Rp 850.000/satuan). Jumlah terjual: 2. Total potensi kerugian kotor pada baris ini: Rp 1.700.000. | Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir. |
| 22 | *WARNING* | `SALES_BELOW_COST` | **Rekapitulasi: 1293 Transaksi Terindikasi Jual Rugi (Total Margin Minus: Rp 226.631.529,3)**<br>Terdapat total 1293 baris penjualan barang yang dijual di bawah HPP dengan akumulasi kebocoran margin laba kotor sebesar Rp 226.631.529,3. | Tinjau aturan batasan diskon maksimal kasir di menu Pengaturan Pengguna iPos 4 agar sistem menolak transaksi yang harga jualnya di bawah HPP. |



## 2. Temuan Audit Pembelian
| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |
| :---: | :---: | :--- | :--- | :--- |
| 1 | INFO | `PURCHASE_EMPTY_DETAIL` | **67 Faktur Pembelian Kosong / Saldo Awal Terbengkalai**<br>Ditemukan 67 faktur pembelian dengan nominal Rp 0 tanpa rincian barang (sebagian besar rekaman setup awal sebelum 2022). | Biarkan sebagai riwayat log atau bersihkan bila ingin merapikan database. |
| 2 | *WARNING* | `PURCHASE_ZERO_PRICE` | **Pembelian Harga Rp 0: METAL JALAN RD/RE/RF8/10 STD (2671/BL/UTM/0126)**<br>Item 'METAL JALAN RD/RE/RF8/10 STD' dibeli dengan harga Rp 0 sebanyak 1 unit pada faktur 2671/BL/UTM/0126 (tgl: 2026-01-02 14:02:16, supplier: SU0064). Hal ini dapat merusak kalkulasi metode rata-rata (moving average) HPP menjadi turun drastis. | Jika ini bukan sampel gratis atau bonus resmi dari supplier, edit faktur 2671/BL/UTM/0126 dan isi harga beli sebenarnya. Jika memang bonus, pastikan perlakuan akuntansi persediaan disesuaikan. |
| 3 | *WARNING* | `PURCHASE_ZERO_PRICE` | **Pembelian Harga Rp 0: PISTON 4D30 STD (2113/BL/UTM/0125)**<br>Item 'PISTON 4D30 STD' dibeli dengan harga Rp 0 sebanyak 4 unit pada faktur 2113/BL/UTM/0125 (tgl: 2024-11-26 10:57:26, supplier: SU0064). Hal ini dapat merusak kalkulasi metode rata-rata (moving average) HPP menjadi turun drastis. | Jika ini bukan sampel gratis atau bonus resmi dari supplier, edit faktur 2113/BL/UTM/0125 dan isi harga beli sebenarnya. Jika memang bonus, pastikan perlakuan akuntansi persediaan disesuaikan. |
| 4 | *WARNING* | `PURCHASE_ZERO_PRICE` | **Pembelian Harga Rp 0: METAL JALAN RD/RE/RF8/10 STD (0934/BL/UTM/0423)**<br>Item 'METAL JALAN RD/RE/RF8/10 STD' dibeli dengan harga Rp 0 sebanyak 1 unit pada faktur 0934/BL/UTM/0423 (tgl: 2023-04-13 09:44:36, supplier: SU0048). Hal ini dapat merusak kalkulasi metode rata-rata (moving average) HPP menjadi turun drastis. | Jika ini bukan sampel gratis atau bonus resmi dari supplier, edit faktur 0934/BL/UTM/0423 dan isi harga beli sebenarnya. Jika memang bonus, pastikan perlakuan akuntansi persediaan disesuaikan. |
| 5 | *WARNING* | `PURCHASE_ZERO_PRICE` | **Pembelian Harga Rp 0: METAL DUDUK RD/RE/RF8 STD (0934/BL/UTM/0423)**<br>Item 'METAL DUDUK RD/RE/RF8 STD' dibeli dengan harga Rp 0 sebanyak 1 unit pada faktur 0934/BL/UTM/0423 (tgl: 2023-04-13 09:44:36, supplier: SU0048). Hal ini dapat merusak kalkulasi metode rata-rata (moving average) HPP menjadi turun drastis. | Jika ini bukan sampel gratis atau bonus resmi dari supplier, edit faktur 0934/BL/UTM/0423 dan isi harga beli sebenarnya. Jika memang bonus, pastikan perlakuan akuntansi persediaan disesuaikan. |



## 3. Temuan Audit Kas & Bank
| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |
| :---: | :---: | :--- | :--- | :--- |
| 1 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (7-3000 - PENDAPTAN LAIN)**<br>Akun 'PENDAPTAN LAIN' (Kelompok: 7) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '7-3000', dan hapus centang opsi 'Kas / Bank'. |
| 2 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (1-2300 - KENDARAAN)**<br>Akun 'KENDARAAN' (Kelompok: 1) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '1-2300', dan hapus centang opsi 'Kas / Bank'. |
| 3 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (1-2400 - PERALATAN)**<br>Akun 'PERALATAN' (Kelompok: 1) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '1-2400', dan hapus centang opsi 'Kas / Bank'. |
| 4 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (3-3000 - LABA TAHUN BERJALAN)**<br>Akun 'LABA TAHUN BERJALAN' (Kelompok: 3) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '3-3000', dan hapus centang opsi 'Kas / Bank'. |
| 5 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (3-2000 - LABA DITAHAN)**<br>Akun 'LABA DITAHAN' (Kelompok: 3) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '3-2000', dan hapus centang opsi 'Kas / Bank'. |
| 6 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (5-1100 - HARGA POKOK PENJUALAN)**<br>Akun 'HARGA POKOK PENJUALAN' (Kelompok: 5) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '5-1100', dan hapus centang opsi 'Kas / Bank'. |
| 7 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (1-2500 - INVENTORY)**<br>Akun 'INVENTORY' (Kelompok: 1) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '1-2500', dan hapus centang opsi 'Kas / Bank'. |
| 8 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (7-4000 - KELEBIHAN PENERIMAAN PIUTANG)**<br>Akun 'KELEBIHAN PENERIMAAN PIUTANG' (Kelompok: 7) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '7-4000', dan hapus centang opsi 'Kas / Bank'. |
| 9 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (6-3003 - BIAYA BONUS KARYAWAN)**<br>Akun 'BIAYA BONUS KARYAWAN' (Kelompok: 6) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '6-3003', dan hapus centang opsi 'Kas / Bank'. |
| 10 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (6-3004 - BIAYA PEMBAGIAN KEUNTUNGAN)**<br>Akun 'BIAYA PEMBAGIAN KEUNTUNGAN' (Kelompok: 6) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '6-3004', dan hapus centang opsi 'Kas / Bank'. |
| 11 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (3-9100 - DEVIDEN)**<br>Akun 'DEVIDEN' (Kelompok: 3) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '3-9100', dan hapus centang opsi 'Kas / Bank'. |
| 12 | **CRITICAL** | `CSH_INVALID_FLAG` | **Salah Konfigurasi Flag Kas/Bank (1-1301 - PERSEDIAAN BARANG)**<br>Akun 'PERSEDIAAN BARANG' (Kelompok: 1) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi. | Buka menu Data Perkiraan di iPos 4, edit akun '1-1301', dan hapus centang opsi 'Kas / Bank'. |
| 13 | *WARNING* | `CSH_NEGATIVE_BALANCE` | **Saldo Kas/Bank Bernilai Minus (1-1120 - BANK BCA)**<br>Akun 'BANK BCA' memiliki akumulasi saldo minus sebesar Rp -903.729.085. Secara fisik uang kas tidak mungkin minus, dan di Neraca akan memunculkan nilai aset kas negatif yang aneh bagi pembaca laporan keuangan. | Lakukan rekonsiliasi rekening koran/buku kas. Periksa apakah ada transaksi penerimaan (penjualan tunai, transfer masuk, setoran modal) yang belum diinput atau terjadi pengeluaran ganda. Jika merupakan fasilitas cerukan/pinjaman bank (overdraft), pindahkan saldo kewajiban ke akun Hutang Bank (Kelompok 2). |
| 14 | *WARNING* | `CSH_NEGATIVE_BALANCE` | **Saldo Kas/Bank Bernilai Minus (1-1122 - BANK BCA HIP)**<br>Akun 'BANK BCA HIP' memiliki akumulasi saldo minus sebesar Rp -25.207.262,2. Secara fisik uang kas tidak mungkin minus, dan di Neraca akan memunculkan nilai aset kas negatif yang aneh bagi pembaca laporan keuangan. | Lakukan rekonsiliasi rekening koran/buku kas. Periksa apakah ada transaksi penerimaan (penjualan tunai, transfer masuk, setoran modal) yang belum diinput atau terjadi pengeluaran ganda. Jika merupakan fasilitas cerukan/pinjaman bank (overdraft), pindahkan saldo kewajiban ke akun Hutang Bank (Kelompok 2). |



## 4. Temuan Integritas Persediaan & HPP
| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |
| :---: | :---: | :--- | :--- | :--- |
| 1 | *WARNING* | `INV_ZERO_HPP` | **Harga Pokok (HPP) Rp 0: PISTON 4D30 (PISTON 4D30 STD)**<br>Item barang 'PISTON 4D30 STD' telah terjual tetapi tercatat memiliki Harga Pokok Rp 0. Hal ini menyebabkan HPP Penjualan di Laporan Laba Rugi menjadi Rp 0 dan Laba Kotor tercatat 100% (fiktif/terlalu tinggi). | Buka Master Data Item, perbarui 'Harga Pokok' item PISTON 4D30 sesuai dengan faktur pembelian atau harga beli modal riil, lalu jalankan menu 'Proses Ulang HPP' di iPos 4. |
| 2 | *WARNING* | `INV_ZERO_HPP` | **Harga Pokok (HPP) Rp 0: METAL JALAN 8DC11 (METAL JALAN 8DC11/81-92 DAIDO R6317K (0.25).)**<br>Item barang 'METAL JALAN 8DC11/81-92 DAIDO R6317K (0.25).' telah terjual tetapi tercatat memiliki Harga Pokok Rp 0. Hal ini menyebabkan HPP Penjualan di Laporan Laba Rugi menjadi Rp 0 dan Laba Kotor tercatat 100% (fiktif/terlalu tinggi). | Buka Master Data Item, perbarui 'Harga Pokok' item METAL JALAN 8DC11 sesuai dengan faktur pembelian atau harga beli modal riil, lalu jalankan menu 'Proses Ulang HPP' di iPos 4. |
| 3 | *WARNING* | `INV_ZERO_HPP` | **Harga Pokok (HPP) Rp 0: METAL DUDUK NISSAN STD (METAL DUDUK RD/RE/RF8 STD)**<br>Item barang 'METAL DUDUK RD/RE/RF8 STD' telah terjual tetapi tercatat memiliki Harga Pokok Rp 0. Hal ini menyebabkan HPP Penjualan di Laporan Laba Rugi menjadi Rp 0 dan Laba Kotor tercatat 100% (fiktif/terlalu tinggi). | Buka Master Data Item, perbarui 'Harga Pokok' item METAL DUDUK NISSAN STD sesuai dengan faktur pembelian atau harga beli modal riil, lalu jalankan menu 'Proses Ulang HPP' di iPos 4. |
| 4 | **CRITICAL** | `INV_OUTOFSTOCK_SALES` | **Penjualan Saat Stok Minus (507 Transaksi / 443 Item)**<br>Ditemukan 507 transaksi penjualan (1.998 unit barang pada 443 item berbeda) yang dilakukan saat stok habis/minus (flag: OUTOFSTOCK di tbl_item_ik). Total nilai HPP yang terdistorsi mencapai Rp 391.321.260,18. Penjualan mendahului input faktur pembelian merusak akurasi kartu stok dan perhitungan HPP FIFO. | Pastikan seluruh faktur pembelian diinput sesuai tanggal fisik barang diterima sebelum transaksi penjualan dibukukan. Di menu 'Pengaturan > Pengaturan Umum', ubah opsi 'Pengecekan Stok pada Penjualan' menjadi 'Stok habis tidak bisa dijual'. Setelah faktur beli lengkap, jalankan 'Proses Bulanan' dengan opsi 'Perbaikan Stok' dicentang. |



## 5. Temuan Rekonsiliasi Buku Pembantu (AP/AR)
| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |
| :---: | :---: | :--- | :--- | :--- |
| 1 | **CRITICAL** | `SUB_AR_DIFF` | **Selisih Total Piutang Faktur vs Akun Piutang Usaha (1-1210)**<br>Total sisa piutang pada kartu faktur pelanggan adalah Rp 7.715.401.373,49, sedangkan saldo akun Piutang Usaha (1-1210) di Buku Besar adalah Rp 7.360.284.458 (Selisih: Rp 355.116.915,49). Laporan Umur Piutang tidak cocok dengan Neraca. | Lakukan rekonsiliasi antara Laporan Buku Pembantu Piutang dengan Buku Besar Piutang. Periksa apakah ada faktur piutang yang dihapus/diedit tanpa membatalkan jurnal pelunasannya atau ada Jurnal Umum manual yang langsung memotong akun 1-1210 tanpa lewat modul pembayaran piutang. |
| 2 | **CRITICAL** | `SUB_AP_DIFF` | **Selisih Total Hutang Faktur vs Akun Hutang Usaha (2-1101)**<br>Total sisa hutang pada faktur pembelian supplier adalah Rp 4.107.230.274,62, sedangkan saldo akun Hutang Usaha (2-1101) di Buku Besar adalah Rp 2.994.021.985,59 (Selisih: Rp 1.113.208.289,03). Laporan Buku Pembantu Hutang tidak cocok dengan Neraca. | Lakukan rekonsiliasi antara Laporan Buku Pembantu Hutang dengan Buku Besar Hutang. Periksa pembayaran hutang atau retur pembelian yang belum terjurnal dengan benar. |



## 6. Temuan Integritas Jurnal & Bagan Akun
_Tidak ada anomali terdeteksi pada kategori ini._



## 7. Temuan Sinkronisasi Pembayaran Kas
_Tidak ada anomali terdeteksi pada kategori ini._



## 8. Temuan Validitas Tanggal Transaksi
_Tidak ada anomali terdeteksi pada kategori ini._



---

## Panduan Tindak Lanjut Perbaikan

1. **Prioritas Utama: Anomali CRITICAL**
   - **Salah Flag Kas (CSH_INVALID_FLAG)**: Segera edit akun Laba Ditahan, HPP, dan Persediaan di Master Data Perkiraan dan hilangkan centang 'Kas/Bank'.
   - **Faktur Beli Belum Terjurnal (PURCHASE_UNPOSTED)**: Lakukan posting ulang modul pembelian.
   - **Jurnal Tidak Seimbang (JUR_UNBALANCED)**: Pastikan transaksi yang selisih debet-kredit diperbaiki agar Neraca kembali seimbang.

2. **Prioritas Kedua: Anomali WARNING**
   - **Saldo Kas Minus (CSH_NEGATIVE_BALANCE)**: Telusuri rekening koran bank atau fisik kas kecil. Masukkan mutasi transfer masuk yang belum terinput.
   - **Penjualan di Bawah HPP (SALES_BELOW_COST)**: Kunci hak akses kasir agar tidak dapat menjual barang di bawah harga pokok modal.
   - **HPP Barang Rp 0 (INV_ZERO_HPP)**: Masukkan modal harga pokok riil barang agar laba kotor tidak fiktif 100%.

_Laporan ini digenerate secara otomatis oleh sistem diagnostik database iPos 4 berbasis Bun & Drizzle ORM._
