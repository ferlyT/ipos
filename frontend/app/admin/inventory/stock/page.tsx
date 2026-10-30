"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/utils";
import {
  Boxes,
  Search,
  RefreshCw,
  FileText,
  Building,
  TrendingDown,
  TrendingUp,
  X,
  Layers,
  Download,
} from "lucide-react";

export default function InventoryStockPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("UTM");
  const [search, setSearch] = useState<string>("");
  const [stockList, setStockList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Kartu Stok
  const [cardItem, setCardItem] = useState<any | null>(null);
  const [cardHistory, setCardHistory] = useState<any[]>([]);
  const [cardLoading, setCardLoading] = useState<boolean>(false);

  // Load Warehouses
  useEffect(() => {
    api.inventory.getWarehouses().then((res) => {
      setWarehouses(res || []);
      if (res && res.length > 0 && !selectedOffice) {
        setSelectedOffice(res[0].kodekantor);
      }
    }).catch(console.error);
  }, []);

  // Load Stock Data
  const loadStock = async () => {
    setLoading(true);
    try {
      const data = await api.inventory.getStock(selectedOffice, search);
      setStockList(data || []);
    } catch (err) {
      console.error("Gagal memuat stok:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOffice) {
      loadStock();
    }
  }, [selectedOffice]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadStock();
  };

  // Buka Kartu Stok Modal
  const handleOpenCard = async (item: any) => {
    setCardItem(item);
    setCardLoading(true);
    try {
      const card = await api.inventory.getCard(item.kodeitem, selectedOffice);
      setCardHistory(card || []);
    } catch (err) {
      console.error("Gagal memuat kartu stok:", err);
    } finally {
      setCardLoading(false);
    }
  };

  const totalSKU = stockList.length;
  const totalPhysicalQty = stockList.reduce((sum, it) => sum + (it.stokGudang || 0), 0);
  const totalValuation = stockList.reduce(
    (sum, it) => sum + (it.stokGudang || 0) * (it.hpp || 0),
    0
  );

  const handleExportCSV = () => {
    if (stockList.length === 0) return;
    const headers = ["Kode Item", "Nama Item", "Jenis", "Merek", "Satuan", "Stok Gudang", "HPP (Pokok)", "Total Nilai Aset"];
    const rows = stockList.map((it) => [
      `"${it.kodeitem}"`,
      `"${(it.namaitem || "").replace(/"/g, '""')}"`,
      `"${it.jenis || ""}"`,
      `"${it.merek || ""}"`,
      `"${it.satuan || ""}"`,
      it.stokGudang || 0,
      it.hpp || 0,
      (it.stokGudang || 0) * (it.hpp || 0),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_stok_${selectedOffice}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Boxes className="w-6 h-6 text-emerald-400" />
            <span>Manajemen Stok Multi-Gudang</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitoring kuantitas fisik persediaan, kartu mutasi stok FIFO, dan total valuasi aset gudang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse Dropdown */}
          <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-xl">
            <Building className="w-4 h-4 text-zinc-400" />
            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-hidden cursor-pointer"
            >
              {warehouses.map((w) => (
                <option key={w.kodekantor} value={w.kodekantor} className="bg-zinc-900 text-white">
                  {w.kodekantor} - {w.namakantor}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode atau nama barang..."
                className="pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              Cari
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={stockList.length === 0}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-zinc-700"
              title="Unduh Laporan Stok (CSV)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </form>
        </div>
      </div>

      {/* KPI Cards Ringkasan Gudang */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Variasi Produk (SKU)</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{formatNumber(totalSKU)} Item</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Kuantitas Fisik</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{formatNumber(totalPhysicalQty)} Unit</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Estimasi Valuasi Aset</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{formatRupiah(totalValuation)}</div>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-850 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Kode Item</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-3 text-center">Gudang</th>
                <th className="py-3 px-2 text-center">Satuan</th>
                <th className="py-3 px-3 text-right">Stok Fisik</th>
                <th className="py-3 px-3 text-right">HPP Modal (FIFO)</th>
                <th className="py-3 px-4 text-right">Total Valuasi</th>
                <th className="py-3 px-3 text-center">Kartu Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data persediaan gudang...
                  </td>
                </tr>
              ) : stockList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Tidak ada persediaan barang ditemukan di gudang {selectedOffice}.
                  </td>
                </tr>
              ) : (
                stockList.map((it) => {
                  const subVal = (it.stokGudang || 0) * (it.hpp || 0);
                  const isLow = (it.stokGudang || 0) <= 0;
                  return (
                    <tr key={it.kodeitem} className="hover:bg-zinc-800/40 text-zinc-200">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {it.kodeitem}
                      </td>
                      <td className="py-3 px-4 font-bold text-white max-w-xs truncate">
                        {it.namaitem}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                          {it.kantor}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-zinc-400">
                        {it.satuan || "PCS"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            isLow
                              ? "text-red-400 font-extrabold bg-red-950/60 px-2 py-0.5 rounded"
                              : "text-white"
                          }
                        >
                          {formatNumber(it.stokGudang)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-400">
                        {formatRupiah(it.hpp)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatRupiah(subVal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleOpenCard(it)}
                          className="py-1 px-2.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700 border border-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 mx-auto"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Mutasi FIFO</span>
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

      {/* Modal Kartu Stok FIFO */}
      {cardItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setCardItem(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 text-white space-y-4 shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">Kartu Mutasi Stok FIFO</h3>
                  <p className="text-xs text-zinc-400">
                    {cardItem.namaitem} ({cardItem.kodeitem}) - Gudang {selectedOffice}
                  </p>
                </div>
              </div>
              <button onClick={() => setCardItem(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Table Riwayat Mutasi */}
            <div className="flex-1 overflow-y-auto border border-zinc-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">No Transaksi</th>
                    <th className="py-2.5 px-2 text-center">Tipe</th>
                    <th className="py-2.5 px-3 text-right">Masuk</th>
                    <th className="py-2.5 px-3 text-right">Keluar</th>
                    <th className="py-2.5 px-3 text-right">Harga Pokok (HPP)</th>
                    <th className="py-2.5 px-3 text-right">Saldo Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium font-mono">
                  {cardLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                        Mengambil riwayat mutasi...
                      </td>
                    </tr>
                  ) : cardHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400 font-sans">
                        Belum ada riwayat mutasi stok untuk barang ini.
                      </td>
                    </tr>
                  ) : (
                    cardHistory.map((m: any, idx: number) => {
                      const isMasuk = Number(m.masuk || 0) > 0;
                      return (
                        <tr key={idx} className="hover:bg-zinc-800/40 text-zinc-300">
                          <td className="py-2 px-3 text-zinc-400">{formatDateTime(m.tanggal)}</td>
                          <td className="py-2 px-3 font-bold text-white">{m.notransaksi || "-"}</td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isMasuk
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-red-950 text-red-400 border border-red-800"
                              }`}
                            >
                              {m.tipe || (isMasuk ? "IN" : "OUT")}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                            {Number(m.masuk || 0) > 0 ? `+${formatNumber(m.masuk)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-red-400 font-bold">
                            {Number(m.keluar || 0) > 0 ? `-${formatNumber(m.keluar)}` : "-"}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-400">
                            {formatRupiah(m.hpp)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-white">
                            {formatNumber(m.saldo)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center text-xs text-zinc-400 border-t border-zinc-800 pt-3">
              <span>Metode Penilaian: <strong>FIFO (First In, First Out)</strong></span>
              <button
                onClick={() => setCardItem(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                Tutup [Esc]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
