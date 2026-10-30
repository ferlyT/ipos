import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkPurchaseRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. PURCHASE_UNPOSTED: Faktur pembelian operasional (tipe BL atau RB) bernilai > 0 tanpa jurnal
  // Catatan: Tipe 'SA' (Saldo Awal) dan 'SAH' (Saldo Awal Hutang) dikecualikan karena di iPos 4 dikelola melalui menu Saldo Awal Perkiraan (tbl_acc_sa)
  const unpostedActivePurchases = await db.execute<any>(sql`
    SELECT 
      im.notransaksi, 
      im.tanggal, 
      im.tipe,
      im.totalakhir::float AS totalakhir,
      im.kodesupel
    FROM tbl_imhd im
    LEFT JOIN tbl_accjurnal j ON im.notransaksi = j.notransaksi
    WHERE j.notransaksi IS NULL 
      AND im.totalakhir > 0 
      AND im.tipe IN ('BL', 'RB')
    ORDER BY im.tanggal DESC;
  `);

  for (const r of unpostedActivePurchases) {
    const jenisText = r.tipe === "RB" ? "Retur Pembelian" : "Faktur Pembelian";

    anomalies.push({
      id: `PURCHASE_UNPOSTED_${r.notransaksi}`,
      code: "PURCHASE_UNPOSTED",
      category: "PURCHASE",
      severity: "CRITICAL",
      title: `${jenisText} Belum Terjurnal (${r.notransaksi})`,
      description: `${jenisText} ${r.notransaksi} sebesar Rp ${r.totalakhir.toLocaleString("id-ID")} (tgl: ${r.tanggal}, supplier: ${r.kodesupel || "-"}) tidak ditemukan di buku jurnal umum. Nilai persediaan masuk dan kewajiban hutang supplier hilang dari Laporan Keuangan Neraca.`,
      referenceKey: r.notransaksi,
      detectedValue: r.totalakhir,
      remediation: `Buka menu Pembelian di iPos 4, buka faktur ${r.notransaksi}, lakukan simpan ulang atau jalankan 'Proses Jurnal Transaksi Pembelian' di menu Akuntansi.`,
    });
  }

  // 2. PURCHASE_EMPTY_DETAIL: Faktur pembelian tanpa detail barang
  const emptyPurchaseHeaders = await db.execute<any>(sql`
    SELECT 
      im.notransaksi, 
      im.tanggal, 
      im.tipe,
      im.totalakhir::float AS totalakhir
    FROM tbl_imhd im
    LEFT JOIN tbl_imdt dt ON im.notransaksi = dt.notransaksi
    WHERE dt.notransaksi IS NULL
    ORDER BY im.tanggal DESC;
  `);

  if (emptyPurchaseHeaders.length > 0) {
    const activeEmpty = emptyPurchaseHeaders.filter(h => h.totalakhir > 0 && (h.tipe === 'BL' || h.tipe === 'RB'));
    const zeroEmpty = emptyPurchaseHeaders.filter(h => h.totalakhir === 0 || h.tipe === 'SA' || h.tipe === 'SAH');

    for (const r of activeEmpty) {
      anomalies.push({
        id: `PURCHASE_EMPTY_ACTIVE_${r.notransaksi}`,
        code: "PURCHASE_EMPTY_DETAIL",
        category: "PURCHASE",
        severity: "CRITICAL",
        title: `Faktur Pembelian Tanpa Rincian Barang (${r.notransaksi})`,
        description: `Faktur pembelian ${r.notransaksi} mencatat total tagihan Rp ${r.totalakhir.toLocaleString("id-ID")}, namun tidak memiliki detail item barang pada tabel 'tbl_imdt'.`,
        referenceKey: r.notransaksi,
        detectedValue: r.totalakhir,
        remediation: `Periksa surat jalan atau tagihan supplier untuk faktur ${r.notransaksi}. Input ulang detail barang atau batalkan faktur bila tidak valid.`,
      });
    }

    if (zeroEmpty.length > 0) {
      anomalies.push({
        id: "PURCHASE_EMPTY_LEGACY_BATCH",
        code: "PURCHASE_EMPTY_DETAIL",
        category: "PURCHASE",
        severity: "INFO",
        title: `${zeroEmpty.length} Faktur Pembelian Kosong / Saldo Awal Terbengkalai`,
        description: `Ditemukan ${zeroEmpty.length} faktur pembelian dengan nominal Rp 0 tanpa rincian barang (sebagian besar rekaman setup awal sebelum 2022).`,
        detectedValue: zeroEmpty.length,
        remediation: `Biarkan sebagai riwayat log atau bersihkan bila ingin merapikan database.`,
      });
    }
  }

  // 3. PURCHASE_ZERO_PRICE: Pembelian dengan harga satuan Rp 0
  const zeroPricePurchases = await db.execute<any>(sql`
    SELECT 
      dt.notransaksi, 
      im.tanggal,
      dt.kodeitem, 
      it.namaitem, 
      dt.harga::float AS harga, 
      dt.jumlah::float AS qty,
      im.kodesupel
    FROM tbl_imdt dt
    JOIN tbl_item it ON dt.kodeitem = it.kodeitem
    JOIN tbl_imhd im ON dt.notransaksi = im.notransaksi
    WHERE dt.harga <= 0 AND im.tipe = 'BL'
    ORDER BY im.tanggal DESC;
  `);

  for (const r of zeroPricePurchases) {
    anomalies.push({
      id: `PURCHASE_ZERO_${r.notransaksi}_${r.kodeitem}`,
      code: "PURCHASE_ZERO_PRICE",
      category: "PURCHASE",
      severity: "WARNING",
      title: `Pembelian Harga Rp 0: ${r.namaitem} (${r.notransaksi})`,
      description: `Item '${r.namaitem}' dibeli dengan harga Rp 0 sebanyak ${r.qty} unit pada faktur ${r.notransaksi} (tgl: ${r.tanggal}, supplier: ${r.kodesupel || "-"}). Hal ini dapat merusak kalkulasi metode rata-rata (moving average) HPP menjadi turun drastis.`,
      referenceKey: r.notransaksi,
      detectedValue: { item: r.namaitem, qty: r.qty, harga: r.harga },
      remediation: `Jika ini bukan sampel gratis atau bonus resmi dari supplier, edit faktur ${r.notransaksi} dan isi harga beli sebenarnya. Jika memang bonus, pastikan perlakuan akuntansi persediaan disesuaikan.`,
    });
  }

  // 4. PURCHASE_GL_DIFF: Selisih faktur pembelian vs jurnal persediaan / hutang
  const purchaseGLDiff = await db.execute<any>(sql`
    SELECT 
      im.notransaksi, 
      im.tanggal, 
      im.totalakhir::float AS total_faktur,
      SUM(CASE WHEN j.kodeacc LIKE '2-11%' OR j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END)::float AS hutang_kas_jurnal,
      ABS(im.totalakhir - SUM(CASE WHEN j.kodeacc LIKE '2-11%' OR j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END))::float AS selisih
    FROM tbl_imhd im
    JOIN tbl_accjurnal j ON im.notransaksi = j.notransaksi
    WHERE im.tipe = 'BL'
    GROUP BY im.notransaksi, im.tanggal, im.totalakhir
    HAVING ABS(im.totalakhir - SUM(CASE WHEN j.kodeacc LIKE '2-11%' OR j.kodeacc LIKE '1-11%' THEN j.kredit - j.debet ELSE 0 END)) > 10
    ORDER BY selisih DESC
    LIMIT 20;
  `);

  for (const r of purchaseGLDiff) {
    anomalies.push({
      id: `PURCHASE_GL_DIFF_${r.notransaksi}`,
      code: "PURCHASE_GL_DIFF",
      category: "PURCHASE",
      severity: "CRITICAL",
      title: `Selisih Nilai Faktur Beli vs Jurnal Hutang/Kas (${r.notransaksi})`,
      description: `Faktur pembelian ${r.notransaksi} mencatat total Rp ${r.total_faktur.toLocaleString("id-ID")}, namun jurnal kewajiban/kas mencatat Rp ${r.hutang_kas_jurnal.toLocaleString("id-ID")} (Selisih: Rp ${r.selisih.toLocaleString("id-ID")}). Ini mengindikasikan adanya perubahan/edit faktur yang belum di-posting ulang ke akuntansi.`,
      referenceKey: r.notransaksi,
      detectedValue: { faktur: r.total_faktur, jurnal: r.hutang_kas_jurnal },
      discrepancy: r.selisih,
      remediation: `Buka faktur ${r.notransaksi} di menu Pembelian, pastikan total akhir sudah benar, lalu lakukan simpan ulang atau jalankan proses posting ulang akuntansi pembelian.`,
    });
  }

  return anomalies;
}
