"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  CalendarSync,
  CalendarCheck,
  CalendarDays,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Database,
  ArrowRight,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Boxes,
  ShieldAlert,
  Download,
  Clock,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function PeriodClosingPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly" | "history">("monthly");
  const [status, setStatus] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Monthly Closing State
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [desdigit, setDesdigit] = useState<number>(2);
  const [closingMonth, setClosingMonth] = useState<boolean>(false);
  const [monthResult, setMonthResult] = useState<any | null>(null);
  const [showMonthModal, setShowMonthModal] = useState<boolean>(false);

  // Yearly Closing State
  const [yearlyYear, setYearlyYear] = useState<number>(2026);
  const [backupBeforeClosing, setBackupBeforeClosing] = useState<boolean>(true);
  const [confirmYearText, setConfirmYearText] = useState<string>("");
  const [closingYear, setClosingYear] = useState<boolean>(false);
  const [yearResult, setYearResult] = useState<any | null>(null);
  const [showYearModal, setShowYearModal] = useState<boolean>(false);

  // History search
  const [historyYearFilter, setHistoryYearFilter] = useState<string>("ALL");

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api.period.getStatus();
      setStatus(res);
      setSelectedMonth(res.currentMonth);
      setSelectedYear(res.currentYear);
      setYearlyYear(res.currentYear > 2000 ? res.currentYear - 1 : 2026);
      loadPeriodSummary(res.currentMonth, res.currentYear);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat status periode");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.period.getHistory();
      setHistory(res || []);
    } catch (err: any) {
      console.error("Gagal memuat riwayat periode:", err);
    }
  };

  const loadPeriodSummary = async (m: number, y: number) => {
    try {
      setLoadingSummary(true);
      const res = await api.period.getSummary(m, y);
      setSummary(res);
    } catch (err: any) {
      console.error("Gagal memuat ringkasan periode:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadHistory();
  }, []);

  const handleMonthChange = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
    loadPeriodSummary(m, y);
  };

  const handleExecuteMonthClosing = async () => {
    setClosingMonth(true);
    setMonthResult(null);
    try {
      const res = await api.period.closeMonth({
        month: selectedMonth,
        year: selectedYear,
        desdigit,
      });
      setMonthResult(res);
      toast.success(res.message || "Tutup buku bulanan berhasil dijalankan!");
      setShowMonthModal(false);
      // Reload status & history
      await loadStatus();
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Gagal menjalankan proses data bulanan");
    } finally {
      setClosingMonth(false);
    }
  };

  const handleExecuteYearClosing = async () => {
    if (confirmYearText.trim() !== `TUTUP TAHUN ${yearlyYear}`) {
      toast.error(`Ketik konfirmasi dengan tepat: TUTUP TAHUN ${yearlyYear}`);
      return;
    }

    setClosingYear(true);
    setYearResult(null);
    try {
      const res = await api.period.closeYear({
        year: yearlyYear,
        backupBeforeClosing,
      });
      setYearResult(res);
      toast.success(res.message || "Tutup buku tahunan berhasil!");
      setShowYearModal(false);
      setConfirmYearText("");
      // Reload status & history
      await loadStatus();
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Gagal menjalankan proses data tahunan");
    } finally {
      setClosingYear(false);
    }
  };

  const exportHistoryCsv = () => {
    if (!history || history.length === 0) {
      toast.error("Tidak ada data riwayat untuk diekspor");
      return;
    }

    const headers = [
      "Tahun",
      "Bulan",
      "Nama Bulan",
      "Total SKU",
      "Nilai Saldo Awal (Rp)",
      "Nilai Mutasi Masuk (Rp)",
      "Nilai Mutasi Keluar (Rp)",
      "Nilai Saldo Akhir (Rp)",
    ];

    const rows = history.map((h) => [
      h.tahun,
      h.bulan,
      `"${h.bulanNama}"`,
      h.totalSku,
      h.totalNilaiAwal.toFixed(2),
      h.totalNilaiMasuk.toFixed(2),
      h.totalNilaiKeluar.toFixed(2),
      h.totalNilaiAkhir.toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `riwayat_tutup_buku_ipos4_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Riwayat Tutup Buku berhasil diunduh");
  };

  const filteredHistory = historyYearFilter === "ALL"
    ? history
    : history.filter((h) => h.tahun.toString() === historyYearFilter);

  const availableYears = Array.from(new Set(history.map((h) => h.tahun))).sort((a, b) => b - a);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400">
              <CalendarSync className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Proses Data & Tutup Buku Periode
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Native iPos 4 Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Rekalkulasi kartu stok mutasi, pemindahan batch FIFO saldo akhir, penutupan laba/rugi & saldo neraca.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pill Badge & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-400">Periode Aktif:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {status ? `${status.monthName} ${status.currentYear}` : "Memuat..."}
            </span>
          </div>

          <button
            onClick={() => {
              loadStatus();
              loadHistory();
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition flex items-center gap-1.5"
          >
            <CalendarDays className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Periode Berjalan</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white font-mono">
              {status ? `${status.monthName} ${status.currentYear}` : "..."}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
              Bulan {status?.currentMonth || 1} dari 12
              {status?.isYearEnd && (
                <span className="text-amber-400 font-bold ml-1">(Bulan Terakhir)</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Awal Pembukuan</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white font-mono">
              {status ? `${MONTH_NAMES[(status.startMonth || 1) - 1]} ${status.startYear}` : "..."}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Basis data historis master iPos 4.0
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Arsip Rekap Mutasi</span>
            <Boxes className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-white font-mono">
              {formatNumber(history.length)} Bulan
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Tercatat dalam tabel <code className="text-zinc-300">tbl_item_rekap</code>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Integritas Transaksi</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Periode Terkunci</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Transaksi sebelum {status?.monthName} {status?.currentYear} dilindungi
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === "monthly"
              ? "bg-zinc-900 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/50"
          }`}
        >
          <CalendarSync className="w-4 h-4" />
          <span>Proses Data Bulanan (Monthly Closing)</span>
        </button>

        <button
          onClick={() => setActiveTab("yearly")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === "yearly"
              ? "bg-zinc-900 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Tutup Buku Tahunan (Yearly Closing)</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === "history"
              ? "bg-zinc-900 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/50"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Riwayat Tutup Periode & Rekap Mutasi</span>
        </button>
      </div>

      {/* TAB 1: PROSES DATA BULANAN */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          {/* Explainer / Workflow Guide */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                <CalendarSync className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white">
                  Mekanisme Proses Data Bulanan iPos 4.0 (Stored Procedure Engine)
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Proses data bulanan mengeksekusi dua fungsi inti database PostgreSQL:{" "}
                  <code className="text-emerald-300 font-mono">proses_item_mutasi(pbulan, ptahun, pdesdigit)</code> untuk
                  menghitung rekapitulasi mutasi stok seluruh item, dan{" "}
                  <code className="text-emerald-300 font-mono">proseshppsaldoakhir(pbulan, ptahun)</code> untuk
                  memindahkan lapisan FIFO (<code className="text-zinc-300">tbl_item_im</code>) yang bersisa ke saldo awal
                  bulan berikutnya (<code className="text-zinc-300">tbl_item_sa</code>) sebagai{" "}
                  <span className="text-zinc-200 font-semibold">SA-ITEM-B</span>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">1</span>
                  Hitung Mutasi Stok
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Akumulasi kuantitas masuk, keluar, dan penyesuaian opname di seluruh gudang.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">2</span>
                  Update Nilai HPP
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Hitung harga pokok rata-rata dan nilai persediaan akhir di <code className="text-zinc-300 font-mono">tbl_item_rekap</code>.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">3</span>
                  Transfer Batch FIFO
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Batch masuk yang belum habis dipindahkan otomatis menjadi saldo awal bulan depan.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">4</span>
                  Kunci & Majukan Periode
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Konfigurasi <code className="text-zinc-300 font-mono">ACC_CURRENT_MONTH</code> dimajukan dan periode lama dikunci.
                </div>
              </div>
            </div>
          </div>

          {/* Form & Current Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Configuration Form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
                Pilih Periode Yang Akan Diproses
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(parseInt(e.target.value, 10), selectedYear)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {idx + 1} - {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Tahun</label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => handleMonthChange(selectedMonth, parseInt(e.target.value, 10) || 2027)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Digit Pembulatan HPP (Desimal)
                  </label>
                  <select
                    value={desdigit}
                    onChange={(e) => setDesdigit(parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={2}>2 Desimal (Standar iPos 4.0 - Rp 0.00)</option>
                    <option value={0}>0 Desimal (Pembulatan Penuh - Rp 0)</option>
                    <option value={4}>4 Desimal (Presisi Tinggi)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowMonthModal(true)}
                  disabled={closingMonth}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition"
                >
                  <CalendarSync className={`w-4 h-4 ${closingMonth ? "animate-spin" : ""}`} />
                  <span>Jalankan Proses Data Bulanan</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-500 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Perhatian</span>
                </div>
                <p>
                  Proses ini dapat memakan waktu beberapa detik hingga 1 menit tergantung volume mutasi barang. Selama proses
                  berjalan, jangan matikan server database.
                </p>
              </div>
            </div>

            {/* Right: Activity Summary for Selected Period */}
            <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    Ringkasan Transaksi Periode: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </h3>
                  {loadingSummary && (
                    <span className="text-xs text-zinc-400 animate-pulse">Menghitung data...</span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                      <span>Penjualan</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-base font-bold text-emerald-400 font-mono">
                      Rp {formatNumber(summary?.salesTotal || 0)}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {formatNumber(summary?.salesCount || 0)} faktur tercatat
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                      <span>Pembelian</span>
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="mt-2 text-base font-bold text-blue-400 font-mono">
                      Rp {formatNumber(summary?.purchaseTotal || 0)}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {formatNumber(summary?.purchaseCount || 0)} faktur tercatat
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                      <span>Transfer Gudang</span>
                      <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="mt-2 text-base font-bold text-purple-400 font-mono">
                      {formatNumber(summary?.transferCount || 0)} Trs
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Perpindahan antar-lokasi
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                      <span>Voucher Kas/Bank</span>
                      <Receipt className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="mt-2 text-base font-bold text-amber-400 font-mono">
                      {formatNumber(summary?.cashTransactionsCount || 0)} Trs
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Penerimaan & pengeluaran kas
                    </div>
                  </div>

                  <div className="col-span-2 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                      <span>Estimasi Margin Bruto (Sales - Cost)</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-base font-bold text-white font-mono">
                      Rp {formatNumber(summary?.netProfitEstimate || 0)}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Estimasi profit periode berjalan sebelum beban operasional
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Feedback Banner */}
              {monthResult && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{monthResult.message}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-emerald-950/80 p-2 rounded border border-emerald-900">
                      Bulan Ditutup: <strong>{monthResult.details?.closedMonth}/{monthResult.details?.closedYear}</strong>
                    </div>
                    <div className="bg-emerald-950/80 p-2 rounded border border-emerald-900">
                      Bulan Dibuka: <strong>{monthResult.details?.newCurrentMonth}/{monthResult.details?.newCurrentYear}</strong>
                    </div>
                    <div className="bg-emerald-950/80 p-2 rounded border border-emerald-900">
                      Item Rekap: <strong>{formatNumber(monthResult.details?.rekapRows || 0)} baris</strong>
                    </div>
                    <div className="bg-emerald-950/80 p-2 rounded border border-emerald-900">
                      Batch FIFO: <strong>{formatNumber(monthResult.details?.fifoOpeningBatches || 0)} layer</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROSES DATA TAHUNAN */}
      {activeTab === "yearly" && (
        <div className="space-y-6">
          {/* Explainer / Workflow Guide */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-950 text-purple-400 rounded-lg shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white">
                  Mekanisme Tutup Buku Akhir Tahun (Year-End Financial Rollover)
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Tutup buku tahunan menutup seluruh akun pendapatan dan beban nominal, lalu membukukan selisih laba/rugi
                  bersih ke akun <code className="text-purple-300 font-mono">3-2000 (LABA DITAHAN)</code> dari akun{" "}
                  <code className="text-purple-300 font-mono">3-3000 (LABA TAHUN BERJALAN)</code> via Jurnal Penutup
                  Otomatis. Selanjutnya, saldo akhir seluruh akun neraca riil (Aktiva, Kewajiban, Ekuitas) dipindahkan
                  menjadi Saldo Awal Neraca Tahun Baru (<code className="text-zinc-300">tbl_acc_sa</code>).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Auto-Backup Database
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Dump binary pg_dump dieksekusi otomatis sebagai proteksi sebelum modifikasi saldo awal tahun.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-400" />
                  Jurnal Penutup Laba
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Membuat jurnal khusus <code className="text-zinc-300 font-mono">JUR-CLOSE-YYYY</code> mentransfer 3-3000 ke 3-2000.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  Rollover Neraca
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Saldo akhir kas, bank, piutang, hutang, dan aset disalin ke saldo awal tahun baru di <code className="text-zinc-300 font-mono">tbl_acc_sa</code>.
                </div>
              </div>

              <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800/80">
                <div className="font-bold text-zinc-200 mb-1 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Kunci Tahun & Buka Baru
                </div>
                <div className="text-zinc-400 text-[11px] leading-relaxed">
                  Konfigurasi <code className="text-zinc-300 font-mono">ACC_CURRENT_YEAR</code> dimajukan dan pembukuan tahun lama dikunci.
                </div>
              </div>
            </div>
          </div>

          {/* Form & Yearly Execution Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-400" />
                Parameter Tutup Buku Tahunan
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Tahun Buku Yang Akan Ditutup
                  </label>
                  <input
                    type="number"
                    value={yearlyYear}
                    onChange={(e) => setYearlyYear(parseInt(e.target.value, 10) || 2026)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Tahun baru yang akan dibuka adalah: <strong className="text-purple-300 font-mono">{yearlyYear + 1}</strong>
                  </span>
                </div>

                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="chkBackup"
                    checked={backupBeforeClosing}
                    onChange={(e) => setBackupBeforeClosing(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="chkBackup" className="text-xs text-zinc-300 cursor-pointer">
                    <strong className="text-white block">Buat Backup Database Otomatis Sebelum Tutup Tahun</strong>
                    Sistem akan menjalankan pg_dump binary backup ke direktori backend/backups sebelum merollover data akun.
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowYearModal(true)}
                  disabled={closingYear}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 active:scale-98 text-white rounded-lg font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-purple-950/50 transition"
                >
                  <Sparkles className={`w-4 h-4 ${closingYear ? "animate-spin" : ""}`} />
                  <span>Mulai Prosedur Tutup Buku Tahunan</span>
                </button>
              </div>
            </div>

            {/* Right: Security & Warning Checklist */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Prasyarat & Aturan Integritas Tutup Tahun
                </h3>

                <ul className="space-y-2 text-xs text-zinc-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Pastikan seluruh proses data bulanan (Januari s.d Desember) tahun berjalan telah tuntas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Pastikan tidak ada transaksi penjualan, pembelian, atau transfer gudang yang tertunda / pending.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Stok opname fisik akhir tahun telah disesuaikan dan dibukukan.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Semua kasir telah melakukan closing drawer shift kasir [F8].</span>
                  </li>
                </ul>
              </div>

              {yearResult && (
                <div className="mt-4 p-4 rounded-xl bg-purple-950/60 border border-purple-800/80 text-purple-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-purple-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{yearResult.message}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div className="bg-purple-950/80 p-2 rounded border border-purple-900">
                      Tahun Ditutup: <strong>{yearResult.details?.closedYear}</strong>
                    </div>
                    <div className="bg-purple-950/80 p-2 rounded border border-purple-900">
                      Tahun Baru: <strong>{yearResult.details?.newCurrentYear}</strong>
                    </div>
                    <div className="bg-purple-950/80 p-2 rounded border border-purple-900">
                      Laba Ditutup: <strong>Rp {formatNumber(yearResult.details?.netProfit || 0)}</strong>
                    </div>
                    <div className="bg-purple-950/80 p-2 rounded border border-purple-900">
                      Akun Neraca Rollover: <strong>{yearResult.details?.rolledOverAccounts} Akun</strong>
                    </div>
                  </div>
                  {yearResult.details?.backupPath && (
                    <div className="text-[10px] text-zinc-400 truncate font-mono">
                      Backup File: {yearResult.details?.backupPath}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT TUTUP PERIODE & REKAP MUTASI */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-semibold">Filter Tahun:</span>
              <select
                value={historyYearFilter}
                onChange={(e) => setHistoryYearFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="ALL">Semua Tahun ({history.length} Periode)</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr.toString()}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportHistoryCsv}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Rekap CSV</span>
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3 text-right">Total SKU</th>
                    <th className="px-4 py-3 text-right">Nilai Awal (Rp)</th>
                    <th className="px-4 py-3 text-right">Mutasi Masuk (Rp)</th>
                    <th className="px-4 py-3 text-right">Mutasi Keluar (Rp)</th>
                    <th className="px-4 py-3 text-right">Nilai Akhir (Rp)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        Belum ada riwayat rekapitulasi mutasi yang tercatat untuk filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((row, idx) => (
                      <tr key={`${row.tahun}-${row.bulan}`} className="hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3 font-sans font-bold text-white flex items-center gap-2">
                          <CalendarCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {row.bulanNama} {row.tahun}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatNumber(row.totalSku)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {formatNumber(row.totalNilaiAwal)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400">
                          +{formatNumber(row.totalNilaiMasuk)}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-400">
                          -{formatNumber(row.totalNilaiKeluar)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatNumber(row.totalNilaiAkhir)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-sans font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Selesai Ditutup
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: MONTHLY CLOSING */}
      {showMonthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl">
                <CalendarSync className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Proses Data Bulanan</h3>
                <p className="text-xs text-zinc-400">
                  Periode: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-300 space-y-2">
              <p>
                Anda akan mengeksekusi rekalkulasi mutasi dan penutupan buku untuk bulan{" "}
                <strong className="text-emerald-400">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </strong>
                .
              </p>
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-1 text-zinc-400">
                <div className="text-zinc-200 font-bold mb-1">Tindakan Otomatis Database:</div>
                <div>• Eksekusi fungsi <code className="text-zinc-300">proses_item_mutasi({selectedMonth}, {selectedYear})</code></div>
                <div>• Eksekusi fungsi <code className="text-zinc-300">proseshppsaldoakhir({selectedMonth}, {selectedYear})</code></div>
                <div>• Memajukan bulan aktif sistem ke bulan berikutnya</div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                disabled={closingMonth}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteMonthClosing}
                disabled={closingMonth}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
              >
                <CalendarSync className={`w-3.5 h-3.5 ${closingMonth ? "animate-spin" : ""}`} />
                <span>{closingMonth ? "Memproses Data..." : "Ya, Jalankan Sekarang"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: YEARLY CLOSING */}
      {showYearModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="p-2 bg-purple-950 text-purple-400 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Tutup Buku Akhir Tahun</h3>
                <p className="text-xs text-zinc-400">Tahun Buku: {yearlyYear} → {yearlyYear + 1}</p>
              </div>
            </div>

            <div className="text-xs text-zinc-300 space-y-3">
              <div className="p-3 bg-amber-950/50 border border-amber-800/80 rounded-lg text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Tindakan Permanen Akhir Periode</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Tutup buku akhir tahun akan memindahkan laba/rugi ke Laba Ditahan, membukukan saldo neraca ke saldo awal
                  tahun baru, dan memajukan tahun pembukuan sistem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Untuk melanjutkan, ketik persis:{" "}
                  <code className="text-purple-400 font-mono select-all">TUTUP TAHUN {yearlyYear}</code>
                </label>
                <input
                  type="text"
                  value={confirmYearText}
                  onChange={(e) => setConfirmYearText(e.target.value)}
                  placeholder={`TUTUP TAHUN ${yearlyYear}`}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500 uppercase"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowYearModal(false);
                  setConfirmYearText("");
                }}
                disabled={closingYear}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteYearClosing}
                disabled={closingYear || confirmYearText.trim() !== `TUTUP TAHUN ${yearlyYear}`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-purple-950/50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${closingYear ? "animate-spin" : ""}`} />
                <span>{closingYear ? "Mengeksekusi Tutup Tahun..." : "Eksekusi Tutup Buku Tahunan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
