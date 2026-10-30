import { FifoInventoryService } from "./services/fifo-inventory.service";
import { client } from "./db";

async function main() {
  console.log("🚀 Testing FifoInventoryService...\n");

  const testItem = "PEN PISTON 6D22";

  // 1. Test Kartu Stok FIFO
  console.log(`1. Kartu Stok FIFO untuk item '${testItem}':`);
  const stockCard = await FifoInventoryService.getItemStockCard(testItem);
  console.log(`Ditemukan ${stockCard.length} mutasi keluar/masuk:`);
  for (const m of stockCard.slice(0, 5)) {
    const tgl = String(m.tanggal).split(' ')[0];
    console.log(`- [${tgl}] ${m.direction} ${m.qty} @ Rp ${m.harga_satuan.toLocaleString('id-ID')} (${m.notransaksi}) => Saldo: ${m.saldo_akhir_qty} unit, Valuasi: Rp ${m.saldo_akhir_nilai.toLocaleString('id-ID')}`);
  }

  // 2. Test Simulasi Pengeluaran FIFO (POS Preview)
  console.log(`\n2. Simulasi FIFO Penjualan 3 Unit untuk item '${testItem}':`);
  const simResult = await FifoInventoryService.simulateFifoDepletion(testItem, 3);
  console.log(`- Total Qty: ${simResult.totalQtyOut}`);
  console.log(`- Total Estimasi HPP: Rp ${simResult.totalHpp.toLocaleString('id-ID')}`);
  console.log(`- Rata-rata HPP/Unit: Rp ${simResult.avgHppPerUnit.toLocaleString('id-ID')}`);
  console.log(`- Menggunakan Fallback Out-of-Stock: ${simResult.isOutOfStockFallback}`);
  console.log(`- Rincian Batch yang Dihabiskan:`);
  for (const alloc of simResult.allocations) {
    console.log(`  * Batch ${alloc.batchNotransaksi} (${alloc.iddetailim}): ${alloc.qtyAllocated} unit @ Rp ${alloc.unitCost.toLocaleString('id-ID')} = Rp ${alloc.subtotalHpp.toLocaleString('id-ID')}`);
  }

  await client.end();
  console.log("\n✅ Test Selesai dengan Sukses!");
}

main().catch(console.error);
