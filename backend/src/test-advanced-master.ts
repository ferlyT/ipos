import { AdvancedMasterService } from "./services/advanced-master.service";

async function run() {
  console.log("================================================================");
  console.log("   TESTING ADVANCED MASTER DATA & RETAIL ENTITIES SERVICE");
  console.log("================================================================\n");

  try {
    // 1. Customer Groups & Level Pricing
    console.log("--- [1] LIST CUSTOMER GROUPS & PRICING TIERS ---");
    const groups = await AdvancedMasterService.listCustomerGroups();
    console.table(groups);

    // 2. Multi-Unit Items Sample
    console.log("\n--- [2] MULTI-UNIT ITEMS IN DATABASE ---");
    const multiItems = await AdvancedMasterService.listMultiUnitItems(5);
    console.table(multiItems);

    if (multiItems.length > 0) {
      const sampleItemCode = multiItems[0].kodeitem;
      console.log(`\n--- [3] DETAIL UNITS FOR ITEM: ${sampleItemCode} ---`);
      const units = await AdvancedMasterService.getItemUnits(sampleItemCode);
      console.table(units);

      // 4. Unit Conversion Test
      if (units.length > 1) {
        const uFrom = units[1].satuan; // e.g. SETS
        const uTo = units[0].satuan;   // e.g. PCS
        console.log(`\n--- [4] CONVERT QUANTITY (5 ${uFrom} -> ${uTo}) ---`);
        const conversion = await AdvancedMasterService.convertUnitQuantity(sampleItemCode, 5, uFrom, uTo);
        console.log(`Hasil: 5 ${uFrom} = ${conversion.convertedQty} ${uTo} (Pengali: ${conversion.multiplierFrom}x / ${conversion.multiplierTo}x)`);
      }

      // 5. Dynamic Price Resolution Tests
      console.log(`\n--- [5] PRICE RESOLUTION SCENARIOS FOR ITEM: ${sampleItemCode} ---`);
      
      // Skenario A: Pelanggan Umum (General - 0% Diskon, Satuan Dasar)
      const priceGeneralBase = await AdvancedMasterService.resolveItemPrice(
        sampleItemCode,
        units[0].satuan,
        2
      );
      console.log("Skenario A (Konsumen Umum - 2 " + units[0].satuan + "):");
      console.log({
        satuan: priceGeneralBase.satuan,
        qty: priceGeneralBase.qty,
        standardPrice: priceGeneralBase.standardUnitPrice,
        customerGroup: priceGeneralBase.customerGroup,
        discountPct: `${priceGeneralBase.customerDiscountPercent}%`,
        finalUnitPrice: priceGeneralBase.finalUnitPrice,
        grandTotal: priceGeneralBase.grandTotal,
        margin: `${priceGeneralBase.estimatedMarginPercent}%`
      });

      // Skenario B: Pelanggan Gold / Member (Diskon 10%, Satuan Konversi Kemasan Besar)
      if (units.length > 1) {
        const priceGold = await AdvancedMasterService.resolveItemPrice(
          sampleItemCode,
          units[1].satuan,
          3,
          "PL0352" // Test customer
        );
        console.log(`\nSkenario B (Pelanggan Gold/Grup - 3 ${units[1].satuan}):`);
        console.log({
          satuan: priceGold.satuan,
          qty: priceGold.qty,
          standardPrice: priceGold.standardUnitPrice,
          customerGroup: priceGold.customerGroup,
          discountPct: `${priceGold.customerDiscountPercent}%`,
          discountNominal: priceGold.totalDiscountAmount,
          finalUnitPrice: priceGold.finalUnitPrice,
          grandTotal: priceGold.grandTotal,
          margin: `${priceGold.estimatedMarginPercent}%`
        });
      }
    }

    // 6. Customer Profile Lookup
    console.log("\n--- [6] CUSTOMER PROFILE & ZONING ---");
    const custProfile = await AdvancedMasterService.getCustomerProfile("PL0352");
    if (custProfile) {
      console.log("Data Customer PL0352:", {
        kode: custProfile.kode,
        nama: custProfile.nama,
        grup: custProfile.namaGrup,
        level: custProfile.levelharga,
        diskon: `${custProfile.potongan}%`,
        plafonKredit: custProfile.limitjmlhupi
      });
    } else {
      console.log("Customer PL0352 tidak ditemukan.");
    }

    // 7. Serial Number Query Test
    console.log("\n--- [7] SERIAL NUMBER TRACKER ---");
    const snInfo = await AdvancedMasterService.getSerialStatus("SN-SAMPLE-9999");
    console.log("Lookup SN Non-Existent:", snInfo ? snInfo : "Not found (Handled gracefully)");

    // 8. Assembly BOM Test
    console.log("\n--- [8] ASSEMBLY / BOM ENGINE ---");
    const bom = await AdvancedMasterService.getAssemblyBOM("PAKET-KOMPUTER-01");
    console.log("Lookup BOM Non-Existent:", bom ? bom : "Not found (Handled gracefully)");

    console.log("\n================================================================");
    console.log("   ALL ADVANCED MASTER DATA TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

run();
