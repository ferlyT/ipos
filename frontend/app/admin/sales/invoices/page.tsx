"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
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
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  ExternalLink,
  Layers,
  Calendar,
  CheckCircle,
  Tag,
} from "lucide-react";
import { InvoiceDetailModal } from "@/components/invoice-detail-modal";

export default function SalesInvoicesPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "aging" | "matcher">("invoices");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<"ALL" | "JL" | "RJ">("ALL");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [aging, setAging] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Smart Invoice Matcher State
  const [matchAmount, setMatchAmount] = useState<string>("");
  const [matchCustomer, setMatchCustomer] = useState<string>("");
  const [matchYear, setMatchYear] = useState<string>("2026");
  const [matchTolerance, setMatchTolerance] = useState<string>("0");
  const [matchLoading, setMatchLoading] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);

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

  const loadData = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search,
    targetType: "ALL" | "JL" | "RJ" = invoiceTypeFilter
  ) => {
    setLoading(true);
    try {
      if (activeTab === "invoices") {
        const typeParam = targetType === "ALL" ? undefined : targetType;
        const res = await api.sales.getInvoices(targetSearch, targetLimit, typeParam, targetPage);
        const paginated = normalizePaginated<any>(res, targetPage, targetLimit);
        setInvoices(paginated.items);
        setTotalItems(paginated.pagination.total);
        setTotalPages(paginated.pagination.totalPages);
        setPage(paginated.pagination.page);
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
    if (activeTab === "matcher") return;
    setPage(1);
    loadData(1, pageSize, search, invoiceTypeFilter);
    api.cashBank.getAccounts().then((accs) => {
      if (accs) {
        const uniqueAccs = Array.from(
          new Map((accs || []).map((a: any) => [a.kodeacc, a])).values()
        );
        setAccounts(uniqueAccs);
      }
    }).catch(console.error);
  }, [activeTab, invoiceTypeFilter]);

  const handleMatchInvoices = async (
    customAmount?: number,
    customCust?: string,
    customYear?: string,
    customTol?: number
  ) => {
    const rawAmount =
      customAmount !== undefined
        ? customAmount
        : Number(matchAmount.replace(/[^0-9]/g, ""));

    if (!rawAmount || rawAmount <= 0) {
      toast.error("Masukkan nominal pembayaran valid yang ingin dicocokkan.");
      return;
    }

    const custQuery = customCust !== undefined ? customCust : matchCustomer.trim();
    const yearVal =
      customYear !== undefined
        ? customYear === "ALL"
          ? undefined
          : Number(customYear)
        : matchYear === "ALL"
        ? undefined
        : Number(matchYear);
    const tolVal = customTol !== undefined ? customTol : Number(matchTolerance) || 0;

    setMatchLoading(true);
    try {
      const data = await api.sales.matchInvoices({
        amount: rawAmount,
        customerQuery: custQuery || undefined,
        year: yearVal,
        tolerance: tolVal,
      });

      if (data) {
        setMatchResult(data);
        setSelectedScenarioIdx(0);
        if (data.scenarios && data.scenarios.length > 0) {
          toast.success(
            `Ditemukan ${data.scenarios.length} skenario kecocokan tagihan!`
          );
        } else {
          toast("Tidak ditemukan kecocokan faktur untuk nominal tersebut.", {
            icon: "ℹ️",
          });
        }
      }
    } catch (err: any) {
      console.error("Match error:", err);
      toast.error(err.message || "Terjadi kesalahan saat mencari kecocokan.");
    } finally {
      setMatchLoading(false);
    }
  };

  const handleApplyPreset = (
    amount: number,
    customer: string,
    year: string = "2026"
  ) => {
    setMatchAmount(formatNumber(amount));
    setMatchCustomer(customer);
    setMatchYear(year);
    setMatchTolerance("0");
    handleMatchInvoices(amount, customer, year, 0);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(1, pageSize, search, invoiceTypeFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, pageSize, search, invoiceTypeFilter);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadData(1, newSize, search, invoiceTypeFilter);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      toast.error("Mohon lengkapi nomor faktur asal, kode barang, dan jumlah retur.");
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
      toast.success(`Retur Penjualan berhasil dicatat! No: ${res.notransaksi}`);
      setToastMessage(`Retur Penjualan berhasil dicatat! No Transaksi: ${res.notransaksi}`);
      setIsReturnModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal membuat retur penjualan: " + err.message);
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
          <button
            onClick={() => setActiveTab("matcher")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === "matcher"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pencocokan Tagihan (Smart Match)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {activeTab !== "matcher" ? (
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Target Pembayaran
              </div>
              <div className="text-xl font-black text-blue-400 font-mono mt-0.5">
                {matchResult ? formatRupiah(matchResult.query.amount) : (matchAmount ? `Rp ${matchAmount}` : "Rp 0")}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
            <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Faktur Belum Lunas Ditelusuri
              </div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {matchResult ? `${matchResult.totalUnpaidInvoicesFound} Faktur` : "Menunggu input"}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
            <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Skenario Kecocokan
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                {matchResult ? `${matchResult.scenariosCount} Rekomendasi` : "-"}
              </div>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => loadData()}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table of Invoices */}
          <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
            {loading && invoices.length > 0 && (
              <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Memuat faktur...</span>
                </div>
              </div>
            )}
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

          {/* Pagination Component */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            disabled={loading}
          />
        </div>
      ) : activeTab === "aging" ? (
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
      ) : (
        /* Tab Smart Invoice Matcher */
        <div className="space-y-6">
          {/* Search & Config Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>Pencocokan Tagihan Cerdas (Smart Payment Reconciler)</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Masukkan nominal dana masuk rekening untuk menelusuri faktur tunggal, batch bulanan, atau kombinasi tagihan piutang yang cocok.
                </p>
              </div>

              {matchResult && (
                <button
                  type="button"
                  onClick={() => {
                    setMatchResult(null);
                    setMatchAmount("");
                    setMatchCustomer("");
                  }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                >
                  Reset Pencarian
                </button>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500 font-bold flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5" />
                <span>Uji Coba Cepat:</span>
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset(3481750, "EDY", "2026")}
                className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 rounded-lg font-mono text-[11px] transition-all"
              >
                Rp 3.481.750 (EDY • 2 Faktur)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(111796650, "APIN", "2026")}
                className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 rounded-lg font-mono text-[11px] transition-all"
              >
                Rp 111.796.650 (APIN • Juli 2026)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(86623400, "APIN", "2026")}
                className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 rounded-lg font-mono text-[11px] transition-all"
              >
                Rp 86.623.400 (APIN • Juni P1)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(42250000, "APIN", "2026")}
                className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 rounded-lg font-mono text-[11px] transition-all"
              >
                Rp 42.250.000 (APIN • Juni P2)
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMatchInvoices();
              }}
              className="space-y-4 pt-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Nominal Input */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Nominal Diterima (Rp) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">
                      Rp
                    </span>
                    <input
                      type="text"
                      required
                      value={matchAmount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setMatchAmount(val ? formatNumber(Number(val)) : "");
                      }}
                      placeholder="Contoh: 3.481.750"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Customer Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Pelanggan / Armada <span className="text-zinc-500 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={matchCustomer}
                    onChange={(e) => setMatchCustomer(e.target.value)}
                    placeholder="Semua (atau: APIN, EDY, TWINDO)"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-emerald-500 placeholder:text-zinc-600"
                  />
                </div>

                {/* Year Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Tahun Faktur
                  </label>
                  <select
                    value={matchYear}
                    onChange={(e) => setMatchYear(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="2026">Tahun 2026</option>
                    <option value="2025">Tahun 2025</option>
                    <option value="2024">Tahun 2024</option>
                    <option value="ALL">Semua Periode</option>
                  </select>
                </div>

                {/* Tolerance Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Toleransi Selisih
                  </label>
                  <select
                    value={matchTolerance}
                    onChange={(e) => setMatchTolerance(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="0">Tepat Persis (Selisih Rp 0)</option>
                    <option value="1000">Maks. Selisih Rp 1.000</option>
                    <option value="10000">Maks. Selisih Rp 10.000</option>
                    <option value="50000">Maks. Selisih Rp 50.000</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={matchLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center space-x-2 transition-all cursor-pointer"
                >
                  {matchLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menganalisa Faktur & Kombinasi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Cari Rekonsiliasi Tagihan (Smart Match)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Results Area */}
          {matchResult && (
            <div className="space-y-6">
              {matchResult.scenarios.length === 0 ? (
                /* Empty Result Card */
                <div className="bg-zinc-900 border border-amber-900/50 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-950 text-amber-400 rounded-2xl border border-amber-800/60 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Tidak Ditemukan Kecocokan Faktur
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                    Tidak ditemukan faktur tunggal, batch bulanan, atau kombinasi faktur yang sesuai dengan nominal{" "}
                    <span className="font-mono font-bold text-amber-400">
                      {formatRupiah(matchResult.query.amount)}
                    </span>{" "}
                    pada filter yang dipilih.
                  </p>
                  <div className="pt-2 flex flex-wrap justify-center gap-2 text-[11px] text-zinc-500">
                    <span className="bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
                      💡 Coba kosongkan filter pelanggan untuk mencari ke seluruh customer
                    </span>
                    <span className="bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
                      💡 Naikkan toleransi jika dicurigai ada potongan bank/materai
                    </span>
                  </div>
                </div>
              ) : (
                /* Scenarios Display */
                <div className="space-y-4">
                  {/* Scenario Cards Selector */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Skenario Rekonsiliasi ({matchResult.scenarios.length} Opsi Ditemukan)</span>
                    </h3>
                    <span className="text-xs text-zinc-500">
                      Klik salah satu skenario untuk melihat rincian faktur
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {matchResult.scenarios.map((sc: any, idx: number) => {
                      const isSelected = selectedScenarioIdx === idx;
                      const isExact = sc.difference === 0;

                      let badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800";
                      let badgeText = "100% Pas Persis";

                      if (sc.type === "MONTHLY_BATCH") {
                        badgeColor = "bg-sky-950 text-sky-300 border-sky-800";
                        badgeText = "Batch 1 Bulan Penuh";
                      } else if (sc.type === "SINGLE_EXACT") {
                        badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-800";
                        badgeText = "Faktur Tunggal";
                      } else if (sc.type === "CONSECUTIVE_FIFO") {
                        badgeColor = "bg-teal-950 text-teal-300 border-teal-800";
                        badgeText = "Faktur Berurutan (FIFO)";
                      } else if (!isExact) {
                        badgeColor = "bg-amber-950 text-amber-300 border-amber-800";
                        badgeText = `Selisih ${formatRupiah(sc.difference)}`;
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedScenarioIdx(idx)}
                          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? "bg-zinc-850 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                              : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeColor}`}
                            >
                              {badgeText}
                            </span>
                            <span className="text-[11px] font-bold text-zinc-400">
                              {sc.invoiceCount} Faktur
                            </span>
                          </div>

                          <div className="font-mono text-base font-black text-white">
                            {formatRupiah(sc.totalAmount)}
                          </div>

                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {sc.description}
                          </p>

                          {isExact ? (
                            <div className="mt-3 flex items-center space-x-1 text-[11px] font-bold text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Sesuai 100% dengan target</span>
                            </div>
                          ) : (
                            <div className="mt-3 flex items-center space-x-1 text-[11px] font-bold text-amber-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Selisih: {formatRupiah(sc.difference)}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Scenario Invoice Table */}
                  {matchResult.scenarios[selectedScenarioIdx] && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
                      <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              Rincian Faktur: Skenario #{selectedScenarioIdx + 1} ({matchResult.scenarios[selectedScenarioIdx].description})
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Total {matchResult.scenarios[selectedScenarioIdx].invoiceCount} faktur • Akumulasi Tagihan:{" "}
                            <span className="font-mono font-bold text-white">
                              {formatRupiah(matchResult.scenarios[selectedScenarioIdx].totalAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] text-zinc-400">
                            Target: <span className="font-mono font-bold text-white">{formatRupiah(matchResult.query.amount)}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              matchResult.scenarios[selectedScenarioIdx].difference === 0
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : "bg-amber-950 text-amber-300 border-amber-800"
                            }`}
                          >
                            Selisih: {formatRupiah(matchResult.scenarios[selectedScenarioIdx].difference)}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                            <tr>
                              <th className="py-3 px-4">No. Faktur</th>
                              <th className="py-3 px-3">Tanggal</th>
                              <th className="py-3 px-4">Pelanggan</th>
                              <th className="py-3 px-4">Armada / Keterangan</th>
                              <th className="py-3 px-4 text-right">Total Tagihan</th>
                              <th className="py-3 px-4 text-right">Sisa Piutang</th>
                              <th className="py-3 px-4 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60 font-medium">
                            {matchResult.scenarios[selectedScenarioIdx].invoices.map(
                              (inv: any, iIdx: number) => (
                                <tr key={iIdx} className="hover:bg-zinc-800/40 text-zinc-300">
                                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                                    {inv.notransaksi}
                                  </td>
                                  <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                                    {formatDate(inv.tanggal)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-white">
                                      {inv.namapelanggan || "KONSUMEN UMUM"}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                      {inv.kodesupel || "-"}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-zinc-300">
                                    {inv.keterangan || "-"}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono text-zinc-300">
                                    {formatRupiah(inv.totalakhir)}
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                                    {formatRupiah(inv.sisapiutang)}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex items-center justify-center space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setViewingInvoice(inv.notransaksi)}
                                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md text-[11px] font-bold transition-all flex items-center space-x-1"
                                        title="Buka rincian faktur"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Detail</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openPayModal(inv)}
                                        className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 rounded-md text-[11px] font-bold transition-all"
                                        title="Catat pelunasan faktur ini"
                                      >
                                        Pelunasan
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                          <tfoot className="bg-zinc-950/80 font-bold border-t border-zinc-800">
                            <tr>
                              <td colSpan={4} className="py-3 px-4 text-right text-zinc-400">
                                Total Akumulasi {matchResult.scenarios[selectedScenarioIdx].invoiceCount} Faktur:
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-white">
                                {formatRupiah(
                                  matchResult.scenarios[selectedScenarioIdx].invoices.reduce(
                                    (sum: number, it: any) => sum + (Number(it.totalakhir) || 0),
                                    0
                                  )
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                                {formatRupiah(matchResult.scenarios[selectedScenarioIdx].totalAmount)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Cashier Guidance Alert */}
                      <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex items-start space-x-3 text-xs text-zinc-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-zinc-200">Panduan Finance / Kasir:</span>{" "}
                          Faktur-faktur di atas memiliki total tagihan tepat sebesar{" "}
                          <span className="font-mono font-bold text-emerald-400">
                            {formatRupiah(matchResult.scenarios[selectedScenarioIdx].totalAmount)}
                          </span>
                          . Anda dapat mengklik tombol <span className="text-emerald-300 font-bold">"Pelunasan"</span> pada masing-masing faktur atau mencatat pembayaran via menu Kas/Bank.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Monthly Overview Section */}
              {matchResult.monthlyOverview && matchResult.monthlyOverview.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
                    <span className="font-bold text-white flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span>Rekapitulasi Tagihan Bulanan Pelanggan Terkait</span>
                    </span>
                    <span className="text-zinc-500">
                      Membantu mendeteksi pembayaran tagihan bulanan utuh
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                        <tr>
                          <th className="py-3 px-4">Bulan Tagihan</th>
                          <th className="py-3 px-4">Pelanggan</th>
                          <th className="py-3 px-4 text-center">Jumlah Faktur</th>
                          <th className="py-3 px-4 text-right">Total Piutang Bulan</th>
                          <th className="py-3 px-4 text-right">Selisih vs Target</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-medium font-mono">
                        {matchResult.monthlyOverview.map((mo: any, mIdx: number) => {
                          const isMatch = mo.differenceWithTarget === 0;
                          return (
                            <tr key={mIdx} className="hover:bg-zinc-800/40 text-zinc-300">
                              <td className="py-3 px-4 font-bold text-white">
                                {mo.month}
                              </td>
                              <td className="py-3 px-4 font-sans">
                                <span className="font-bold text-white">{mo.customer}</span>
                              </td>
                              <td className="py-3 px-4 text-center font-sans text-zinc-400">
                                {mo.invoiceCount} Faktur
                              </td>
                              <td className="py-3 px-4 text-right text-white font-bold">
                                {formatRupiah(mo.totalAmount)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isMatch ? (
                                  <span className="text-emerald-400 font-bold">Rp 0 (Pas)</span>
                                ) : mo.differenceWithTarget > 0 ? (
                                  <span className="text-amber-400">
                                    + {formatRupiah(mo.differenceWithTarget)}
                                  </span>
                                ) : (
                                  <span className="text-red-400">
                                    - {formatRupiah(Math.abs(mo.differenceWithTarget))}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                {isMatch ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    Cocok 100%
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-[10px]">
                                    Berbeda
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
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
