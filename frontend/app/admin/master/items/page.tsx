"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Search,
  Package,
  Calculator,
  RefreshCw,
  X,
  Tag,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function MasterItemsPage() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Price Resolver Simulator Modal
  const [simItem, setSimItem] = useState<any | null>(null);
  const [simQty, setSimQty] = useState<number>(1);
  const [simCustomer, setSimCustomer] = useState<string>("PL0110");
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newKode, setNewKode] = useState<string>("");
  const [newNama, setNewNama] = useState<string>("");
  const [newJenis, setNewJenis] = useState<string>("SPAREPART");
  const [newMerek, setNewMerek] = useState<string>("-");
  const [newSatuan, setNewSatuan] = useState<string>("PCS");
  const [newHpp, setNewHpp] = useState<number>(0);
  const [newHargaJual, setNewHargaJual] = useState<number>(0);
  const [newRak, setNewRak] = useState<string>("-");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadItems = async (q: string = "") => {
    setLoading(true);
    try {
      const data = await api.master.getItems(q, 50);
      setItems(data || []);
    } catch (err) {
      console.error("Gagal memuat katalog barang:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems("");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadItems(search);
  };

  const handleSimulatePrice = async () => {
    if (!simItem) return;
    setSimLoading(true);
    try {
      const res = await api.master.resolvePrice({
        itemCode: simItem.kodeitem,
        unit: simItem.satuan || "PCS",
        qty: simQty,
        customerCode: simCustomer,
      });
      setSimResult(res);
    } catch (err) {
      console.error("Gagal simulasi harga:", err);
    } finally {
      setSimLoading(false);
    }
  };

  const openAddModal = () => {
    setNewKode(`ITM${Date.now().toString().slice(-6)}`);
    setNewNama("");
    setNewJenis("SPAREPART");
    setNewMerek("-");
    setNewSatuan("PCS");
    setNewHpp(0);
    setNewHargaJual(0);
    setNewRak("-");
    setErrorMessage(null);
    setIsAddOpen(true);
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKode || !newNama) {
      setErrorMessage("Kode Item dan Nama Barang wajib diisi.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.master.createItem({
        kodeitem: newKode,
        namaitem: newNama,
        jenis: newJenis,
        merek: newMerek,
        satuan: newSatuan,
        hargapokok: newHpp,
        hargajual: newHargaJual,
        rak: newRak,
      });

      setToastMessage(`Sukses! Barang baru ${newNama} (${newKode}) berhasil ditambahkan.`);
      setIsAddOpen(false);
      loadItems(search);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan barang baru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <span>Katalog Master Barang & Barcode</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Data referensi produk, harga jual bertingkat, dan valuasi HPP persediaan.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama barang atau kode..."
                className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-56 sm:w-64"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cari
            </button>
          </form>

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-850 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Kode Item</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Merek</th>
                <th className="py-3 px-2 text-center">Satuan</th>
                <th className="py-3 px-3 text-right">Harga Pokok (HPP)</th>
                <th className="py-3 px-4 text-right">Harga Jual Std</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat katalog produk...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.kodeitem} className="hover:bg-zinc-800/40 text-zinc-300">
                    <td className="py-3 px-4 font-mono font-bold text-white">{it.kodeitem}</td>
                    <td className="py-3 px-4 text-zinc-200">{it.namaitem}</td>
                    <td className="py-3 px-3 text-zinc-400">{it.jenis || "-"}</td>
                    <td className="py-3 px-3 text-zinc-400">{it.merek || "-"}</td>
                    <td className="py-3 px-2 text-center font-mono text-zinc-400">{it.satuan || "PCS"}</td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-400">
                      {formatRupiah(it.hargapokok)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatRupiah(it.hargajual)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => {
                          setSimItem(it);
                          setSimResult(null);
                        }}
                        className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Simulasi Tier Harga Grosir"
                      >
                        <Calculator className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Barang Baru */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>Tambah Item Barang Baru</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Daftarkan SKU baru ke master barang dan database iPos 4.0
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem}>
              <div className="p-6 space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Kode Item (SKU)
                    </label>
                    <input
                      type="text"
                      value={newKode}
                      onChange={(e) => setNewKode(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Satuan Dasar
                    </label>
                    <select
                      value={newSatuan}
                      onChange={(e) => setNewSatuan(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="PCS">PCS</option>
                      <option value="DUS">DUS</option>
                      <option value="SET">SET</option>
                      <option value="LTR">LTR</option>
                      <option value="KG">KG</option>
                      <option value="MTR">MTR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Nama Barang Lengkap
                  </label>
                  <input
                    type="text"
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Misal: FILTER OLI DIESEL ME-014838"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Jenis</label>
                    <input
                      type="text"
                      value={newJenis}
                      onChange={(e) => setNewJenis(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Merek</label>
                    <input
                      type="text"
                      value={newMerek}
                      onChange={(e) => setNewMerek(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Lokasi Rak</label>
                    <input
                      type="text"
                      value={newRak}
                      onChange={(e) => setNewRak(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Harga Pokok (HPP) (Rp)
                    </label>
                    <input
                      type="number"
                      value={newHpp}
                      onChange={(e) => setNewHpp(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Harga Jual Standar (Rp)
                    </label>
                    <input
                      type="number"
                      value={newHargaJual}
                      onChange={(e) => setNewHargaJual(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-emerald-600 rounded-xl px-3 py-2 text-right font-mono font-bold text-sm text-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-850 border-t border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Simpan Barang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Simulasi Harga Bertingkat */}
      {simItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase">
                  Simulasi Harga Berjenjang
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{simItem.namaitem}</h3>
                <span className="text-xs text-zinc-400 font-mono">Kode: {simItem.kodeitem}</span>
              </div>
              <button
                onClick={() => setSimItem(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Jumlah Pembelian (Qty)
                </label>
                <input
                  type="number"
                  min="1"
                  value={simQty}
                  onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">
                  Grup Mitra / Pelanggan
                </label>
                <select
                  value={simCustomer}
                  onChange={(e) => setSimCustomer(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="UMUM">UMUM (Retail Regular)</option>
                  <option value="PL0110">PL0110 - GROSIR UTAMA (Tier 1)</option>
                  <option value="PL0079">PL0079 - BENGKEL REKANAN (Tier 2)</option>
                </select>
              </div>

              <button
                onClick={handleSimulatePrice}
                disabled={simLoading}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
              >
                {simLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Tag className="w-4 h-4" />
                    <span>Kalkulasi Harga Berlaku</span>
                  </>
                )}
              </button>
            </div>

            {simResult && (
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2 mt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Harga Satuan Net:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatRupiah(simResult.finalUnitPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Total Tagihan ({simQty} {simItem.satuan}):</span>
                  <span className="font-mono font-bold text-white text-base">
                    {formatRupiah(simResult.finalTotalPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
                  <span>Margin Estimasi:</span>
                  <span className="font-mono text-zinc-300">
                    {simResult.marginPct}% ({formatRupiah(simResult.marginAmount)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
