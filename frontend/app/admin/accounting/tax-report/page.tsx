"use client";

import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate, formatDateTime, cn } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { exportTaxReportToExcel, TaxReportInvoice } from "@/lib/excel-export";
import {
  ReceiptText,
  Search,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  Coins,
  ShieldCheck,
  AlertCircle,
  Percent,
  LayoutList,
  Table as TableIcon,
} from "lucide-react";

export default function SalesTaxReportPage() {
  const [invoices, setInvoices] = useState<TaxReportInvoice[]>([]);
  const [summary, setSummary] = useState({
    totalInvoices: 0,
    totalDpp: 0,
    totalTax: 0,
    totalGrand: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // View Mode: "table" (expandable table) or "full-detail" (iPos 4 document style)
  const [viewMode, setViewMode] = useState<"table" | "full-detail">("table");

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [hasNofp, setHasNofp] = useState<"ALL" | "YES" | "NO">("ALL");
  const [printDate, setPrintDate] = useState<string>("");

  useEffect(() => {
    setPrintDate(new Date().toLocaleString("id-ID"));
  }, []);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Expandable Rows State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Report Data
  const loadData = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetStart: string = startDate,
    targetEnd: string = endDate,
    targetSearch: string = search,
    targetNofp: "ALL" | "YES" | "NO" = hasNofp
  ) => {
    setLoading(true);
    try {
      const res = await api.sales.getTaxReport({
        startDate: targetStart || undefined,
        endDate: targetEnd || undefined,
        search: targetSearch || undefined,
        hasNofp: targetNofp,
        page: targetPage,
        limit: targetLimit,
      });

      if (res) {
        setInvoices(res.items || []);
        setSummary(
          res.summary || {
            totalInvoices: 0,
            totalDpp: 0,
            totalTax: 0,
            totalGrand: 0,
          }
        );
        if (res.pagination) {
          setPage(res.pagination.page);
          setTotalPages(res.pagination.totalPages);
          setTotalItems(res.pagination.total);
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat laporan pajak:", err);
      toast.error(err?.message || "Gagal mengambil data laporan pajak");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, pageSize, startDate, endDate, search, hasNofp);
  }, [hasNofp]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, pageSize, startDate, endDate, search, hasNofp);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearch("");
    setHasNofp("ALL");
    setPage(1);
    loadData(1, pageSize, "", "", "", "ALL");
  };

  // Quick Date Presets
  const applyPreset = (preset: "this-month" | "last-month" | "this-year" | "all") => {
    const now = new Date();
    let start = "";
    let end = "";

    if (preset === "this-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    } else if (preset === "last-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    } else if (preset === "this-year") {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    } else if (preset === "all") {
      start = "";
      end = "";
    }

    setStartDate(start);
    setEndDate(end);
    setPage(1);
    loadData(1, pageSize, start, end, search, hasNofp);
  };

  // Toggle Single Row Expand
  const toggleRow = (notransaksi: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(notransaksi)) {
        next.delete(notransaksi);
      } else {
        next.add(notransaksi);
      }
      return next;
    });
  };

  // Toggle Expand All Visible Rows
  const toggleExpandAll = () => {
    if (expandedRows.size === invoices.length && invoices.length > 0) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(invoices.map((inv) => inv.notransaksi)));
    }
  };

  // Export to Excel (Matches iPos 4 Detail Report structure)
  const handleExportExcel = async () => {
    setExporting(true);
    const toastId = toast.loading("Mengambil seluruh data penjualan untuk ekspor Excel...");
    try {
      const allDataRes = await api.sales.getTaxReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        hasNofp,
        all: true,
      });

      if (!allDataRes || !allDataRes.items || allDataRes.items.length === 0) {
        toast.error("Tidak ada data faktur berpajak untuk diekspor", { id: toastId });
        return;
      }

      await exportTaxReportToExcel({
        invoices: allDataRes.items,
        summary: allDataRes.summary,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchFilter: search || undefined,
        nofpFilter: hasNofp === "ALL" ? "Semua" : hasNofp === "YES" ? "Ada NOFP" : "Tanpa NOFP",
      });

      toast.success(
        `Berhasil mengekspor ${allDataRes.items.length} faktur berpajak ke Excel!`,
        { id: toastId }
      );
    } catch (err: any) {
      console.error("Gagal ekspor Excel:", err);
      toast.error(err?.message || "Terjadi kesalahan saat mengekspor ke Excel", {
        id: toastId,
      });
    } finally {
      setExporting(false);
    }
  };

  // Print Report
  const handlePrint = () => {
    setPrintDate(new Date().toLocaleString("id-ID"));
    setViewMode("full-detail");
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* 1. Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Laporan Penjualan Detail Berpajak
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Format resmi iPos 4: Rekapitulasi transaksi penjualan kena pajak (PPN), DPP, rincian item barang & NOFP.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
              title="Tampilan Tabel Master-Detail"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("full-detail")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                viewMode === "full-detail"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
              title="Tampilan Detail Penuh Format iPos 4"
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Detail Penuh</span>
            </button>
          </div>

          <button
            onClick={() => loadData(page, pageSize, startDate, endDate, search, hasNofp)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Muat Ulang Data"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || invoices.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Cetak atau Simpan PDF"
          >
            <Printer className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={loading || exporting || invoices.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            title="Ekspor Laporan Format iPos 4 ke File Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{exporting ? "Mengekspor..." : "Ekspor Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* Print Document Title (Only Visible in Print Mode) */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h1 className="text-xl font-bold text-slate-900">
          LAPORAN PENJUALAN DETAIL BERPAJAK
        </h1>
        <p className="text-xs text-slate-600">
          Periode: {startDate || "Semua"} s/d {endDate || "Semua"} | Dicetak pada:{" "}
          {printDate || "-"}
        </p>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:p-3 print:border-slate-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Faktur Pajak
            </p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 print:hidden">
              <ReceiptText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white print:text-lg">
              {formatNumber(summary.totalInvoices)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Transaksi penjualan dengan PPN
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:p-3 print:border-slate-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total DPP (Dasar Pajak)
            </p>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 print:hidden">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 print:text-lg">
              {formatRupiah(summary.totalDpp)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Nilai perolehan sebelum PPN
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:p-3 print:border-slate-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total PPN Terkumpul
            </p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 print:hidden">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 print:text-lg">
              {formatRupiah(summary.totalTax)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              PPN Keluaran tercatat
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:p-3 print:border-slate-300">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Grand Total Penjualan
            </p>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 print:hidden">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white print:text-lg">
              {formatRupiah(summary.totalGrand)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              DPP + PPN + Biaya Lain
            </p>
          </div>
        </div>
      </div>

      {/* 3. Filters & Control Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari No. Faktur, No. Faktur Pajak (NOFP), Pelanggan, atau Nama Barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                    loadData(1, pageSize, startDate, endDate, "", hasNofp);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Calendar className="h-4 w-4" />
                <span>Periode:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-xs text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <select
                value={hasNofp}
                onChange={(e) => setHasNofp(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="ALL">Semua Faktur Pajak</option>
                <option value="YES">Ada No. FP</option>
                <option value="NO">Tanpa No. FP</option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Terapkan
              </button>

              {(startDate || endDate || search || hasNofp !== "ALL") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Preset:</span>
              <button
                type="button"
                onClick={() => applyPreset("this-month")}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last-month")}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this-year")}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Tahun Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset("all")}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Semua Data
              </button>
            </div>

            {viewMode === "table" && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>
                    {expandedRows.size === invoices.length && invoices.length > 0
                      ? "Tutup Semua Detail Item"
                      : "Buka Semua Detail Item"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 4A. View Mode: "full-detail" (Exact iPos 4 Official Print & Detail Layout) */}
      {viewMode === "full-detail" ? (
        <div className="space-y-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Memuat rincian laporan penjualan detail...
              </p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-base font-medium text-slate-900 dark:text-white">
                Tidak ada data penjualan berpajak
              </p>
            </div>
          ) : (
            invoices.map((inv, idx) => {
              const globalIndex = (page - 1) * pageSize + idx + 1;
              const items = inv.details || [];
              const sumQty = items.reduce((acc, it) => acc + Number(it.jumlah || 0), 0);
              const sumTotal = items.reduce((acc, it) => acc + Number(it.total || 0), 0);

              return (
                <div
                  key={inv.notransaksi}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-slate-400 print:shadow-none break-inside-avoid"
                >
                  {/* Transaction Header Bar */}
                  <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                          #{globalIndex}
                        </span>
                        <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                          {inv.notransaksi}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {formatDateTime(inv.tanggal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Dept:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {inv.kodekantor || "UTM"}
                        </span>
                        {inv.nofp && (
                          <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-mono font-semibold text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                            FP: {inv.nofp}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-500">Pelanggan: </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {inv.namapelanggan || "-"} ({inv.kodesupel || "-"})
                        </span>
                        {inv.npwp && (
                          <span className="ml-2 font-mono text-slate-500">
                            NPWP: {inv.npwp}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-slate-600 dark:text-slate-400">
                        <span className="text-slate-500">Alamat: </span>
                        <span title={inv.alamat}>{inv.alamat || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Item Detail Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                          <th className="py-2 pl-4 text-center w-12">No</th>
                          <th className="py-2 px-3 text-left w-36">Kd. Item</th>
                          <th className="py-2 px-3 text-left">Nama Item</th>
                          <th className="py-2 px-3 text-center w-20">Jml</th>
                          <th className="py-2 px-3 text-center w-20">Satuan</th>
                          <th className="py-2 px-3 text-right w-28">Harga</th>
                          <th className="py-2 px-3 text-right w-24">Pot %</th>
                          <th className="py-2 pr-4 text-right w-32">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {items.length > 0 ? (
                          items.map((it) => (
                            <tr
                              key={it.iddetail || `${inv.notransaksi}-${it.nobaris}`}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-2 pl-4 text-center font-mono text-slate-400">
                                {it.nobaris}
                              </td>
                              <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                                {it.kodeitem}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {it.namaitem}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                                {formatNumber(it.jumlah)}
                              </td>
                              <td className="py-2 px-3 text-center text-slate-500">
                                {it.satuan}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {formatNumber(it.harga)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-rose-500">
                                {it.potongan > 0 ? formatNumber(it.potongan) : "0"}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                {formatNumber(it.total)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-4 text-center italic text-slate-400">
                              Tidak ada rincian item barang
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {/* Subtotal Row */}
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50/50 font-bold dark:border-slate-800 dark:bg-slate-800/30">
                          <td colSpan={3} className="py-2 pl-4 text-left text-slate-500">
                            Subtotal Barang ({items.length} item)
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-900 dark:text-white">
                            {formatNumber(sumQty)}
                          </td>
                          <td colSpan={3}></td>
                          <td className="py-2 pr-4 text-right font-mono text-slate-900 dark:text-white">
                            {formatNumber(sumTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Transaction Footer Summary Bar */}
                  <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 text-xs dark:bg-slate-800/50 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-3 font-semibold">
                      <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                        <div>
                          Pot. :{" "}
                          <span className="font-mono text-rose-600 dark:text-rose-400">
                            {formatNumber(inv.potongan || 0)}
                          </span>
                        </div>
                        <div>
                          Pajak ({inv.prpajak || 0}%) :{" "}
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {formatNumber(inv.pajak || 0)}
                          </span>
                        </div>
                        <div>
                          Biaya :{" "}
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {formatNumber(inv.biayalain || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Total Akhir :{" "}
                        <span className="font-mono text-blue-700 dark:text-blue-400">
                          {formatRupiah(inv.totalakhir)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 4B. View Mode: "table" (Proper Fixed-Width Master-Detail Table) */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm border-collapse">
              <colgroup>
                <col style={{ width: "4%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 print:bg-slate-100">
                  <th className="py-3.5 pl-3 text-center print:hidden">#</th>
                  <th className="py-3.5 px-3">No. Transaksi</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">No. Faktur Pajak</th>
                  <th className="py-3.5 px-3">Pelanggan & NPWP</th>
                  <th className="py-3.5 px-2 text-center">Tarif</th>
                  <th className="py-3.5 px-3 text-right">DPP (Subtotal)</th>
                  <th className="py-3.5 px-3 text-right">Nilai PPN</th>
                  <th className="py-3.5 pr-4 pl-3 text-right">Total Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-500 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Memuat rincian faktur dan pajak...
                      </p>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <AlertCircle className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-base font-medium text-slate-900 dark:text-white">
                        Tidak ada data penjualan berpajak
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Coba sesuaikan kata kunci pencarian atau rentang tanggal.
                      </p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const isExpanded = expandedRows.has(inv.notransaksi);
                    const itemCount = inv.details?.length || 0;
                    const items = inv.details || [];
                    const sumQty = items.reduce((acc, it) => acc + Number(it.jumlah || 0), 0);
                    const sumTotal = items.reduce((acc, it) => acc + Number(it.total || 0), 0);

                    return (
                      <React.Fragment key={inv.notransaksi}>
                        {/* Master Invoice Row */}
                        <tr
                          onClick={() => toggleRow(inv.notransaksi)}
                          className={cn(
                            "cursor-pointer font-medium text-slate-900 dark:text-white transition",
                            isExpanded
                              ? "bg-blue-50/40 dark:bg-blue-950/30"
                              : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                          )}
                        >
                          <td className="py-3.5 pl-3 text-center print:hidden">
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-3 truncate">
                            <div className="font-semibold text-blue-600 dark:text-blue-400">
                              {inv.notransaksi}
                            </div>
                            <div className="text-xs text-slate-400">
                              {itemCount} item barang ({inv.kodekantor || "UTM"})
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                            {formatDateTime(inv.tanggal)}
                          </td>
                          <td className="py-3.5 px-3 truncate">
                            {inv.nofp ? (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="truncate">{inv.nofp}</span>
                              </span>
                            ) : (
                              <span className="text-xs italic text-slate-400">Tanpa NOFP</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {inv.namapelanggan || "-"}
                            </div>
                            {inv.npwp && (
                              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                                NPWP: {inv.npwp}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-center">
                            <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {inv.prpajak}%
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-xs">
                            {formatRupiah(inv.dpp)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(inv.pajak)}
                          </td>
                          <td className="py-3.5 pr-4 pl-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {formatRupiah(inv.totalakhir)}
                          </td>
                        </tr>

                        {/* Detail Items Sub-Table matching iPos 4 format */}
                        {isExpanded && (
                          <tr className="bg-slate-100/70 dark:bg-slate-950/80">
                            <td colSpan={9} className="p-3 sm:p-4">
                              <div className="rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                                {/* iPos 4 Transaction Header Summary */}
                                <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 dark:text-slate-200">
                                        No Transaksi: {inv.notransaksi}
                                      </span>
                                      <span className="text-slate-400">|</span>
                                      <span>Tanggal: {formatDate(inv.tanggal)}</span>
                                      <span className="text-slate-400">|</span>
                                      <span>Dept: {inv.kodekantor || "UTM"}</span>
                                    </div>
                                    <div className="text-slate-500">
                                      Kode Pel: {inv.kodesupel || "-"} | Kasir: {inv.kasir || "ADMIN"}
                                    </div>
                                  </div>
                                  <div className="mt-1 text-slate-600 dark:text-slate-400 truncate">
                                    Alamat: {inv.alamat || "-"}
                                  </div>
                                </div>

                                {/* Items Sub-Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400 font-semibold">
                                        <th className="py-2 pl-3 text-center w-12">No</th>
                                        <th className="py-2 px-2 text-left w-36">Kd. Item</th>
                                        <th className="py-2 px-2 text-left">Nama Item</th>
                                        <th className="py-2 px-2 text-center w-16">Jml</th>
                                        <th className="py-2 px-2 text-center w-16">Satuan</th>
                                        <th className="py-2 px-2 text-right w-28">Harga</th>
                                        <th className="py-2 px-2 text-right w-20">Pot %</th>
                                        <th className="py-2 pr-3 text-right w-28">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {items.length > 0 ? (
                                        items.map((it) => (
                                          <tr
                                            key={it.iddetail || `${inv.notransaksi}-${it.nobaris}`}
                                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                                          >
                                            <td className="py-1.5 pl-3 text-center text-slate-400 font-mono">
                                              {it.nobaris}
                                            </td>
                                            <td className="py-1.5 px-2 font-mono font-medium text-slate-700 dark:text-slate-300">
                                              {it.kodeitem}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-800 dark:text-slate-200 font-medium">
                                              {it.namaitem}
                                            </td>
                                            <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                                              {formatNumber(it.jumlah)}
                                            </td>
                                            <td className="py-1.5 px-2 text-center text-slate-500">
                                              {it.satuan}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                              {formatNumber(it.harga)}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-rose-500">
                                              {it.potongan > 0 ? formatNumber(it.potongan) : "0"}
                                            </td>
                                            <td className="py-1.5 pr-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                                              {formatNumber(it.total)}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td
                                            colSpan={8}
                                            className="py-3 text-center italic text-slate-400"
                                          >
                                            Tidak ada rincian item barang pada faktur ini
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-200 bg-slate-50/40 font-bold dark:border-slate-800 dark:bg-slate-800/20">
                                        <td colSpan={3} className="py-2 pl-3 text-left text-slate-500">
                                          Total Item
                                        </td>
                                        <td className="py-2 px-2 text-center font-mono text-slate-900 dark:text-white">
                                          {formatNumber(sumQty)}
                                        </td>
                                        <td colSpan={3}></td>
                                        <td className="py-2 pr-3 text-right font-mono text-slate-900 dark:text-white">
                                          {formatNumber(sumTotal)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>

                                {/* iPos 4 Footer Row */}
                                <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800/60">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                                      <div>
                                        Pot. :{" "}
                                        <span className="font-mono text-rose-600 dark:text-rose-400">
                                          {formatNumber(inv.potongan || 0)}
                                        </span>
                                      </div>
                                      <div>
                                        Pajak :{" "}
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                          {formatNumber(inv.pajak || 0)}
                                        </span>
                                      </div>
                                      <div>
                                        Biaya :{" "}
                                        <span className="font-mono text-slate-700 dark:text-slate-300">
                                          {formatNumber(inv.biayalain || 0)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      Total Akhir :{" "}
                                      <span className="font-mono text-blue-700 dark:text-blue-400">
                                        {formatRupiah(inv.totalakhir)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {/* Grand Total Footer */}
              {invoices.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white print:bg-slate-200">
                    <td colSpan={6} className="py-3 pl-4 text-left">
                      TOTAL KESELURUHAN (Halaman Ini & Agregat)
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs">
                      {formatRupiah(summary.totalDpp)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(summary.totalTax)}
                    </td>
                    <td className="py-3 pr-4 pl-3 text-right font-mono text-xs">
                      {formatRupiah(summary.totalGrand)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 5. Pagination */}
          {!loading && invoices.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-3.5 dark:border-slate-800 print:hidden">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(p) => {
                  setPage(p);
                  loadData(p, pageSize, startDate, endDate, search, hasNofp);
                }}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                  loadData(1, s, startDate, endDate, search, hasNofp);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination for Full-Detail Mode as well */}
      {viewMode === "full-detail" && !loading && invoices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs print:hidden">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => {
              setPage(p);
              loadData(p, pageSize, startDate, endDate, search, hasNofp);
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              loadData(1, s, startDate, endDate, search, hasNofp);
            }}
          />
        </div>
      )}
    </div>
  );
}
