"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  Layers,
  MapPin,
  RefreshCw,
  QrCode,
  Box,
  CheckCircle2,
  AlertTriangle,
  Building,
  Sliders,
  X,
  ExternalLink,
  Printer,
  ArrowRightLeft,
} from "lucide-react";

export default function WmsLayoutPage() {
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("GD");
  const [visualMap, setVisualMap] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected Bin Modal Drawer
  const [selectedBinCode, setSelectedBinCode] = useState<string | null>(null);
  const [binDetail, setBinDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Load Offices
  useEffect(() => {
    api.inventory.getWarehouses().then((res) => {
      setOffices(res || []);
      if (res && res.length > 0 && !selectedOffice) {
        setSelectedOffice(res[0].kodekantor);
      }
    }).catch(console.error);
  }, []);

  // Load Visual Map Data
  const loadMap = async () => {
    setLoading(true);
    try {
      const data = await api.wms.getVisualMap(selectedOffice);
      setVisualMap(data);
    } catch (err) {
      console.error("Gagal memuat visual map:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOffice) {
      loadMap();
    }
  }, [selectedOffice]);

  // Click on a Bin
  const handleSelectBin = async (kodebin: string) => {
    setSelectedBinCode(kodebin);
    setLoadingDetail(true);
    try {
      const detail = await api.wms.getBinDetail(kodebin);
      setBinDetail(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Helper Heatmap Color
  const getOccupancyColor = (pct: number, totalQty: number) => {
    if (totalQty === 0) return "bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700";
    if (pct < 50) return "bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600/80 text-emerald-300";
    if (pct < 85) return "bg-amber-950/70 hover:bg-amber-900 border-amber-500/80 text-amber-300";
    return "bg-rose-950/70 hover:bg-rose-900 border-rose-500/80 text-rose-300 animate-pulse";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-400" />
              Denah Visual 2D Tata Letak Gudang
            </h1>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Live Heatmap
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Visualisasi tingkat keterisian rak (*occupancy rate*) dan posisi penempatan stok per lorong dan tingkat.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Warehouse Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <Building className="w-4 h-4 text-slate-400" />
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
            >
              {offices.map((o) => (
                <option key={o.kodekantor} value={o.kodekantor} className="bg-slate-900 text-white">
                  {o.namakantor} ({o.kodekantor})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadMap}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition"
            title="Muat Ulang Denah"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/wms/scanner"
            target="_blank"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-lg shadow-emerald-900/30"
          >
            <QrCode className="w-4 h-4" />
            Buka Scanner PDA
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {visualMap && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Total Lokasi Bin</div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {formatNumber(visualMap.summary.total_bins)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tercatat di sistem</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Rak Terisi (Occupied)</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatNumber(visualMap.summary.occupied_bins)}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Memiliki stok fisik</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Rak Kosong (Available)</div>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">
              {formatNumber(visualMap.summary.empty_bins)}
            </div>
            <div className="text-[10px] text-blue-500/80 mt-0.5">Siap menerima putaway</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400">Tingkat Utilisasi Ruang</div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {visualMap.summary.occupancy_rate}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Rasio kapasitas terpakai</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 col-span-2 md:col-span-1">
            <div className="text-xs text-slate-400">Total Kuantitas Fisik</div>
            <div className="text-2xl font-black text-purple-400 font-mono mt-1">
              {formatNumber(visualMap.summary.total_qty)} <span className="text-xs font-normal">unit</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Seluruh isi rak</div>
          </div>
        </div>
      )}

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300">
        <span className="font-semibold text-slate-400">Indikator Keterisian:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></span>
          <span>Kosong (0%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-600"></span>
          <span>Aman (&lt;50%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-950 border border-amber-500"></span>
          <span>Menengah (50-85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-950 border border-rose-500"></span>
          <span>Penuh / Padat (&gt;85%)</span>
        </div>
      </div>

      {/* 2D Visual Aisles Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-900/40 rounded-2xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : !visualMap || Object.keys(visualMap.aisles).length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          Belum ada konfigurasi lokasi rak di gudang {selectedOffice}.
          <div className="mt-3">
            <Link
              href="/admin/wms/bins"
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              Buat Rak Baru di Master Lokasi
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(visualMap.aisles).map(([aisleKey, racksMap]: [string, any]) => (
            <div key={aisleKey} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-600 flex items-center justify-center font-bold text-white font-mono">
                    {aisleKey}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Lorong (Aisle) {aisleKey}</h3>
                    <p className="text-xs text-slate-400">Terdapat {Object.keys(racksMap).length} blok rak penyimpanan</p>
                  </div>
                </div>
              </div>

              {/* Racks in this Aisle */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Object.entries(racksMap).map(([rackKey, bins]: [string, any]) => (
                  <div key={rackKey} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Rak {rackKey}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{bins.length} Slot Bin</span>
                    </div>

                    {/* Bins Matrix (Tiers x Slots) */}
                    <div className="grid grid-cols-2 gap-2">
                      {bins.map((b: any) => {
                        const isSelected = selectedBinCode === b.kodebin;
                        return (
                          <div
                            key={b.kodebin}
                            onClick={() => handleSelectBin(b.kodebin)}
                            className={`p-2 rounded-lg border cursor-pointer transition flex flex-col justify-between ${getOccupancyColor(
                              b.occupancy_pct,
                              b.total_qty || 0
                            )} ${isSelected ? "ring-2 ring-emerald-400 scale-[1.02]" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold truncate">T{b.tier}-S{b.slot}</span>
                              <span className="text-[9px] font-semibold">{b.occupancy_pct}%</span>
                            </div>
                            <div className="text-right mt-1.5">
                              <div className="text-xs font-black font-mono">
                                {formatNumber(b.total_qty || 0)}
                              </div>
                              <div className="text-[8px] text-slate-400 truncate">
                                {b.total_items > 0 ? `${b.total_items} SKU` : "Kosong"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-in Drawer / Modal Detail Rak */}
      {selectedBinCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Detail Lokasi Rak
                  </span>
                  <h2 className="text-lg font-black text-white mt-1 font-mono">{selectedBinCode}</h2>
                </div>
                <button
                  onClick={() => setSelectedBinCode(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-12 flex justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
              ) : binDetail ? (
                <div className="space-y-4">
                  {/* Bin Metrics Box */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500">Zona:</span>
                      <div className="font-semibold text-white mt-0.5">{binDetail.bin.namazone || "Zona Umum"}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Kapasitas Maksimal:</span>
                      <div className="font-mono font-semibold text-white mt-0.5">
                        {binDetail.bin.kapasitas_max_qty} Unit
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Kuantitas:</span>
                      <div className="font-mono font-black text-emerald-400 mt-0.5">
                        {formatNumber(binDetail.bin.total_qty)} Unit
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Utilisasi Rak:</span>
                      <div className="font-mono font-black text-amber-400 mt-0.5">
                        {binDetail.bin.occupancy_pct}%
                      </div>
                    </div>
                  </div>

                  {/* Stored Items List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                      <span>Daftar Barang Tersimpan</span>
                      <span>{binDetail.stocks.length} SKU</span>
                    </div>

                    {binDetail.stocks.length === 0 ? (
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
                        Rak ini kosong (0 unit)
                      </div>
                    ) : (
                      binDetail.stocks.map((item: any) => (
                        <div
                          key={item.id}
                          className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-start justify-between"
                        >
                          <div>
                            <div className="font-mono text-xs font-bold text-white">{item.kodeitem}</div>
                            <div className="text-xs text-slate-300 font-medium">{item.namaitem}</div>
                            {item.batch_no && (
                              <div className="text-[10px] text-slate-500 mt-1">
                                Batch: <span className="text-slate-300">{item.batch_no}</span>
                                {item.expired_date && ` • Exp: ${item.expired_date}`}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-emerald-400 font-mono">
                              {formatNumber(item.jumlah)}
                            </div>
                            <div className="text-[10px] text-slate-500">{item.satuan || "PCS"}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-2">
              <Link
                href="/wms/scanner"
                target="_blank"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <QrCode className="w-4 h-4" /> Buka di Scanner PDA
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
