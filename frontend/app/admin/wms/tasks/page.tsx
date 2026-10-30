"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import { formatNumber, formatDateTime } from "@/lib/utils";
import {
  ClipboardList,
  PackagePlus,
  ShoppingCart,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Printer,
  X,
  FileText,
  UserCheck,
  Building,
} from "lucide-react";

export default function WmsTasksPage() {
  const [activeTab, setActiveTab] = useState<"OUTBOUND" | "INBOUND">("OUTBOUND");
  const [inboundTasks, setInboundTasks] = useState<any[]>([]);
  const [outboundTasks, setOutboundTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Create Task
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createInvoiceNo, setCreateInvoiceNo] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);

  // Modal Detail Task
  const [selectedTaskNo, setSelectedTaskNo] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const [inRes, outRes] = await Promise.all([
        api.wms.getInboundTasks(),
        api.wms.getOutboundTasks(),
      ]);
      setInboundTasks(inRes || []);
      setOutboundTasks(outRes || []);
    } catch (err) {
      console.error("Gagal memuat task WMS:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createInvoiceNo) return;
    setCreating(true);
    try {
      if (activeTab === "INBOUND") {
        await api.wms.createInboundFromPurchase(createInvoiceNo.trim());
      } else {
        await api.wms.createOutboundFromSales(createInvoiceNo.trim());
      }
      toast.success(activeTab === "INBOUND" ? "Tugas penerimaan (Inbound) berhasil diterbitkan!" : "Tugas pengambilan (Outbound) berhasil diterbitkan!");
      setShowCreateModal(false);
      setCreateInvoiceNo("");
      loadTasks();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat tugas WMS");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetail = async (notask: string) => {
    setSelectedTaskNo(notask);
    setLoadingDetail(true);
    try {
      if (activeTab === "INBOUND") {
        const res = await api.wms.getInboundTaskDetail(notask);
        setTaskDetail(res);
      } else {
        const res = await api.wms.getOutboundTaskDetail(notask);
        setTaskDetail(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const currentTasks = activeTab === "INBOUND" ? inboundTasks : outboundTasks;

  const pendingList = currentTasks.filter((t) => t.status === "PENDING");
  const inProgressList = currentTasks.filter(
    (t) => t.status === "RECEIVING" || t.status === "PICKING"
  );
  const completedList = currentTasks.filter(
    (t) => t.status === "COMPLETED" || t.status === "PACKED"
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-400" />
            Papan Tugas Gudang (Task Dispatch & Kanban)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitoring alur kerja picking pengeluaran pesanan dan putaway penerimaan barang gudang secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition"
            title="Refresh Antrean"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-lg shadow-amber-900/30"
          >
            <Plus className="w-4 h-4" />
            {activeTab === "INBOUND" ? "Tugas Masuk dari Faktur Beli" : "Tugas Ambil dari Faktur Jual"}
          </button>

          <Link
            href="/wms/scanner"
            target="_blank"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            Scanner PDA
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Tabs Switcher: Outbound Picking vs Inbound Receiving */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => {
            setActiveTab("OUTBOUND");
            setSelectedTaskNo(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === "OUTBOUND"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Tugas Pengeluaran (Picking Outbound)
          <span className="bg-amber-950 text-amber-200 text-[10px] px-2 py-0.5 rounded-full border border-amber-800">
            {outboundTasks.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("INBOUND");
            setSelectedTaskNo(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === "INBOUND"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          Tugas Penerimaan (Putaway Inbound)
          <span className="bg-emerald-950 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full border border-emerald-800">
            {inboundTasks.length}
          </span>
        </button>
      </div>

      {/* Kanban Board (3 Columns: Antrean, Dikerjakan, Selesai) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Kolom 1: Menunggu / Pending */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
              <h3 className="font-bold text-sm text-white">Antrean (Pending)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {pendingList.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {pendingList.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">Tidak ada antrean pending</div>
            ) : (
              pendingList.map((t) => (
                <div
                  key={t.notask}
                  onClick={() => handleOpenDetail(t.notask)}
                  className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 cursor-pointer transition shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">{t.notask}</span>
                    <span className="text-[10px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {t.priority || "NORMAL"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {t.tujuan || t.namasupel || "Klien / Dokumen"}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">Ref: {t.notransaksi_ref || "-"}</div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                    <span>{t.total_items} Barang</span>
                    <span>{t.total_qty_order} Unit</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kolom 2: Sedang Dikerjakan (In Progress) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <h3 className="font-bold text-sm text-white">Sedang Diproses (In Progress)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
              {inProgressList.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {inProgressList.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">Tidak ada tugas sedang berjalan</div>
            ) : (
              inProgressList.map((t) => (
                <div
                  key={t.notask}
                  onClick={() => handleOpenDetail(t.notask)}
                  className="bg-slate-900 hover:bg-slate-800/80 border border-amber-600/40 rounded-xl p-3.5 cursor-pointer transition shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">{t.notask}</span>
                    <span className="text-[10px] font-semibold bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {t.tujuan || t.namasupel || "Klien / Dokumen"}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>Petugas: {t.petugas || "Operator Scanner"}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400">{t.total_items} Barang</span>
                    <span className="font-mono font-bold text-amber-400">
                      {t.total_qty_picked || t.total_qty_received} / {t.total_qty_order} Selesai
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kolom 3: Selesai (Completed / Packed) */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="font-bold text-sm text-white">Selesai (Completed)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              {completedList.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {completedList.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">Belum ada tugas yang selesai</div>
            ) : (
              completedList.map((t) => (
                <div
                  key={t.notask}
                  onClick={() => handleOpenDetail(t.notask)}
                  className="bg-slate-900 hover:bg-slate-800/80 border border-emerald-600/30 rounded-xl p-3.5 cursor-pointer transition shadow-sm space-y-2 opacity-90"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-400">{t.notask}</span>
                    <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {t.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {t.tujuan || t.namasupel || "Klien / Dokumen"}
                  </div>
                  <div className="text-[11px] text-slate-500">Ref: {t.notransaksi_ref || "-"}</div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                    <span>{t.total_items} Barang</span>
                    <span className="font-mono text-emerald-400">{t.total_qty_order} Unit Selesai</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Buat Task Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {activeTab === "INBOUND" ? "Buat Tugas Putaway Masuk" : "Buat Tugas Picking Keluar"}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {activeTab === "INBOUND" ? "Nomor Faktur Pembelian iPos 4.0:" : "Nomor Faktur Penjualan iPos 4.0:"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "INBOUND" ? "Contoh: BL2301001" : "Contoh: JL2301001"}
                  value={createInvoiceNo}
                  onChange={(e) => setCreateInvoiceNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Sistem otomatis mengurai barang dan merencanakan alokasi rak/lorong terdekat.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition shadow-lg shadow-amber-900/30"
                >
                  {creating ? "Memproses..." : "Terbitkan Tugas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Task */}
      {selectedTaskNo && taskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                  {activeTab === "INBOUND" ? "Lembar Penerimaan & Putaway" : "Lembar Pengambilan (Picking List)"}
                </span>
                <h3 className="font-mono text-lg font-black text-white mt-1">{taskDetail.task.notask}</h3>
              </div>
              <button onClick={() => setSelectedTaskNo(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500">Referensi Transaksi:</span>
                <div className="font-mono font-semibold text-white">{taskDetail.task.notransaksi_ref || "-"}</div>
              </div>
              <div>
                <span className="text-slate-500">Status & Petugas:</span>
                <div className="font-semibold text-amber-400">
                  {taskDetail.task.status} ({taskDetail.task.petugas || "Belum ditugaskan"})
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {taskDetail.items.map((it: any, idx: number) => (
                <div
                  key={it.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono font-bold text-[10px]">
                      {it.sequence_order || idx + 1}
                    </span>
                    <div>
                      <div className="font-mono font-bold text-white">{it.kodeitem}</div>
                      <div className="text-slate-300">{it.namaitem}</div>
                      <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span>Lokasi Rak: {it.source_bin || it.target_bin || "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-white">
                      {it.jumlah_picked || it.jumlah_received || 0} / {it.jumlah_order} {it.satuan}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">{it.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" /> Cetak Slip Fisik (Print)
              </button>
              <Link
                href="/wms/scanner"
                target="_blank"
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
              >
                Buka di Terminal Scanner <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
