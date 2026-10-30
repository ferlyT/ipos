"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Barcode,
  Printer,
  X,
  Layers,
  Building,
  Check,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

export default function WmsBinsPage() {
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("GD");
  const [zones, setZones] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Generator
  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [genOffice, setGenOffice] = useState<string>("GD");
  const [genZone, setGenZone] = useState<string>("ZN-FAST");
  const [genAisle, setGenAisle] = useState<string>("D");
  const [genStartRack, setGenStartRack] = useState<number>(1);
  const [genEndRack, setGenEndRack] = useState<number>(5);
  const [genTiers, setGenTiers] = useState<number>(3);
  const [genSlots, setGenSlots] = useState<number>(2);
  const [genMaxQty, setGenMaxQty] = useState<number>(500);
  const [generating, setGenerating] = useState<boolean>(false);

  // Modal Cetak Label Barcode
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedBinsForPrint, setSelectedBinsForPrint] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [whRes, zRes, bRes] = await Promise.all([
        api.inventory.getWarehouses(),
        api.wms.getZones(selectedOffice),
        api.wms.getBins(selectedOffice),
      ]);
      setOffices(whRes || []);
      setZones(zRes || []);
      setBins(bRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedOffice]);

  const handleGenerateBins = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.wms.generateBins({
        kodekantor: genOffice,
        kodezone: genZone,
        aisle: genAisle.toUpperCase(),
        startRack: genStartRack,
        endRack: genEndRack,
        tiers: genTiers,
        slots: genSlots,
        maxQty: genMaxQty,
      });
      toast.success(`Berhasil membuat ${res.count} lokasi rak baru!`);
      setShowGenModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat deretan rak");
    } finally {
      setGenerating(false);
    }
  };

  const filteredBins = bins.filter(
    (b) =>
      b.kodebin.toLowerCase().includes(search.toLowerCase()) ||
      b.aisle.toLowerCase().includes(search.toLowerCase()) ||
      (b.namazone && b.namazone.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelectBinForPrint = (kodebin: string) => {
    if (selectedBinsForPrint.includes(kodebin)) {
      setSelectedBinsForPrint(selectedBinsForPrint.filter((b) => b !== kodebin));
    } else {
      setSelectedBinsForPrint([...selectedBinsForPrint, kodebin]);
    }
  };

  const selectAllFilteredForPrint = () => {
    if (selectedBinsForPrint.length === filteredBins.length) {
      setSelectedBinsForPrint([]);
    } else {
      setSelectedBinsForPrint(filteredBins.map((b) => b.kodebin));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            Master Lokasi Rak & Bin Gudang
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Konfigurasi tata letak fisik rak (Zona, Lorong, Rak, Lantai, Slot) dan pencetakan stiker label barcode rak.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" />
            Generator Rak Masal
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            disabled={selectedBinsForPrint.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            Cetak Label ({selectedBinsForPrint.length})
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari kode bin, lorong, atau zona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAllFilteredForPrint}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition"
          >
            {selectedBinsForPrint.length === filteredBins.length ? "Batal Pilih Semua" : "Pilih Semua untuk Cetak"}
          </button>
          <button
            onClick={loadData}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Bins Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 w-10">Pilih</th>
              <th className="py-3 px-4">Kode Bin Barcode</th>
              <th className="py-3 px-4">Zona</th>
              <th className="py-3 px-4 text-center">Lorong / Rak</th>
              <th className="py-3 px-4 text-center">Lantai / Slot</th>
              <th className="py-3 px-4 text-right">Kapasitas</th>
              <th className="py-3 px-4 text-right">Stok Fisik</th>
              <th className="py-3 px-4 text-right">Utilisasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
                </td>
              </tr>
            ) : filteredBins.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  Tidak ada data lokasi rak yang cocok
                </td>
              </tr>
            ) : (
              filteredBins.map((b) => {
                const isSelected = selectedBinsForPrint.includes(b.kodebin);
                return (
                  <tr key={b.kodebin} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectBinForPrint(b.kodebin)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-slate-500" />
                      <span>{b.kodebin}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {b.namazone || "Umum"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-200">
                      Lorong {b.aisle} &bull; Rak {b.rack}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                      T{b.tier} &bull; S{b.slot}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                      {formatNumber(b.kapasitas_max_qty)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatNumber(b.total_qty || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          (b.occupancy_pct || 0) > 85
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : (b.occupancy_pct || 0) > 0
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "text-slate-500"
                        }`}
                      >
                        {b.occupancy_pct || 0}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Generator Rak Masal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" /> Bulk Generator Lokasi Rak
              </h3>
              <button onClick={() => setShowGenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBins} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Gudang / Kantor:</label>
                  <select
                    value={genOffice}
                    onChange={(e) => setGenOffice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    {offices.map((o) => (
                      <option key={o.kodekantor} value={o.kodekantor}>
                        {o.namakantor} ({o.kodekantor})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Zona Penyimpanan:</label>
                  <select
                    value={genZone}
                    onChange={(e) => setGenZone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                  >
                    {zones.map((z) => (
                      <option key={z.kodezone} value={z.kodezone}>
                        {z.namazone} ({z.kodezone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Kode Lorong (Aisle):</label>
                  <input
                    type="text"
                    required
                    value={genAisle}
                    onChange={(e) => setGenAisle(e.target.value)}
                    placeholder="Contoh: A, B, D"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Nomor Rak Awal:</label>
                  <input
                    type="number"
                    min="1"
                    value={genStartRack}
                    onChange={(e) => setGenStartRack(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Nomor Rak Akhir:</label>
                  <input
                    type="number"
                    min="1"
                    value={genEndRack}
                    onChange={(e) => setGenEndRack(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Tingkat / Lantai (Tier):</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={genTiers}
                    onChange={(e) => setGenTiers(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Slot per Lantai:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={genSlots}
                    onChange={(e) => setGenSlots(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Kapasitas Max (Unit):</label>
                  <input
                    type="number"
                    min="1"
                    value={genMaxQty}
                    onChange={(e) => setGenMaxQty(parseInt(e.target.value) || 500)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Akan membuat:{" "}
                <span className="font-bold text-white font-mono">
                  {(genEndRack - genStartRack + 1) * genTiers * genSlots} lokasi bin
                </span>{" "}
                dengan format barcode:{" "}
                <code className="text-blue-400">BIN-{genOffice}-{genAisle.toUpperCase()}-01-1-01</code>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-blue-900/40"
                >
                  {generating ? "Menghasilkan..." : "Generate Rak Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Label Barcode Stiker Thermal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-400" /> Pratinjau Stiker Barcode Rak
                </h3>
                <p className="text-xs text-slate-400">Siap dicetak ke printer label thermal (Ukuran standar 50x30mm / 70x40mm)</p>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Stickers Preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-3">
              {selectedBinsForPrint.map((bCode) => (
                <div
                  key={bCode}
                  className="bg-white text-black p-3 rounded-lg border-2 border-black flex flex-col items-center justify-center text-center shadow-sm"
                >
                  <div className="text-[10px] font-bold tracking-widest uppercase">GUDANG UTAMA</div>
                  <div className="my-1.5 font-mono text-xl tracking-widest font-black">
                    ||| | |||| | ||||| ||
                  </div>
                  <div className="font-mono text-xs font-black tracking-tight">{bCode}</div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-900/30"
              >
                <Printer className="w-4 h-4" /> Cetak Sekarang (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
