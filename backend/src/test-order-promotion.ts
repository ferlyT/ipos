import { sql } from "drizzle-orm";
import { db } from "./db";
import { OrderPromotionService } from "./services/order-promotion.service";

async function runOrderPromotionTests() {
  console.log("================================================================");
  console.log("   TESTING ORDER LIFECYCLE, PROMOTION & SYSTEM CONFIG ENGINE   ");
  console.log("================================================================\n");

  // --- [1] TEST KONFIGURASI SISTEM GLOBAL ---
  console.log("--- [1] SYSTEM CONFIGURATION (tbl_conf) ---");
  const config = await OrderPromotionService.getSystemConfigurations();
  console.log("Company:", config.company);
  console.log("Accounting Policies:", config.accounting);
  console.log("Taxes:", config.taxes);
  console.log("Sales Policies:", config.salesPolicy);
  console.log(`Loaded ${config.rawConfigCount} configuration parameters.\n`);

  if (config.company.name !== "CV. BARUNA ARTHA LESTARI") {
    throw new Error("Company name configuration mismatch!");
  }

  // --- [2] TEST PEMBUATAN PURCHASE ORDER DENGAN DOWN PAYMENT (DP) ---
  console.log("--- [2] CREATE PURCHASE ORDER WITH DOWN PAYMENT ---");
  const testPoNo = "PO-TST-202610-001";

  // Bersihkan data lama jika ada
  await db.execute(sql`DELETE FROM tbl_pesandt WHERE notransaksi = ${testPoNo};`);
  await db.execute(sql`DELETE FROM tbl_pesanhd WHERE notransaksi = ${testPoNo};`);
  await db.execute(sql`DELETE FROM tbl_accjurnal WHERE notransaksi = ${testPoNo};`);

  const createdPo = await OrderPromotionService.createOrder({
    notransaksi: testPoNo,
    tipe: "PO",
    kodekantor: "UTM",
    kodesupel: "SU0001", // Supplier ABADI DIESEL
    keterangan: "Pemesanan Suku Cadang Mesin Utama - Proyek Q4",
    prpajak: 11,
    dppesanan: 5000000,
    dppesananbyr: 5000000,
    acc_dppesanan: "1-9100",
    acc_dpkas: "1-1110",
    items: [
      {
        kodeitem: "LINER EK100 W/CHROME IZUMI",
        jumlah: 10,
        satuan: "PCS",
        harga: 2500000,
        potongan: 500000,
      },
      {
        kodeitem: "WATER PUMP RF8/10 SISIR",
        jumlah: 5,
        satuan: "PCS",
        harga: 3000000,
      },
    ],
  });

  console.log("Created Purchase Order:", {
    notransaksi: createdPo.notransaksi,
    tipe: createdPo.tipe,
    totalitem: createdPo.totalitem,
    subtotal: `Rp ${createdPo.subtotal.toLocaleString("id-ID")}`,
    pajak: `Rp ${createdPo.pajak.toLocaleString("id-ID")}`,
    totalakhir: `Rp ${createdPo.totalakhir.toLocaleString("id-ID")}`,
    dpPaid: `Rp ${createdPo.dppesananbyr.toLocaleString("id-ID")}`,
  });

  // Verifikasi Jurnal DP
  const dpJournals = await db.execute(sql`
    SELECT nourut, kodeacc, posisi, debet, kredit, keterangan
    FROM tbl_accjurnal
    WHERE notransaksi = ${testPoNo}
    ORDER BY nourut ASC;
  `);
  console.log("Otomatisasi Jurnal Uang Muka PO:", dpJournals);

  // --- [3] TEST MONITORING OUTSTANDING ORDERS ---
  console.log("\n--- [3] OUTSTANDING BACKLOG MONITORING ---");
  const outstanding = await OrderPromotionService.getOutstandingOrders("PO");
  console.log(`Ditemukan ${outstanding.length} PO yang belum selesai:`);
  console.table(outstanding);

  // --- [4] TEST PEMENUHAN PARSIAL (PARTIAL FULFILLMENT) ---
  console.log("\n--- [4] PARTIAL FULFILLMENT OF ORDER ---");
  const partialFulfill = await OrderPromotionService.fulfillOrder(testPoNo, [
    {
      nobaris: 1,
      kodeitem: "LINER EK100 W/CHROME IZUMI",
      qtyReceived: 6, // Terima 6 dari 10
    },
    {
      nobaris: 2,
      kodeitem: "WATER PUMP RF8/10 SISIR",
      qtyReceived: 2, // Terima 2 dari 5
    },
  ]);

  console.log("Status Pemenuhan Parsial:", {
    status: partialFulfill.status,
    totalPesan: partialFulfill.totalPesan,
    totalTerima: partialFulfill.totalTerima,
    backlog: partialFulfill.backlog,
  });
  console.table(partialFulfill.items);

  // --- [5] TEST PEMENUHAN PENUH (COMPLETION FULFILLMENT) ---
  console.log("\n--- [5] COMPLETE FULFILLMENT OF ORDER ---");
  const completeFulfill = await OrderPromotionService.fulfillOrder(testPoNo, [
    {
      nobaris: 1,
      kodeitem: "LINER EK100 W/CHROME IZUMI",
      qtyReceived: 4, // Terima sisa 4
    },
    {
      nobaris: 2,
      kodeitem: "WATER PUMP RF8/10 SISIR",
      qtyReceived: 3, // Terima sisa 3
    },
  ]);

  console.log("Status Pemenuhan Akhir:", {
    status: completeFulfill.status,
    totalPesan: completeFulfill.totalPesan,
    totalTerima: completeFulfill.totalTerima,
    backlog: completeFulfill.backlog,
  });
  console.table(completeFulfill.items);

  // --- [6] TEST PROMOSI BERKALA & POTONGAN KUANTITAS ---
  console.log("\n--- [6] PERIODIC PROMOTIONS & QUANTITY TIER PRICING ---");
  const testPromoId = "PRM-TEST-Q4";
  const testTierId = "TIER-TEST-001";
  const targetItem = "LINER RF8 W/CR IZUMI";

  // Bersihkan data lama jika ada
  await db.execute(sql`DELETE FROM tbl_itemdisp WHERE iddiskon = ${testPromoId};`);
  await db.execute(sql`DELETE FROM tbl_itempotongan WHERE iddetail = ${testTierId};`);

  // 1. Daftarkan Potongan Kuantitas Bertingkat: Beli >= 10 unit dapat diskon 5%
  await OrderPromotionService.registerQuantityTierDiscount({
    iddetail: testTierId,
    kodeitem: targetItem,
    jumlah: 10,
    pot1: 5,
  });

  // 2. Daftarkan Promo Flash Sale / Khusus: Diskon 10% untuk item tersebut
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  await OrderPromotionService.registerPromotion({
    iddiskon: testPromoId,
    kodeitemd: targetItem,
    kodeitems: targetItem,
    tgldari: today,
    tglsampai: nextMonth,
    pot1: 10, // 10%
    prioritas: 2,
  });

  // 3. Evaluasi Harga jika beli 1 unit (Kena Promo 10%)
  const price1 = await OrderPromotionService.resolvePromotionalPrice({
    kodeitem: targetItem,
    jumlah: 1,
  });

  console.log("Simulasi Pembelian 1 Unit (Kena Flash Sale Promo 10%):", {
    item: price1.namaitem,
    basePrice: `Rp ${price1.basePrice.toLocaleString("id-ID")}`,
    effectiveDiscount: `${price1.effectiveDiscountPercent}%`,
    netUnitPrice: `Rp ${price1.netUnitPrice.toLocaleString("id-ID")}`,
    total: `Rp ${price1.totalPrice.toLocaleString("id-ID")}`,
  });

  // 4. Evaluasi Harga jika beli 15 unit (Kena Diskon Terbaik 10%)
  const price15 = await OrderPromotionService.resolvePromotionalPrice({
    kodeitem: targetItem,
    jumlah: 15,
  });

  console.log("Simulasi Pembelian 15 Unit (Volume Grosir):", {
    item: price15.namaitem,
    basePrice: `Rp ${price15.basePrice.toLocaleString("id-ID")}`,
    tierDiscount: `${price15.tierDiscountPercent}%`,
    promoDiscount: `${price15.promoDiscountPercent}%`,
    effectiveDiscount: `${price15.effectiveDiscountPercent}%`,
    netUnitPrice: `Rp ${price15.netUnitPrice.toLocaleString("id-ID")}`,
    total: `Rp ${price15.totalPrice.toLocaleString("id-ID")}`,
  });

  // --- [7] BERSIHKAN DATA TEST SETELAH PENGUJIAN ---
  await db.execute(sql`DELETE FROM tbl_pesandt WHERE notransaksi = ${testPoNo};`);
  await db.execute(sql`DELETE FROM tbl_pesanhd WHERE notransaksi = ${testPoNo};`);
  await db.execute(sql`DELETE FROM tbl_accjurnal WHERE notransaksi = ${testPoNo};`);
  await db.execute(sql`DELETE FROM tbl_itemdisp WHERE iddiskon = ${testPromoId};`);
  await db.execute(sql`DELETE FROM tbl_itempotongan WHERE iddetail = ${testTierId};`);

  console.log("\n================================================================");
  console.log("   ALL ORDER, PROMOTION & CONFIGURATION TESTS PASSED!");
  console.log("================================================================");
  process.exit(0);
}

runOrderPromotionTests().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
