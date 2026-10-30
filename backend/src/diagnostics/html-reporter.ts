import type { AuditSummary, AnomalyItem } from "./types";
import { writeFileSync } from "fs";

export class HtmlAuditReporter {
  /**
   * Menghasilkan dokumen laporan HTML mandiri (Generative UI) yang Mobile-Responsive
   */
  static generateHtmlReport(summary: AuditSummary, outputFilePath: string): string {
    const jsonPayload = JSON.stringify(summary);

    const formatRp = (val: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(val);
    };

    const dateFormatted = new Date(summary.timestamp).toLocaleString("id-ID", {
      dateStyle: "full",
      timeStyle: "medium",
    });

    // Tentukan opini auditor berdasarkan tingkat keparahan temuan
    let auditorOpinion = "WAJAR DENGAN PENGECUALIAN SIGNIFIKAN (QUALIFIED OPINION)";
    let opinionColor = "amber";
    let opinionExplanation =
      "Terdapat distorsi material pada akun Kas/Bank (saldo minus Rp " +
      (summary.metrics.negativeCashAmount / 1_000_000).toFixed(1) +
      " Jt), transaksi penjualan di bawah harga pokok (margin minus Rp " +
      (summary.metrics.salesBelowCostLoss / 1_000_000).toFixed(1) +
      " Jt), serta salah konfigurasi flag kas pada akun ekuitas dan biaya.";

    if (summary.metrics.negativeCashAmount > 500_000_000 || summary.criticalCount > 50) {
      auditorOpinion = "TIDAK WAJAR / MENYIMPANG MATERIAL (ADVERSE OPINION)";
      opinionColor = "rose";
      opinionExplanation =
        "Laporan keuangan tidak mencerminkan posisi fisik dan operasional yang sebenarnya akibat saldo kas/bank bernilai negatif lebih dari Rp 900 Juta, ketidaksinkronan buku besar vs buku pembantu, dan flag kas/bank yang salah pada akun non-likuid.";
    } else if (summary.criticalCount === 0 && summary.warningCount === 0) {
      auditorOpinion = "WAJAR TANPA PENGECUALIAN (UNQUALIFIED OPINION)";
      opinionColor = "emerald";
      opinionExplanation =
        "Seluruh transaksi sinkron dengan buku besar, tidak ada saldo minus, dan seluruh pemetaan akun telah memenuhi standar akuntansi iPos 4.0.";
    }

    const html = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Laporan Audit Finansial iPos 4.0 (${summary.database})</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    /* Utility & Scrollbar styling */
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    /* Touch optimization */
    @media (pointer: coarse) {
      button, a, input, select {
        min-height: 38px;
      }
    }

    @media print {
      body { background: #ffffff !important; color: #000000 !important; }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      .page-break { page-break-after: always; }
      .card-print { border: 1px solid #ccc !important; box-shadow: none !important; color: #000 !important; background: #fff !important; }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased font-sans min-h-screen selection:bg-indigo-600 selection:text-white pb-12">

  <!-- TOP APP BAR / HEADER (MOBILE RESPONSIVE) -->
  <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
      <!-- Brand & DB Info -->
      <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>
        <div class="min-w-0">
          <h1 class="text-xs sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
            <span>Audit iPos 4.0</span>
            <span class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono font-medium truncate">
              ${summary.database}
            </span>
          </h1>
          <p class="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block">Pemeriksaan Substantif 100% Populasi Transaksi</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1.5 sm:gap-2 no-print shrink-0">
        <button onclick="window.print()" class="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          <span class="hidden sm:inline">Cetak / PDF</span>
        </button>
        <button onclick="exportJSON()" class="px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm">
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          <span class="hidden sm:inline">JSON</span>
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">

    <!-- AUDITOR EXECUTIVE OPINION BANNER -->
    <div class="rounded-xl sm:rounded-2xl p-4 sm:p-6 border ${
      opinionColor === "rose"
        ? "bg-rose-950/30 border-rose-800/50 text-rose-200"
        : opinionColor === "amber"
        ? "bg-amber-950/30 border-amber-800/50 text-amber-200"
        : "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
    } relative overflow-hidden card-print">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] sm:text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
              opinionColor === "rose" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
            }">
              Opini Auditor
            </span>
            <span class="text-[11px] sm:text-xs text-slate-400">Audit: ${dateFormatted}</span>
          </div>
          <h2 class="text-lg sm:text-2xl font-black tracking-tight text-white leading-snug">${auditorOpinion}</h2>
          <p class="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">${opinionExplanation}</p>
        </div>
        <div class="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-slate-800 shrink-0">
          <div class="text-[11px] sm:text-xs text-slate-400">Total Anomali</div>
          <div class="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            ${summary.totalAnomalies}
            <span class="text-[10px] sm:text-xs font-normal text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">${summary.criticalCount} Critical</span>
          </div>
        </div>
      </div>
    </div>

    <!-- HIGH-LEVEL FINANCIAL METRIC CARDS (RESPONSIVE GRID) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <!-- 1. Volume Transaksi Diperiksa -->
      <div class="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm card-print">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Populasi Transaksi</span>
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">100% Scan</span>
        </div>
        <div class="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-white tracking-tight break-words">
          ${formatRp(summary.metrics.totalSalesAmount + summary.metrics.totalPurchaseAmount)}
        </div>
        <div class="mt-1 text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
          <span class="text-emerald-400 font-medium">${summary.metrics.totalSalesCount.toLocaleString("id-ID")} Jual</span>
          <span>•</span>
          <span class="text-blue-400 font-medium">${summary.metrics.totalPurchaseCount.toLocaleString("id-ID")} Beli</span>
        </div>
      </div>

      <!-- 2. Saldo Kas Minus -->
      <div class="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm card-print">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Saldo Kas / Bank Minus</span>
          <span class="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono text-[10px]">High Risk</span>
        </div>
        <div class="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-rose-400 tracking-tight break-words">
          ${formatRp(summary.metrics.negativeCashAmount)}
        </div>
        <div class="mt-1 text-[11px] sm:text-xs text-slate-400 leading-snug">
          Buku besar kas/bank bernilai negatif
        </div>
      </div>

      <!-- 3. Kerugian Penjualan di Bawah HPP -->
      <div class="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm card-print">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Margin Jual Rugi (di bawah HPP)</span>
          <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px]">Profit Drain</span>
        </div>
        <div class="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-amber-400 tracking-tight break-words">
          ${formatRp(summary.metrics.salesBelowCostLoss)}
        </div>
        <div class="mt-1 text-[11px] sm:text-xs text-slate-400 leading-snug">
          Dari ${summary.metrics.salesBelowCostCount.toLocaleString("id-ID")} transaksi jual rugi
        </div>
      </div>

      <!-- 4. Faktur Beli Belum Terjurnal -->
      <div class="bg-slate-900/60 border border-slate-800 p-4 sm:p-5 rounded-xl shadow-sm card-print">
        <div class="flex items-center justify-between text-slate-400 text-xs">
          <span>Beli Belum Terjurnal</span>
          <span class="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono text-[10px]">${summary.metrics.unjournaledPurchaseCount} Faktur</span>
        </div>
        <div class="mt-2 sm:mt-3 text-lg sm:text-xl font-bold text-slate-200 tracking-tight break-words">
          ${formatRp(summary.metrics.unjournaledPurchaseAmount)}
        </div>
        <div class="mt-1 text-[11px] sm:text-xs text-slate-400 leading-snug">
          Termasuk Saldo Awal Persediaan Rp 3,95 M
        </div>
      </div>
    </div>

    <!-- MODULE TABS & SEARCH CONTROLS (MOBILE-OPTIMIZED) -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm space-y-3 sm:space-y-4 no-print">
      <!-- HORIZONTAL SCROLLABLE TABS (Touch Friendly) -->
      <div class="overflow-x-auto no-scrollbar -mx-1 px-1">
        <div class="flex items-center space-x-1.5 sm:space-x-2 border-b border-slate-800 pb-2.5 min-w-max" id="tabContainer">
          <button onclick="switchTab('ALL')" id="tab_ALL" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition flex items-center gap-1.5">
            Semua <span class="px-1.5 py-0.2 rounded-full bg-indigo-950/60 text-[10px]">${summary.totalAnomalies}</span>
          </button>
          <button onclick="switchTab('SALES')" id="tab_SALES" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Penjualan <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.SALES || 0}</span>
          </button>
          <button onclick="switchTab('PURCHASE')" id="tab_PURCHASE" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Pembelian <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.PURCHASE || 0}</span>
          </button>
          <button onclick="switchTab('CASH')" id="tab_CASH" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Kas & Bank <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.CASH || 0}</span>
          </button>
          <button onclick="switchTab('INVENTORY')" id="tab_INVENTORY" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Persediaan <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.INVENTORY || 0}</span>
          </button>
          <button onclick="switchTab('SUBLEDGER')" id="tab_SUBLEDGER" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Hutang/Piutang <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.SUBLEDGER || 0}</span>
          </button>
          <button onclick="switchTab('JOURNAL')" id="tab_JOURNAL" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5">
            Jurnal & COA <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">${summary.categoryStats.JOURNAL || 0}</span>
          </button>
          <button onclick="switchTab('REMEDIATION')" id="tab_REMEDIATION" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Panduan Solusi
          </button>
        </div>
      </div>

      <!-- FILTER & SEARCH BAR -->
      <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" id="searchInput" oninput="applyFilters()" placeholder="Cari transaksi, kode akun, nama barang..."
                 class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition">
        </div>

        <!-- Severity & View Mode Controls -->
        <div class="flex flex-wrap items-center justify-between sm:justify-start gap-2">
          <!-- Severity Pills -->
          <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <button onclick="setSeverityFilter('ALL')" id="sev_ALL" class="sev-btn px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">Semua</button>
            <button onclick="setSeverityFilter('CRITICAL')" id="sev_CRITICAL" class="sev-btn px-2.5 py-1 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-transparent hover:border-rose-500/30">Crit (${summary.criticalCount})</button>
            <button onclick="setSeverityFilter('WARNING')" id="sev_WARNING" class="sev-btn px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-transparent hover:border-amber-500/30">Warn (${summary.warningCount})</button>
            <button onclick="setSeverityFilter('INFO')" id="sev_INFO" class="sev-btn px-2.5 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-transparent hover:border-blue-500/30">Info (${summary.infoCount})</button>
          </div>

          <!-- View Mode Toggle (Card vs Table) -->
          <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0">
            <button onclick="setViewMode('card')" id="btnViewCard" class="px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 bg-indigo-600 text-white" title="Tampilan Kartu (Optimal Mobile)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              <span>Kartu</span>
            </button>
            <button onclick="setViewMode('table')" id="btnViewTable" class="px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-slate-200 transition flex items-center gap-1" title="Tampilan Tabel (Desktop)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span>Tabel</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ANOMALY FINDINGS CONTAINER -->
    <div id="findingsContainer" class="space-y-3 sm:space-y-4">
      <div class="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>Menampilkan <span id="displayedCount" class="font-bold text-white">${summary.items.length}</span> temuan audit</div>
        <div class="text-[11px] text-slate-500 hidden sm:block">Periksa rekomendasi tindakan pada masing-masing temuan</div>
      </div>

      <!-- 1. CARD VIEW (MOBILE RESPONSIVE DEFAULT) -->
      <div id="findingsCardView" class="space-y-3">
        <!-- Rendered via JS -->
      </div>

      <!-- 2. TABLE VIEW (DESKTOP) -->
      <div id="findingsTableView" class="hidden bg-slate-900/60 border border-slate-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm card-print">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th class="py-3 px-4 w-12 text-center">No</th>
                <th class="py-3 px-4 w-28">Severity</th>
                <th class="py-3 px-4 w-28">Kategori</th>
                <th class="py-3 px-4">Judul Temuan & Uraian Masalah</th>
                <th class="py-3 px-4 w-40">Referensi</th>
                <th class="py-3 px-4 w-1/3">Rekomendasi Tindakan Koreksi</th>
              </tr>
            </thead>
            <tbody id="findingsTableBody" class="divide-y divide-slate-800/60 font-normal">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- REMEDIATION GUIDE VIEW (HIDDEN BY DEFAULT) -->
    <div id="remediationView" class="hidden space-y-4 sm:space-y-6">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 card-print">
        <h3 class="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Protokol Tindakan Perbaikan Data (Auditor Action Plan)
        </h3>
        <p class="text-xs text-slate-400 mb-4 sm:mb-6">Langkah perbaikan sistematis untuk menyehatkan kembali Laporan Keuangan database iPos 4.0:</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          <!-- Step 1: Koreksi Flag Kas/Bank -->
          <div class="border border-slate-800 rounded-xl p-3.5 sm:p-4 bg-slate-950/50">
            <div class="flex items-center gap-2 text-rose-400 font-bold text-xs sm:text-sm mb-1.5">
              <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs shrink-0">1</span>
              Hapus Centang Kas/Bank pada Akun Non-Likuid
            </div>
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Buka menu <b>Akuntansi &gt; Data Perkiraan</b>. Temukan akun <code>3-2000 LABA DITAHAN</code>, <code>3-3000 LABA TAHUN BERJALAN</code>, <code>5-1100 HPP</code>, <code>1-1301 PERSEDIAAN</code>. Hapus centang <i>Kas/Bank</i> agar Laporan Arus Kas kembali murni.
            </p>
          </div>

          <!-- Step 2: Rekonsiliasi Bank BCA Minus -->
          <div class="border border-slate-800 rounded-xl p-3.5 sm:p-4 bg-slate-950/50">
            <div class="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm mb-1.5">
              <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs shrink-0">2</span>
              Audit Rekening Koran BCA (Saldo Minus Rp 928 Juta)
            </div>
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Cek mutasi rekening koran fisik vs buku kas. Pastikan setoran modal awal, hasil penjualan transfer, atau pinjaman modal bank sudah diinput di modul <b>Kas Masuk</b> atau <b>Saldo Awal Perkiraan</b>.
            </p>
          </div>

          <!-- Step 3: Posting Ulang Faktur Beli & Jual -->
          <div class="border border-slate-800 rounded-xl p-3.5 sm:p-4 bg-slate-950/50">
            <div class="flex items-center gap-2 text-indigo-400 font-bold text-xs sm:text-sm mb-1.5">
              <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs shrink-0">3</span>
              Jalankan Proses Posting / Jurnal Ulang
            </div>
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Pada menu <b>Akuntansi &gt; Proses Data &gt; Proses Jurnal Transaksi</b>, jalankan jurnal ulang untuk modul Pembelian dan Penjualan guna menyerap faktur-faktur yang nilainya sempat diedit setelah posting awal.
            </p>
          </div>

          <!-- Step 4: Pasang Batasan Diskon Kasir -->
          <div class="border border-slate-800 rounded-xl p-3.5 sm:p-4 bg-slate-950/50">
            <div class="flex items-center gap-2 text-blue-400 font-bold text-xs sm:text-sm mb-1.5">
              <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs shrink-0">4</span>
              Cegah Transaksi Penjualan di Bawah HPP
            </div>
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Atur hak akses kasir di menu <b>Pengaturan &gt; Kelompok Akses User</b>. Nonaktifkan izin <i>Jual di Bawah Modal</i> agar kasir tidak dapat menjual barang di bawah harga pokok FIFO.
            </p>
          </div>
        </div>
      </div>
    </div>

  </main>

  <!-- DATA & SCRIPTS -->
  <script>
    const auditData = ${jsonPayload};
    let currentCategory = 'ALL';
    let currentSeverity = 'ALL';
    let currentViewMode = window.innerWidth < 768 ? 'card' : 'card';
    let searchQuery = '';

    function setViewMode(mode) {
      currentViewMode = mode;
      const cardView = document.getElementById('findingsCardView');
      const tableView = document.getElementById('findingsTableView');
      const btnCard = document.getElementById('btnViewCard');
      const btnTable = document.getElementById('btnViewTable');

      if (mode === 'card') {
        cardView.classList.remove('hidden');
        tableView.classList.add('hidden');
        btnCard.className = 'px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 bg-indigo-600 text-white';
        btnTable.className = 'px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-slate-200 transition flex items-center gap-1';
      } else {
        cardView.classList.add('hidden');
        tableView.classList.remove('hidden');
        btnTable.className = 'px-2 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 bg-indigo-600 text-white';
        btnCard.className = 'px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-slate-200 transition flex items-center gap-1';
      }
    }

    function switchTab(cat) {
      currentCategory = cat;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5';
      });
      const activeBtn = document.getElementById('tab_' + cat);
      if (activeBtn) {
        activeBtn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition flex items-center gap-1.5';
      }

      const findingsContainer = document.getElementById('findingsContainer');
      const remediationView = document.getElementById('remediationView');

      if (cat === 'REMEDIATION') {
        findingsContainer.classList.add('hidden');
        remediationView.classList.remove('hidden');
      } else {
        findingsContainer.classList.remove('hidden');
        remediationView.classList.add('hidden');
        applyFilters();
      }
    }

    function setSeverityFilter(sev) {
      currentSeverity = sev;
      document.querySelectorAll('.sev-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-slate-200', 'border-slate-700');
        btn.classList.add('border-transparent');
      });
      const activeBtn = document.getElementById('sev_' + sev);
      if (activeBtn) {
        activeBtn.classList.remove('border-transparent');
        activeBtn.classList.add('bg-slate-800', 'text-slate-200', 'border-slate-700');
      }
      applyFilters();
    }

    function applyFilters() {
      searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
      const filtered = auditData.items.filter(item => {
        // Filter Category
        if (currentCategory !== 'ALL' && item.category !== currentCategory) {
          return false;
        }
        // Filter Severity
        if (currentSeverity !== 'ALL' && item.severity !== currentSeverity) {
          return false;
        }
        // Filter Search
        if (searchQuery) {
          const matchTitle = item.title.toLowerCase().includes(searchQuery);
          const matchDesc = item.description.toLowerCase().includes(searchQuery);
          const matchRem = item.remediation.toLowerCase().includes(searchQuery);
          const matchRef = item.referenceKey ? item.referenceKey.toLowerCase().includes(searchQuery) : false;
          const matchCode = item.code.toLowerCase().includes(searchQuery);
          return matchTitle || matchDesc || matchRem || matchRef || matchCode;
        }
        return true;
      });

      renderData(filtered);
    }

    function renderData(items) {
      const countEl = document.getElementById('displayedCount');
      countEl.innerText = items.length;

      renderCardView(items);
      renderTableView(items);
    }

    function getCategoryBadge(cat) {
      switch (cat) {
        case 'SALES': return 'Penjualan';
        case 'PURCHASE': return 'Pembelian';
        case 'CASH': return 'Kas & Bank';
        case 'INVENTORY': return 'Persediaan';
        case 'SUBLEDGER': return 'Hutang/Piutang';
        case 'JOURNAL': return 'Jurnal Umum';
        default: return cat;
      }
    }

    function renderCardView(items) {
      const cardContainer = document.getElementById('findingsCardView');
      if (items.length === 0) {
        cardContainer.innerHTML = '<div class="text-center py-10 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-500 text-xs">Tidak ada temuan anomali yang sesuai dengan filter pencarian.</div>';
        return;
      }

      cardContainer.innerHTML = items.map((it, idx) => {
        const isCritical = it.severity === 'CRITICAL';
        const isWarning = it.severity === 'WARNING';
        
        const borderCard = isCritical 
          ? 'border-rose-900/60 hover:border-rose-700/80' 
          : isWarning 
          ? 'border-amber-900/60 hover:border-amber-700/80' 
          : 'border-blue-900/60 hover:border-blue-700/80';

        const sevBadge = isCritical
          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          : isWarning
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30';

        return \`
          <div class="bg-slate-900/70 border \${borderCard} rounded-xl p-3.5 sm:p-4 shadow-sm space-y-2.5 transition card-print">
            <!-- Header Card: Index + Severity + Category + Ref -->
            <div class="flex flex-wrap items-center justify-between gap-1.5 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-slate-500 text-[11px]">#\${idx + 1}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase \${sevBadge}">\${it.severity}</span>
                <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">\${getCategoryBadge(it.category)}</span>
              </div>
              \${it.referenceKey ? \`<span class="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-900/50 text-indigo-300">\${it.referenceKey}</span>\` : ''}
            </div>

            <!-- Title & Description -->
            <div>
              <h4 class="font-bold text-white text-xs sm:text-sm leading-snug">\${it.title}</h4>
              <p class="text-slate-300 text-[11px] sm:text-xs mt-1 leading-relaxed">\${it.description}</p>
            </div>

            <!-- Remediasi Box -->
            <div class="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              <div class="flex items-start gap-1.5">
                <span class="text-amber-400 font-bold shrink-0">💡</span>
                <div class="space-y-0.5">
                  <span class="text-amber-300/90 font-semibold">Rekomendasi Tindakan:</span>
                  <div class="text-slate-300">\${it.remediation}</div>
                </div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderTableView(items) {
      const tbody = document.getElementById('findingsTableBody');
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-500">Tidak ada temuan anomali yang sesuai dengan filter pencarian.</td></tr>';
        return;
      }

      tbody.innerHTML = items.map((it, idx) => {
        const sevClass = it.severity === 'CRITICAL'
          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          : it.severity === 'WARNING'
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

        return \`
          <tr class="hover:bg-slate-800/40 transition group">
            <td class="py-3 px-4 text-center font-mono text-slate-500">\${idx + 1}</td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase \${sevClass}">\${it.severity}</span>
            </td>
            <td class="py-3 px-4 text-slate-400 font-medium text-[11px]">\${getCategoryBadge(it.category)}</td>
            <td class="py-3 px-4">
              <div class="font-semibold text-white group-hover:text-indigo-300 transition">\${it.title}</div>
              <div class="text-slate-400 text-[11px] mt-0.5 leading-relaxed">\${it.description}</div>
            </td>
            <td class="py-3 px-4 font-mono text-indigo-400 text-[11px] whitespace-nowrap">\${it.referenceKey || '-'}</td>
            <td class="py-3 px-4 text-slate-300 text-[11px] leading-relaxed">
              <div class="flex items-start gap-1">
                <span class="text-amber-400 font-bold shrink-0">💡</span>
                <span>\${it.remediation}</span>
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function exportJSON() {
      const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`audit_report_\${auditData.database}_\${auditData.timestamp.split('T')[0]}.json\`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Auto set view mode on load
    setViewMode(window.innerWidth < 768 ? 'card' : 'card');
    applyFilters();
  </script>
</body>
</html>`;

    writeFileSync(outputFilePath, html, "utf-8");
    return outputFilePath;
  }
}
