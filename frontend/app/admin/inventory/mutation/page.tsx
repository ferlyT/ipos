"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { StockCardModal } from "@/components/stock-card-modal";
import {
  History,
  Search,
  RefreshCw,
  Calendar,
  Download,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  DollarSign,
  TrendingUp,
  MapPin,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MONTHS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const YEARS = [2026, 2025, 2024, 2023, 2022];

export default function InventoryMutationPage() {
  // Filter States
  const [periodMode, setPeriodMode] = useState<"monthly" | "custom">("monthly");
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [startDate, setStartDate] = useState<string>("2026-11-01");
  const [endDate, setEndDate] = useState<string>("2026-11-30");
  const [office, setOffice] = useState<string>("UTM");
  const [search, setSearch] = useState<string>("");
  const [showFinancial, setShowFinancial] = useState<boolean>(true);

  // Data States
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Modal Stock Card State
  const [selectedStockCardItem, setSelectedStockCardItem] = useState<string | null>(null);

  // Fetch warehouse list on mount and set current month
  useEffect(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1; // 1-12
    setSelectedMonth(currMonth);
    setSelectedYear(currYear);

    const mStr = String(currMonth).padStart(2, "0");
    const lastDay = new Date(currYear, currMonth, 0).getDate();
    const mStart = `${currYear}-${mStr}-01`;
    const mEnd = `${currYear}-${mStr}-${String(lastDay).padStart(2, "0")}`;

    setStartDate(mStart);
    setEndDate(mEnd);

    api.inventory
      .getWarehouses()
      .then((whs) => {
        if (whs && Array.isArray(whs)) {
          setWarehouses(whs);
        }
      })
      .catch(console.error);

    loadData(1, pageSize, search, mStart, mEnd, office);
  }, []);

  const loadData = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search,
    targetStart: string = startDate,
    targetEnd: string = endDate,
    targetOffice: string = office
  ) => {
    setLoading(true);
    try {
      const res = await api.inventory.getMutationSummary({
        startDate: targetStart,
        endDate: targetEnd,
        office: targetOffice,
        search: targetSearch,
        page: targetPage,
        limit: targetLimit,
      });

      if (res) {
        setItems(res.items || []);
        setSummary(res.summary || null);
        setTotalItems(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
        setPage(res.pagination?.page || 1);
      }
    } catch (err) {
      console.error("Gagal memuat rekapitulasi mutasi item:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData(1, pageSize, search, startDate, endDate, office);
  }, [office]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, pageSize, search, startDate, endDate, office);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, pageSize, search, startDate, endDate, office);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadData(1, newSize, search, startDate, endDate, office);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyMonthlyPeriod = (m: number, y: number) => {
    setSelectedMonth(m);
    setSelectedYear(y);
    setPeriodMode("monthly");
    const mStr = String(m).padStart(2, "0");
    const lastDay = new Date(y, m, 0).getDate();
    const s = `${y}-${mStr}-01`;
    const e = `${y}-${mStr}-${String(lastDay).padStart(2, "0")}`;
    setStartDate(s);
    setEndDate(e);
    setPage(1);
    loadData(1, pageSize, search, s, e, office);
  };

  const handlePrevMonth = () => {
    let nextM = selectedMonth - 1;
    let nextY = selectedYear;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    applyMonthlyPeriod(nextM, nextY);
  };

  const handleNextMonth = () => {
    let nextM = selectedMonth + 1;
    let nextY = selectedYear;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    applyMonthlyPeriod(nextM, nextY);
  };

  const handleApplyPreset = (
    type: "this_month" | "last_month" | "two_months_ago" | "year_to_date" | "prev_year"
  ) => {
    const now = new Date();
    const currY = now.getFullYear();
    const currM = now.getMonth() + 1;

    if (type === "this_month") {
      applyMonthlyPeriod(currM, currY);
    } else if (type === "last_month") {
      let m = currM - 1;
      let y = currY;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      applyMonthlyPeriod(m, y);
    } else if (type === "two_months_ago") {
      let m = currM - 2;
      let y = currY;
      if (m < 1) {
        m += 12;
        y -= 1;
      }
      applyMonthlyPeriod(m, y);
    } else if (type === "year_to_date") {
      setPeriodMode("custom");
      setSelectedYear(currY);
      const s = `${currY}-01-01`;
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(todayStr);
      setPage(1);
      loadData(1, pageSize, search, s, todayStr, office);
    } else if (type === "prev_year") {
      setPeriodMode("custom");
      const prevY = currY - 1;
      setSelectedYear(prevY);
      const s = `${prevY}-01-01`;
      const e = `${prevY}-12-31`;
      setStartDate(s);
      setEndDate(e);
      setPage(1);
      loadData(1, pageSize, search, s, e, office);
    }
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      // Ambil seluruh data sesuai filter periode, gudang, dan pencarian tanpa paginasi (limit: 0)
      const res = await api.inventory.getMutationSummary({
        startDate,
        endDate,
        office,
        search,
        page: 1,
        limit: 0,
      });

      const exportItems = res?.items || [];
      if (exportItems.length === 0) {
        alert("Tidak ada data mutasi untuk diekspor pada filter ini.");
        return;
      }

      const headers = [
        "Kode Item",
        "Nama Item",
        "Satuan",
        "Lokasi Rak",
        "Saldo Awal",
        "Total Masuk (+)",
        "Total Keluar (-)",
        "Saldo Akhir",
        ...(showFinancial
          ? [
              "Harga Pokok (HPP)",
              "Nilai Saldo Awal",
              "Nilai Masuk",
              "Nilai Keluar",
              "Nilai Saldo Akhir",
            ]
          : []),
      ];

      const rows = exportItems.map((it: any) => [
        `"${(it.kodeitem || "").replace(/"/g, '""')}"`,
        `"${(it.namaitem || "").replace(/"/g, '""')}"`,
        `"${(it.satuan || "").replace(/"/g, '""')}"`,
        `"${(it.rak || "-").replace(/"/g, '""')}"`,
        it.saldoAwal,
        it.qtyMasuk,
        it.qtyKeluar,
        it.saldoAkhir,
        ...(showFinancial
          ? [
              it.hargapokok,
              it.nilaiAwal,
              it.nilaiMasuk,
              it.nilaiKeluar,
              it.nilaiAkhir,
            ]
          : []),
      ]);

      const csvString = [
        `"LAPORAN REKAPITULASI MUTASI ITEM"`,
        `"Gudang: ${office}"`,
        `"Periode: ${startDate} s/d ${endDate}"`,
        `"Total Master Item: ${exportItems.length}"`,
        "",
        headers.join(","),
        ...rows.map((r: any[]) => r.join(",")),
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvString], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `rekap_mutasi_item_${office}_${startDate}_${endDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV seluruh data:", err);
      alert("Terjadi kesalahan saat mengekspor data mutasi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Laporan Mutasi Item & Kartu Stok</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Rekapitulasi kuantitas & nominal pergerakan saldo awal, barang masuk, barang keluar, dan saldo akhir persediaan per periode.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle Financial Valuation */}
          <button
            type="button"
            onClick={() => setShowFinancial(!showFinancial)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
              showFinancial
                ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
            title="Sembunyikan atau tampilkan nilai nominal Rupiah"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>{showFinancial ? "Nilai Nominal: Aktif" : "Hanya Qty Fisik"}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting || loading || totalItems === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs border border-emerald-500 active:scale-95"
            title="Export seluruh data mutasi item periode ini ke file CSV"
          >
            {exporting ? (
              <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-white" />
            )}
            <span className="text-white font-bold">
              {exporting ? "Mengekspor..." : "Export CSV"}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Barang Masuk (+)
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              +{formatNumber(summary?.totalQtyMasuk || 0)} <span className="text-xs text-zinc-400 font-normal">Unit</span>
            </div>
            {showFinancial && (
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {formatRupiah(summary?.totalNilaiMasuk || 0)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-red-950 text-red-400 rounded-xl border border-red-800/60">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Barang Keluar (-)
            </div>
            <div className="text-xl font-black text-red-400 font-mono mt-0.5">
              -{formatNumber(summary?.totalQtyKeluar || 0)} <span className="text-xs text-zinc-400 font-normal">Unit</span>
            </div>
            {showFinancial && (
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {formatRupiah(summary?.totalNilaiKeluar || 0)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Pergerakan Bersih (Net)
            </div>
            <div className={`text-xl font-black font-mono mt-0.5 ${
              (summary?.netMovementQty || 0) >= 0 ? "text-blue-400" : "text-amber-400"
            }`}>
              {(summary?.netMovementQty || 0) >= 0 ? "+" : ""}
              {formatNumber(summary?.netMovementQty || 0)} <span className="text-xs text-zinc-400 font-normal">Unit</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Masuk vs Keluar
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Master Item
            </div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {formatNumber(totalItems)} <span className="text-xs text-zinc-400 font-normal">SKU</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Gudang: <span className="text-white font-bold">{office}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card & Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        {/* Periode Mode & Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setPeriodMode("monthly");
                applyMonthlyPeriod(selectedMonth, selectedYear);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                periodMode === "monthly"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Per Bulan</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                periodMode === "custom"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Rentang Bebas</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-bold mr-1 hidden sm:inline">Pilihan Cepat:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset("this_month")}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("last_month")}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("two_months_ago")}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              2 Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("year_to_date")}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              YTD 2026
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("prev_year")}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              Tahun 2025
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
          {periodMode === "monthly" ? (
            /* Mode Per Bulan: Pemilih Bulan, Tahun, dan Tombol Navigasi Prev/Next */
            <div className="lg:col-span-5 flex flex-col space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Periode Bulan & Tahun
              </label>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700 transition-all cursor-pointer shrink-0"
                  title="Periode Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  value={selectedMonth}
                  onChange={(e) => applyMonthlyPeriod(parseInt(e.target.value, 10), selectedYear)}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-white text-xs font-bold focus:outline-hidden focus:border-emerald-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => applyMonthlyPeriod(selectedMonth, parseInt(e.target.value, 10))}
                  className="w-24 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-2 text-white text-xs font-bold focus:outline-hidden focus:border-emerald-500"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl border border-zinc-700 transition-all cursor-pointer shrink-0"
                  title="Periode Bulan Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Mode Custom Range: Tanggal Mulai & Akhir */
            <>
              <div className="lg:col-span-3">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </>
          )}

          {/* Office / Warehouse */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Gudang / Cabang
            </label>
            <select
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-emerald-500"
            >
              <option value="UTM">UTM - GUDANG UTAMA</option>
              {warehouses
                .filter((w) => w.kodekantor !== "UTM")
                .map((w, idx) => (
                  <option key={idx} value={w.kodekantor}>
                    {w.kodekantor} - {w.namakantor}
                  </option>
                ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="lg:col-span-4 flex items-end gap-2">
            <div className="relative flex-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Pencarian Barang
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kode atau nama barang..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center space-x-1.5 transition-all shrink-0 cursor-pointer h-[34px]"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Filter className="w-3.5 h-3.5 text-white" />
              )}
              <span>Filter</span>
            </button>
          </div>
        </form>

        {/* Active Period Info Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
          <div className="flex items-center space-x-2">
            <span className="text-zinc-500 font-medium">Periode Aktif:</span>
            <span className="px-2.5 py-0.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 font-bold rounded-md font-mono">
              {periodMode === "monthly"
                ? `${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`
                : `${formatDate(startDate)} s/d ${formatDate(endDate)}`}
            </span>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              ({formatDate(startDate)} s/d {formatDate(endDate)})
            </span>
          </div>

          <div className="text-[11px] text-zinc-500">
            Total {formatNumber(totalItems)} SKU terdaftar di Gudang <span className="text-zinc-300 font-bold">{office}</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div ref={tableRef} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white flex items-center space-x-1.5">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Daftar Mutasi Stok Barang</span>
            </span>
            <span className="text-zinc-500">
              ({totalItems} item terdaftar)
            </span>
          </div>

          <span className="text-zinc-400 text-[11px]">
            Klik tombol <span className="text-emerald-400 font-bold">"Kartu Stok"</span> untuk melihat kronologis transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-3.5">Kode Item</th>
                <th className="py-3 px-4">Nama Barang & Satuan</th>
                <th className="py-3 px-3.5 text-right">Saldo Awal</th>
                <th className="py-3 px-3.5 text-right text-emerald-400">Masuk (+)</th>
                <th className="py-3 px-3.5 text-right text-red-400">Keluar (-)</th>
                <th className="py-3 px-3.5 text-right text-white">Saldo Akhir</th>
                <th className="py-3 px-3 text-center">Mutasi</th>
                <th className="py-3 px-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Mengkalkulasi saldo mutasi item...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Tidak ada data mutasi barang untuk kriteria pencarian ini.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const hasMovement = it.qtyMasuk > 0 || it.qtyKeluar > 0;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-zinc-850/50 text-zinc-300 transition-colors ${
                        hasMovement ? "bg-zinc-900/40" : ""
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                        {it.kodeitem}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-zinc-100 truncate">
                          {it.namaitem}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center space-x-2 mt-0.5">
                          <span className="bg-zinc-800 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                            {it.satuan}
                          </span>
                          {it.rak && it.rak !== "-" && (
                            <span>Rak: {it.rak}</span>
                          )}
                          {showFinancial && (
                            <span>HPP: {formatRupiah(it.hargapokok)}</span>
                          )}
                        </div>
                      </td>

                      {/* Saldo Awal */}
                      <td className="py-3 px-3.5 text-right font-mono">
                        <div className="font-bold text-zinc-300">
                          {formatNumber(it.saldoAwal)}
                        </div>
                        {showFinancial && (
                          <div className="text-[10px] text-zinc-500">
                            {formatRupiah(it.nilaiAwal)}
                          </div>
                        )}
                      </td>

                      {/* Masuk (+) */}
                      <td className="py-3 px-3.5 text-right font-mono">
                        <div className={`font-bold ${it.qtyMasuk > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                          {it.qtyMasuk > 0 ? `+${formatNumber(it.qtyMasuk)}` : "-"}
                        </div>
                        {showFinancial && it.qtyMasuk > 0 && (
                          <div className="text-[10px] text-emerald-500/80">
                            {formatRupiah(it.nilaiMasuk)}
                          </div>
                        )}
                      </td>

                      {/* Keluar (-) */}
                      <td className="py-3 px-3.5 text-right font-mono">
                        <div className={`font-bold ${it.qtyKeluar > 0 ? "text-red-400" : "text-zinc-500"}`}>
                          {it.qtyKeluar > 0 ? `-${formatNumber(it.qtyKeluar)}` : "-"}
                        </div>
                        {showFinancial && it.qtyKeluar > 0 && (
                          <div className="text-[10px] text-red-500/80">
                            {formatRupiah(it.nilaiKeluar)}
                          </div>
                        )}
                      </td>

                      {/* Saldo Akhir */}
                      <td className="py-3 px-3.5 text-right font-mono">
                        <div className={`font-bold text-sm ${
                          it.saldoAkhir < 0 ? "text-red-400" : "text-white"
                        }`}>
                          {formatNumber(it.saldoAkhir)}
                        </div>
                        {showFinancial && (
                          <div className="text-[10px] text-zinc-400 font-bold">
                            {formatRupiah(it.nilaiAkhir)}
                          </div>
                        )}
                      </td>

                      {/* Mutasi Badge */}
                      <td className="py-3 px-3 text-center">
                        {hasMovement ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {it.txCount} Trs
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600">
                            Diam
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedStockCardItem(it.kodeitem)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 mx-auto cursor-pointer"
                          title="Buka Kartu Stok Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Kartu Stok</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        disabled={loading}
      />

      {/* Stock Card Drilldown Modal */}
      <StockCardModal
        isOpen={Boolean(selectedStockCardItem)}
        onClose={() => setSelectedStockCardItem(null)}
        kodeitem={selectedStockCardItem}
        startDate={startDate}
        endDate={endDate}
        office={office}
        showFinancial={showFinancial}
      />
    </div>
  );
}
