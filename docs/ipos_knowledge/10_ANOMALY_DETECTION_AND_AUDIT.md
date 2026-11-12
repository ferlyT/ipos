# 🔍 Modul 10: Deteksi Anomali, Audit Integritas Data & Remediasi

> **Cakupan**: Aturan diagnostik integritas database (`backend/src/diagnostics/rules/`), katalog anomali umum (stok minus, jurnal unbalance, subledger mismatch), kueri audit SQL, dan prosedur remediasi data.

---

## 1. Engine Diagnostik & Audit Data iPos 4.0

Untuk menjaga keandalan operasional dan kepatuhan finansial, sistem dilengkapi mesin pemindai otomatis (*Diagnostic Scanner*) yang dapat dijalankan secara berkala atau menjelang proses Tutup Buku:

```bash
cd backend
bun run audit
bun run detect:stock-minus
```

Mesin ini memeriksa 8 pilar integritas data secara mendalam:
1. **Inventory**: Integritas stok fisik, HPP Rp 0, dan antrean FIFO.
2. **Journal**: Keseimbangan debit-kredit, akun header, dan akun yatim (*orphan accounts*).
3. **Sales**: Inkonsistensi pembayaran kasir dan diskon tidak wajar.
4. **Purchase**: Hutang menggantung dan selisih nota beli.
5. **Cash & Bank**: Rekening minus dan kas laci kasir belum ditutup.
6. **Subledger**: Sinkronisasi kartu piutang/hutang terhadap akun Buku Besar `1-1210` dan `2-1101`.
7. **Date**: Transaksi tanggal mundur (*backdated*) atau tanggal masa depan (*future-dated*).
8. **Sync**: Keselarasan stok fisik `tbl_itemstok` terhadap rak modern `wms_bin_stocks`.

---

## 2. Katalog Anomali Kritis & Langkah Remediasi

### 1. `INV_NEGATIVE_STOCK` (Stok Fisik Gudang Bernilai Minus)
- **Penyebab**: Pengaturan `ALLOW_MINUS_STOCK = 'Y'` diizinkan, kasir tetap menjual barang meski fisik belum di-input ke komputer, atau keterlambatan input faktur pembelian.
- **Dampak Finansial**: Perhitungan alokasi FIFO terganggu, HPP menjadi tidak terdefinisi, dan nilai aset persediaan di Neraca Keuangan menjadi terdistorsi ke bawah.
- **Kueri Audit**:
  ```sql
  SELECT s.kodeitem, i.namaitem, s.kantor, s.stok 
  FROM tbl_itemstok s
  JOIN tbl_item i ON s.kodeitem = i.kodeitem
  WHERE s.stok < 0;
  ```
- **Langkah Remediasi**:
  1. Input faktur pembelian yang belum tercatat (dengan tanggal mendahului tanggal penjualan).
  2. Atau lakukan **Stok Opname Penyesuaian** pada menu Persediaan untuk mengembalikan stok ke kuantitas fisik riil.

---

### 2. `JUR_UNBALANCED` (Buku Jurnal Tidak Seimbang)
- **Penyebab**: Transaksi terputus di tengah jalan (*network timeout*), bug pembulatan desimal kasir, atau injeksi data manual tanpa transaksi atomik.
- **Dampak Finansial**: Laporan Neraca Keuangan menjadi **TIDAK SEIMBANG / TIDAK BALANCE** (Total Aktiva $\ne$ Total Pasiva).
- **Kueri Audit**:
  ```sql
  SELECT 
    notransaksi,
    DATE(tanggal) AS tgl,
    SUM(debet) AS total_debet,
    SUM(kredit) AS total_kredit,
    ABS(SUM(debet) - SUM(kredit)) AS selisih
  FROM tbl_accjurnal
  GROUP BY notransaksi, DATE(tanggal)
  HAVING ABS(SUM(debet) - SUM(kredit)) > 0.001
  ORDER BY selisih DESC;
  ```
