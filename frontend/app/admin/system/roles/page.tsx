"use client";

import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";

interface RoleGroup {
  kelompok: string;
  urut: number;
  total_users: number;
}

interface PermissionRow {
  klpakses: string;
  modulid: string;
  mopen: boolean;
  mnew: boolean;
  medit: boolean;
  mdel: boolean;
  mlock: boolean;
  urut: number;
  kelompok: number;
}

const GROUP_LABELS: Record<number, string> = {
  1: "Master Data",
  2: "Transaksi Operasional",
  3: "Laporan Utama",
  4: "Otorisasi & Keamanan",
  5: "Seksi Modul",
  6: "Sub-Laporan Cetak",
};

export default function RolesPermissionPage() {
  const [roles, setRoles] = useState<RoleGroup[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("ADMINISTRATOR");
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadPermissions(selectedRole);
    }
  }, [selectedRole]);

  const loadRoles = async () => {
    try {
      const data = await api.system.getRoles();
      setRoles(data || []);
      if (data && data.length > 0 && !selectedRole) {
        setSelectedRole(data[0].kelompok);
      }
    } catch (err: any) {
      console.error("Gagal memuat roles:", err);
    }
  };

  const loadPermissions = async (role: string) => {
    setLoading(true);
    try {
      const data = await api.system.getPermissions(role);
      setPermissions(data || []);
    } catch (err: any) {
      console.error("Gagal memuat permissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    modulid: string,
    field: "mopen" | "mnew" | "medit" | "mdel" | "mlock",
    currentVal: boolean
  ) => {
    const newVal = !currentVal;
    const actionKey = `${modulid}-${field}`;
    setSavingKey(actionKey);

    // Optimistic UI update
    setPermissions((prev) =>
      prev.map((p) => (p.modulid === modulid ? { ...p, [field]: newVal } : p))
    );

    try {
      await api.system.updatePermission({
        role: selectedRole,
        modulid,
        field,
        value: newVal,
      });
      toast.success(`Akses ${modulid}.${field} diubah ke ${newVal ? "AKTIF" : "NONAKTIF"}`);
      setMessage(`Akses ${modulid}.${field} berhasil diubah ke ${newVal ? "AKTIF" : "NONAKTIF"}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      // Revert if error
      setPermissions((prev) =>
        prev.map((p) => (p.modulid === modulid ? { ...p, [field]: currentVal } : p))
      );
      toast.error("Gagal menyimpan perubahan hak akses: " + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchSearch =
        search === "" || p.modulid.toLowerCase().includes(search.toLowerCase());
      const matchGroup =
        selectedGroup === "all" || p.kelompok.toString() === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [permissions, search, selectedGroup]);

  // Statistics for current role
  const stats = useMemo(() => {
    const total = permissions.length;
    const openCount = permissions.filter((p) => p.mopen).length;
    const writeCount = permissions.filter(
      (p) => p.mnew || p.medit || p.mdel
    ).length;
    return { total, openCount, writeCount };
  }, [permissions]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Matriks Hak Akses & Role Pengguna
              </h1>
              <p className="text-xs text-zinc-400">
                Konfigurasi otorisasi modul tbl_userakses & tbl_userg (RBAC iPos 4.0)
              </p>
            </div>
          </div>
        </div>

        {/* Global info pill */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-zinc-400">Akses Terbuka</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {stats.openCount} / {stats.total} Modul
            </div>
          </div>
          <button
            onClick={() => loadPermissions(selectedRole)}
            disabled={loading}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors border border-zinc-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-zinc-800/80">
        {roles.map((r) => {
          const isSelected = selectedRole === r.kelompok;
          return (
            <button
              key={r.kelompok}
              onClick={() => setSelectedRole(r.kelompok)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shrink-0 transition-all ${
                isSelected
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-950/50 border border-purple-400/40"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800"
              }`}
            >
              <span>{r.kelompok}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isSelected ? "bg-purple-800 text-purple-200" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {r.total_users} user
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari ID Modul (contoh: mKasir, mItem, mBeli)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="md:col-span-4 flex items-center space-x-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full py-2 px-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Semua Kelompok Modul (1 - 6)</option>
            <option value="1">Kelompok 1 - Master Data</option>
            <option value="2">Kelompok 2 - Transaksi Operasional</option>
            <option value="3">Kelompok 3 - Laporan Utama</option>
            <option value="4">Kelompok 4 - Otorisasi & Keamanan</option>
            <option value="5">Kelompok 5 - Seksi Modul</option>
            <option value="6">Kelompok 6 - Sub-Laporan Cetak</option>
          </select>
        </div>

        <div className="md:col-span-3 flex justify-end">
          {message && (
            <div className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 font-bold">Modul ID & Kategori</th>
                <th className="py-3.5 px-3 font-bold text-center">Buka (Open)</th>
                <th className="py-3.5 px-3 font-bold text-center">Baru (New)</th>
                <th className="py-3.5 px-3 font-bold text-center">Edit (Edit)</th>
                <th className="py-3.5 px-3 font-bold text-center">Hapus (Del)</th>
                <th className="py-3.5 px-3 font-bold text-center">Kunci (Lock)</th>
                <th className="py-3.5 px-4 font-bold text-right">Status Otoritas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Memuat matriks hak akses {selectedRole}...
                  </td>
                </tr>
              ) : filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-500">
                    Tidak ada modul yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((row) => {
                  const hasWrite = row.mnew || row.medit || row.mdel;
                  return (
                    <tr
                      key={row.modulid}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-zinc-200 group-hover:text-purple-300 transition-colors">
                          {row.modulid}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center space-x-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 bg-zinc-800 rounded font-mono">
                            Grup {row.kelompok}
                          </span>
                          <span>{GROUP_LABELS[row.kelompok] || "Umum"}</span>
                        </div>
                      </td>

                      {/* Toggle BUKA / OPEN */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggle(row.modulid, "mopen", row.mopen)}
                          disabled={savingKey === `${row.modulid}-mopen`}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                            row.mopen
                              ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30"
                              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40 hover:bg-zinc-800"
                          }`}
                          title="Izinkan Membuka Modul"
                        >
                          {row.mopen ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Toggle BARU / NEW */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggle(row.modulid, "mnew", row.mnew)}
                          disabled={savingKey === `${row.modulid}-mnew`}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                            row.mnew
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/40 hover:bg-blue-600/30"
                              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40 hover:bg-zinc-800"
                          }`}
                          title="Izinkan Tambah Baru"
                        >
                          {row.mnew ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Toggle EDIT / UBAH */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggle(row.modulid, "medit", row.medit)}
                          disabled={savingKey === `${row.modulid}-medit`}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                            row.medit
                              ? "bg-amber-600/20 text-amber-400 border border-amber-500/40 hover:bg-amber-600/30"
                              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40 hover:bg-zinc-800"
                          }`}
                          title="Izinkan Ubah/Edit"
                        >
                          {row.medit ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Toggle HAPUS / DEL */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggle(row.modulid, "mdel", row.mdel)}
                          disabled={savingKey === `${row.modulid}-mdel`}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                            row.mdel
                              ? "bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600/30"
                              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40 hover:bg-zinc-800"
                          }`}
                          title="Izinkan Hapus Data"
                        >
                          {row.mdel ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Toggle KUNCI / LOCK */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggle(row.modulid, "mlock", row.mlock)}
                          disabled={savingKey === `${row.modulid}-mlock`}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                            row.mlock
                              ? "bg-purple-600/20 text-purple-400 border border-purple-500/40 hover:bg-purple-600/30"
                              : "bg-zinc-800/60 text-zinc-600 border border-zinc-700/40 hover:bg-zinc-800"
                          }`}
                          title="Otoritas Kunci Transaksi"
                        >
                          {row.mlock ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Level Status Badge */}
                      <td className="py-3 px-4 text-right">
                        {!row.mopen ? (
                          <span className="text-[10px] px-2 py-0.8 bg-zinc-800 text-zinc-500 rounded-md font-semibold">
                            Terkunci Total
                          </span>
                        ) : hasWrite ? (
                          <span className="text-[10px] px-2 py-0.8 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-md font-semibold">
                            Baca & Tulis (RW)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.8 bg-blue-950 text-blue-400 border border-blue-800/80 rounded-md font-semibold">
                            Hanya Baca (RO)
                          </span>
                        )}
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
