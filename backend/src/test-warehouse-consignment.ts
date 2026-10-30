import { db } from "./db";
import { WarehouseConsignmentService } from "./services/warehouse-consignment.service";

async function run() {
  console.log("================================================================");
  console.log("   TESTING MULTI-WAREHOUSE, TRANSFER & CONSIGNMENT SERVICE");
  console.log("================================================================\n");

  try {
    // 1. List All Registered Warehouses
    console.log("--- [1] LIST ALL WAREHOUSES / OFFICES (tbl_kantor) ---");
    const warehouses = await WarehouseConsignmentService.listWarehouses();
    console.table(warehouses);

    // 2. Query Item Stock in UTM
    console.log("\n--- [2] SAMPLE ITEM STOCK IN WAREHOUSE 'UTM' ---");
    const utmStock = await WarehouseConsignmentService.getWarehouseStock("UTM");
    console.table(utmStock.slice(0, 5));

    // 3. Query Item Stock in GD
    console.log("\n--- [3] SAMPLE ITEM STOCK IN WAREHOUSE 'GD' ---");
    const gdStock = await WarehouseConsignmentService.getWarehouseStock("GD");
    console.log(`Total item records in GD: ${gdStock.length}`);

    // 4. Test Stock Transfer Logic inside a Rollback Transaction (Zero Risk to Production)
    console.log("\n--- [4] TEST STOCK TRANSFER WORKFLOW (TRANSACTION ROLLBACK) ---");
    if (utmStock.length > 0) {
      const sampleItem = utmStock.find(i => i.stokGudang > 5) || utmStock[0];
      console.log(`Menguji transfer 2 ${sampleItem.satuan} '${sampleItem.kodeitem}' dari UTM -> GD...`);

      try {
        await db.transaction(async (tx) => {
          const transferResult = await WarehouseConsignmentService.transferStock({
            kantordari: "UTM",
            kantortujuan: "GD",
            tanggal: new Date(),
            keterangan: "Uji Coba Mutasi Stok Otomatis Antar Gudang",
            user: "ADMIN",
            items: [
              {
                kodeitem: sampleItem.kodeitem,
                jumlah: 2,
                satuan: sampleItem.satuan,
                keterangan: "Transfer test line"
              }
            ]
          }, tx);

          console.log("Transfer Berhasil Dieksekusi di Dalam Transaksi:");
          console.log({
            notransaksi: transferResult.notransaksi,
            asal: transferResult.kantordari,
            tujuan: transferResult.kantortujuan,
            totalQty: transferResult.totalQuantity,
            totalValuasi: `Rp ${transferResult.totalValuation.toLocaleString("id-ID")}`
          });

          // Verifikasi saldo di GD bertambah di dalam transaksi
          const stockAfter = await WarehouseConsignmentService.getWarehouseStock("GD", sampleItem.kodeitem, tx);
          console.log(`Saldo '${sampleItem.kodeitem}' di GD saat transfer: ${stockAfter[0]?.stokGudang || 0} ${sampleItem.satuan}`);

          // Trigger intentional rollback
          throw new Error("ROLLBACK_FOR_TEST");
        });
      } catch (err: any) {
        if (err.message === "ROLLBACK_FOR_TEST") {
          console.log(">> Transaksi transfer berhasil di-ROLLBACK dengan aman (data produksi tidak berubah).");
        } else {
          throw err;
        }
      }
    }

    // 5. Test Stock Opname Logic inside a Rollback Transaction
    console.log("\n--- [5] TEST STOCK OPNAME RECONCILIATION (TRANSACTION ROLLBACK) ---");
    if (utmStock.length > 0) {
      const sampleItem = utmStock[0];
      const stokAwal = sampleItem.stokGudang;
      const stokFisikSimulasi = stokAwal + 3; // Simulasi Surplus 3 unit

      console.log(`Menguji opname item '${sampleItem.kodeitem}' (Sistem: ${stokAwal}, Fisik: ${stokFisikSimulasi})...`);

      try {
        await db.transaction(async (tx) => {
          const opnameResult = await WarehouseConsignmentService.executeStockOpname({
            kodekantor: "UTM",
            tanggal: new Date(),
            user: "AUDITOR",
            items: [
              {
                kodeitem: sampleItem.kodeitem,
                jmlfisik: stokFisikSimulasi,
                satuan: sampleItem.satuan
              }
            ]
          }, tx);

          console.log("Opname Berhasil Diproses di Dalam Transaksi:");
          console.log({
            periode: opnameResult.periode,
            totalAudited: opnameResult.totalItemsAudited,
            surplus: opnameResult.totalItemsSurplus,
            deficit: opnameResult.totalItemsDeficit,
            netValuasi: `Rp ${opnameResult.netAdjustmentValuation.toLocaleString("id-ID")}`,
            detail: opnameResult.items[0]
          });

          // Trigger intentional rollback
          throw new Error("ROLLBACK_FOR_TEST");
        });
      } catch (err: any) {
        if (err.message === "ROLLBACK_FOR_TEST") {
          console.log(">> Transaksi opname berhasil di-ROLLBACK dengan aman (saldo fisik asli tetap utuh).");
        } else {
          throw err;
        }
      }
    }

    // 6. Test Consignment Summary
    console.log("\n--- [6] TEST CONSIGNMENT MODULE SUMMARY ---");
    const konsinSummary = await WarehouseConsignmentService.getConsignmentSummary();
    console.log(`Daftar Supplier Konsinyasi Terdaftar: ${konsinSummary.length}`);
    if (konsinSummary.length > 0) {
      console.table(konsinSummary);
    } else {
      console.log("Belum ada data transaksi konsinyasi masuk (tipe 'KI') historis di database.");
    }

    console.log("\n================================================================");
    console.log("   ALL WAREHOUSE & CONSIGNMENT TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

run();
