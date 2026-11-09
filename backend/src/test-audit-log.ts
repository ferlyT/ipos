import { client } from "./db";

async function runAuditTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING SISTEM AUDIT LOG DATABASE TRIGGER (PENJUALAN & PEMBELIAN)");
  console.log("================================================================================");

  // Ambil data referensi yang ada di database agar tidak melanggar foreign key
  const supelRow = await client`SELECT kode FROM tbl_supel LIMIT 1`;
  const kantorRow = await client`SELECT kodekantor FROM tbl_kantor LIMIT 1`;
  const itemRow = await client`SELECT kodeitem FROM tbl_item LIMIT 1`;

  const testKantor = kantorRow[0]?.kodekantor || "UTM";
  const testPelanggan = supelRow[0]?.kode || "CUST-001";
  const testSupplier = supelRow[0]?.kode || "SUPP-001";
  const testItem = itemRow[0]?.kodeitem || "ITEM-001";
  try {
    // 1. TEST AUDIT PENJUALAN HEADER & DETAIL
    console.log("\n--- [TEST 1 & 2] PENJUALAN (tbl_ikhd & tbl_ikdt) ---");
    const noTrxSales = `TEST-JL-${Date.now()}`;
    const idDetailSales = `${noTrxSales}-1`;

    // A. Insert Faktur Penjualan Baru
    await client`
      INSERT INTO tbl_ikhd (
        notransaksi, kodekantor, tanggal, tipe, kodesupel, subtotal, 
        potnomfaktur, totalakhir, carabayar, jmltunai, user1
      ) VALUES (
        ${noTrxSales}, ${testKantor}, NOW(), 'JL', ${testPelanggan}, 100000, 
        0, 100000, 'TN', 100000, 'kasir_a'
      )
    `;

    await client`
      INSERT INTO tbl_ikdt (
        iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total
      ) VALUES (
        ${idDetailSales}, 1, ${noTrxSales}, ${testItem}, 2, 'PCS', 50000, 0, 100000
      )
    `;
    console.log(`✓ Inserted dummy sales transaction: ${noTrxSales}`);

    // B. Test UPDATE tbl_ikdt (ubah jumlah dan total)
    console.log("-> Menguji UPDATE pada tbl_ikdt (Detail Item Penjualan)...");
    await client`
      UPDATE tbl_ikdt
      SET jumlah = 3, total = 150000
      WHERE iddetail = ${idDetailSales}
    `;

    // C. Test UPDATE tbl_ikhd (ubah totalakhir dan user2)
    console.log("-> Menguji UPDATE pada tbl_ikhd (Header Penjualan)...");
    await client`
      UPDATE tbl_ikhd
      SET subtotal = 150000, totalakhir = 150000, user2 = 'supervisor_b'
      WHERE notransaksi = ${noTrxSales}
    `;

    // D. Test DELETE tbl_ikdt
    console.log("-> Menguji DELETE pada tbl_ikdt (Detail Item Penjualan)...");
    await client`
      DELETE FROM tbl_ikdt
      WHERE iddetail = ${idDetailSales}
    `;

    // E. Test DELETE tbl_ikhd
    console.log("-> Menguji DELETE pada tbl_ikhd (Header Penjualan)...");
    await client`
      DELETE FROM tbl_ikhd
      WHERE notransaksi = ${noTrxSales}
    `;

    // Periksa log audit yang tercatat untuk transaksi penjualan ini
    const salesLogs = await client`
      SELECT id, table_name, action_type, modul, notransaksi, iddetail, user_app, perubahan_kolom, data_lama, data_baru
      FROM tbl_audit_log
      WHERE notransaksi = ${noTrxSales}
      ORDER BY id ASC
    `;

    console.log(`\n📊 Jumlah log audit tercatat untuk ${noTrxSales}: ${salesLogs.length}`);
    salesLogs.forEach((log: any, i: number) => {
      console.log(`  [${i + 1}] Tabel: ${log.table_name} | Aksi: ${log.action_type} | User: ${log.user_app}`);
      console.log(`      Perubahan: ${log.perubahan_kolom}`);
    });

    if (salesLogs.length < 4) {
      throw new Error(`Ekspektasi minimal 4 log audit penjualan (UPDATE dt, UPDATE hd, DELETE dt, DELETE hd), tetapi mendapat ${salesLogs.length}`);
    }

    // 2. TEST AUDIT PEMBELIAN HEADER & DETAIL
    console.log("\n--- [TEST 3 & 4] PEMBELIAN (tbl_imhd & tbl_imdt) ---");
    const noTrxPurchase = `TEST-BL-${Date.now()}`;
    const idDetailPurchase = `${noTrxPurchase}-1`;

    // A. Insert Faktur Pembelian Baru
    await client`
      INSERT INTO tbl_imhd (
        notransaksi, kodekantor, tanggal, tipe, kodesupel, subtotal, 
        potnomfaktur, totalakhir, carabayar, jmlkredit, user1
      ) VALUES (
        ${noTrxPurchase}, ${testKantor}, NOW(), 'BL', ${testSupplier}, 200000, 
        0, 200000, 'KD', 200000, 'staff_procurement'
      )
    `;

    await client`
      INSERT INTO tbl_imdt (
        iddetail, nobaris, notransaksi, kodeitem, jumlah, satuan, harga, potongan, total
      ) VALUES (
        ${idDetailPurchase}, 1, ${noTrxPurchase}, ${testItem}, 4, 'PCS', 50000, 0, 200000
      )
    `;
    console.log(`✓ Inserted dummy purchase transaction: ${noTrxPurchase}`);

    // B. Test UPDATE tbl_imdt
    console.log("-> Menguji UPDATE pada tbl_imdt (Detail Item Pembelian)...");
    await client`
      UPDATE tbl_imdt
      SET harga = 45000, total = 180000
      WHERE iddetail = ${idDetailPurchase}
    `;

    // C. Test UPDATE tbl_imhd
    console.log("-> Menguji UPDATE pada tbl_imhd (Header Pembelian)...");
    await client`
      UPDATE tbl_imhd
      SET subtotal = 180000, totalakhir = 180000, jmlkredit = 180000, user2 = 'manager_c'
      WHERE notransaksi = ${noTrxPurchase}
    `;

    // D. Test DELETE tbl_imdt
    console.log("-> Menguji DELETE pada tbl_imdt (Detail Item Pembelian)...");
    await client`
      DELETE FROM tbl_imdt
      WHERE iddetail = ${idDetailPurchase}
    `;

    // E. Test DELETE tbl_imhd
    console.log("-> Menguji DELETE pada tbl_imhd (Header Pembelian)...");
    await client`
      DELETE FROM tbl_imhd
      WHERE notransaksi = ${noTrxPurchase}
    `;

    // Periksa log audit pembelian
    const purchaseLogs = await client`
      SELECT id, table_name, action_type, modul, notransaksi, iddetail, user_app, perubahan_kolom, data_lama, data_baru
      FROM tbl_audit_log
      WHERE notransaksi = ${noTrxPurchase}
      ORDER BY id ASC
    `;

    console.log(`\n📊 Jumlah log audit tercatat untuk ${noTrxPurchase}: ${purchaseLogs.length}`);
    purchaseLogs.forEach((log: any, i: number) => {
      console.log(`  [${i + 1}] Tabel: ${log.table_name} | Aksi: ${log.action_type} | User: ${log.user_app}`);
      console.log(`      Perubahan: ${log.perubahan_kolom}`);
    });

    if (purchaseLogs.length < 4) {
      throw new Error(`Ekspektasi minimal 4 log audit pembelian (UPDATE dt, UPDATE hd, DELETE dt, DELETE hd), tetapi mendapat ${purchaseLogs.length}`);
    }

    console.log("\n================================================================================");
    console.log("🎉 SEMUA PENGUJIAN TRIGGER AUDIT LOG BERHASIL 100%!");
    console.log("================================================================================");
  } catch (error) {
    console.error("❌ Test gagal:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAuditTests();
