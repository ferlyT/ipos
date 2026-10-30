"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Tag,
  Sparkles,
  Percent,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  Layers,
  Clock,
  Calendar,
  Users,
} from "lucide-react";

export default function PromotionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [customerGroups, setCustomerGroups] = useState<any[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [calculating, setCalculating] = useState<boolean>(false);
  const [promoResult, setPromoResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load initial items & groups
  useEffect(() => {
    async function init() {
      try {
        const [itemList, groups] = await Promise.all([
          api.master.getItems("", 50),
          api.master.getCustomerGroups(),
        ]);
        setItems(itemList || []);
        setCustomerGroups(groups || []);
        if (itemList && itemList.length > 0) {
          setSelectedItemCode(itemList[0].kodeitem);
        }
      } catch (err) {
        console.error("Gagal inisialisasi promosi:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Calculate promotional price whenever parameters change
  useEffect(() => {
    if (!selectedItemCode) return;

    let isMounted = true;
    setCalculating(true);
    setErrorMsg(null);

    api.orders
      .resolvePromotionPrice(selectedItemCode, qty, selectedGroup || undefined)
      .then((res) => {
        if (isMounted) setPromoResult(res);
      })
      .catch((err) => {
        if (isMounted) setErrorMsg(err.message || "Gagal menghitung harga promosi");
      })
      .finally(() => {
        if (isMounted) setCalculating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedItemCode, qty, selectedGroup]);

  const selectedItem = items.find((it) => it.kodeitem === selectedItemCode);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
          <Tag className="w-6 h-6 text-emerald-400" />
          <span>Mesin Promosi, Diskon Grosir & Happy Hour</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Simulator resolusi diskon bertingkat (Quantity Tier), promosi berkala, dan diskon grup mitra iPos 4.0.
        </p>
      </div>

      {/* Simulator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Inputs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-zinc-800 text-sm font-bold text-white">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Parameter Pengujian Harga & Diskon</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Item Selection */}
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">
                Pilih Barang (SKU / Nama)
              </label>
              <select
                value={selectedItemCode}
                onChange={(e) => setSelectedItemCode(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              >
                {items.map((it, idx) => (
                  <option key={it.kodeitem ? `${it.kodeitem}-${idx}` : `item-${idx}`} value={it.kodeitem}>
                    [{it.kodeitem}] {it.namaitem}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">
                Jumlah Pembelian (Qty)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-emerald-400 font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
                <span className="text-zinc-500 font-mono font-bold">
                  {selectedItem?.satuan || "PCS"}
                </span>
              </div>
              {/* Quick Qty Buttons */}
              <div className="flex space-x-1.5 mt-2">
                {[1, 5, 12, 24, 50, 100].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQty(q)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      qty === q
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Group */}
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">
                Grup Pelanggan (Opsional)
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option key="all" value="">Semua Pelanggan (Umum)</option>
                {customerGroups.map((g: any, idx: number) => (
                  <option key={g.kodegrup ? `${g.kodegrup}-${idx}` : `grp-${idx}`} value={g.kodegrup}>
                    {g.kodegrup} - {g.namagrup || g.kodegrup}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Output: Calculation Results */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-sm font-bold text-white">
              <span className="flex items-center space-x-2">
                <Percent className="w-4 h-4 text-emerald-400" />
                <span>Hasil Resolusi Harga & Diskon Efektif</span>
              </span>
              {calculating && (
                <span className="text-[10px] text-zinc-400 flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                  <span>Mengkalkulasi...</span>
                </span>
              )}
            </div>

            {errorMsg ? (
              <div className="mt-6 p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : promoResult ? (
              <div className="mt-5 space-y-5">
                {/* Product Name Header */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                  <div className="text-[10px] font-mono text-zinc-500">
                    KODE: {promoResult.kodeitem}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {promoResult.namaitem}
                  </div>
                </div>

                {/* KPI Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">
                      Harga Normal (Retail)
                    </div>
                    <div className="font-mono font-bold text-sm text-zinc-300 mt-1">
                      {formatRupiah(promoResult.basePrice)}
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">
                      Diskon Efektif
                    </div>
                    <div className="font-mono font-bold text-sm text-emerald-400 mt-1">
                      {promoResult.effectiveDiscountPercent}%
                    </div>
                    <div className="text-[9px] text-zinc-500">
                      Hemat {formatRupiah(promoResult.unitDiscountNominal)} / unit
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">
                      Harga Net / Satuan
                    </div>
                    <div className="font-mono font-bold text-sm text-white mt-1">
                      {formatRupiah(promoResult.netUnitPrice)}
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">
                      Total Penghematan
                    </div>
                    <div className="font-mono font-bold text-sm text-amber-400 mt-1">
                      {formatRupiah(promoResult.unitDiscountNominal * promoResult.qty)}
                    </div>
                  </div>
                </div>

                {/* Grand Total Net Banner */}
                <div className="promo-total-banner bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-950 border border-emerald-300 dark:border-emerald-800/60 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <div className="promo-total-label text-xs text-emerald-800 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      Total Tagihan Net ({promoResult.qty} {selectedItem?.satuan || "PCS"})
                    </div>
                    <div className="promo-total-value text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                      {formatRupiah(promoResult.totalPrice)}
                    </div>
                  </div>

                  {promoResult.effectiveDiscountPercent > 0 && (
                    <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/60">
                      <TrendingDown className="w-4 h-4" />
                      <span>Hemat {promoResult.effectiveDiscountPercent}%</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Logic Hierarchy Rules Explanation */}
          <div className="mt-6 pt-4 border-t border-zinc-800 text-[11px] text-zinc-400 flex flex-wrap gap-4">
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Prioritas: 1. Promo Event &rarr; 2. Tier Kuantitas &rarr; 3. Harga Normal</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Mendukung Happy Hour otomatis sesuai jam & hari kerja</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
