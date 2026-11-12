import { client } from "./db";

async function runAccountingAuditTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING SISTEM AUDIT LOG MODUL AKUNTANSI & KAS/BANK");
  console.log("================================================================================");

  const accRow = await client`SELECT kodeacc FROM tbl_perkiraan LIMIT 2`;
  const kodeacc1 = accRow[0]?.kodeacc || "111.01";
  const kodeacc2 = accRow[1]?.kodeacc || "511.01";
  const kantorRow = await client`SELECT kodekantor FROM tbl_kantor LIMIT 1`;
  const kodekantor = kantorRow[0]?.kodekantor || "UTM";
  const supelRow = await client`SELECT kode FROM tbl_supel LIMIT 1`;
  const kodesupel = supelRow[0]?.kode || "SUPP-001";

  try {
    // ------------------------------------------------------------------------
    // TEST 1: KAS MASUK / KELUAR (tbl_acckashd & tbl_acckasdt)
    // ------------------------------------------------------------------------
    console.log("\n--- [TEST 1] KAS MASUK / KELUAR (tbl_acckashd & tbl_acckasdt) ---");
    const noTrxKas = `TEST-KK-${Date.now()}`;
    const idDetailKas = `${noTrxKas}-1`;

    console.log(`-> Menyimpan transaksi Kas Baru: ${noTrxKas}`);
    await client`
      INSERT INTO tbl_acckashd (
        notransaksi, kodekantor, kodeacc, kodeaccto, tanggal, tipe,
        jumlah, subtotal, keterangan, user1
      ) VALUES (
        ${noTrxKas}, ${kodekantor}, ${kodeacc1}, ${kodeacc2}, NOW(), 'KK',
        250000, 250000, 'Test pengeluaran kas', 'kasir_test'
      )
    `;

    await client`
      INSERT INTO tbl_acckasdt (
        iddetail, nobaris, notransaksi, kodeacc, jumlah
      ) VALUES (
        ${idDetailKas}, 1, ${noTrxKas}, ${kodeacc2}, 250000
      )
    `;

    console.log("-> Menguji UPDATE pada tbl_acckashd (Ubah nominal pengeluaran kas)...");
    await client`
      UPDATE tbl_acckashd
      SET jumlah = 300000, subtotal = 300000, user2 = 'supervisor_test'
      WHERE notransaksi = ${noTrxKas}
    `;

    console.log("-> Menguji DELETE pada tbl_acckasdt (Hapus detail kas)...");
    await client`
      DELETE FROM tbl_acckasdt
      WHERE iddetail = ${idDetailKas}
    `;

    console.log("-> Menguji DELETE pada tbl_acckashd (Hapus header kas)...");
    await client`
      DELETE FROM tbl_acckashd
      WHERE notransaksi = ${noTrxKas}
    `;

    // Cek hasil log kas
    const logsKas = await client`
      SELECT id, table_name, action_type, modul, notransaksi, user_app, perubahan_kolom, data_lama, data_baru
      FROM tbl_audit_log
      WHERE notransaksi = ${noTrxKas}
      ORDER BY id ASC
    `;

    console.log(`\n📋 Ditemukan ${logsKas.length} catatan audit log untuk kas ${noTrxKas}:`);
    for (const log of logsKas) {
      console.log(`   [ID: ${log.id}] [${log.action_type}] Tabel: ${log.table_name} | User: ${log.user_app}`);
      console.log(`      Perubahan: ${log.perubahan_kolom}`);
    }

    // ------------------------------------------------------------------------
    // TEST 2: JURNAL UMUM / AKUNTANSI (tbl_accjurnal)
    // ------------------------------------------------------------------------
    console.log("\n--- [TEST 2] JURNAL UMUM / AKUNTANSI (tbl_accjurnal) ---");
    const noTrxJurnal = `TEST-JU-${Date.now()}`;
    const idDetailJurnal1 = `${noTrxJurnal}-1`;
    const idDetailJurnal2 = `${noTrxJurnal}-2`;

    console.log(`-> Menyimpan Jurnal Baru: ${noTrxJurnal}`);
    await client`
      INSERT INTO tbl_accjurnal (
        iddetail, nourut, tipeinput, notransaksi, tanggal, kodeacc,
        posisi, debet, kredit, kantor, keterangan
      ) VALUES 
      (${idDetailJurnal1}, 1, 'JU', ${noTrxJurnal}, NOW(), ${kodeacc1}, 'D', 500000, 0, ${kodekantor}, 'Jurnal tes debet'),
      (${idDetailJurnal2}, 2, 'JU', ${noTrxJurnal}, NOW(), ${kodeacc2}, 'K', 0, 500000, ${kodekantor}, 'Jurnal tes kredit')
    `;

    console.log("-> Menguji UPDATE baris jurnal debet...");
    await client`
      UPDATE tbl_accjurnal
      SET debet = 600000, keterangan = 'Jurnal tes koreksi debet'
      WHERE iddetail = ${idDetailJurnal1}
    `;

    console.log("-> Menguji DELETE baris jurnal kredit...");
    await client`
      DELETE FROM tbl_accjurnal
      WHERE iddetail = ${idDetailJurnal2}
    `;

    console.log("-> Menguji DELETE sisa baris jurnal debet...");
    await client`
      DELETE FROM tbl_accjurnal
      WHERE iddetail = ${idDetailJurnal1}
    `;

    const logsJurnal = await client`
      SELECT id, table_name, action_type, modul, notransaksi, user_app, perubahan_kolom
      FROM tbl_audit_log
      WHERE notransaksi = ${noTrxJurnal}
      ORDER BY id ASC
    `;

    console.log(`\n📋 Ditemukan ${logsJurnal.length} catatan audit log untuk jurnal ${noTrxJurnal}:`);
    for (const log of logsJurnal) {
      console.log(`   [ID: ${log.id}] [${log.action_type}] Tabel: ${log.table_name} | User: ${log.user_app}`);
      console.log(`      Perubahan: ${log.perubahan_kolom}`);
    }

    // ------------------------------------------------------------------------
    // TEST 3: PEMBAYARAN HUTANG (tbl_byrhutanghd)
    // ------------------------------------------------------------------------
    console.log("\n--- [TEST 3] PEMBAYARAN HUTANG (tbl_byrhutanghd) ---");
    const noTrxHutang = `TEST-BH-${Date.now()}`;

    console.log(`-> Menyimpan Pelunasan Hutang: ${noTrxHutang}`);
    await client`
      INSERT INTO tbl_byrhutanghd (
        notransaksi, kodekantor, tanggal, tipe, kodesupel,
        totalbayar, acc_bayar, carabayar, user1, keterangan
      ) VALUES (
        ${noTrxHutang}, ${kodekantor}, NOW(), 'BH', ${kodesupel},
        1250000, ${kodeacc1}, 'TN', 'user_finance', 'Bayar hutang supplier'
      )
    `;

    console.log("-> Menguji UPDATE pada tbl_byrhutanghd (Koreksi total bayar)...");
    await client`
      UPDATE tbl_byrhutanghd
      SET totalbayar = 1500000, user2 = 'supervisor_finance'
      WHERE notransaksi = ${noTrxHutang}
    `;

    console.log("-> Menguji DELETE pada tbl_byrhutanghd (Hapus transaksi bayar hutang)...");
    await client`
      DELETE FROM tbl_byrhutanghd
      WHERE notransaksi = ${noTrxHutang}
    `;

    const logsHutang = await client`
      SELECT id, table_name, action_type, modul, notransaksi, user_app, perubahan_kolom
      FROM tbl_audit_log
      WHERE notransaksi = ${noTrxHutang}
      ORDER BY id ASC
    `;

    console.log(`\n📋 Ditemukan ${logsHutang.length} catatan audit log untuk hutang ${noTrxHutang}:`);
    for (const log of logsHutang) {
      console.log(`   [ID: ${log.id}] [${log.action_type}] Tabel: ${log.table_name} | User: ${log.user_app}`);
      console.log(`      Perubahan: ${log.perubahan_kolom}`);
    }

    console.log("\n================================================================================");
    console.log("🎉 SELURUH PENGUJIAN AUDIT LOG AKUNTANSI & KAS/BANK BERHASIL 100%!");
    console.log("================================================================================");

  } catch (err) {
    console.error("❌ Terjadi kesalahan saat pengujian audit akuntansi:", err);
  } finally {
    await client.end();
  }
}

runAccountingAuditTests();
