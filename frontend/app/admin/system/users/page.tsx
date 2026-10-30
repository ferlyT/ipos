"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  Users,
  ShieldCheck,
  Server,
  Database,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  HardDrive,
  Cpu,
  Clock,
  Search,
} from "lucide-react";

export default function SystemUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [health, setHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const loadData = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search
  ) => {
    setLoading(true);
    try {
      const [uRes, h] = await Promise.all([
        api.system.getUsers(targetSearch, targetLimit, targetPage),
        api.system.getHealth(),
      ]);
      const paginated = normalizePaginated<any>(uRes, targetPage, targetLimit);
      setUsers(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
      setHealth(h || null);
    } catch (err) {
      console.error("Gagal memuat status sistem:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, pageSize, "");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, pageSize, search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, pageSize, search);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadData(1, newSize, search);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Manajemen Pengguna & Status Server</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Daftar operator kasir, hak akses grup pengguna, dan monitoring infrastruktur PostgreSQL.
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Health KPI Cards */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Status Koneksi Engine</span>
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {health.status}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">
              Latensi: {health.latencyMs} ms
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Database Terhubung</span>
            </div>
            <div className="text-xl font-black text-white font-mono mt-0.5 truncate">
              {health.database}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">
              {health.totalTables} Tabel Terkelola
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>Versi Basis Data</span>
            </div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              PostgreSQL 8.4
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">Port: 5444</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Runtime Engine</span>
            </div>
            <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
              Bun {health.bunVersion}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">REST API Port: 3001</div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari user ID (username) atau nama operator..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </form>
        <button
          onClick={() => loadData(page, pageSize, search)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Users Table */}
      <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        {loading && users.length > 0 && (
          <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memuat data pengguna...</span>
            </div>
          </div>
        )}
        <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
          <span className="font-bold text-white flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Daftar Pengguna Sistem & Hak Akses (Operator Kasir & Admin)</span>
          </span>
          <span className="text-zinc-400 font-mono">{totalItems} Operator</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">User ID (Username)</th>
                <th className="py-3 px-4">Grup / Role</th>
                <th className="py-3 px-4 text-center">Status Akun</th>
                <th className="py-3 px-4">Kantor Default</th>
                <th className="py-3 px-4">Update Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.userid} className="hover:bg-zinc-800/40 text-zinc-300">
                    <td className="py-3 px-4 font-mono font-bold text-white flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{u.userid}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {u.usergrup || "OPERATOR"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.useraktif !== false
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-red-950 text-red-400 border border-red-800"
                        }`}
                      >
                        {u.useraktif !== false ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">
                      {u.kantor || "UTM"}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">
                      {u.dateupd ? formatDate(u.dateupd) : "-"}
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
        pageSizeOptions={[10, 20, 50, 100]}
        className="mt-4"
      />
    </div>
  );
}
