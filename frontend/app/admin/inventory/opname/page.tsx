"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  ClipboardCheck,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  X,
  Search,
} from "lucide-react";

interface OpnameRow {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  hpp: number;
  stokSistem: number;
  stokFisik: number;
}

export default function StockOpnamePage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("UTM");
  const [rows, setRows] = useState<OpnameRow[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Load warehouses & initial stock
  useEffect(() => {
    api.inventory.getWarehouses().then((whs) => {
      setWarehouses(whs || []);
      if (whs && whs.length > 0) {
        setSelectedWarehouse(whs[0].kodekantor);
      }
    }).catch(console.error);
  }, []);

  const loadStockData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const stock = await api.inventory.getStock(selectedWarehouse, search);
      const mapped: OpnameRow[] = (stock || []).map((s: any) => {
        const qty = Number(s.stokGudang || 0);
        return {
          kodeitem: s.kodeitem,
          namaitem: s.namaitem,
          satuan: s.satuan || "PCS",
          hpp: Number(s.hargapokok || 0),
          stokSistem: qty,
          stokFisik: qty, // Default to system stock
        };
      });
      setRows(mapped);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat data stok untuk opname.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouse) {
      loadStockData();
    }
  }, [selectedWarehouse]);

  const updatePhysicalStock = (idx: number, val: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, stokFisik: Math.max(0, val) } : r))
    );
  };

  // Calculations
  const totalAudited = rows.length;
  const itemsSurplus = rows.filter((r) => r.stokFisik > r.stokSistem).length;
  const itemsDeficit = rows.filter((r) => r.stokFisik < r.stokSistem).length;
  const itemsMatched = rows.filter((r) => r.stokFisik === r.stokSistem).length;

  const netAdjustmentValuation = rows.reduce((sum, r) => {
    const diff = r.stokFisik - r.stokSistem;
    return sum + diff * r.hpp;
  }, 0);

  const handleSubmit = async () => {
    // Only items that have a discrepancy
    const discrepancyItems = rows
      .filter((r) => r.stokFisik !== r.stokSistem)
      .map((r) => ({
        kodeitem: r.kodeitem,
        jmlfisik: r.stokFisik,
        satuan: r.satuan,
      }));

    if (discrepancyItems.length === 0) {
      setErrorMsg("Tidak ada selisih stok fisik vs sistem yang terdeteksi untuk disesuaikan.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const payload = {
        kodekantor: selectedWarehouse,
        tanggal: new Date().toISOString().split("T")[0],
        user: "ADMIN",
        items: discrepancyItems,
      };

      const res = await api.inventory.executeOpname(payload);
      setResult(res);
      loadStockData(); // Refresh current stock
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses penyesuaian stok opname.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-400" />
          <span>Stok Opname & Penyesuaian Persediaan Fisik</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Audit fisik stok di rak gudang, deteksi selisih surplus/defisit, dan rekonsiliasi otomatis nilai persediaan.
        </p>
      </div>

      {/* Success Result Alert */}
      {result && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-5 rounded-2xl space-y-3 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Rekonsiliasi Stok Opname Berhasil Disimpan!</span>
            </div>
            <button onClick={() => setResult(null)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-900/60 p-3 rounded-xl border border-emerald-800/40">
            <div>
              <span className="text-zinc-400">Gudang:</span>
              <div className="font-bold text-white">{result.kodekantor}</div>
            </div>
            <div>
              <span className="text-zinc-400">Item Disesuaikan:</span>
              <div className="font-mono font-bold text-white">
                {result.totalItemsAudited} Item ({result.totalItemsSurplus} Surplus, {result.totalItemsDeficit} Defisit)
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Net Valuasi Penyesuaian:</span>
              <div className="font-mono font-bold text-emerald-400">
                {formatRupiah(result.netAdjustmentValuation)}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Periode Jurnal:</span>
              <div className="font-mono font-bold text-zinc-300">{result.periode}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Audit Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Total Item Diaudit
          </div>
          <div className="text-xl font-black text-white font-mono mt-0.5">
            {totalAudited} SKU
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">{itemsMatched} Cocok (Match)</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Surplus (Lebih)</span>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
            {itemsSurplus} SKU
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Fisik &gt; Sistem</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1">
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Defisit (Kurang)</span>
          </div>
          <div className="text-xl font-black text-red-400 font-mono mt-0.5">
            {itemsDeficit} SKU
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Fisik &lt; Sistem</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Net Selisih Valuasi (HPP)
          </div>
          <div
            className={`text-xl font-black font-mono mt-0.5 ${
              netAdjustmentValuation >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatRupiah(netAdjustmentValuation)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Dampak Laba/Rugi</div>
        </div>
      </div>

      {/* Warehouse Selector & Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-bold shrink-0">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Gudang:</span>
          </div>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-bold focus:outline-none focus:border-emerald-500"
          >
            {warehouses.map((wh) => (
              <option key={wh.kodekantor} value={wh.kodekantor}>
                [{wh.kodekantor}] {wh.namakantor}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadStockData()}
              placeholder="Cari item..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={loadStockData}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
            title="Refresh Stok"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stock Opname Audit Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">Kode Item</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-3 text-center">Satuan</th>
                <th className="py-3 px-3 text-right">Harga Pokok (HPP)</th>
                <th className="py-3 px-4 text-right">Stok Sistem</th>
                <th className="py-3 px-4 text-right w-36">Stok Fisik Riil</th>
                <th className="py-3 px-4 text-right">Selisih</th>
                <th className="py-3 px-4 text-right">Nilai Selisih</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data stok gudang...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    Tidak ada data stok di gudang ini.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const selisih = row.stokFisik - row.stokSistem;
                  const nilaiSelisih = selisih * row.hpp;
                  const isSurplus = selisih > 0;
                  const isDeficit = selisih < 0;

                  return (
                    <tr
                      key={row.kodeitem}
                      className={`hover:bg-zinc-800/40 ${
                        isSurplus
                          ? "bg-emerald-950/10"
                          : isDeficit
                          ? "bg-red-950/10"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {row.kodeitem}
                      </td>
                      <td className="py-3 px-4 text-zinc-200">{row.namaitem}</td>
                      <td className="py-3 px-3 text-center font-mono text-zinc-400">
                        {row.satuan}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-400">
                        {formatRupiah(row.hpp)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-300">
                        {formatNumber(row.stokSistem)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min={0}
                          value={row.stokFisik}
                          onChange={(e) => updatePhysicalStock(idx, Number(e.target.value))}
                          className="w-28 bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-white focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            isSurplus
                              ? "text-emerald-400"
                              : isDeficit
                              ? "text-red-400"
                              : "text-zinc-500"
                          }
                        >
                          {selisih > 0 ? `+${selisih}` : selisih}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={
                            isSurplus
                              ? "text-emerald-400"
                              : isDeficit
                              ? "text-red-400"
                              : "text-zinc-500"
                          }
                        >
                          {formatRupiah(nilaiSelisih)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSurplus
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : isDeficit
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {isSurplus ? "SURPLUS" : isDeficit ? "DEFISIT" : "MATCH"}
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

      {/* Submit Action */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-xs text-zinc-400">
          Hanya item dengan status <span className="text-emerald-400 font-bold">SURPLUS</span> atau{" "}
          <span className="text-red-400 font-bold">DEFISIT</span> yang akan diposting ke jurnal penyesuaian stok opname.
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || (itemsSurplus === 0 && itemsDeficit === 0)}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memproses Penyesuaian...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Penyesuaian Stok Opname</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
