import { db } from "./db";
import { CashBankService } from "./services/cash-bank.service";

async function run() {
  console.log("================================================================");
  console.log("   TESTING CASH & BANK, EXPENSES, DEPOSITS & CASH DRAWER");
  console.log("================================================================\n");

  try {
    // 1. List Cash & Bank Accounts
    console.log("--- [1] LIST CASH & BANK ACCOUNTS WITH REAL-TIME BALANCES ---");
    const accounts = await CashBankService.listCashBankAccounts();
    console.table(accounts);

    // 2. Test Kas Masuk (KASI) inside Rollback Transaction
    console.log("\n--- [2] TEST KAS MASUK (KASI) (TRANSACTION ROLLBACK) ---");
    try {
      await db.transaction(async (tx) => {
        const cashInResult = await CashBankService.recordCashIn({
          kodekantor: "UTM",
          kodeaccKasBank: "1-1110", // Kas Kecil
          kodeaccLawan: "7-3000",   // Pendapatan Lain-lain
          tanggal: new Date(),
          jumlah: 250000,
          keterangan: "Penerimaan Pendapatan Jasa Parkir & Titipan",
          user: "ADMIN"
        }, tx);

        console.log("Kas Masuk Berhasil Dicatat:");
        console.log({
          notransaksi: cashInResult.notransaksi,
          rekeningPenerima: `${cashInResult.kodeaccKasBank} (${cashInResult.namaKasBank})`,
          sumberDana: `${cashInResult.kodeaccLawan} (${cashInResult.namaLawan})`,
          nominal: `Rp ${cashInResult.jumlah.toLocaleString("id-ID")}`,
          keterangan: cashInResult.keterangan
        });

        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (err: any) {
      if (err.message === "ROLLBACK_FOR_TEST") {
        console.log(">> Transaksi KASI berhasil di-ROLLBACK dengan aman.");
      } else {
        throw err;
      }
    }

    // 3. Test Kas Keluar (KASO) inside Rollback Transaction
    console.log("\n--- [3] TEST KAS KELUAR (KASO) (TRANSACTION ROLLBACK) ---");
    try {
      await db.transaction(async (tx) => {
        const cashOutResult = await CashBankService.recordCashOut({
          kodekantor: "UTM",
          kodeaccKasBank: "1-1110", // Kas Kecil
          kodeaccBiaya: "6-1110",   // Biaya Operasional / Admin
          tanggal: new Date(),
          jumlah: 75000,
          keterangan: "Pembelian ATK dan Materai Operasional",
          user: "ADMIN"
        }, tx);

        console.log("Kas Keluar Berhasil Dicatat:");
        console.log({
          notransaksi: cashOutResult.notransaksi,
          rekeningPembayar: `${cashOutResult.kodeaccKasBank} (${cashOutResult.namaKasBank})`,
          bebanBiaya: `${cashOutResult.kodeaccBiaya} (${cashOutResult.namaBiaya})`,
          nominal: `Rp ${cashOutResult.jumlah.toLocaleString("id-ID")}`,
          keterangan: cashOutResult.keterangan
        });

        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (err: any) {
      if (err.message === "ROLLBACK_FOR_TEST") {
        console.log(">> Transaksi KASO berhasil di-ROLLBACK dengan aman.");
      } else {
        throw err;
      }
    }

    // 4. Test Mutasi Kas/Bank (KASTR) inside Rollback Transaction
    console.log("\n--- [4] TEST MUTASI TRANSFER KAS/BANK (KASTR) (TRANSACTION ROLLBACK) ---");
    try {
      await db.transaction(async (tx) => {
        const transferResult = await CashBankService.transferCashBank({
          kodekantor: "UTM",
          kodeaccAsal: "1-1120",   // Bank BCA
          kodeaccTujuan: "1-1110", // Kas Kecil Toko
          tanggal: new Date(),
          jumlah: 5000000,
          keterangan: "Tarik Tunai Bank BCA untuk Modal Kas Kecil Toko",
          user: "ADMIN"
        }, tx);

        console.log("Mutasi Kas/Bank Berhasil Dicatat:");
        console.log({
          notransaksi: transferResult.notransaksi,
          dari: `${transferResult.kodeaccAsal} (${transferResult.namaAsal})`,
          ke: `${transferResult.kodeaccTujuan} (${transferResult.namaTujuan})`,
          nominal: `Rp ${transferResult.jumlah.toLocaleString("id-ID")}`,
          keterangan: transferResult.keterangan
        });

        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (err: any) {
      if (err.message === "ROLLBACK_FOR_TEST") {
        console.log(">> Transaksi KASTR berhasil di-ROLLBACK dengan aman.");
      } else {
        throw err;
      }
    }

    // 5. Test Deposit Pelanggan (DP) inside Rollback Transaction
    console.log("\n--- [5] TEST DEPOSIT PELANGGAN (DP) (TRANSACTION ROLLBACK) ---");
    try {
      await db.transaction(async (tx) => {
        const depResult = await CashBankService.recordDeposit({
          kodekantor: "UTM",
          tipetrs: "DP",
          kodesupel: "PL0352",
          kodeaccKasBank: "1-1120", // Bank BCA
          tanggal: new Date(),
          jumlah: 1500000,
          keterangan: "Uang Muka Pemesanan Suku Cadang Mesin",
          user: "ADMIN"
        }, tx);

        console.log("Deposit Pelanggan Berhasil Dicatat:");
        console.log({
          notransaksi: depResult.notransaksi,
          tipe: depResult.tipetrs,
          pelanggan: `${depResult.kodesupel} (${depResult.namasupel})`,
          rekeningPenerima: depResult.kodeaccKasBank,
          nominal: `Rp ${depResult.jumlah.toLocaleString("id-ID")}`
        });

        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (err: any) {
      if (err.message === "ROLLBACK_FOR_TEST") {
        console.log(">> Transaksi DP berhasil di-ROLLBACK dengan aman.");
      } else {
        throw err;
      }
    }

    // 6. Test Cash Drawer Management (Open & Close Shift)
    console.log("\n--- [6] TEST CASH DRAWER SHIFT & RECONCILIATION (TRANSACTION ROLLBACK) ---");
    try {
      await db.transaction(async (tx) => {
        // A. Buka shift kasir dengan kas awal Rp 200.000
        const openShift = await CashBankService.openCashDrawer({
          namaUser: "KASIR1",
          shift: "1",
          namaKomputer: "POS-KASIR-01",
          kasAwal: 200000
        }, tx);

        console.log("Buka Shift Kasir Sukses:");
        console.log({
          notransaksi: openShift.notransaksi,
          kasir: openShift.namaUser,
          shift: openShift.shift,
          terminal: openShift.namaKomputer,
          kasAwal: `Rp ${openShift.kasAwal.toLocaleString("id-ID")}`,
          status: openShift.statusShift
        });

        // B. Tutup shift kasir dengan uang fisik Rp 200.000 (Balance)
        const closeShift = await CashBankService.closeCashDrawer({
          notransaksi: openShift.notransaksi,
          kasFisik: 200000,
          user: "KASIR1"
        }, tx);

        console.log("Tutup Shift & Rekonsiliasi Sukses:");
        console.log({
          notransaksi: closeShift.notransaksi,
          kasAwal: `Rp ${closeShift.kasAwal.toLocaleString("id-ID")}`,
          kasAkhirSistem: `Rp ${closeShift.kasAkhirSistem.toLocaleString("id-ID")}`,
          kasFisik: `Rp ${closeShift.kasFisik?.toLocaleString("id-ID")}`,
          selisih: `Rp ${closeShift.selisih?.toLocaleString("id-ID")}`,
          status: closeShift.statusShift
        });

        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (err: any) {
      if (err.message === "ROLLBACK_FOR_TEST") {
        console.log(">> Transaksi Laci Kasir berhasil di-ROLLBACK dengan aman.");
      } else {
        throw err;
      }
    }

    console.log("\n================================================================");
    console.log("   ALL CASH & BANK TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================");
    process.exit(0);
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

run();
