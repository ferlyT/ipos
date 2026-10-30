import { FifoInventoryService } from "../services/fifo-inventory.service";
import { client } from "../db";

async function main() {
  console.log("================================================================================");
  console.log("       🔍 AUDIT DETEKSI SALDO ITEM MINUS & PENJUALAN TANPA STOK (iPos 4.0)");
  console.log("================================================================================\n");

  try {
    const report = await FifoInventoryService.detectNegativeStock();

    // 1. STATISTIK SALDO TERKINI MINUS (tbl_itemstok)
    console.log("📌 BAGIAN 1: SALDO STOK FISIK MINUS TERKINI (tbl_itemstok)");
    console.log("--------------------------------------------------------------------------------");
    console.log(`- Jumlah Item Bersaldo Minus Saat Ini : ${report.totalCurrentNegativeItems} Item`);
    console.log(`- Total Akumulasi Kuantitas Defisit   : ${report.totalCurrentNegativeQty} Unit`);
    console.log(`- Total Nilai Defisit Valuasi Aset    : Rp ${report.totalCurrentNegativeValuation.toLocaleString("id-ID")}`);

    if (report.totalCurrentNegativeItems > 0) {
      console.log("\nDaftar Item Bersaldo Minus:");
      report.currentNegativeItems.forEach((it, idx) => {
        console.log(`  ${idx + 1}. [${it.kodeitem}] ${it.namaitem}`);
        console.log(`     Kantor/Gudang : ${it.kantor} | Saldo: ${it.stok} Unit`);
        console.log(`     HPP Acuan     : Rp ${it.hargapokok.toLocaleString("id-ID")} | Potensi Defisit: Rp ${it.totalDefisitValuasi.toLocaleString("id-ID")}`);
      });
    } else {
      console.log("✅ STATUS: Tidak ditemukan item dengan saldo negatif saat ini pada tbl_itemstok.");
    }

    // 2. STATISTIK KRONOLOGIS PENJUALAN OUTOFSTOCK (tbl_item_ik)
    console.log("\n================================================================================");
    console.log("📌 BAGIAN 2: PENJUALAN SAAT STOK MINUS / KOSONG (Flag: OUTOFSTOCK di tbl_item_ik)");
    console.log("--------------------------------------------------------------------------------");
    console.log("Keterangan: Menampilkan transaksi penjualan di mana kasir menjual barang saat batch");
    console.log("pembelian belum tersedia (sisa = 0), sehingga HPP terpaksa menggunakan harga pokok master.");
    console.log(`- Total Frekuensi Transaksi Out-Of-Stock : ${report.totalOutOfStockSalesCount.toLocaleString("id-ID")} Transaksi`);
    console.log(`- Total Item Unik Terkena Dampak         : ${report.totalOutOfStockItemsCount.toLocaleString("id-ID")} Item`);
    console.log(`- Total Qty Terjual Tanpa Batch FIFO     : ${report.totalOutOfStockQty.toLocaleString("id-ID")} Unit`);
    console.log(`- Total HPP yang Berpotensi Terdistorsi  : Rp ${report.totalOutOfStockHppDistortion.toLocaleString("id-ID")}`);

    console.log("\n📋 TOP 15 ITEM TERBANYAK DIJUAL SAAT STOK MINUS:");
    report.topOutOfStockItems.slice(0, 15).forEach((it, idx) => {
      console.log(`  ${idx + 1}. [${it.kodeitem}] ${it.namaitem}`);
      console.log(`     Terjual Tanpa Stok : ${it.totalQtyTerjualTanpaStok} Unit (${it.frekuensiTransaksi} faktur)`);
      console.log(`     Rata-rata HPP      : Rp ${it.avgHpp.toLocaleString("id-ID")} | Total Nilai Distorsi: Rp ${it.totalNilaiDistorsi.toLocaleString("id-ID")}`);
      console.log(`     Transaksi Terakhir : ${it.transaksiTerakhir}`);
    });

    console.log("\n================================================================================");
    console.log("💡 REKOMENDASI AUDITOR UNTUK MENYEHATKAN KARTU STOK:");
    console.log("1. Periksa tanggal faktur pembelian. Jika barang dibeli tanggal 5 tapi baru diinput");
    console.log("   tanggal 10, pastikan tanggal transaksi pada faktur beli disesuaikan dengan faktur fisik.");
    console.log("2. Kunci opsi penjualan di menu 'Pengaturan > Pengaturan Umum':");
    console.log("   Pada bagian 'Pengecekan Stok pada Penjualan', ganti dari 'Cek jika stok habis'");
    console.log("   menjadi 'Stok habis tidak bisa dijual' agar kasir tidak dapat membukukan transaksi tanpa stok.");
    console.log("   (Di menu 'Pengaturan > Kelompok Akses User', pastikan kasir tidak diberi akses ke Pengaturan Umum).");
    console.log("3. Jalankan 'Proses Bulanan' di menu Proses Data dengan opsi 'Perbaikan Stok' dicentang");
    console.log("   agar iPos 4 merealokasi otomatis pemakaian batch FIFO yang tertunda.");
    console.log("================================================================================\n");

  } catch (err) {
    console.error("❌ Terjadi kesalahan saat memeriksa saldo item minus:", err);
  } finally {
    await client.end();
  }
}

main();
