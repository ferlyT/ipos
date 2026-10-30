import type { AuditSummary, AnomalyItem } from "./types";
import { writeFileSync } from "fs";
import { join } from "path";

export class AuditReporter {
  /**
   * Menampilkan ringkasan audit ke konsol terminal
   */
  static printConsole(summary: AuditSummary): void {
    console.log("\n================================================================================");
    console.log("       🔍 HASIL AUDIT DIAGNOSTIK DATABASE iPos 4.0 (PostgreSQL)");
    console.log("================================================================================");
    console.log(`Database Aktif : ${summary.database}`);
    console.log(`Waktu Scan     : ${summary.timestamp}`);
    console.log(`Total Anomali  : ${summary.totalAnomalies}`);
    console.log(`- 🔴 CRITICAL  : ${summary.criticalCount} (Penyebab Neraca / Laporan Invalid)`);
    console.log(`- 🟡 WARNING   : ${summary.warningCount} (Distorsi Nilai / Potensi Salah Tafsir)`);
    console.log(`- 🔵 INFO      : ${summary.infoCount} (Selisih Pembulatan / Catatan Minor)`);
    console.log("--------------------------------------------------------------------------------");
    console.log("Ringkasan Metrik Finansial:");
    console.log(`- Populasi Penjualan : ${summary.metrics.totalSalesCount.toLocaleString("id-ID")} Faktur (Rp ${summary.metrics.totalSalesAmount.toLocaleString("id-ID")})`);
    console.log(`- Populasi Pembelian : ${summary.metrics.totalPurchaseCount.toLocaleString("id-ID")} Faktur (Rp ${summary.metrics.totalPurchaseAmount.toLocaleString("id-ID")})`);
    console.log(`- Saldo Kas Minus    : Rp ${summary.metrics.negativeCashAmount.toLocaleString("id-ID")}`);
    console.log(`- Margin Jual Rugi   : Rp ${summary.metrics.salesBelowCostLoss.toLocaleString("id-ID")} (${summary.metrics.salesBelowCostCount} baris item)`);
    console.log("--------------------------------------------------------------------------------");
    console.log("Statistik per Modul Audit:");
    console.log(`- Audit Penjualan     : ${summary.categoryStats.SALES || 0}`);
    console.log(`- Audit Pembelian     : ${summary.categoryStats.PURCHASE || 0}`);
    console.log(`- Kas & Bank          : ${summary.categoryStats.CASH || 0}`);
    console.log(`- Persediaan & HPP    : ${summary.categoryStats.INVENTORY || 0}`);
    console.log(`- Rekonsiliasi AP/AR  : ${summary.categoryStats.SUBLEDGER || 0}`);
    console.log(`- Integritas Jurnal   : ${summary.categoryStats.JOURNAL || 0}`);
    console.log(`- Sinkronisasi Bayar  : ${summary.categoryStats.SYNC || 0}`);
    console.log(`- Validitas Tanggal   : ${summary.categoryStats.DATE || 0}`);
    console.log("================================================================================\n");

    if (summary.items.length === 0) {
      console.log("✅ Luar Biasa! Tidak ditemukan anomali pada database. Laporan keuangan valid dan sinkron.\n");
      return;
    }

    console.log("📋 15 TEMUAN ANOMALI UTAMA DENGAN REKOMENDASI PERBAIKAN:\n");
    const topItems = summary.items.slice(0, 15);

    topItems.forEach((item, idx) => {
      const badge =
        item.severity === "CRITICAL"
          ? "🔴 [CRITICAL]"
          : item.severity === "WARNING"
          ? "🟡 [WARNING ]"
          : "🔵 [INFO    ]";

      console.log(`${idx + 1}. ${badge} ${item.title}`);
      console.log(`   Keterangan : ${item.description}`);
      console.log(`   💡 Solusi  : ${item.remediation}\n`);
    });

    if (summary.items.length > 15) {
      console.log(`... dan ${summary.items.length - 15} temuan lainnya tercatat lengkap pada file laporan Markdown & HTML.\n`);
    }
  }

