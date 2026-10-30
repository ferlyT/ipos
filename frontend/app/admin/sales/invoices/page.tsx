"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import {
  Receipt,
  Search,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
  UserCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  X,
  Printer,
  Download,
  CornerDownLeft,
  Plus,
} from "lucide-react";
import { InvoiceDetailModal } from "@/components/invoice-detail-modal";

export default function SalesInvoicesPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "aging">("invoices");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<"ALL" | "JL" | "RJ">("ALL");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [aging, setAging] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnRefInvoice, setReturnRefInvoice] = useState<string>("");
  const [returnCustomer, setReturnCustomer] = useState<string>("");
  const [returnItemCode, setReturnItemCode] = useState<string>("");
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnPrice, setReturnPrice] = useState<number>(0);
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

  // Receive Payment Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<string>("1-1110");
  const [paymentMethod, setPaymentMethod] = useState<string>("TN");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "invoices") {
        const typeParam = invoiceTypeFilter === "ALL" ? undefined : invoiceTypeFilter;
        const data = await api.sales.getInvoices(search, 50, typeParam);
        setInvoices(data || []);
      } else {
        const data = await api.sales.getAging();
        setAging(data || []);
      }
    } catch (err) {
      console.error("Gagal memuat data penjualan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    api.cashBank.getAccounts().then((accs) => {
      if (accs) setAccounts(accs);
    }).catch(console.error);
  }, [activeTab, invoiceTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openPayModal = (inv: any) => {
    const sisa = Number(inv.sisapiutang) || 0;
    setSelectedInvoice(inv);
    setPayAmount(sisa);
    setDiscountAmount(0);
    setErrorMessage(null);
  };

  const handleExportSalesCSV = () => {
    if (invoices.length === 0) return;
    const headers = ["No Faktur", "Tipe", "Tanggal", "Kode Pelanggan", "Nama Pelanggan", "Cara Bayar", "Subtotal", "PPN", "Total Akhir", "Sisa Piutang"];
    const rows = invoices.map((inv) => [
      `"${inv.notransaksi}"`,
      `"${inv.tipe || "JL"}"`,
      `"${inv.tanggal || ""}"`,
      `"${inv.kodesupel || ""}"`,
      `"${(inv.namapelanggan || "").replace(/"/g, '""')}"`,
      `"${inv.carabayar || "TN"}"`,
      inv.subtotal || 0,
      inv.pajak || 0,
      inv.totalakhir || 0,
      inv.sisapiutang || 0,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_penjualan_${invoiceTypeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReturnModalWithInvoice = (inv: any) => {
    setReturnRefInvoice(inv.notransaksi);
    setReturnCustomer(inv.kodesupel || "PL0001");
    setReturnItemCode("");
    setReturnQty(1);
    setReturnPrice(0);
    setIsReturnModalOpen(true);
  };

  const handleCreateReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnRefInvoice || !returnItemCode || returnQty <= 0) {
      alert("Mohon lengkapi nomor faktur asal, kode barang, dan jumlah retur.");
      return;
    }
    setReturnSubmitting(true);
    try {
      const res = await api.sales.createReturn({
        refInvoice: returnRefInvoice,
        kodesupel: returnCustomer,
        items: [
          {
            kodeitem: returnItemCode,
            jumlah: Number(returnQty),
            harga: Number(returnPrice),
          },
        ],
      });
      setToastMessage(`Retur Penjualan berhasil dicatat! No Transaksi: ${res.notransaksi}`);
      setIsReturnModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert("Gagal membuat retur penjualan: " + err.message);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      setErrorMessage("Nominal penerimaan harus lebih besar dari 0");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        notransaksi: `BP${Date.now().toString().slice(-8)}`,
        kodekantor: selectedInvoice.kodekantor || "UTM",
        tanggal: new Date().toISOString().split("T")[0],
        kodesupel: selectedInvoice.kodesupel || "KASIR",
        carabayar: paymentMethod,
        accBayar: selectedAccount,
        user: "ADMIN",
        alokasi: [
          {
            notrsmasuk: selectedInvoice.notransaksi,
            bayarNominal: payAmount,
            potonganNominal: discountAmount,
          },
        ],
      };

      await api.sales.payCustomerReceivable(payload);
      setToastMessage(`Sukses! Pelunasan piutang faktur ${selectedInvoice.notransaksi} berhasil dicatat.`);
      setSelectedInvoice(null);
      loadData();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses pelunasan piutang.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOutstandingReceivable = invoices.reduce(
    (sum, it) => sum + (Number(it.sisapiutang) || 0),
    0
  );

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

      {/* Title & Tabs Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>Penjualan & Piutang Pelanggan</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Riwayat transaksi kasir dan penjualan tempo (JL), pelunasan piutang kas/bank, dan analisa schedule aging.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "invoices"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Faktur Penjualan
          </button>
          <button
            onClick={() => setActiveTab("aging")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "aging"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Analisa Aging Piutang
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-red-950 text-red-400 rounded-xl border border-red-800/60">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Saldo Piutang Aktif
            </div>
            <div className="text-xl font-black text-red-400 font-mono mt-0.5">
              {formatRupiah(totalOutstandingReceivable)}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Transaksi Ditampilkan
            </div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {invoices.length} Faktur
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-amber-950 text-amber-400 rounded-xl border border-amber-800/60">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Faktur Belum Lunas
            </div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              {invoices.filter((it) => Number(it.sisapiutang) > 0).length} Faktur
            </div>
          </div>
        </div>
      </div>

      {/* Main View Content */}
      {activeTab === "invoices" ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Sub-filter tabs */}
            <div className="flex items-center space-x-1 bg-zinc-950 border border-zinc-800 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setInvoiceTypeFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  invoiceTypeFilter === "ALL"
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setInvoiceTypeFilter("JL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  invoiceTypeFilter === "JL"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Faktur (JL)
              </button>
              <button
                type="button"
                onClick={() => setInvoiceTypeFilter("RJ")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  invoiceTypeFilter === "RJ"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Retur (RJ)
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nomor faktur/retur atau nama pelanggan..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </form>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setReturnRefInvoice("");
                  setReturnCustomer("PL0001");
                  setReturnItemCode("");
                  setReturnQty(1);
                  setReturnPrice(0);
                  setIsReturnModalOpen(true);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-purple-950/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Buat Retur (RJ)</span>
              </button>

              <button
                type="button"
                onClick={handleExportSalesCSV}
                disabled={invoices.length === 0}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border border-zinc-700"
                title="Ekspor Laporan Penjualan (CSV)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={loadData}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table of Invoices */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                  <tr>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-2 text-center">Cara Bayar</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">PPN</th>
                    <th className="py-3 px-4 text-right">Total Akhir</th>
                    <th className="py-3 px-4 text-right">Sisa Piutang</th>
                    <th className="py-3 px-3 text-center">Jatuh Tempo</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-zinc-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                        Memuat faktur penjualan...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-zinc-400">
                        Tidak ada faktur penjualan yang sesuai pencarian.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv: any) => {
                      const hasReceivable = Number(inv.sisapiutang) > 0;
                      return (
                        <tr key={inv.notransaksi} className="hover:bg-zinc-800/40 text-zinc-300">
                          <td className="py-3 px-4 font-mono font-bold text-white flex items-center space-x-1.5">
                            <span>{inv.notransaksi}</span>
                            {inv.tipe === "RJ" ? (
                              <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-700 px-1.5 py-0.2 rounded font-bold">
                                RJ
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                JL
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-400">
                            {formatDate(inv.tanggal)}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-200">
                            {inv.namapelanggan || inv.kodesupel || "KONSUMEN UMUM"}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.carabayar === "TN"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {inv.carabayar === "TN" ? "TUNAI" : "KREDIT"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-zinc-400">
                            {formatRupiah(inv.subtotal)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-zinc-400">
                            {formatRupiah(inv.pajak)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {formatRupiah(inv.totalakhir)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            <span className={hasReceivable ? "text-red-400" : "text-emerald-400"}>
                              {formatRupiah(inv.sisapiutang)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-zinc-400 font-mono">
                            {inv.jatuhtempo ? formatDate(inv.jatuhtempo) : "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => setViewingInvoice(inv.notransaksi)}
                                className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all"
                                title="Lihat & Cetak Faktur"
                              >
                                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                              </button>
                              {inv.tipe !== "RJ" && (
                                <button
                                  onClick={() => openReturnModalWithInvoice(inv)}
                                  className="p-1 bg-zinc-800 hover:bg-purple-900/60 text-zinc-400 hover:text-purple-300 rounded-lg transition-all"
                                  title="Buat Retur dari Faktur Ini"
                                >
                                  <CornerDownLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasReceivable ? (
                                <button
                                  onClick={() => openPayModal(inv)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all shadow-sm"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Terima</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-500 font-bold px-1">Lunas</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Tab Aging Schedule */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
            <span className="font-bold text-white flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Jadwal Umur Piutang Pelanggan (Aging Schedule)</span>
            </span>
            <span className="text-zinc-400">Periode: Berjalan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-3 text-right">Belum JT</th>
                  <th className="py-3 px-3 text-right">1-30 Hari</th>
                  <th className="py-3 px-3 text-right">31-60 Hari</th>
                  <th className="py-3 px-3 text-right">61-90 Hari</th>
                  <th className="py-3 px-3 text-right">&gt;90 Hari</th>
                  <th className="py-3 px-4 text-right">Total Saldo Piutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 font-sans">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                      Mengkalkulasi analisa aging piutang...
                    </td>
                  </tr>
                ) : aging.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 font-sans">
                      Tidak ada catatan saldo piutang aktif.
                    </td>
                  </tr>
                ) : (
                  aging.map((a: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-3 px-4 text-zinc-400">{a.kode || "-"}</td>
                      <td className="py-3 px-4 font-bold text-white font-sans">{a.nama || "-"}</td>
                      <td className="py-3 px-3 text-right text-emerald-400">
                        {formatRupiah(a.current || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-yellow-400">
                        {formatRupiah(a.days1_30 || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-500">
                        {formatRupiah(a.days31_60 || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-orange-500">
                        {formatRupiah(a.days61_90 || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-red-500 font-bold">
                        {formatRupiah(a.daysOver90 || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white text-sm">
                        {formatRupiah(a.total || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive Payment Modal Dialog */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <span>Pelunasan Piutang Pelanggan</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Faktur: <span className="font-mono text-emerald-400 font-bold">{selectedInvoice.notransaksi}</span> ({selectedInvoice.namapelanggan || selectedInvoice.kodesupel || "KONSUMEN UMUM"})
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80">
                <div>
                  <div className="text-zinc-500">Total Nilai Faktur</div>
                  <div className="font-mono font-bold text-sm text-white">
                    {formatRupiah(selectedInvoice.totalakhir)}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Sisa Piutang</div>
                  <div className="font-mono font-bold text-sm text-red-400">
                    {formatRupiah(selectedInvoice.sisapiutang)}
                  </div>
                </div>
              </div>

              {/* Form Input */}
              <div className="space-y-3">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Akun Kas / Bank Penerima Setoran
                  </label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  >
                    {accounts.length > 0 ? (
                      accounts.map((acc: any) => (
                        <option key={acc.kodeacc} value={acc.kodeacc}>
                          {acc.kodeacc} - {acc.namaacc} (Saldo: {formatRupiah(acc.saldo)})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1-1110">1-1110 - Kas Kecil</option>
                        <option value="1-1120">1-1120 - Bank BCA</option>
                        <option value="1-1121">1-1121 - Bank Mandiri</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Metode</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="TN">TUNAI</option>
                      <option value="TR">TRANSFER BANK</option>
                      <option value="BG">BILYET GIRO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Diskon / Potongan</label>
                    <input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono text-xs text-right"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Nominal Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-emerald-600 rounded-xl px-3 py-2.5 text-emerald-400 font-mono font-bold text-base text-right focus:outline-none shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-850 border-t border-zinc-800 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Konfirmasi Penerimaan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Buat Retur Penjualan (RJ) */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <CornerDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Catat Retur Penjualan (RJ)</h3>
                  <p className="text-[10px] text-zinc-400">Pengembalian barang pelanggan & pemotong piutang</p>
                </div>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReturnSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-bold">No. Faktur Penjualan Asal (Ref)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 0005/JL/UTM/0122 atau JL..."
                  value={returnRefInvoice}
                  onChange={(e) => setReturnRefInvoice(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-bold">Kode Pelanggan</label>
                <input
                  type="text"
                  value={returnCustomer}
                  onChange={(e) => setReturnCustomer(e.target.value)}
                  placeholder="PL0001"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-bold">Kode Item yang Diretur</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan kode barang persis..."
                  value={returnItemCode}
                  onChange={(e) => setReturnItemCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-bold">Jumlah Retur</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-bold">Harga Retur (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={returnPrice}
                    onChange={(e) => setReturnPrice(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="text-purple-300 font-bold">Total Nilai Retur:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatRupiah(Number(returnQty) * Number(returnPrice))}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={returnSubmitting}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-950/50 flex items-center space-x-1.5"
                >
                  {returnSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Retur (RJ)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      <InvoiceDetailModal
        isOpen={Boolean(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
        type="sales"
        notransaksi={viewingInvoice}
      />
    </div>
  );
}
