"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import {
  PackageCheck,
  ShoppingBag,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Send,
  Plus,
  Trash2,
} from "lucide-react";

export default function OrdersBacklogPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "SO" | "PO">("ALL");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Fulfillment Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [fulfillRows, setFulfillRows] = useState<
    Array<{ nobaris: number; kodeitem: string; qtyReceived: number }>
  >([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Order Modal State
  const [isNewOrderOpen, setIsNewOrderOpen] = useState<boolean>(false);
  const [orderTipe, setOrderTipe] = useState<"SO" | "PO">("SO");
  const [orderNo, setOrderNo] = useState<string>("");
  const [orderCustomer, setOrderCustomer] = useState<string>("PL0001");
  const [orderKirimDate, setOrderKirimDate] = useState<string>("2026-11-15");
  const [orderDp, setOrderDp] = useState<number>(0);
  const [orderKeterangan, setOrderKeterangan] = useState<string>("");
  const [orderItems, setOrderItems] = useState<
    Array<{ kodeitem: string; namaitem: string; jumlah: number; satuan: string; harga: number }>
  >([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const typeParam = activeTab === "ALL" ? undefined : activeTab;
      const data = await api.orders.getOutstanding(typeParam);
      setOrders(data || []);
    } catch (err) {
      console.error("Gagal memuat backlog pesanan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // Load metadata for new order form
    Promise.all([
      api.master.getItems("", 50),
      api.master.getContacts(undefined, "", 50),
    ]).then(([its, cts]) => {
      setAvailableItems(its || []);
      setAvailableContacts(cts || []);
    }).catch(console.error);
  }, [activeTab]);

  const filteredOrders = orders.filter((o) => {
    const s = search.toLowerCase();
    return (
      o.notransaksi?.toLowerCase().includes(s) ||
      o.namasupel?.toLowerCase().includes(s) ||
      o.kodesupel?.toLowerCase().includes(s)
    );
  });

  const openFulfillModal = (order: any) => {
    setSelectedOrder(order);
    setFulfillRows([
      {
        nobaris: 1,
        kodeitem: "ITEM",
        qtyReceived: Math.min(1, order.backlogQty || 1),
      },
    ]);
    setErrorMsg(null);
  };

  const handleProcessFulfillment = async () => {
    if (!selectedOrder) return;
    if (fulfillRows.length === 0 || fulfillRows[0].qtyReceived <= 0) {
      setErrorMsg("Kuantitas pemenuhan harus lebih dari 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await api.orders.fulfillOrder(selectedOrder.notransaksi, fulfillRows);
      setToastMessage(
        `Sukses! Pemenuhan pesanan ${selectedOrder.notransaksi} berhasil dicatat.`
      );
      setSelectedOrder(null);
      loadOrders();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat pemenuhan pesanan.");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateModal = () => {
    const tipe = activeTab === "PO" ? "PO" : "SO";
    setOrderTipe(tipe);
    setOrderNo(`${tipe}${Date.now().toString().slice(-6)}`);
    setOrderKeterangan("");
    setOrderDp(0);
    setOrderKirimDate("2026-11-15");
    if (availableItems.length > 0) {
      const it = availableItems[0];
      setOrderItems([
        {
          kodeitem: it.kodeitem,
          namaitem: it.namaitem,
          jumlah: 1,
          satuan: it.satuan || "PCS",
          harga: Number(it.hargajual || it.hargapokok || 100000),
        },
      ]);
    } else {
      setOrderItems([]);
    }
    setErrorMsg(null);
    setIsNewOrderOpen(true);
  };

  const addOrderItemRow = () => {
    if (availableItems.length === 0) return;
    const it = availableItems[0];
    setOrderItems((prev) => [
      ...prev,
      {
        kodeitem: it.kodeitem,
        namaitem: it.namaitem,
        jumlah: 1,
        satuan: it.satuan || "PCS",
        harga: Number(it.hargajual || it.hargapokok || 100000),
      },
    ]);
  };

  const updateOrderItem = (idx: number, kodeitem: string) => {
    const it = availableItems.find((i) => i.kodeitem === kodeitem);
    if (!it) return;
    setOrderItems((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              kodeitem: it.kodeitem,
              namaitem: it.namaitem,
              satuan: it.satuan || "PCS",
              harga: Number(it.hargajual || it.hargapokok || 100000),
            }
          : row
      )
    );
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      setErrorMsg("Tambahkan minimal 1 item barang dalam pesanan.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.orders.createOrder({
        notransaksi: orderNo,
        tipe: orderTipe,
        kodekantor: "UTM",
        tanggal: new Date().toISOString().split("T")[0],
        tanggalkirim: orderKirimDate,
        kodesupel: orderCustomer,
        keterangan: orderKeterangan || `Pesanan ${orderTipe} Baru`,
        dppesananbyr: orderDp,
        items: orderItems.map((it) => ({
          kodeitem: it.kodeitem,
          jumlah: it.jumlah,
          satuan: it.satuan,
          harga: it.harga,
          potongan: 0,
        })),
      });

      setToastMessage(`Sukses! Pesanan baru ${orderNo} (${orderTipe}) berhasil dibuat.`);
      setIsNewOrderOpen(false);
      loadOrders();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat pesanan.");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalBacklogQty = orders.reduce((sum, o) => sum + (o.backlogQty || 0), 0);
  const totalOutstandingValue = orders.reduce((sum, o) => sum + (o.totalakhir || 0), 0);
  const totalDpCollected = orders.reduce((sum, o) => sum + (o.dppesananbyr || 0), 0);
  const delayedOrders = orders.filter((o) => (o.agingDays || 0) > 7).length;

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

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <PackageCheck className="w-6 h-6 text-emerald-400" />
            <span>Pemesanan & Backlog Fulfillment (PO & SO)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Pelacakan status pemenuhan purchase order supplier dan sales order pelanggan, antrean pengiriman, dan DP.
          </p>
        </div>

        {/* Action Button & Tab Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "ALL"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Semua Pesanan
            </button>
            <button
              onClick={() => setActiveTab("SO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "SO"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sales Order (SO)
            </button>
            <button
              onClick={() => setActiveTab("PO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "PO"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Purchase Order (PO)
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pesanan Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Kuantitas Backlog</span>
          </div>
          <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
            {formatNumber(totalBacklogQty)} Unit
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Belum Terpenuhi / Terkirim</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Total Nilai Pesanan
          </div>
          <div className="text-xl font-black text-white font-mono mt-0.5">
            {formatRupiah(totalOutstandingValue)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">{orders.length} Pesanan Aktif</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Uang Muka (DP)
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
            {formatRupiah(totalDpCollected)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Telah Diterima / Dibayar</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span>Aging &gt; 7 Hari</span>
          </div>
          <div
            className={`text-xl font-black font-mono mt-0.5 ${
              delayedOrders > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {delayedOrders} Pesanan
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Perlu Prioritas Kirim</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor pesanan PO/SO atau nama mitra/pelanggan..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={loadOrders}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-3 text-center">Tipe</th>
                <th className="py-3 px-3">Tgl Pesan</th>
                <th className="py-3 px-3">Target Kirim</th>
                <th className="py-3 px-4">Supplier / Pelanggan</th>
                <th className="py-3 px-4">Progress Pemenuhan</th>
                <th className="py-3 px-3 text-right">Backlog Qty</th>
                <th className="py-3 px-4 text-right">Total Nilai</th>
                <th className="py-3 px-3 text-right">DP</th>
                <th className="py-3 px-3 text-center">Aging</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data pesanan...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-400">
                    Tidak ada backlog pesanan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord: any) => {
                  const isSO = ord.tipe === "SO";
                  return (
                    <tr key={ord.notransaksi} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {ord.notransaksi}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isSO
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {ord.tipe}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-400">
                        {formatDate(ord.tanggal)}
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-400">
                        {ord.tanggalkirim ? formatDate(ord.tanggalkirim) : "-"}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {ord.namasupel || ord.kodesupel || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span>{ord.totalterima} / {ord.totalitem} Qty</span>
                            <span className="font-bold text-emerald-400">
                              {ord.progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, ord.progressPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                        {formatNumber(ord.backlogQty)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatRupiah(ord.totalakhir)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">
                        {formatRupiah(ord.dppesananbyr)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.agingDays > 7
                              ? "bg-red-950 text-red-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {ord.agingDays} Hari
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => openFulfillModal(ord)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 mx-auto transition-all shadow-xs cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Fulfill</span>
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

      {/* Modal Buat Pesanan Baru (PO & SO) */}
      {isNewOrderOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  <span>Buat Surat Pesanan Baru ({orderTipe})</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Input pesanan penjualan (Sales Order) atau pesanan pembelian (Purchase Order)
                </p>
              </div>
              <button
                onClick={() => setIsNewOrderOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {errorMsg && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Tipe Pesanan</label>
                    <select
                      value={orderTipe}
                      onChange={(e) => {
                        const val = e.target.value as "SO" | "PO";
                        setOrderTipe(val);
                        setOrderNo(`${val}${Date.now().toString().slice(-6)}`);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SO">SO - Sales Order (Pelanggan)</option>
                      <option value="PO">PO - Purchase Order (Supplier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">No. Transaksi</label>
                    <input
                      type="text"
                      value={orderNo}
                      onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Target Tgl Kirim</label>
                    <input
                      type="date"
                      value={orderKirimDate}
                      onChange={(e) => setOrderKirimDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      {orderTipe === "SO" ? "Pelanggan (Pemesan)" : "Supplier (Vendor)"}
                    </label>
                    <select
                      value={orderCustomer}
                      onChange={(e) => setOrderCustomer(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      {availableContacts
                        .filter((c) => (orderTipe === "SO" ? c.tipe === "PL" : c.tipe === "SU"))
                        .map((c) => (
                          <option key={c.kode} value={c.kode}>
                            [{c.kode}] {c.nama}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Uang Muka / DP (Rp)</label>
                    <input
                      type="number"
                      value={orderDp}
                      onChange={(e) => setOrderDp(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-right font-mono text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-300">Daftar Barang Pesanan</span>
                    <button
                      type="button"
                      onClick={addOrderItemRow}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Item</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {orderItems.map((row, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                        <select
                          value={row.kodeitem}
                          onChange={(e) => updateOrderItem(idx, e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-xs font-mono"
                        >
                          {availableItems.map((it) => (
                            <option key={it.kodeitem} value={it.kodeitem}>
                              [{it.kodeitem}] {it.namaitem}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={row.jumlah}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, jumlah: Math.max(1, Number(e.target.value)) } : r
                              )
                            )
                          }
                          className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-white text-xs"
                        />
                        <span className="text-zinc-500 font-mono text-[10px] w-12 text-center">{row.satuan}</span>
                        <input
                          type="number"
                          value={row.harga}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, harga: Number(e.target.value) } : r
                              )
                            )
                          }
                          className="w-28 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-right font-mono text-zinc-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setOrderItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-zinc-850 border-t border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewOrderOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || orderItems.length === 0}
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
                      <span>Terbitkan Pesanan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fulfillment Modal Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Send className="w-5 h-5 text-emerald-400" />
                  <span>Pemenuhan Barang Pesanan (Fulfillment)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  No: <span className="font-mono text-emerald-400 font-bold">{selectedOrder.notransaksi}</span> ({selectedOrder.namasupel})
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80">
                <div>
                  <div className="text-zinc-500">Total Dipesan</div>
                  <div className="font-mono font-bold text-sm text-white">
                    {formatNumber(selectedOrder.totalitem)} Unit
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Telah Diterima/Kirim</div>
                  <div className="font-mono font-bold text-sm text-emerald-400">
                    {formatNumber(selectedOrder.totalterima)} Unit
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Sisa Backlog</div>
                  <div className="font-mono font-bold text-sm text-amber-400">
                    {formatNumber(selectedOrder.backlogQty)} Unit
                  </div>
                </div>
              </div>

              {/* Form Input Qty Received */}
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1.5">
                    Kuantitas {selectedOrder.tipe === "PO" ? "Penerimaan Barang Masuk" : "Pengiriman Barang Keluar"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={selectedOrder.backlogQty}
                      value={fulfillRows[0]?.qtyReceived || 1}
                      onChange={(e) =>
                        setFulfillRows([
                          {
                            nobaris: 1,
                            kodeitem: "ITEM",
                            qtyReceived: Number(e.target.value),
                          },
                        ])
                      }
                      className="w-full bg-zinc-950 border border-emerald-600 rounded-xl px-4 py-2.5 text-emerald-400 font-mono font-bold text-base text-right focus:outline-none shadow-inner"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Maksimal pemenuhan saat ini: {selectedOrder.backlogQty} unit.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-850 border-t border-zinc-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessFulfillment}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Konfirmasi Pemenuhan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
