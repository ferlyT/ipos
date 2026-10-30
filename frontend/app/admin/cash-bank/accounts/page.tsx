"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Wallet,
  Building,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  CreditCard,
  Banknote,
  DollarSign,
} from "lucide-react";

export default function CashBankAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await api.cashBank.getAccounts();
      const uniqueData = Array.from(
        new Map((data || []).map((a: any) => [a.kodeacc, a])).values()
      );
      setAccounts(uniqueData);
    } catch (err) {
      console.error("Gagal memuat akun kas & bank:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const totalLiquidAssets = accounts.reduce(
    (sum, it) => sum + (Number(it.saldoAkhir || it.saldo || 0)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Title & Quick Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <span>Manajemen Kas, Bank & Likuiditas</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitoring saldo buku besar kas kecil, rekening bank aktif, dan mutasi likuiditas perusahaan.
          </p>
        </div>

        <button
          onClick={loadAccounts}
          className="flex items-center space-x-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-2 rounded-xl font-bold transition-all w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Segarkan Saldo</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Aset Likuid (Kas & Bank)</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{formatRupiah(totalLiquidAssets)}</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Rekening Bank Terdaftar</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">BCA, Mandiri, HIP</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Jumlah Akun Buku Besar</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{formatNumber(accounts.length)} Rekening</div>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
          <span className="font-bold text-white flex items-center space-x-1.5">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Daftar Akun Kas & Rekening Bank Perkiraan</span>
          </span>
          <span className="text-zinc-400">Mata Uang: IDR</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">Kode Akun</th>
                <th className="py-3 px-4">Nama Perkiraan</th>
                <th className="py-3 px-3 text-center">Tipe</th>
                <th className="py-3 px-3 text-right">Saldo Awal</th>
                <th className="py-3 px-3 text-right">Total Debet</th>
                <th className="py-3 px-3 text-right">Total Kredit</th>
                <th className="py-3 px-4 text-right">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Menghitung saldo buku besar kas & bank...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                    Tidak ada akun kas/bank terdaftar.
                  </td>
                </tr>
              ) : (
                accounts.map((acc: any) => {
                  const saldo = Number(acc.saldoAkhir ?? acc.saldo ?? 0);
                  const isNegative = saldo < 0;
                  return (
                    <tr key={acc.kodeacc} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-3 px-4 font-bold text-emerald-400">{acc.kodeacc}</td>
                      <td className="py-3 px-4 font-bold text-white font-sans">{acc.namaacc}</td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                          {acc.tipe || "KAS/BANK"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-400">
                        {formatRupiah(acc.saldoAwal || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400">
                        {formatRupiah(acc.totalDebet ?? acc.totDebet ?? 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-red-400">
                        {formatRupiah(acc.totalKredit ?? acc.totKredit ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        <span className={isNegative ? "text-red-400 font-extrabold" : "text-white"}>
                          {formatRupiah(saldo)}
                        </span>
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
