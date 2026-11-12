"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatDate } from "@/lib/utils";
import {
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  TrendingUp,
  Scale,
  DollarSign,
  Download,
} from "lucide-react";

export default function AccountingReportsPage() {
  const [activeTab, setActiveTab] = useState<"pnl" | "balance">("pnl");
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>("2026-12-31");
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === "pnl") {
        const data = await api.accounting.getProfitLoss(startDate, endDate);
        setReportRows(data || []);
      } else {
        const data = await api.accounting.getBalanceSheet(startDate, endDate);
        setReportRows(data || []);
      }
    } catch (err) {
      console.error("Gagal memuat laporan akuntansi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeTab]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReport();
  };

  return (
    <div className="space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <span>Laporan Akuntansi & Keuangan Resmi</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Laporan Laba Rugi komprehensif dan Neraca Keuangan yang dihasilkan langsung oleh stored procedure iPos 4.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("pnl")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "pnl"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Laporan Laba Rugi
          </button>
          <button
            onClick={() => setActiveTab("balance")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "balance"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Neraca Keuangan
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-400 font-semibold">Periode:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-zinc-500">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate Laporan</span>
          </button>
        </form>

        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Cetak / Export PDF</span>
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl p-6">
        {/* Report Official Header */}
        <div className="text-center border-b border-zinc-800 pb-5 mb-5 space-y-1">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            CV. BARUNA ARTHA LESTARI
          </h2>
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
            {activeTab === "pnl" ? "Laporan Laba Rugi Komprehensif" : "Neraca Keuangan (Balance Sheet)"}
          </h3>
          <p className="text-xs text-zinc-400 font-mono">
            {activeTab === "pnl"
              ? `Periode: ${formatDate(startDate)} s/d ${formatDate(endDate)}`
              : `Per Tanggal: ${formatDate(endDate)}`} (Mata Uang: IDR)
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p className="text-xs font-semibold">Mengeksekusi Stored Procedure Akuntansi PostgreSQL...</p>
          </div>
        ) : reportRows.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs">
            Tidak ada transaksi akuntansi pada rentang periode ini.
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            {reportRows.map((row: any, idx: number) => {
              const isHeader = row.tipeacc === "H";
              const isTotal = row.tipeacc === "TH";
              const level = row.level || 1;
              const indent = (level - 1) * 1.5;

              return (
                <div
                  key={idx}
                  className={`flex justify-between items-center py-1.5 px-3 rounded-lg text-xs transition-colors ${
                    isTotal
                      ? "bg-zinc-800/80 font-bold border-t border-b border-zinc-700 text-white my-1"
                      : isHeader
                      ? "font-extrabold text-emerald-400 uppercase pt-3 pb-1"
                      : "hover:bg-zinc-800/30 text-zinc-300"
                  }`}
                >
                  <div style={{ paddingLeft: `${indent}rem` }} className="flex items-center space-x-2">
                    {row.kodeacc && (
                      <span className="font-mono text-zinc-500 text-[11px] w-16 shrink-0">
                        {row.kodeacc}
                      </span>
                    )}
                    <span className={isTotal ? "text-white" : ""}>{row.nama}</span>
                  </div>

                  <div className="font-mono font-bold text-right shrink-0">
                    {row.nilai !== null && row.nilai !== undefined ? (
                      <span className={Number(row.nilai) < 0 ? "text-red-400" : isTotal ? "text-emerald-400" : "text-white"}>
                        {formatRupiah(row.nilai)}
                      </span>
                    ) : (
                      ""
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
