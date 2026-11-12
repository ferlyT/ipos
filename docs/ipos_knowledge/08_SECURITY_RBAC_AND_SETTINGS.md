# 🔐 Modul 08: Keamanan, Autentikasi, RBAC & Konfigurasi Sistem

> **Cakupan**: Otentikasi pengguna (`tbl_user`), enkripsi kata sandi (MD5 legacy vs modern), Role-Based Access Control (`tbl_userakses`), format penomoran otomatis (`tbl_formatnotr`), dan opsi global (`tbl_conf`).

---

## 1. Otentikasi Pengguna & Enkripsi Sandi

Pengguna aplikasi iPos 4.0 disimpan pada tabel `tbl_user`:

| Kolom | Tipe | Keterangan |
|:---|:---|:---|
| `user_id` | `VARCHAR(50)` **PK** | Username unik untuk login |
| `user_name` | `VARCHAR(100)` | Nama lengkap operator / staf |
| `user_pass` | `VARCHAR(100)` | Hash kata sandi |
| `grup_id` | `VARCHAR(50)` | Role pengguna (Superadmin, Kasir, Akuntan, Gudang) |
| `kantor` | `VARCHAR(50)` | Cabang tempat staf bertugas |
| `loginshift` | `BOOLEAN` | Apakah user terikat pembukaan shift kas laci |
| `is_active` | `BOOLEAN` | Status aktif akun pengguna |

### Penanganan Password (Legacy MD5 vs Modern Hash):
- **Desktop iPos 4.0**: Menggunakan format hash MD5 standar:
  $$\text{user\_pass} = \text{MD5}(\text{plain\_text})$$
- **Backend Modern Enterprise**:
  Mendukung skema dual-check (backward compatibility):
  1. Cek apakah cocok dengan MD5 lama.
  2. Jika cocok, sistem secara otomatis melakukan re-hash ke format modern yang lebih aman (seperti bcrypt/argon2) atau menyimpan token JWT yang ditandatangani secara kriptografis.

---

## 2. Role-Based Access Control (RBAC)

Setiap aksi pada sistem dikontrol melalui matriks izin pengguna:

| Role | Akses Kasir (POS) | Master & Harga | Stok & Gudang | Akuntansi & Jurnal | Laporan Finansial |
|:---|:---:|:---:|:---:|:---:|:---:|
| **SUPERADMIN** | ✅ Penuh | ✅ Penuh | ✅ Penuh | ✅ Penuh | ✅ Penuh |
| **KASIR** | ✅ Transaksi | ❌ Baca Saja | ❌ Tidak Ada | ❌ Otomatis | ❌ Rekap Shift Saja |
| **STAFF GUDANG** | ❌ Tidak Ada | ❌ Baca Saja | ✅ Mutasi & Opname | ❌ Tidak Ada | ❌ Laporan Stok Saja |
| **AKUNTAN** | ❌ Tidak Ada | ❌ Baca Saja | ❌ Baca Saja | ✅ Jurnal Umum | ✅ Penuh (Neraca/PL) |
| **MANAJER TOKO** | ✅ Void/Diskon | ✅ Edit Item | ✅ Approval | ✅ Verifikasi | ✅ Analitik BI |

### Proteksi Khusus Supervisor (Manager Override):
- **Void Struk Kasir**: Kasir tidak dapat menghapus transaksi tanpa input PIN/password Supervisor.
- **Diskon Manual di Atas Batas**: Pembatasan diskon kasir maksimum (misal: kasir max 5%, di atasnya butuh otorisasi supervisor).
- **Penjualan di Bawah HPP**: Peringatan keras jika harga jual yang dimasukkan lebih rendah dari harga pokok modal item.

---

## 3. Format Penomoran Otomatis Transaksi (`tbl_formatnotr`)

Seluruh dokumen di iPos 4.0 memiliki nomor urut resmi yang diproduksi oleh tabel `tbl_formatnotr`:

```sql
SELECT tipe, format, counter, panjang, kantor 
FROM tbl_formatnotr 
WHERE tipe = 'JL' AND kantor = 'PUSAT' 
FOR UPDATE;
```

### Algoritma Pembentukan Nomor Transaksi:
1. Pola template format: `[PREFIX]/[YY][MM]/[COUNTER]`
2. Contoh:
   - Penjualan Kasir: `JL/2611/00042`
   - Faktur Pembelian: `BL/2611/00015`
   - Penerimaan Kas: `KM/2611/00008`
   - Pengeluaran Biaya: `KK/2611/00021`
   - Mutasi Antar-Gudang: `TR/2611/00003`
3. Setelah nomor berhasil dirakit, kolom `counter` di-update: `counter = counter + 1`.
4. Seluruh proses dilakukan di dalam transaksi database yang terisolasi untuk menghindari duplikasi nomor transaksi (*race condition*).

---

## 4. Opsi Konfigurasi Global (`tbl_conf`)

Menyimpan parameter konfigurasi global toko/perusahaan:
- `NAMA_PERUSAHAAN`: Nama entitas usaha yang tampil di kop struk dan laporan.
- `ALAMAT_PERUSAHAAN`: Alamat kantor operasional.
- `ALLOW_MINUS_STOCK`: Parameter kebijakan apakah kasir diperbolehkan menjual barang saat stok fisik di sistem habis (`'Y'` atau `'N'`).
- `FORMAT_DECIMAL`: Presisi angka di belakang koma untuk kuantitas dan kalkulasi desimal (default: 2 atau 4 digit).
- `PRINTER_WIDTH`: Pengaturan lebar kertas cetak kasir (58mm atau 80mm).