  /**
   * Menghasilkan dokumen laporan Markdown audit lengkap
   */
  static generateMarkdownReport(summary: AuditSummary, outputDir: string): string {
    const dateStr = summary.timestamp.split("T")[0];
    const fileName = `audit_report_${dateStr}.md`;
    const filePath = join(outputDir, fileName);

    const formatItemsTable = (items: AnomalyItem[]) => {
      if (items.length === 0) return "_Tidak ada anomali terdeteksi pada kategori ini._\n\n";

      let table = "| No | Severity | Kode | Judul Temuan & Deskripsi | Rekomendasi Solusi |\n";
      table += "| :---: | :---: | :--- | :--- | :--- |\n";

      items.forEach((it, idx) => {
        const sevBadge =
          it.severity === "CRITICAL"
            ? "**CRITICAL**"
            : it.severity === "WARNING"
            ? "*WARNING*"
            : "INFO";

        const desc = `**${it.title}**<br>${it.description.replace(/\n/g, " ")}`;
        const rem = it.remediation.replace(/\n/g, " ");

        table += `| ${idx + 1} | ${sevBadge} | \`${it.code}\` | ${desc} | ${rem} |\n`;
      });

      return table + "\n";
    };

    const salesItems = summary.items.filter((i) => i.category === "SALES");
    const purchaseItems = summary.items.filter((i) => i.category === "PURCHASE");
    const cashItems = summary.items.filter((i) => i.category === "CASH");
    const inventoryItems = summary.items.filter((i) => i.category === "INVENTORY");
    const subledgerItems = summary.items.filter((i) => i.category === "SUBLEDGER");
    const journalItems = summary.items.filter((i) => i.category === "JOURNAL");
    const syncItems = summary.items.filter((i) => i.category === "SYNC");
    const dateItems = summary.items.filter((i) => i.category === "DATE");

    const mdContent = `# Laporan Hasil Audit Diagnostik Database iPos 4.0

- **Database**: \`${summary.database}\`
- **Tanggal Audit**: ${summary.timestamp}
- **Total Anomali Terdeteksi**: **${summary.totalAnomalies}**
  - **CRITICAL**: ${summary.criticalCount} (Penyebab Neraca / Laba Rugi Rusak atau Tidak Seimbang)
  - **WARNING**: ${summary.warningCount} (Distorsi Nilai / HPP / Saldo Kas Minus)
  - **INFO**: ${summary.infoCount} (Selisih Pembulatan Minor)

---

## Ringkasan Finansial Populasi Data

| Parameter Finansial | Nilai Audit |
| :--- | :--- |
| **Total Omset Penjualan (5.457 Faktur)** | Rp ${summary.metrics.totalSalesAmount.toLocaleString("id-ID")} |
| **Total Nilai Pembelian (3.057 Faktur)** | Rp ${summary.metrics.totalPurchaseAmount.toLocaleString("id-ID")} |
| **Akumulasi Saldo Kas/Bank Minus** | Rp ${summary.metrics.negativeCashAmount.toLocaleString("id-ID")} |
| **Potensi Margin Hilang (Jual Rugi)** | Rp ${summary.metrics.salesBelowCostLoss.toLocaleString("id-ID")} (${summary.metrics.salesBelowCostCount} baris) |
| **Faktur Beli Belum Terjurnal** | Rp ${summary.metrics.unjournaledPurchaseAmount.toLocaleString("id-ID")} (${summary.metrics.unjournaledPurchaseCount} faktur) |

---

## Ringkasan per Domain Audit

| Domain | Jumlah Temuan |
| :--- | :---: |
| **1. Audit Penjualan (Sales)** | ${summary.categoryStats.SALES || 0} |
| **2. Audit Pembelian (Purchases)** | ${summary.categoryStats.PURCHASE || 0} |
| **3. Audit Kas & Bank (Likuiditas & Flag Akun)** | ${summary.categoryStats.CASH || 0} |
| **4. Integritas Persediaan & HPP** | ${summary.categoryStats.INVENTORY || 0} |
| **5. Rekonsiliasi Buku Pembantu Piutang / Hutang** | ${summary.categoryStats.SUBLEDGER || 0} |
| **6. Integritas Jurnal & Bagan Akun (COA)** | ${summary.categoryStats.JOURNAL || 0} |
| **7. Sinkronisasi Pembayaran Kas** | ${summary.categoryStats.SYNC || 0} |
| **8. Validitas Periode & Tanggal Transaksi** | ${summary.categoryStats.DATE || 0} |

---

## 1. Temuan Audit Penjualan
${formatItemsTable(salesItems)}

## 2. Temuan Audit Pembelian
${formatItemsTable(purchaseItems)}

## 3. Temuan Audit Kas & Bank
${formatItemsTable(cashItems)}

## 4. Temuan Integritas Persediaan & HPP
${formatItemsTable(inventoryItems)}

## 5. Temuan Rekonsiliasi Buku Pembantu (AP/AR)
${formatItemsTable(subledgerItems)}

## 6. Temuan Integritas Jurnal & Bagan Akun
${formatItemsTable(journalItems)}

## 7. Temuan Sinkronisasi Pembayaran Kas
${formatItemsTable(syncItems)}

## 8. Temuan Validitas Tanggal Transaksi
${formatItemsTable(dateItems)}

---

## Panduan Tindak Lanjut Perbaikan

1. **Prioritas Utama: Anomali CRITICAL**
   - **Salah Flag Kas (CSH_INVALID_FLAG)**: Segera edit akun Laba Ditahan, HPP, dan Persediaan di Master Data Perkiraan dan hilangkan centang 'Kas/Bank'.
   - **Faktur Beli Belum Terjurnal (PURCHASE_UNPOSTED)**: Lakukan posting ulang modul pembelian.
   - **Jurnal Tidak Seimbang (JUR_UNBALANCED)**: Pastikan transaksi yang selisih debet-kredit diperbaiki agar Neraca kembali seimbang.

2. **Prioritas Kedua: Anomali WARNING**
   - **Saldo Kas Minus (CSH_NEGATIVE_BALANCE)**: Telusuri rekening koran bank atau fisik kas kecil. Masukkan mutasi transfer masuk yang belum terinput.
   - **Penjualan di Bawah HPP (SALES_BELOW_COST)**: Kunci hak akses kasir agar tidak dapat menjual barang di bawah harga pokok modal.
   - **HPP Barang Rp 0 (INV_ZERO_HPP)**: Masukkan modal harga pokok riil barang agar laba kotor tidak fiktif 100%.

_Laporan ini digenerate secara otomatis oleh sistem diagnostik database iPos 4 berbasis Bun & Drizzle ORM._
`;

    writeFileSync(filePath, mdContent, "utf-8");
    return filePath;
  }
}
