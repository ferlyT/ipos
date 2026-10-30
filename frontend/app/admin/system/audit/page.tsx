"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  ShieldAlert,
  Activity,
  Search,
  RefreshCw,
  Filter,
  Receipt,
  ShoppingCart,
  ArrowRightLeft,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const loadAuditTrail = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search,
    targetModule: string = selectedModule
  ) => {
    setLoading(true);
    try {
      const res = await api.system.getAuditTrail({
        module: targetModule !== "ALL" ? targetModule : undefined,
        search: targetSearch || undefined,
        limit: targetLimit,
        page: targetPage,
      });
      const paginated = normalizePaginated<any>(res, targetPage, targetLimit);
      setLogs(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
    } catch (err) {
      console.error("Gagal memuat jejak audit:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadAuditTrail(1, pageSize, search, selectedModule);
  }, [selectedModule]);

  // Optional auto-refresh interval (every 10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAuditTrail(page, pageSize, search, selectedModule);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedModule, search, page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAuditTrail(1, pageSize, search, selectedModule);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadAuditTrail(newPage, pageSize, search, selectedModule);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadAuditTrail(1, newSize, search, selectedModule);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const moduleCounts = {
    all: logs.length,
    sales: logs.filter((l) => l.modul === "PENJUALAN").length,
    purchasing: logs.filter((l) => l.modul === "PEMBELIAN").length,
    transfer: logs.filter((l) => l.modul === "TRANSFER").length,
    cashBank: logs.filter((l) => l.modul === "KAS_BANK").length,
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case "PENJUALAN":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
            <Receipt className="w-3 h-3" />
            <span>PENJUALAN</span>
          </span>
        );
      case "PEMBELIAN":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800 flex items-center space-x-1">
            <ShoppingCart className="w-3 h-3" />
            <span>PEMBELIAN</span>
          </span>
        );
      case "TRANSFER":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800 flex items-center space-x-1">
            <ArrowRightLeft className="w-3 h-3" />
            <span>TRANSFER STOK</span>
          </span>
        );
      case "KAS_BANK":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center space-x-1">
            <DollarSign className="w-3 h-3" />
            <span>KAS & BANK</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {mod}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            <span>Jejak Audit & Riwayat Aktivitas Sistem (Audit Trail)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Log forensik seluruh operasi bisnis: penjualan kasir, penerimaan supplier, mutasi logistik gudang, dan arus kas.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <label className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Auto Refresh (10s)</span>
          </label>

          <button
            onClick={() => loadAuditTrail()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">Total Aktivitas</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{moduleCounts.all} Log</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">Penjualan (JL)</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">{moduleCounts.sales} Faktur</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">Pembelian (BL)</div>
            <div className="text-xl font-black text-blue-400 font-mono mt-0.5">{moduleCounts.purchasing} Faktur</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">Mutasi Transfer (ITR)</div>
            <div className="text-xl font-black text-purple-400 font-mono mt-0.5">{moduleCounts.transfer} Bukti</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Module Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {[
              { id: "ALL", label: "Semua Modul" },
              { id: "PENJUALAN", label: "Penjualan (JL)" },
              { id: "PEMBELIAN", label: "Pembelian (BL)" },
              { id: "TRANSFER", label: "Transfer Logistik" },
              { id: "KAS_BANK", label: "Kas & Bank" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedModule(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedModule === tab.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no bukti, operator, keterangan..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </form>
        </div>
      </div>

      {/* Main Audit Trail Table */}
      <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        {loading && logs.length > 0 && (
          <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memuat jejak audit...</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-3">Modul</th>
                <th className="py-3 px-3">No. Transaksi</th>
                <th className="py-3 px-3">Kantor / Gudang</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-4">Deskripsi / Rekanan</th>
                <th className="py-3 px-4 text-right">Nilai / Nominal</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat log aktivitas terkini...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Tidak ada catatan aktivitas yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                logs.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-800/40 text-zinc-300">
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {formatDateTime(row.waktu)}
                    </td>
                    <td className="py-3 px-3">{getModuleBadge(row.modul)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                      {row.notransaksi}
                    </td>
                    <td className="py-3 px-3 font-bold text-zinc-300">{row.kodekantor || "UTM"}</td>
                    <td className="py-3 px-3 text-zinc-200 flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{row.operator}</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-medium max-w-xs truncate">
                      {row.deskripsi || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {row.modul === "TRANSFER"
                        ? `${formatNumber(row.nominal)} Unit`
                        : formatRupiah(row.nominal)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-900">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Component */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        disabled={loading}
        pageSizeOptions={[25, 50, 100, 200]}
        className="mt-4"
      />
    </div>
  );
}
