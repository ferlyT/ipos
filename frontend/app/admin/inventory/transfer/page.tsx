"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Boxes,
  ArrowRightLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  X,
  Printer,
  History,
} from "lucide-react";
import { InvoiceDetailModal } from "@/components/invoice-detail-modal";

interface TransferRow {
  kodeitem: string;
  namaitem: string;
  satuan: string;
  stokAsal: number;
  jumlah: number;
}

export default function StockTransferPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [kantorDari, setKantorDari] = useState<string>("UTM");
  const [kantorTujuan, setKantorTujuan] = useState<string>("CAB1");
  const [keterangan, setKeterangan] = useState<string>("");
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [historyTransfers, setHistoryTransfers] = useState<any[]>([]);
  const [viewingTransfer, setViewingTransfer] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const loadHistory = async () => {
    try {
      const history = await api.inventory.getTransfers("", 20);
      setHistoryTransfers(history || []);
    } catch (e) {
      console.error("Gagal memuat histori transfer:", e);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const [whs, items] = await Promise.all([
          api.inventory.getWarehouses(),
          api.master.getItems("", 100),
        ]);
        setWarehouses(whs || []);
        setItemsList(items || []);
        if (whs && whs.length >= 2) {
          setKantorDari(whs[0].kodekantor);
          setKantorTujuan(whs[1].kodekantor);
        }
        await loadHistory();
      } catch (err) {
        console.error("Gagal inisialisasi transfer:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const addRow = () => {
    if (itemsList.length === 0) return;
    const defaultItem = itemsList[0];
    setRows((prev) => [
      ...prev,
      {
        kodeitem: defaultItem.kodeitem,
        namaitem: defaultItem.namaitem,
        satuan: defaultItem.satuan || "PCS",
        stokAsal: 0,
        jumlah: 1,
      },
    ]);
  };

  const updateRowItem = (idx: number, kodeitem: string) => {
    const item = itemsList.find((it) => it.kodeitem === kodeitem);
    if (!item) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              kodeitem: item.kodeitem,
              namaitem: item.namaitem,
              satuan: item.satuan || "PCS",
            }
          : r
      )
    );
  };

  const updateRowQty = (idx: number, qty: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, jumlah: Math.max(1, qty) } : r))
    );
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kantorDari === kantorTujuan) {
      setErrorMsg("Gudang asal dan gudang tujuan tidak boleh sama.");
      return;
    }
    if (rows.length === 0) {
      setErrorMsg("Tambahkan minimal 1 item untuk ditransfer.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const payload = {
        kantordari: kantorDari,
        kantortujuan: kantorTujuan,
        tanggal: new Date().toISOString().split("T")[0],
        keterangan: keterangan || `Transfer dari ${kantorDari} ke ${kantorTujuan}`,
        user: "ADMIN",
        items: rows.map((r) => ({
          kodeitem: r.kodeitem,
          jumlah: r.jumlah,
          satuan: r.satuan,
        })),
      };

      const res = await api.inventory.transferStock(payload);
      setResult(res);
      setRows([]);
      setKeterangan("");
      loadHistory();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal melakukan transfer stok.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
          <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
          <span>Transfer Antar-Gudang (Mutasi ITR)</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Pindahkan persediaan barang antar kantor cabang atau gudang logistik dengan pencatatan FIFO terpadu.
        </p>
      </div>

      {/* Success Alert */}
      {result && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-5 rounded-2xl space-y-3 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Transfer Stok Berhasil Diproses!</span>
            </div>
            <button
              onClick={() => setResult(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-900/60 p-3 rounded-xl border border-emerald-800/40">
            <div>
              <span className="text-zinc-400">No. Bukti Mutasi:</span>
              <div className="font-mono font-bold text-emerald-300 text-sm">
                {result.notransaksi}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Rute:</span>
              <div className="font-bold text-white">
                {result.kantordari} &rarr; {result.kantortujuan}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Total Kuantitas:</span>
              <div className="font-mono font-bold text-white">
                {formatNumber(result.totalQuantity)} Unit
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Total Nilai Valuasi:</span>
              <div className="font-mono font-bold text-emerald-400">
                {formatRupiah(result.totalValuation)}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setViewingTransfer(result.notransaksi)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Surat Jalan / Bukti Transfer</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Transfer Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="text-xs font-bold text-white flex items-center space-x-2 pb-2 border-b border-zinc-800">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Parameter Lokasi Gudang & Keterangan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-bold mb-1.5">Gudang Asal (Sumber)</label>
              <select
                value={kantorDari}
                onChange={(e) => setKantorDari(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-bold focus:outline-none focus:border-emerald-500"
              >
                {warehouses.map((wh) => (
                  <option key={wh.kodekantor} value={wh.kodekantor}>
                    [{wh.kodekantor}] {wh.namakantor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1.5">Gudang Tujuan (Penerima)</label>
              <select
                value={kantorTujuan}
                onChange={(e) => setKantorTujuan(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-bold focus:outline-none focus:border-emerald-500"
              >
                {warehouses.map((wh) => (
                  <option key={wh.kodekantor} value={wh.kodekantor}>
                    [{wh.kodekantor}] {wh.namakantor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-bold mb-1.5">Keterangan / Memo</label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Misal: Pemenuhan stok cabang jelang akhir pekan"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Item Rows Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
            <span className="font-bold text-white flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-emerald-400" />
              <span>Daftar Item Barang Yang Ditransfer</span>
            </span>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris Item</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 min-w-[280px]">Pilih Barang (Kode / Nama)</th>
                  <th className="py-3 px-4 w-28 text-center">Satuan</th>
                  <th className="py-3 px-4 w-36 text-right">Jumlah Transfer</th>
                  <th className="py-3 px-3 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Belum ada item ditambahkan. Klik tombol &quot;Tambah Baris Item&quot; di atas.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/40">
                      <td className="py-3 px-4 text-center text-zinc-500 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={row.kodeitem}
                          onChange={(e) => updateRowItem(idx, e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                        >
                          {itemsList.map((it) => (
                            <option key={it.kodeitem} value={it.kodeitem}>
                              [{it.kodeitem}] {it.namaitem}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-400">
                        {row.satuan}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          min={1}
                          value={row.jumlah}
                          onChange={(e) => updateRowQty(idx, Number(e.target.value))}
                          className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || rows.length === 0}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Mutasi Stok...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Eksekusi Transfer Stok Antar-Gudang</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Riwayat Mutasi Transfer Antar Gudang */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg mt-8">
        <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">Riwayat Mutasi Antar Gudang Terkini</span>
          </div>
          <button
            onClick={loadHistory}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">No. Bukti Mutasi</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Gudang Asal</th>
                <th className="py-3 px-3">Gudang Tujuan</th>
                <th className="py-3 px-3 text-center">Total Item</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {historyTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Belum ada riwayat mutasi antar-gudang yang tercatat.
                  </td>
                </tr>
              ) : (
                historyTransfers.map((tr: any) => (
                  <tr key={tr.notransaksi} className="hover:bg-zinc-800/40 text-zinc-300">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {tr.notransaksi}
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-400">
                      {tr.tanggal ? tr.tanggal.slice(0, 10) : "-"}
                    </td>
                    <td className="py-3 px-3 font-bold text-zinc-200">
                      {tr.namakantordari || tr.kantordari}
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-400">
                      {tr.namakantortujuan || tr.kantortujuan}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {tr.totalitem}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {tr.keterangan || "-"}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      {tr.operator || "ADMIN"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setViewingTransfer(tr.notransaksi)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all mx-auto"
                        title="Cetak Surat Jalan"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Cetak</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Transfer Modal */}
      <InvoiceDetailModal
        isOpen={Boolean(viewingTransfer)}
        onClose={() => setViewingTransfer(null)}
        type="transfer"
        notransaksi={viewingTransfer}
      />
    </div>
  );
}
