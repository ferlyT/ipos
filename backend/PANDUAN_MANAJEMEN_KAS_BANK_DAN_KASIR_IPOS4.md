# PANDUAN MANAJEMEN KAS & BANK, BIAYA OPERASIONAL, DEPOSIT & KAS LACI KASIR IPOS 4.0

Dokumen ini merupakan panduan teknis dan arsitektur menyeluruh mengenai pengelolaan **Kas & Bank (`tbl_acckashd`/`dt`), Biaya Operasional, Deposit Pelanggan/Supplier (`tbl_accdeposithd`/`dt`), serta Rekonsiliasi Kas Laci Kasir (`tbl_kaslaci`/`dt`)** pada iPos 4.0 dengan database PostgreSQL (`i4_barunatrial`).

---

## 1. Arsitektur Kas & Bank (`tbl_acckashd` & `tbl_acckasdt`)

Modul Kas & Bank mengelola seluruh arus kas yang **bukan berasal langsung dari pelunasan hutang/piutang dagang** (non-trade cash flows), seperti biaya operasional, pendapatan non-usaha, dan transfer likuiditas antar rekening.

```
                    ┌─────────────────────────┐
                    │      tbl_acckashd       │ (Header Transaksi)
                    ├─────────────────────────┤
                    │ notransaksi (PK)        │
                    │ kodekantor              │
                    │ kodeacc (Akun Kas/Bank) │
                    │ tanggal                 │
                    │ tipe (KASO/KASI/KASTR)  │
                    │ jumlah / subtotal       │
                    │ keterangan              │
                    └────────────┬────────────┘
                                 │ 1
                                 │
                                 │ N
                    ┌────────────┴────────────┐
                    │      tbl_acckasdt       │ (Rincian Akun Lawan)
                    ├─────────────────────────┤
                    │ iddetail (PK)           │
                    │ notransaksi (FK)        │
                    │ nobaris                 │
                    │ kodeacc (Akun Beban/Pdp)│
                    │ jumlah                  │
                    └─────────────────────────┘
```

### 1.1 Tiga Tipe Transaksi Kas & Bank

| Tipe | Nama Transaksi | Format Bukti | Posisi Kas/Bank | Posisi Akun Lawan |
|---|---|---|---|---|
| **`KASI`** | **Kas Masuk** | `[CNT]/KSIN/[DEPT]/[BLNTHN]` | **Debet** (`tbl_acckashd.kodeacc`) | **Kredit** (`tbl_acckasdt.kodeacc`) |
| **`KASO`** | **Kas Keluar** | `[CNT]/KASO/[DEPT]/[BLNTHN]` | **Kredit** (`tbl_acckashd.kodeacc`) | **Debet** (`tbl_acckasdt.kodeacc`) |
| **`KASTR`** | **Transfer Kas/Bank** | `[CNT]/KASTR/[DEPT]/[BLNTHN]` | **Kredit** (`tbl_acckashd.kodeacc` - Asal) | **Debet** (`tbl_acckasdt.kodeacc` - Tujuan) |

### 1.2 Integrasi Jurnal Akuntansi Otomatis (`tbl_accjurnal`)
Setiap transaksi kas wajib membentuk pasangan jurnal berimbang (`tipeinput = 'R'`):

1. **Kas Masuk (`KASI`)**:
   $$\text{[Dr] Kas / Bank (Header)} \quad \text{Rp } X$$
   $$\text{[Cr] Akun Pendapatan / Modal (Detail)} \quad \text{Rp } X$$
2. **Kas Keluar (`KASO`)**:
   $$\text{[Dr] Akun Biaya Operasional (Detail)} \quad \text{Rp } X$$
   $$\text{[Cr] Kas / Bank (Header)} \quad \text{Rp } X$$
3. **Transfer Kas/Bank (`KASTR`)**:
   $$\text{[Dr] Rekening Bank Penerima (Detail)} \quad \text{Rp } X$$
   $$\text{[Cr] Rekening Kas/Bank Pengirim (Header)} \quad \text{Rp } X$$

---

## 2. Deposit Pelanggan & Deposit Supplier (`tbl_accdeposithd`/`dt`)

Fitur Deposit digunakan untuk mencatat uang muka (Down Payment / Titipan Uang) yang diserahkan pelanggan atau dibayarkan ke supplier sebelum faktur penjualan/pembelian terbit.

