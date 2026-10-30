"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import {
  Award,
  Crown,
  Search,
  Gift,
  RefreshCw,
  TrendingUp,
  Users,
  CheckCircle2,
  X,
  AlertCircle,
  Coins,
  Sparkles,
} from "lucide-react";

interface LoyaltyMember {
  kode: string;
  nama: string;
  telepon: string;
  kota: string;
  grup: string;
  saldoAwal: number;
  totalDiperoleh: number;
  totalDitukar: number;
  saldoPoinAktif: number;
}

export default function LoyaltyPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);

  // Modal Redeem state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [redeemQty, setRedeemQty] = useState<number>(10);
  const [redeemDesc, setRedeemDesc] = useState<string>("Penukaran Voucher Diskon Belanja");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async (q: string = search) => {
    setLoading(true);
    try {
      const data = await api.sales.getLoyaltyMembers(q, 100);
      setMembers(data || []);
    } catch (err: any) {
      console.error("Gagal memuat loyalty members:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMembers(search);
  };

  const openRedeemModal = (member: LoyaltyMember) => {
    setSelectedMember(member);
    setRedeemQty(Math.min(member.saldoPoinAktif, 10) || 1);
    setRedeemDesc("Penukaran Voucher Diskon Belanja");
    setIsModalOpen(true);
    setStatusMessage(null);
  };

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    if (redeemQty <= 0) {
      alert("Jumlah poin yang ditukar harus lebih dari 0");
      return;
    }

    if (redeemQty > selectedMember.saldoPoinAktif) {
      alert(`Jumlah poin melebihi saldo aktif (${selectedMember.saldoPoinAktif})`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.sales.redeemLoyaltyPoints({
        kodesupel: selectedMember.kode,
        jmlambil: Number(redeemQty),
        keterangan: redeemDesc,
      });

      setStatusMessage({
        type: "success",
        text: `Berhasil menukarkan ${redeemQty} poin untuk ${selectedMember.nama}! No Trs: ${res.notransaksi}`,
      });

      // Reload member data & close modal
      await loadMembers();
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedMember(null);
        setStatusMessage(null);
      }, 1800);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: "Gagal menukar poin: " + err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated KPI Stats
  const kpi = useMemo(() => {
    const totalMembers = members.length;
    let totalEarned = 0;
    let totalRedeemed = 0;
    let totalActive = 0;

    for (const m of members) {
      totalEarned += m.totalDiperoleh;
      totalRedeemed += m.totalDitukar;
      totalActive += m.saldoPoinAktif;
    }

    return { totalMembers, totalEarned, totalRedeemed, totalActive };
  }, [members]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Program Poin & Loyalitas Pelanggan
              </h1>
              <p className="text-xs text-zinc-400">
                Peringkat member, akumulasi transaksi (tbl_ikhd), dan penukaran reward (tbl_pointambil)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => loadMembers()}
          disabled={loading}
          className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-colors border border-zinc-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Member */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Member Terdaftar
            </div>
            <div className="text-2xl font-black text-white mt-1 font-mono">
              {kpi.totalMembers.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">Database Pelanggan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Total Earned Points */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Poin Didapat
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
              {kpi.totalEarned.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Reward dari Penjualan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Redeemed Points */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Poin Ditukar
            </div>
            <div className="text-2xl font-black text-purple-400 mt-1 font-mono">
              {kpi.totalRedeemed.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-purple-400/80 mt-0.5">Klaim Hadiah / Voucher</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        {/* Outstanding Active Balance */}
        <div className="bg-zinc-900 border border-amber-900/40 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Saldo Poin Beredar
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
              {kpi.totalActive.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Kewajiban Reward Aktif</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan kode pelanggan, nama, atau kota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-950/40"
        >
          Cari
        </button>
      </form>

      {/* Member Loyalty Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 font-bold text-center w-12">Rank</th>
                <th className="py-3.5 px-4 font-bold">Pelanggan / Member</th>
                <th className="py-3.5 px-4 font-bold">Kontak & Kota</th>
                <th className="py-3.5 px-4 font-bold text-right">Total Didapat</th>
                <th className="py-3.5 px-4 font-bold text-right">Total Ditukar</th>
                <th className="py-3.5 px-4 font-bold text-right">Saldo Poin Aktif</th>
                <th className="py-3.5 px-4 font-bold text-center">Aksi Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat data peringkat loyalitas...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-500">
                    Tidak ada data member yang ditemukan.
                  </td>
                </tr>
              ) : (
                members.map((m, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1 && m.saldoPoinAktif > 0;
                  const isTop3 = rank <= 3 && m.saldoPoinAktif > 0;

                  return (
                    <tr
                      key={m.kode}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Rank Indicator */}
                      <td className="py-3 px-4 text-center">
                        {isTop1 ? (
                          <div className="w-7 h-7 mx-auto rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black">
                            <Crown className="w-4 h-4" />
                          </div>
                        ) : isTop3 ? (
                          <div className="w-6 h-6 mx-auto rounded-full bg-zinc-800 text-amber-300 border border-zinc-700 flex items-center justify-center font-bold font-mono">
                            {rank}
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-mono text-[11px]">{rank}</span>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors flex items-center space-x-1.5">
                          <span>{m.nama}</span>
                          {isTop1 && (
                            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-700 px-1.5 py-0.2 rounded font-mono font-bold">
                              TOP VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {m.kode} • Grup: {m.grup}
                        </div>
                      </td>

                      {/* Contact & City */}
                      <td className="py-3 px-4">
                        <div className="text-zinc-300">{m.kota !== "-" ? m.kota : "Dalam Kota"}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {m.telepon !== "-" ? m.telepon : "No telp -"}
                        </div>
                      </td>

                      {/* Total Earned */}
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-medium">
                        +{m.totalDiperoleh.toLocaleString("id-ID")}
                      </td>

                      {/* Total Redeemed */}
                      <td className="py-3 px-4 text-right font-mono text-purple-400 font-medium">
                        -{m.totalDitukar.toLocaleString("id-ID")}
                      </td>

                      {/* Active Balance */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-black text-sm px-2.5 py-1 rounded-lg ${
                            m.saldoPoinAktif > 0
                              ? "bg-amber-950/60 text-amber-300 border border-amber-800/80"
                              : "text-zinc-600 bg-zinc-800/40"
                          }`}
                        >
                          {m.saldoPoinAktif.toLocaleString("id-ID")} Poin
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openRedeemModal(m)}
                          disabled={m.saldoPoinAktif <= 0}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 mx-auto transition-all ${
                            m.saldoPoinAktif > 0
                              ? "bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600 hover:text-white shadow-sm"
                              : "bg-zinc-800/40 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>Tukar Poin</span>
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

      {/* Modal Penukaran Poin (Redemption Dialog) */}
      {isModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Penukaran Hadiah / Poin</h3>
                  <p className="text-[10px] text-zinc-400">
                    Input pencatatan penukaran hadiah member di tbl_pointambil
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Alert if any */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
                  statusMessage.type === "success"
                    ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                    : "bg-rose-950/80 border-rose-800 text-rose-300"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Member Snapshot Card */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{selectedMember.nama}</div>
                <div className="text-[10px] text-zinc-500 font-mono">{selectedMember.kode}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-400">Saldo Poin Aktif</div>
                <div className="text-base font-black text-amber-400 font-mono">
                  {selectedMember.saldoPoinAktif.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            {/* Redemption Form */}
            <form onSubmit={handleRedeemSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Jumlah Poin Ditukar
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    max={selectedMember.saldoPoinAktif}
                    value={redeemQty}
                    onChange={(e) => setRedeemQty(Number(e.target.value))}
                    required
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-bold text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setRedeemQty(selectedMember.saldoPoinAktif)}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[11px] font-bold border border-zinc-700"
                  >
                    Tukar Semua
                  </button>
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Sisa poin setelah klaim:{" "}
                  <span className="font-mono text-zinc-300">
                    {Math.max(0, selectedMember.saldoPoinAktif - (Number(redeemQty) || 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Keterangan Hadiah / Voucher
                </label>
                <input
                  type="text"
                  value={redeemDesc}
                  onChange={(e) => setRedeemDesc(e.target.value)}
                  required
                  placeholder="Contoh: Voucher Diskon Rp 50.000 / Payung Eksklusif"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || redeemQty <= 0 || redeemQty > selectedMember.saldoPoinAktif}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950/50 flex items-center space-x-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Konfirmasi Penukaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