- **Langkah Remediasi**:
  - Jika selisih $\le$ Rp 10 (biasanya pembulatan kasir): Posting jurnal penyesuaian selisih pembulatan ke akun `8-1100`.
  - Jika selisih besar: Telusuri dokumen sumber transaksi (`tbl_ikhd`, `tbl_imhd`, atau `tbl_acckashd`), perbaiki nilai baris ayat jurnal yang hilang.

---

### 3. `JUR_HEADER_POST` (Posting ke Akun Header)
- **Penyebab**: Kesalahan konfigurasi pada `tbl_perksetting` di mana akun bertipe `'H'` (Header) dipetakan sebagai akun transaksi otomatis.
- **Dampak Finansial**: Buku besar tidak dapat menampilkan rincian sub-akun secara benar dan laporan keuangan berjenjang menjadi kacau.
- **Kueri Audit**:
  ```sql
  SELECT j.notransaksi, j.kodeacc, p.namaacc, j.debet, j.kredit, j.tanggal
  FROM tbl_accjurnal j
  JOIN tbl_perkiraan p ON j.kodeacc = p.kodeacc
  WHERE p.tipe = 'H';
  ```
- **Langkah Remediasi**:
  1. Ganti pemetaan akun default pada `tbl_perksetting` ke akun detail bertipe `'D'`.
  2. Update baris jurnal pada `tbl_accjurnal` dengan mengganti `kodeacc` ke akun detail yang tepat.

---

### 4. `INV_ZERO_HPP` (Item Terjual dengan HPP Rp 0)
- **Penyebab**: Master barang dibuat tanpa input harga beli awal dan dijual sebelum ada faktur penerimaan barang pertama kali.
- **Dampak Finansial**: Laba Kotor di Laporan Laba Rugi membengkak secara fiktif (*100% Margin*), mengakibatkan kewajiban pajak dilaporkan terlalu tinggi.
- **Kueri Audit**:
  ```sql
  SELECT dt.notransaksi, dt.kodeitem, i.namaitem, dt.jumlah, dt.harga, dt.hpp
  FROM tbl_ikdt dt
  JOIN tbl_item i ON dt.kodeitem = i.kodeitem
  WHERE dt.hpp <= 0 AND i.tipe != 'J' -- Bukan barang bertipe Jasa
  LIMIT 50;
  ```
- **Langkah Remediasi**:
  1. Perbarui kolom `hargapokok` di master `tbl_item`.
  2. Jalankan engine re-kalkulasi HPP FIFO untuk merevaluasi transaksi penjualan masa lalu.

---

### 5. `SUBLEDGER_MISMATCH` (Selisih Buku Pembantu vs Buku Besar)
- **Penyebab**: Ada jurnal umum manual (`tipeinput = 'JU'`) yang mendebet/mengkredit akun `1-1210` (Piutang) atau `2-1101` (Hutang) tanpa menyertakan nomor faktur di buku pembantu kartu piutang/hutang.
- **Kueri Audit**:
  ```sql
  -- Membandingkan Total Piutang Faktur (tbl_ikhd) vs Saldo Akun 1-1210 di tbl_accjurnal
  SELECT 
    (SELECT SUM(bayarkredit) FROM tbl_ikhd WHERE status = 'BELUM LUNAS') AS total_piutang_kartu,
    (SELECT SUM(debet - kredit) FROM tbl_accjurnal WHERE kodeacc = '1-1210') AS total_piutang_buku_besar,
    (
      (SELECT SUM(bayarkredit) FROM tbl_ikhd WHERE status = 'BELUM LUNAS') - 
      (SELECT SUM(debet - kredit) FROM tbl_accjurnal WHERE kodeacc = '1-1210')
    ) AS selisih_rekonsiliasi;
  ```
- **Langkah Remediasi**:
  - Hindari membuat jurnal umum manual langsung ke akun piutang/hutang. Selalu gunakan formulir transaksi resmi Pembayaran Piutang (`tbl_byrpiutanghd`) atau Pembayaran Hutang (`tbl_byrhutanghd`).