### 2.1 Struktur Tabel Deposit
- **Header (`tbl_accdeposithd`)**:
  - `notransaksi`: Format `[CNT]/DP/[DEPT]/[BLNTHN]` (Pelanggan) atau `[CNT]/DB/[DEPT]/[BLNTHN]` (Supplier).
  - `tipetrs`: `'DP'` (Deposit Pelanggan) atau `'DB'` (Deposit Supplier).
  - `kodesupel`: Kode pelanggan atau supplier (`tbl_supel.kode`).
  - `kodeacc`: Akun Kas/Bank tempat uang masuk atau keluar.
  - `jumlah`: Nominal deposit yang disetor/diterima.
- **Detail (`tbl_accdepositdt`)**:
  - `kodeacc`: Akun penampung deposit (`2-1200` Hutang Uang Muka Penjualan atau `1-1400` Uang Muka Pembelian).
  - `jumlah`: Alokasi nominal deposit.

### 2.2 Alur Pemotongan Deposit pada Faktur
Ketika transaksi POS Kasir (`tbl_ikhd`) atau Pembelian (`tbl_imhd`) diterbitkan:
- Kolom `jmldeposit` diisi dengan nominal deposit yang digunakan untuk memotong total tagihan.
- Kolom `acc_deposit` mencatat akun perantara uang muka yang didebet/dikredit saat faktur diposting.

---

## 3. Manajemen Kas Laci Kasir & Tutup Shift (`tbl_kaslaci`)

Untuk mencegah kebocoran uang tunai di kasir toko ritel, iPos 4.0 menerapkan mekanisme shift kasir berbasis kas laci (*Cash Drawer Management*).

### 3.1 Siklus Shift Kasir (Shift Cash Flow)

```
[Buka Shift Kasir]
Kasir menerima modal uang receh kembalian
tbl_kaslaci.kas_awal (misal: Rp 200.000)
login_flag = TRUE
       │
       ├──────────────► [Penjualan Tunai Berjalan]
       │                Sistem mengakumulasi penjualan kasir:
       │                tbl_kaslaci.kas_masuk += total_tunai_pos
       │
       ├──────────────► [Pengeluaran Kecil Laci]
       │                Kasir mengeluarkan kas kecil (misal: beli bensin kurir)
       │                Dicatat di tbl_kaslacidt (nama_pengambil, kas_keluar)
       │                tbl_kaslaci.kas_keluar += nominal
       │
       ▼
[Tutup Shift / Rekonsiliasi Fisik]
Kasir menghitung seluruh uang fisik di laci (kas_fisik)
Sistem menghitung:
kas_akhir_sistem = kas_awal + kas_masuk - kas_keluar
selisih = kas_fisik - kas_akhir_sistem
       │
       ├─► selisih == 0 : Balance (Sempurna)
       ├─► selisih > 0  : Kas Lebih (Masuk Pendapatan Selisih Kas)
       └─► selisih < 0  : Kas Kurang (Beban Selisih Kas / Potong Gaji Kasir)
login_flag = FALSE
```

### 3.2 Struktur Kolom `tbl_kaslaci` & `tbl_kaslacidt`
- `tbl_kaslaci`:
  - `nama_user`: ID login kasir yang bertanggung jawab.
  - `shift`: Shift kerja kasir (`1`, `2`, `PAGI`, `SIANG`).
  - `kas_awal`: Modal awal laci kasir.
  - `kas_masuk`: Total penerimaan uang tunai selama shift.
  - `kas_keluar`: Total pengeluaran uang dari laci selama shift.
  - `kas_akhir`: Saldo akhir menurut pembukuan sistem.
  - `wkt_mulai` & `wkt_akhir`: Waktu buka dan tutup laci.
  - `login_flag`: Status shift aktif (`TRUE`) atau telah tutup (`FALSE`).
  - `nama_komputer`: Hostname / nomor terminal kasir (POS Station).
- `tbl_kaslacidt`:
  - `notransaksi`: Relasi ke sesi shift kasir.
  - `nama_pengambil`: Nama penerima uang laci.
  - `kas_keluar`: Nominal uang keluar.
  - `keterangan_p`: Deskripsi keperluan pengeluaran.
