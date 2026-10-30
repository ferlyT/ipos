"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Cpu,
  Layers,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Package,
  Boxes,
  Trash2,
  X,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export default function AssemblyBOMPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedParentCode, setSelectedParentCode] = useState<string>("");
  const [activeBOM, setActiveBOM] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingBOM, setLoadingBOM] = useState<boolean>(false);

  // Simulation & Production Execution State
  const [qtyToBuild, setQtyToBuild] = useState<number>(1);
  const [selectedOffice, setSelectedOffice] = useState<string>("UTM");
  const [simulation, setSimulation] = useState<any | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [assembling, setAssembling] = useState<boolean>(false);
  const [assemblyResult, setAssemblyResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Recipe Modal State
  const [isNewRecipeModalOpen, setIsNewRecipeModalOpen] = useState<boolean>(false);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [newParentCode, setNewParentCode] = useState<string>("");
  const [newComponents, setNewComponents] = useState<
    Array<{ kodeitemrakitan: string; namaitem: string; jumlah: number; satuan: string; harga: number }>
  >([]);
  const [savingRecipe, setSavingRecipe] = useState<boolean>(false);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const data = await api.master.getBOMRecipes();
      setRecipes(data || []);
      if (data && data.length > 0 && !selectedParentCode) {
        setSelectedParentCode(data[0].kodeitem);
      }
    } catch (err) {
      console.error("Gagal memuat resep BOM:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
    api.master.getItems("", 100).then((items) => {
      if (items) setAllItems(items);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedParentCode) {
      setActiveBOM(null);
      setSimulation(null);
      return;
    }

    setLoadingBOM(true);
    setSimulation(null);
    setAssemblyResult(null);
    setErrorMessage(null);

    api.master.getBOM(selectedParentCode)
      .then((bom) => {
        setActiveBOM(bom);
      })
      .catch((err) => {
        console.error("Gagal memuat detail formula BOM:", err);
      })
      .finally(() => {
        setLoadingBOM(false);
      });
  }, [selectedParentCode]);

  const handleSimulate = async () => {
    if (!selectedParentCode) return;
    setSimulating(true);
    setErrorMessage(null);
    try {
      const sim = await api.master.simulateAssembly(selectedParentCode, qtyToBuild, selectedOffice);
      setSimulation(sim);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal melakukan simulasi perakitan");
    } finally {
      setSimulating(false);
    }
  };

  const handleExecuteAssembly = async () => {
    if (!selectedParentCode) return;
    setAssembling(true);
    setErrorMessage(null);
    setAssemblyResult(null);
    try {
      const result = await api.master.assemble(selectedParentCode, qtyToBuild, selectedOffice, "ADMIN");
      setAssemblyResult(result);
      // Reload BOM to update stocks
      const updatedBOM = await api.master.getBOM(selectedParentCode);
      setActiveBOM(updatedBOM);
      setSimulation(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengeksekusi perakitan");
    } finally {
      setAssembling(false);
    }
  };

  // Modal Component Helpers
  const addComponentToNewRecipe = () => {
    if (allItems.length === 0) return;
    const defaultItem = allItems[0];
    setNewComponents((prev) => [
      ...prev,
      {
        kodeitemrakitan: defaultItem.kodeitem,
        namaitem: defaultItem.namaitem,
        jumlah: 1,
        satuan: defaultItem.satuan || "PCS",
        harga: Number(defaultItem.hargapokok || 0),
      },
    ]);
  };

  const handleSaveRecipe = async () => {
    if (!newParentCode) {
      toast.error("Pilih barang jadi hasil rakitan!");
      return;
    }
    if (newComponents.length === 0) {
      toast.error("Tambahkan minimal 1 bahan baku komponen!");
      return;
    }

    setSavingRecipe(true);
    try {
      await api.master.saveBOM({
        parentItemCode: newParentCode,
        components: newComponents,
      });
      toast.success("Formula rakitan berhasil disimpan!");
      setIsNewRecipeModalOpen(false);
      setNewParentCode("");
      setNewComponents([]);
      await loadRecipes();
      setSelectedParentCode(newParentCode);
    } catch (err: any) {
      toast.error("Gagal menyimpan formula rakitan: " + (err.message || err));
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Cpu className="w-6 h-6 text-emerald-400" />
            <span>Perakitan Barang & Bill of Materials (BOM)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Kelola formula resep produk perakitan, uji kecukupan bahan baku gudang, dan eksekusi produksi perakitan otomatis.
          </p>
        </div>

        <button
          onClick={() => {
            setNewComponents([]);
            if (allItems.length > 0) setNewParentCode(allItems[0].kodeitem);
            setIsNewRecipeModalOpen(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-950/60 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Formula BOM Baru</span>
        </button>
      </div>

      {/* Assembly Success Alert */}
      {assemblyResult && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-5 rounded-2xl space-y-2 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Produksi Perakitan Berhasil Dieksekusi!</span>
            </div>
            <button onClick={() => setAssemblyResult(null)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-900/60 p-3 rounded-xl border border-emerald-800/40">
            <div>
              <span className="text-zinc-400">No. Bukti Rakitan:</span>
              <div className="font-mono font-bold text-emerald-300 text-sm">{assemblyResult.notransaksi}</div>
            </div>
            <div>
              <span className="text-zinc-400">Item Jadi:</span>
              <div className="font-bold text-white">{assemblyResult.parentItemName}</div>
            </div>
            <div>
              <span className="text-zinc-400">Kuantitas Selesai:</span>
              <div className="font-mono font-bold text-white">{assemblyResult.qtyBuilt} Unit</div>
            </div>
            <div>
              <span className="text-zinc-400">Total Biaya Produksi:</span>
              <div className="font-mono font-bold text-emerald-400">{formatRupiah(assemblyResult.totalCost)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Recipes Selector & Right Formula + Simulation Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Registered Recipes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Daftar Formula Rakitan</span>
            </div>
            <button
              onClick={loadRecipes}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
            {loading ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Memuat daftar formula...</div>
            ) : recipes.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
                <Package className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>Belum ada formula rakitan terdaftar.</p>
                <button
                  onClick={() => setIsNewRecipeModalOpen(true)}
                  className="text-emerald-400 font-bold hover:underline"
                >
                  + Tambah Formula Pertama
                </button>
              </div>
            ) : (
              recipes.map((rc: any) => {
                const isSelected = rc.kodeitem === selectedParentCode;
                return (
                  <button
                    key={rc.kodeitem}
                    onClick={() => setSelectedParentCode(rc.kodeitem)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-600 text-white shadow-md shadow-emerald-950/20"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-mono text-[11px] text-zinc-400">{rc.kodeitem}</div>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 font-mono font-bold">
                        {rc.total_components} Komponen
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white mt-1 truncate">{rc.namaitem}</div>
                    <div className="flex justify-between items-center mt-2 text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/60">
                      <span>Est. Biaya Bahan:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatRupiah(rc.total_estimated_cost)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (2 spans): Active BOM Detail & Assembly Execution Engine */}
        <div className="lg:col-span-2 space-y-6">
          {loadingBOM ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
              <p className="text-xs">Memuat formula bahan baku...</p>
            </div>
          ) : !activeBOM ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs">
              Pilih formula rakitan dari daftar di sebelah kiri untuk meninjau komponen bahan baku dan menjalankan simulasi produksi.
            </div>
          ) : (
            <>
              {/* Product Header Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                      Barang Jadi Hasil Rakitan
                    </span>
                    <h2 className="text-lg font-black text-white mt-1.5">{activeBOM.namaitem}</h2>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">Kode: {activeBOM.kodeitem} &bull; Satuan: {activeBOM.satuan}</div>
                  </div>
                  <div className="text-left sm:text-right bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Total Biaya Komponen (HPP)</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                      {formatRupiah(activeBOM.totalComponentCost)}
                    </div>
                  </div>
                </div>

                {/* Components Table */}
                <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                      <tr>
                        <th className="py-2.5 px-3">Kode Bahan</th>
                        <th className="py-2.5 px-3">Nama Bahan Baku</th>
                        <th className="py-2.5 px-3 text-right">Rasio / Unit</th>
                        <th className="py-2.5 px-3 text-right">HPP Satuan</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Stok Gudang (UTM)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium">
                      {activeBOM.components.map((comp: any) => (
                        <tr key={comp.kodeitemrakitan} className="hover:bg-zinc-800/40 text-zinc-300">
                          <td className="py-2.5 px-3 font-mono text-zinc-400">{comp.kodeitemrakitan}</td>
                          <td className="py-2.5 px-3 font-bold text-white">{comp.namaitem}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatNumber(comp.jumlah)} {comp.satuan}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                            {formatRupiah(comp.estimasiHpp)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatRupiah(comp.subtotalCost)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span className={comp.currentStock < comp.jumlah ? "text-red-400 font-bold" : "text-zinc-200"}>
                              {formatNumber(comp.currentStock)} {comp.satuan}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Simulation & Assembly Engine Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center space-x-2 text-sm font-black text-white">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>Mesin Simulasi & Eksekusi Perakitan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Kuantitas Produksi (Unit)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qtyToBuild}
                      onChange={(e) => setQtyToBuild(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Lokasi Gudang Bahan & Hasil
                    </label>
                    <select
                      value={selectedOffice}
                      onChange={(e) => setSelectedOffice(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="UTM">UTAMA (UTM)</option>
                      <option value="CAB1">CABANG 1 (CAB1)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleSimulate}
                      disabled={simulating}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all"
                    >
                      {simulating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>Uji Kesiapan Stok</span>
                    </button>
                  </div>
                </div>

                {/* Simulation Result Area */}
                {simulation && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            simulation.canBuild
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-red-950 text-red-400 border border-red-800"
                          }`}
                        >
                          {simulation.canBuild ? "BAHAN BAKU MENCUKUPI" : "STOK BAHAN KURANG"}
                        </span>
                        <span className="text-zinc-400">
                          Kapasitas Max: <strong className="text-white font-mono">{simulation.maxPossibleToBuild} Unit</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-400 mr-2">Estimasi Biaya Produksi:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatRupiah(simulation.totalProductionCost)}
                        </span>
                      </div>
                    </div>

                    {/* Requirements Breakdown */}
                    <div className="space-y-1 pt-2 border-t border-zinc-800 text-[11px]">
                      {simulation.componentRequirements.map((req: any) => (
                        <div key={req.kodeitem} className="flex justify-between items-center py-1 border-b border-zinc-900">
                          <span className="text-zinc-300 font-medium">{req.namaitem}</span>
                          <div className="flex items-center space-x-3 font-mono">
                            <span className="text-zinc-400">
                              Dibutuhkan: <strong className="text-white">{req.qtyRequired}</strong>
                            </span>
                            <span className="text-zinc-400">
                              Tersedia:{" "}
                              <strong className={req.isSufficient ? "text-emerald-400" : "text-red-400"}>
                                {req.currentStock}
                              </strong>
                            </span>
                            {!req.isSufficient && (
                              <span className="text-red-400 font-bold bg-red-950/80 px-1.5 py-0.2 rounded">
                                Kurang {req.shortage}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Execution CTA Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleExecuteAssembly}
                        disabled={assembling || !simulation.canBuild}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                      >
                        {assembling ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mengeksekusi Produksi...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Eksekusi Perakitan Sekarang ({qtyToBuild} Unit)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: Tambah Formula BOM Baru */}
      {isNewRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Buat / Konfigurasi Formula Rakitan BOM</h3>
              </div>
              <button
                onClick={() => setIsNewRecipeModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Pilih Barang Jadi Hasil Rakitan
                </label>
                <select
                  value={newParentCode}
                  onChange={(e) => setNewParentCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Pilih Barang Jadi --</option>
                  {allItems.map((it) => (
                    <option key={it.kodeitem} value={it.kodeitem}>
                      {it.kodeitem} - {it.namaitem} ({it.satuan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-zinc-400">
                    Bahan Baku Komponen:
                  </label>
                  <button
                    type="button"
                    onClick={addComponentToNewRecipe}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Bahan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {newComponents.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                      Belum ada bahan baku komponen ditambahkan.
                    </div>
                  ) : (
                    newComponents.map((c, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl flex items-center space-x-2 text-xs"
                      >
                        <select
                          value={c.kodeitemrakitan}
                          onChange={(e) => {
                            const val = e.target.value;
                            const it = allItems.find((x) => x.kodeitem === val);
                            setNewComponents((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      kodeitemrakitan: val,
                                      namaitem: it?.namaitem || val,
                                      satuan: it?.satuan || "PCS",
                                      harga: Number(it?.hargapokok || 0),
                                    }
                                  : item
                              )
                            );
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white"
                        >
                          {allItems.map((it) => (
                            <option key={it.kodeitem} value={it.kodeitem}>
                              {it.namaitem} ({it.kodeitem})
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min={0.01}
                            step={0.1}
                            value={c.jumlah}
                            onChange={(e) => {
                              const qty = parseFloat(e.target.value) || 1;
                              setNewComponents((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, jumlah: qty } : item))
                              );
                            }}
                            className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-white font-mono text-right"
                          />
                          <span className="text-zinc-500 text-[10px] uppercase">{c.satuan}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setNewComponents((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsNewRecipeModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                disabled={savingRecipe}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
              >
                {savingRecipe ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Simpan Formula BOM</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
