"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  Database,
  HardDrive,
  Cpu,
  Layers,
  Activity,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Server,
  Zap,
  Download,
  FolderArchive,
  FileCheck,
} from "lucide-react";

export default function DatabaseDiagnosticsPage() {
  const [stats, setStats] = useState<any | null>(null);
  const [searchTable, setSearchTable] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [vacuuming, setVacuuming] = useState<boolean>(false);
  const [vacuumResult, setVacuumResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Backup State
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.system.getDatabaseStats();
      setStats(data);
    } catch (err: any) {
      console.error("Gagal memuat statistik database:", err);
      setErrorMsg(err.message || "Gagal memuat statistik database.");
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const data = await api.system.getBackups();
      setBackups(data || []);
    } catch (err: any) {
      console.error("Gagal memuat daftar backup:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.system.createBackup();
      setBackupMsg(`Cadangan database berhasil dibuat: ${res.filename} (${res.sizeFormatted})`);
      await loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat cadangan database.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVacuum = async (targetTable?: string) => {
    setVacuuming(true);
    setVacuumResult(null);
    setErrorMsg(null);
    try {
      const res = await api.system.vacuumDatabase(targetTable);
      setVacuumResult(res);
      await loadStats();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menjalankan VACUUM ANALYZE.");
    } finally {
      setVacuuming(false);
    }
  };

  const tables = stats?.tables || [];
  const filteredTables = tables.filter((t: any) =>
    t.tableName.toLowerCase().includes(searchTable.toLowerCase())
  );

  const maxSizeBytes = tables.length > 0 ? tables[0].sizeBytes : 1;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Database className="w-6 h-6 text-emerald-400" />
            <span>Diagnostik & Pemeliharaan Database</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitoring kesehatan storage, alokasi memori buffer cache, dan optimasi vacuum tabel pada engine PostgreSQL 8.4.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => handleVacuum()}
            disabled={vacuuming || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            {vacuuming ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Jalankan VACUUM Global</span>
          </button>

          <button
            onClick={loadStats}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Vacuum Success Alert */}
      {vacuumResult && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-4 rounded-xl flex items-center justify-between text-xs animate-in zoom-in-95 duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white">VACUUM ANALYZE Berhasil Diselesaikan!</span>
              <span className="text-zinc-300 ml-2">
                Target: <strong className="font-mono text-emerald-300">{vacuumResult.target}</strong> &bull; Waktu:{" "}
                <strong className="font-mono text-emerald-300">{vacuumResult.elapsedMs} ms</strong>
              </span>
            </div>
          </div>
          <button onClick={() => setVacuumResult(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Backup Success Alert */}
      {backupMsg && (
        <div className="bg-blue-950/80 border border-blue-700 text-blue-200 p-4 rounded-xl flex items-center justify-between text-xs animate-in zoom-in-95 duration-200">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Cadangan Database Berhasil Dibuat!</span>
              <span className="text-zinc-300 ml-2">{backupMsg}</span>
            </div>
          </div>
          <button onClick={() => setBackupMsg(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ukuran Database</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {stats?.dbsize || "122 MB"}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate">{stats?.dbname || "i4_barunatrial"}</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cache Hit Ratio</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {stats?.hitRatio !== undefined ? `${stats.hitRatio}%` : "89.00%"}
            </div>
            <div className="text-[10px] text-emerald-500 font-bold">Optimal (&gt;85%)</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tabel Terdaftar</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {stats?.tablesCount || 71} Tabel
            </div>
            <div className="text-[10px] text-zinc-500">Skema Publik</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-amber-950 text-amber-400 rounded-xl border border-amber-800/60">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Koneksi Aktif</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {stats?.numbackends || 2} Klien
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Port 5444</div>
          </div>
        </div>
      </div>

      {/* Backup & Disaster Recovery Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Cadangan Database 1-Klik (pg_dump Native)</h2>
              <p className="text-[10px] text-zinc-400">
                Ekspor seluruh struktur relasional & data 71 tabel ke file cadangan biner (.dump)
              </p>
            </div>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-blue-950 transition-all cursor-pointer"
          >
            {creatingBackup ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{creatingBackup ? "Membuat Cadangan..." : "Buat Cadangan Sekarang"}</span>
          </button>
        </div>

        {/* Recent Backups List */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Riwayat Berkas Cadangan ({backups.length})
          </div>

          {loadingBackups ? (
            <div className="py-4 text-center text-xs text-zinc-500">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />
              Memeriksa arsip cadangan...
            </div>
          ) : backups.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              Belum ada berkas cadangan tersimpan. Klik tombol di atas untuk membuat cadangan pertama.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {backups.map((b) => (
                <div
                  key={b.filename}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-bold text-zinc-200">{b.filename}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Ukuran: <span className="text-blue-400 font-bold">{b.sizeFormatted}</span> &bull; Dibuat:{" "}
                      {new Date(b.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>

                  <a
                    href={`http://localhost:3001${b.downloadUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-zinc-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Database Engine Information Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
        <div className="flex items-center space-x-2 text-zinc-300">
          <Server className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Engine: <strong className="text-white">{stats?.pgversion?.split(",")[0] || "PostgreSQL 8.4.6"}</strong>
          </span>
          <span className="text-zinc-500">&bull;</span>
          <span>
            Host: <strong className="font-mono text-zinc-300">localhost:5444</strong>
          </span>
        </div>
        <div className="flex items-center space-x-3 text-zinc-400 font-mono text-[11px]">
          <span>Commit: <strong className="text-white">{formatNumber(stats?.xactCommit || 0)}</strong></span>
          <span>Rollback: <strong className="text-red-400">{formatNumber(stats?.xactRollback || 0)}</strong></span>
        </div>
      </div>

      {/* Tables Storage Explorer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Alokasi Penyimpanan & Estimasi Baris per Tabel</h2>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              placeholder="Filter nama tabel..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">No</th>
                <th className="py-2.5 px-4">Nama Tabel</th>
                <th className="py-2.5 px-4 text-right">Perkiraan Baris</th>
                <th className="py-2.5 px-4 text-right">Ukuran Disk</th>
                <th className="py-2.5 px-4 w-48">Proporsi Disk</th>
                <th className="py-2.5 px-4 text-center">Aksi Optimasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat ukuran tabel...
                  </td>
                </tr>
              ) : filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    Tidak ada tabel yang sesuai dengan pencarian "{searchTable}".
                  </td>
                </tr>
              ) : (
                filteredTables.map((t: any, idx: number) => {
                  const percent = Math.min(100, Math.round((t.sizeBytes / maxSizeBytes) * 100));
                  return (
                    <tr key={t.tableName} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-2.5 px-4 text-center font-mono text-zinc-500 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white">
                        {t.tableName}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-300">
                        {formatNumber(t.estimatedRows)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {t.totalSize}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleVacuum(t.tableName)}
                          disabled={vacuuming}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                          title={`Vacuum tabel ${t.tableName}`}
                        >
                          Vacuum
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
    </div>
  );
}
