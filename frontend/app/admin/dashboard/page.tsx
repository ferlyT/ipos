"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  TrendingUp,
  Receipt,
  CreditCard,
  ShoppingBag,
  AlertTriangle,
  Award,
  Users,
  Archive,
  RefreshCw,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [abcData, setAbcData] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, items, abc, ret] = await Promise.all([
        api.analytics.getDashboard(2026),
        api.analytics.getItemProfitability(2026, 5),
        api.analytics.getABC(2026),
        api.analytics.getCustomerRetention(90),
      ]);
      setDashboard(dash);
      setTopItems(items || []);
      setAbcData(abc);
      setRetention(ret || null);
    } catch (err) {
      console.error("Gagal memuat analitik dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-zinc-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-semibold">Memuat data Business Intelligence & Analitik Eksekutif...</p>
      </div>
    );
  }

  const churnRisks: any[] = retention?.highRiskChurnCustomers
    ? retention.highRiskChurnCustomers.slice(0, 5)
    : Array.isArray(retention)
    ? retention.filter((r: any) => r.isChurnRisk).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Executive Financial Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Ringkasan performa penjualan, margin profitabilitas, dan manajemen risiko inventaris tahun 2026.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center space-x-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3 py-2 rounded-xl font-bold transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* 1. 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Omzet */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Omzet 2026</span>
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {formatRupiah(dashboard?.totalAnnualRevenue)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Akumulasi penjualan kotor tahun 2026</div>
        </div>

        {/* Card 2: Total Faktur */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Faktur Penjualan</span>
            <div className="p-2 rounded-xl bg-blue-950 text-blue-400 border border-blue-800/60">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {formatNumber(dashboard?.totalInvoices)} Faktur
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Transaksi faktur tipe 'JL'</div>
        </div>

        {/* Card 3: Rasio Kredit vs Tunai */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rasio Penjualan Kredit</span>
            <div className="p-2 rounded-xl bg-amber-950 text-amber-400 border border-amber-800/60">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {dashboard?.creditRatioPercent || 0}%
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1 font-semibold">100% Penjualan Menggunakan Tempo</div>
        </div>

        {/* Card 4: Average Basket Size */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rata-Rata Keranjang (AOV)</span>
            <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/60">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 font-mono">
            {formatRupiah(dashboard?.overallAverageBasketSize)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Rata-rata omzet per satu faktur</div>
        </div>
      </div>

      {/* 2. Monthly Trend Table & Chart Area */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Tren Penjualan Bulanan (Tahun 2026)</span>
          </h2>
          <span className="text-xs font-mono text-zinc-400">Puncak: Juli 2026 (Rp 523 Juta)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800/60 text-zinc-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Bulan</th>
                <th className="py-2.5 px-3 text-center">Faktur</th>
                <th className="py-2.5 px-3 text-right">Total Omzet</th>
                <th className="py-2.5 px-3 text-right">Rata-rata Basket Size</th>
                <th className="py-2.5 px-3">Distribusi Visual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {dashboard?.monthlyTrend?.map((m: any) => {
                const maxRev = 530000000;
                const pct = Math.min(100, Math.round((m.totalRevenue / maxRev) * 100));
                return (
                  <tr key={m.month} className="hover:bg-zinc-800/40 text-zinc-200">
                    <td className="py-2.5 px-3 font-mono font-bold">{m.month}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{m.totalInvoices}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                      {formatRupiah(m.totalRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                      {formatRupiah(m.averageBasketSize)}
                    </td>
                    <td className="py-2.5 px-3 w-48">
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Split Row: Top Profitability Items + Dead Stock Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Profitability Leaders */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Top 5 Kontributor Laba Kotor (2026)</span>
            </h2>
            <span className="text-[10px] text-zinc-400">Gross Margin %</span>
          </div>

          <div className="space-y-3">
            {topItems.map((it, idx) => (
              <div
                key={it.kodeitem}
                className="p-3 bg-zinc-800/50 border border-zinc-800 rounded-xl flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-white flex items-center space-x-2">
                    <span className="text-zinc-500 font-mono text-xs">#{idx + 1}</span>
                    <span className="truncate max-w-[240px]">{it.namaitem}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Kategori: {it.kategori} | Qty Terjual: {it.qtySold}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-400 text-sm">
                    +{formatRupiah(it.grossProfit)}
                  </div>
                  <div className="text-[10px] font-bold text-amber-400">
                    Margin: {it.marginPercent}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dead Stock & Pareto ABC Alert */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Archive className="w-4 h-4 text-red-400" />
              <span>Inventaris Macet (Dead Stock Alert)</span>
            </h2>
            <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded font-mono font-bold">
              {abcData?.totalDeadStockSKUs ?? 0} SKU
            </span>
          </div>

          {/* Capital Warning Banner */}
          <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-red-200">Total Modal Mengendap Tanpa Penjualan 2026:</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {formatRupiah(abcData?.totalDeadStockCapital ?? 0)}
              </div>
            </div>
          </div>

          {/* Pareto ABC Distribution Summary */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="p-3 bg-zinc-800/60 rounded-xl text-center border border-zinc-700/60">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">Kelas A (80% Omzet)</span>
              <div className="text-lg font-black text-white font-mono mt-1">
                {abcData?.totalClassAItems ?? 0} SKU
              </div>
              <span className="text-[9px] text-zinc-400">Fast-Moving Core</span>
            </div>
            <div className="p-3 bg-zinc-800/60 rounded-xl text-center border border-zinc-700/60">
              <span className="text-[10px] font-bold text-blue-400 uppercase">Kelas B (15% Omzet)</span>
              <div className="text-lg font-black text-white font-mono mt-1">
                {abcData?.totalClassBItems ?? 0} SKU
              </div>
              <span className="text-[9px] text-zinc-400">Medium Moving</span>
            </div>
            <div className="p-3 bg-zinc-800/60 rounded-xl text-center border border-zinc-700/60">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Kelas C (5% Omzet)</span>
              <div className="text-lg font-black text-white font-mono mt-1">
                {abcData?.totalClassCItems ?? 0} SKU
              </div>
              <span className="text-[9px] text-zinc-400">Slow Moving</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Customer Churn Risk Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>Peringatan Risiko Churn Pelanggan VIP (Inaktif &gt; 90 Hari)</span>
          </h2>
          <span className="text-xs text-zinc-400">
            {retention?.totalDormantCustomers != null
              ? `${retention.totalDormantCustomers} Pelanggan Tidak Belanja > 90 Hari`
              : "Pelanggan dengan LTV tinggi yang berhenti belanja"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800/60 text-zinc-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Kode</th>
                <th className="py-2.5 px-3">Nama Pelanggan</th>
                <th className="py-2.5 px-3 text-right">Lifetime Value (LTV)</th>
                <th className="py-2.5 px-3 text-center">Total Faktur</th>
                <th className="py-2.5 px-3 text-center">Terakhir Belanja</th>
                <th className="py-2.5 px-3 text-center">Hari Inaktif</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {churnRisks.map((c: any) => (
                <tr key={c.kode} className="hover:bg-zinc-800/40 text-zinc-200">
                  <td className="py-2.5 px-3 font-mono text-zinc-400">{c.kode}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{c.nama}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatRupiah(c.lifetimeSpend)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">{c.totalInvoices}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-zinc-400">{c.lastPurchaseDate}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                    {c.daysInactive} Hari
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      CHURN RISK
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
