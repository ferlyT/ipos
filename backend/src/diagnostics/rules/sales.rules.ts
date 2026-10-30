import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkSalesRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. SALES_UNPOSTED: Faktur penjualan atau retur jual aktif bernilai > 0 tanpa jurnal
  const unpostedActiveSales = await db.execute<any>(sql`
    SELECT 
      ik.notransaksi, 
      ik.tanggal, 
      ik.tipe,
      ik.totalakhir::float AS totalakhir,
      ik.kodesupel
    FROM tbl_ikhd ik
    LEFT JOIN tbl_accjurnal j ON ik.notransaksi = j.notransaksi
    WHERE j.notransaksi IS NULL AND ik.totalakhir > 0
    ORDER BY ik.tanggal DESC;
  `);

  for (const r of unpostedActiveSales) {
    const jenisText = r.tipe === "RJ" ? "Retur Penjualan" : "Faktur Penjualan";
    anomalies.push({
      id: `SALES_UNPOSTED_${r.notransaksi}`,
      code: "SALES_UNPOSTED",
      category: "SALES",
      severity: "CRITICAL",
      title: `${jenisText} Bernilai Belum Terjurnal (${r.notransaksi})`,
      description: `${jenisText} ${r.notransaksi} sebesar Rp ${r.totalakhir.toLocaleString("id-ID")} (tgl: ${r.tanggal}, pelanggan: ${r.kodesupel || "-"}) tidak ditemukan di buku jurnal umum. Nilai omset dan kas/piutang tidak tercatat di Laporan Keuangan.`,
      referenceKey: r.notransaksi,
      detectedValue: r.totalakhir,
      remediation: `Buka menu Penjualan / Kasir di iPos 4, periksa transaksi ${r.notransaksi}, lakukan simpan ulang atau jalankan 'Proses Jurnal Transaksi Penjualan' pada menu Akuntansi.`,
    });
  }

  // 2. SALES_EMPTY_DETAIL: Faktur penjualan header tanpa detail barang di tbl_ikdt
  const emptySalesHeaders = await db.execute<any>(sql`
    SELECT 
      ik.notransaksi, 
      ik.tanggal, 
      ik.tipe,
      ik.totalakhir::float AS totalakhir
    FROM tbl_ikhd ik
    LEFT JOIN tbl_ikdt dt ON ik.notransaksi = dt.notransaksi
    WHERE dt.notransaksi IS NULL
    ORDER BY ik.tanggal DESC;
  `);

  if (emptySalesHeaders.length > 0) {
    const activeEmpty = emptySalesHeaders.filter(h => h.totalakhir > 0);
    const zeroEmpty = emptySalesHeaders.filter(h => h.totalakhir === 0);

    for (const r of activeEmpty) {
      anomalies.push({
        id: `SALES_EMPTY_ACTIVE_${r.notransaksi}`,
        code: "SALES_EMPTY_DETAIL",
        category: "SALES",
        severity: "CRITICAL",
        title: `Faktur Penjualan Tanpa Rincian Barang (${r.notransaksi})`,
        description: `Faktur penjualan ${r.notransaksi} mencatat total Rp ${r.totalakhir.toLocaleString("id-ID")}, namun tidak memiliki rincian item barang pada tabel detail (tbl_ikdt). Potensi data rusak atau transaksi hantu (ghost invoice).`,
        referenceKey: r.notransaksi,
        detectedValue: r.totalakhir,
        remediation: `Periksa fisik nota faktur ${r.notransaksi}. Jika transaksi tidak valid, hapus faktur atau input ulang item barangnya.`,
      });
    }

    if (zeroEmpty.length > 0) {
      anomalies.push({
        id: "SALES_EMPTY_LEGACY_BATCH",
        code: "SALES_EMPTY_DETAIL",
        category: "SALES",
        severity: "INFO",
        title: `${zeroEmpty.length} Faktur Penjualan Kosong / Saldo Awal Terbengkalai`,
        description: `Ditemukan ${zeroEmpty.length} faktur penjualan dengan total Rp 0 dan tanpa detail item barang (sebagian besar transaksi historis/setup awal sebelum 2022). Tidak mempengaruhi nominal uang di neraca namun mengotori nomor urut faktur.`,
        detectedValue: zeroEmpty.length,
        remediation: `Lakukan pembersihan data historis atau biarkan jika diperlukan untuk kontinuitas nomor faktur terdahulu.`,
      });
    }
  }

  // 3. SALES_BELOW_COST: Penjualan di bawah harga pokok (Jual Rugi / Kebocoran Margin)
  const salesBelowCost = await db.execute<any>(sql`
    SELECT 
      dt.notransaksi,
      ik.tanggal,
      dt.kodeitem, 
      it.namaitem, 
      dt.harga::float AS harga_jual, 
      it.hargapokok::float AS hpp, 
      dt.jumlah::float AS qty,
      ((it.hargapokok - dt.harga) * dt.jumlah)::float AS potensi_rugi
    FROM tbl_ikdt dt
    JOIN tbl_item it ON dt.kodeitem = it.kodeitem
    JOIN tbl_ikhd ik ON dt.notransaksi = ik.notransaksi
    WHERE dt.harga < it.hargapokok AND it.hargapokok > 0 AND dt.harga > 0
    ORDER BY potensi_rugi DESC;
  `);

  if (salesBelowCost.length > 0) {
    const totalRugi = salesBelowCost.reduce((sum, r) => sum + r.potensi_rugi, 0);

    // Ambil top 20 kasus dengan potensi rugi terbesar
    const topCases = salesBelowCost.slice(0, 20);
    for (const r of topCases) {
      const severity = r.potensi_rugi >= 1000000 ? "CRITICAL" : "WARNING";
      anomalies.push({
        id: `SALES_LOSS_${r.notransaksi}_${r.kodeitem}`,
        code: "SALES_BELOW_COST",
        category: "SALES",
        severity,
        title: `Penjualan di Bawah HPP: ${r.namaitem} (${r.notransaksi})`,
        description: `Item '${r.namaitem}' dijual seharga Rp ${r.harga_jual.toLocaleString("id-ID")} padahal HPP tercatat Rp ${r.hpp.toLocaleString("id-ID")} (Selisih minus: Rp ${(r.hpp - r.harga_jual).toLocaleString("id-ID")}/satuan). Jumlah terjual: ${r.qty}. Total potensi kerugian kotor pada baris ini: Rp ${r.potensi_rugi.toLocaleString("id-ID")}.`,
        referenceKey: r.notransaksi,
        detectedValue: { harga_jual: r.harga_jual, hpp: r.hpp, qty: r.qty },
        discrepancy: r.potensi_rugi,
        remediation: `Audit kebijakan diskon kasir, cek apakah HPP di master item melonjak karena salah input faktur beli, atau apakah ada kesalahan input harga jual oleh staf kasir.`,
      });
    }

    if (salesBelowCost.length > 20) {
      anomalies.push({
        id: "SALES_LOSS_AGGREGATE",
        code: "SALES_BELOW_COST",
        category: "SALES",
        severity: "WARNING",
        title: `Rekapitulasi: ${salesBelowCost.length} Transaksi Terindikasi Jual Rugi (Total Margin Minus: Rp ${totalRugi.toLocaleString("id-ID")})`,
        description: `Terdapat total ${salesBelowCost.length} baris penjualan barang yang dijual di bawah HPP dengan akumulasi kebocoran margin laba kotor sebesar Rp ${totalRugi.toLocaleString("id-ID")}.`,
        detectedValue: totalRugi,
        remediation: `Tinjau aturan batasan diskon maksimal kasir di menu Pengaturan Pengguna iPos 4 agar sistem menolak transaksi yang harga jualnya di bawah HPP.`,
      });
    }
  }

  // 4. SALES_GL_DIFF: Selisih faktur penjualan vs mutasi jurnal
  const salesDiscrepancies = await db.execute<any>(sql`
    SELECT 
      ik.notransaksi,
      ik.tanggal,
      ik.totalakhir::float AS total_faktur,
      SUM(CASE WHEN j.kodeacc LIKE '1-11%' OR j.kodeacc LIKE '1-121%' THEN j.debet - j.kredit ELSE 0 END)::float AS kas_piutang_jurnal,
      ABS(ik.totalakhir - SUM(CASE WHEN j.kodeacc LIKE '1-11%' OR j.kodeacc LIKE '1-121%' THEN j.debet - j.kredit ELSE 0 END))::float AS selisih
    FROM tbl_ikhd ik
    JOIN tbl_accjurnal j ON ik.notransaksi = j.notransaksi
    WHERE ik.tipe = 'JL'
    GROUP BY ik.notransaksi, ik.tanggal, ik.totalakhir
    HAVING ABS(ik.totalakhir - SUM(CASE WHEN j.kodeacc LIKE '1-11%' OR j.kodeacc LIKE '1-121%' THEN j.debet - j.kredit ELSE 0 END)) > 10
    ORDER BY selisih DESC
    LIMIT 20;
  `);

  for (const r of salesDiscrepancies) {
    anomalies.push({
      id: `SALES_GL_DIFF_${r.notransaksi}`,
      code: "SALES_GL_DIFF",
      category: "SALES",
      severity: "CRITICAL",
      title: `Selisih Nilai Faktur Penjualan vs Jurnal (${r.notransaksi})`,
      description: `Faktur penjualan ${r.notransaksi} bernilai Rp ${r.total_faktur.toLocaleString("id-ID")}, namun jurnal Kas/Piutang mencatat Rp ${r.kas_piutang_jurnal.toLocaleString("id-ID")} (Selisih: Rp ${r.selisih.toLocaleString("id-ID")}).`,
      referenceKey: r.notransaksi,
      detectedValue: { faktur: r.total_faktur, jurnal: r.kas_piutang_jurnal },
      discrepancy: r.selisih,
      remediation: `Lakukan proses posting ulang / jurnal ulang untuk faktur penjualan ${r.notransaksi} agar sinkron dengan buku besar.`,
    });
  }

  return anomalies;
}
