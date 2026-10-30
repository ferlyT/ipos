import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkCashRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. CSH_INVALID_FLAG: Akun non-kas/bank yang ditandai kasbank = true di master
  const invalidKasFlags = await db.execute<any>(sql`
    SELECT kodeacc, namaacc, kelompok, tipe
    FROM tbl_perkiraan
    WHERE kasbank = true
      AND (
        kelompok NOT IN ('1') 
        OR kodeacc NOT LIKE '1-11%'
      );
  `);

  for (const r of invalidKasFlags) {
    anomalies.push({
      id: `CSH_INVALID_FLAG_${r.kodeacc}`,
      code: "CSH_INVALID_FLAG",
      category: "CASH",
      severity: "CRITICAL",
      title: `Salah Konfigurasi Flag Kas/Bank (${r.kodeacc} - ${r.namaacc})`,
      description: `Akun '${r.namaacc}' (Kelompok: ${r.kelompok}) ditandai sebagai 'kasbank = true' di master data. Akun ini BUKAN akun kas/bank likuid, sehingga akan mengacaukan Laporan Arus Kas, Buku Kas, dan daftar pilihan kas pada modul transaksi.`,
      referenceKey: r.kodeacc,
      detectedValue: { kodeacc: r.kodeacc, kelompok: r.kelompok },
      remediation: `Buka menu Data Perkiraan di iPos 4, edit akun '${r.kodeacc}', dan hapus centang opsi 'Kas / Bank'.`,
    });
  }

  // 2. CSH_NEGATIVE_BALANCE: Akun kas / bank yang bersaldo negatif di Buku Besar
  const negativeCash = await db.execute<any>(sql`
    SELECT 
      p.kodeacc, 
      p.namaacc, 
      SUM(j.debet - j.kredit)::float AS saldo_kas
    FROM tbl_perkiraan p
    JOIN tbl_accjurnal j ON p.kodeacc = j.kodeacc
    WHERE p.kasbank = true AND p.kodeacc LIKE '1-11%'
    GROUP BY p.kodeacc, p.namaacc
    HAVING SUM(j.debet - j.kredit) < -1;
  `);

  for (const r of negativeCash) {
    anomalies.push({
      id: `CSH_NEGATIVE_BALANCE_${r.kodeacc}`,
      code: "CSH_NEGATIVE_BALANCE",
      category: "CASH",
      severity: "WARNING",
      title: `Saldo Kas/Bank Bernilai Minus (${r.kodeacc} - ${r.namaacc})`,
      description: `Akun '${r.namaacc}' memiliki akumulasi saldo minus sebesar Rp ${r.saldo_kas.toLocaleString("id-ID")}. Secara fisik uang kas tidak mungkin minus, dan di Neraca akan memunculkan nilai aset kas negatif yang aneh bagi pembaca laporan keuangan.`,
      referenceKey: r.kodeacc,
      detectedValue: r.saldo_kas,
      remediation: `Lakukan rekonsiliasi rekening koran/buku kas. Periksa apakah ada transaksi penerimaan (penjualan tunai, transfer masuk, setoran modal) yang belum diinput atau terjadi pengeluaran ganda. Jika merupakan fasilitas cerukan/pinjaman bank (overdraft), pindahkan saldo kewajiban ke akun Hutang Bank (Kelompok 2).`,
    });
  }

  // 3. CSH_UNJOURNALED: Bukti Kas di tbl_acckashd tanpa jurnal
  const unjournaledCash = await db.execute<any>(sql`
    SELECT 
      k.notransaksi, 
      k.tipe, 
      k.tanggal, 
      k.jumlah::float AS jumlah,
      k.keterangan
    FROM tbl_acckashd k
    LEFT JOIN tbl_accjurnal j ON k.notransaksi = j.notransaksi
    WHERE j.notransaksi IS NULL
    LIMIT 30;
  `);

  for (const r of unjournaledCash) {
    anomalies.push({
      id: `CSH_UNJOURNALED_${r.notransaksi}`,
      code: "CSH_UNJOURNALED",
      category: "CASH",
      severity: "CRITICAL",
      title: `Transaksi Kas Tidak Memiliki Jurnal (${r.notransaksi})`,
      description: `Bukti ${r.tipe} bernomor ${r.notransaksi} sebesar Rp ${r.jumlah.toLocaleString("id-ID")} (tgl: ${r.tanggal}) tidak tercatat pada buku jurnal 'tbl_accjurnal'. Pengeluaran/penerimaan ini hilang dari laporan keuangan.`,
      referenceKey: r.notransaksi,
      detectedValue: r.jumlah,
      remediation: `Buka menu Kas Masuk / Kas Keluar / Kas Transfer di iPos 4, cari transaksi ${r.notransaksi}, lakukan simpan ulang atau gunakan fitur proses jurnal ulang kas.`,
    });
  }

  // 4. CSH_TRANSFER_UNBALANCED: Kas Transfer KASTR yang tidak seimbang di jurnal
  const unbalancedTransfer = await db.execute<any>(sql`
    SELECT 
      k.notransaksi, 
      k.jumlah::float AS jumlah,
      k.tanggal,
      SUM(CASE WHEN j.debet > 0 THEN j.debet ELSE 0 END)::float AS tot_debet,
      SUM(CASE WHEN j.kredit > 0 THEN j.kredit ELSE 0 END)::float AS tot_kredit
    FROM tbl_acckashd k
    JOIN tbl_accjurnal j ON k.notransaksi = j.notransaksi
    WHERE k.tipe = 'KASTR'
    GROUP BY k.notransaksi, k.jumlah, k.tanggal
    HAVING ABS(SUM(CASE WHEN j.debet > 0 THEN j.debet ELSE 0 END) - k.jumlah) > 1
        OR ABS(SUM(CASE WHEN j.kredit > 0 THEN j.kredit ELSE 0 END) - k.jumlah) > 1
    LIMIT 20;
  `);

  for (const r of unbalancedTransfer) {
    anomalies.push({
      id: `CSH_TRANSFER_UNBALANCED_${r.notransaksi}`,
      code: "CSH_TRANSFER_UNBALANCED",
      category: "CASH",
      severity: "CRITICAL",
      title: `Kas Transfer Tidak Seimbang (${r.notransaksi})`,
      description: `Transaksi transfer antar kas ${r.notransaksi} bernilai Rp ${r.jumlah.toLocaleString("id-ID")}, namun mutasi jurnal debet kas tujuan (Rp ${r.tot_debet.toLocaleString("id-ID")}) atau kredit kas asal (Rp ${r.tot_kredit.toLocaleString("id-ID")}) tidak cocok.`,
      referenceKey: r.notransaksi,
      detectedValue: { jumlah: r.jumlah, debet: r.tot_debet, kredit: r.tot_kredit },
      remediation: `Periksa bukti Kas Transfer ${r.notransaksi}. Pastikan akun kas asal dan kas tujuan telah didebet dan dikredit dengan nilai yang persis sama.`,
    });
  }

  // 5. CSH_DRAWER_DIFF: Selisih kas laci kasir (POS Cash Drawer)
  const drawerDiff = await db.execute<any>(sql`
    SELECT 
      nama_user, 
      shift, 
      nama_komputer,
      kas_awal::float AS kas_awal,
      kas_masuk::float AS kas_masuk,
      kas_keluar::float AS kas_keluar,
      kas_akhir::float AS kas_akhir,
      (kas_awal + kas_masuk - kas_keluar)::float AS kas_seharusnya,
      ABS(kas_akhir - (kas_awal + kas_masuk - kas_keluar))::float AS selisih,
      wkt_akhir
    FROM tbl_kaslaci
    WHERE ABS(kas_akhir - (kas_awal + kas_masuk - kas_keluar)) > 10
    ORDER BY wkt_akhir DESC
    LIMIT 20;
  `);

  for (const r of drawerDiff) {
    anomalies.push({
      id: `CSH_DRAWER_DIFF_${r.nama_user}_${r.wkt_akhir}`,
      code: "CSH_DRAWER_DIFF",
      category: "CASH",
      severity: "WARNING",
      title: `Selisih Kas Laci Kasir (${r.nama_user} - Shift ${r.shift})`,
      description: `Pada penutupan kasir ${r.wkt_akhir}, kas fisik akhir tercatat Rp ${r.kas_akhir.toLocaleString("id-ID")}, sedangkan perhitungan sistem (Awal + Masuk - Keluar) adalah Rp ${r.kas_seharusnya.toLocaleString("id-ID")} (Selisih: Rp ${r.selisih.toLocaleString("id-ID")}).`,
      referenceKey: r.nama_user,
      detectedValue: { fisik: r.kas_akhir, sistem: r.kas_seharusnya },
      discrepancy: r.selisih,
      remediation: `Verifikasi fisik uang kas laci kasir pada shift tersebut. Jika ada kelebihan/kekurangan kas riil, buat Jurnal Penyesuaian ke akun 'Selisih Kas Kasir' agar buku kas cocok dengan fisik.`,
    });
  }

  return anomalies;
}
