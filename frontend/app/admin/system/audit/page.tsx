"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatCurrency, formatDateTime } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import toast from "react-hot-toast";
import {
  ShieldAlert,
  Activity,
  Search,
  RefreshCw,
  Receipt,
  ShoppingCart,
  Coins,
  BookOpen,
  User,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Check,
  X,
  AlertTriangle,
  Monitor,
  Calendar,
  Layers,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  FileCode,
} from "lucide-react";

interface AuditLogItem {
  id: number;
  schema_name: string;
  table_name: string;
  action_type: "UPDATE" | "DELETE" | string;
  modul: string;
  notransaksi: string;
  iddetail?: string | null;
  kodeitem?: string | null;
  kodekantor?: string | null;
  kodesupel?: string | null;
  total_transaksi?: number | string | null;
  user_app: string;
  user_db?: string;
  ip_client?: string | null;
  perubahan_kolom?: string | null;
  matauang?: string | null;
  created_at: string;
}

interface AuditDetailItem extends AuditLogItem {
  data_lama?: string | null;
  data_baru?: string | null;
  data_lama_parsed?: any;
  data_baru_parsed?: any;
}

/* ------------------------------------------------------------- */
/* DIFF BADGE PARSER & COMPONENT (LAMA -> BARU)                  */
/* ------------------------------------------------------------- */
interface DiffChange {
  field?: string;
  oldVal: string;
  newVal?: string;
}

const FINANCIAL_FIELDS = new Set([
  "subtotal",
  "totalakhir",
  "total",
  "kredit",
  "debet",
  "harga",
  "potnomfaktur",
  "pajak",
  "biayalain",
  "totalbayar",
  "jmltunai",
  "jmlkredit",
  "krd_jml_byr",
  "jumlah_uang",
]);

function formatDiffValue(val: string, field?: string, currency: string = "IDR"): string {
  const trimmed = val.trim();
  if (!trimmed) return "-";
  if (field && FINANCIAL_FIELDS.has(field.toLowerCase())) {
    const num = Number(trimmed);
    if (!isNaN(num)) {
      return formatCurrency(num, currency);
    }
  }
  return trimmed;
}

function parseDiffChanges(rawText?: string | null): DiffChange[] {
  if (!rawText) return [];
  const text = rawText.trim();
  if (!text) return [];

  // Split by semicolon (;)
  const parts = text.split(";").map((p) => p.trim()).filter(Boolean);
  const changes: DiffChange[] = [];

  for (const part of parts) {
    if (part.includes("->")) {
      const arrowIndex = part.indexOf("->");
      const leftPart = part.substring(0, arrowIndex).trim();
      const rightPart = part.substring(arrowIndex + 2).trim();

      let field: string | undefined;
      let oldVal = leftPart;

      const colonIndex = leftPart.indexOf(":");
      if (colonIndex > 0 && colonIndex < 25) {
        const potentialField = leftPart.substring(0, colonIndex).trim();
        if (/^[a-zA-Z0-9_ ]+$/.test(potentialField)) {
          field = potentialField;
          oldVal = leftPart.substring(colonIndex + 1).trim();
        }
      }

      changes.push({
        field,
        oldVal,
        newVal: rightPart,
      });
    } else {
      changes.push({
        oldVal: part,
      });
    }
  }

  return changes.length > 0 ? changes : [{ oldVal: text }];
}

function AuditDiffBadge({
  rawDiff,
  actionType,
  currency = "IDR",
  inModal = false,
}: {
  rawDiff?: string | null;
  actionType?: string;
  currency?: string | null;
  inModal?: boolean;
}) {
  if (!rawDiff) {
    return <span className="text-zinc-500 font-mono text-xs">-</span>;
  }

  const curr = currency || "IDR";
  const isDelete = actionType === "DELETE";
  const changes = parseDiffChanges(rawDiff);

  if (isDelete) {
    return (
      <div className="space-y-1">
        {changes.map((ch, idx) => (
          <div
            key={idx}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg audit-diff-old text-xs font-mono max-w-full"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0 not-italic no-underline" />
            <span className="font-bold no-underline uppercase text-[9px] bg-rose-200/80 dark:bg-rose-900/80 px-1.5 py-0.5 rounded text-rose-800 dark:text-rose-200 shrink-0">
              DIHAPUS
            </span>
            <span className="truncate">{ch.oldVal}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${inModal ? "" : "max-w-md"}`}>
      {changes.map((item, idx) => {
        const oldFormatted = formatDiffValue(item.oldVal, item.field, curr);
        const newFormatted = item.newVal !== undefined ? formatDiffValue(item.newVal, item.field, curr) : undefined;

        if (newFormatted === undefined) {
          return (
            <div key={idx} className="flex items-center space-x-1.5 text-xs font-mono">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                {item.oldVal}
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            {item.field && (
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 font-sans uppercase shrink-0">
                {item.field}:
              </span>
            )}
            {/* Nilai Lama (Coret Merah/Pink) */}
            <span
              className="audit-diff-old inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono max-w-[280px] sm:max-w-md truncate"
              title={`Sebelum: ${item.oldVal}`}
            >
              {oldFormatted}
            </span>

            {/* Panah Transisi */}
            <span className="text-zinc-400 dark:text-zinc-500 font-bold text-xs shrink-0">&rarr;</span>

            {/* Nilai Baru (Hijau) */}
            <span
              className="audit-diff-new inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono max-w-[280px] sm:max-w-md truncate"
              title={`Sesudah: ${item.newVal}`}
            >
              {newFormatted}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Summary statistics state
  const [summaryStats, setSummaryStats] = useState<{
    totalDeletions: number;
    totalUpdates: number;
    totalRecords: number;
    salesCount: number;
    purchaseCount: number;
    cashBankCount: number;
    accountingCount: number;
  }>({
    totalDeletions: 0,
    totalUpdates: 0,
    totalRecords: 0,
    salesCount: 0,
    purchaseCount: 0,
    cashBankCount: 0,
    accountingCount: 0,
  });

  // Modal Detail State
  const [selectedDetail, setSelectedDetail] = useState<AuditDetailItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"VISUAL" | "RAW">("VISUAL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Helper untuk mendapatkan objek data snapshot
  const parseSnapshot = (raw: any) => {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const getDocTypeLabel = (table: string, modul: string) => {
    switch (table) {
      case "tbl_ikhd":
        return "FAKTUR PENJUALAN KASIR";
      case "tbl_ikdt":
        return "RINCIAN ITEM PENJUALAN";
      case "tbl_imhd":
        return "FAKTUR PEMBELIAN BARANG";
      case "tbl_imdt":
        return "RINCIAN ITEM PEMBELIAN";
      case "tbl_acckashd":
        return "BUKTI KAS & BANK";
      case "tbl_acckasdt":
        return "RINCIAN ITEM BUKTI KAS";
      case "tbl_accjurnal":
        return "LEMBAR JURNAL UMUM";
      case "tbl_byrhutanghd":
        return "BUKTI PELUNASAN HUTANG";
      case "tbl_byrpiutanghd":
        return "BUKTI PENERIMAAN PIUTANG";
      case "tbl_accdeposithd":
        return "BUKTI DEPOSIT TITIPAN";
      default:
        return `DOKUMEN ${modul}`;
    }
  };

  // 1. Load Summary Metrics
  const loadSummary = async () => {
    try {
      const res = await api.audit.getSummary();
      const stats = res?.summary || [];
      let dels = 0;
      let upds = 0;
      let sales = 0;
      let purch = 0;
      let cash = 0;
      let acc = 0;

      for (const row of stats) {
        const count = Number(row.total || 0);
        if (row.action_type === "DELETE") dels += count;
        if (row.action_type === "UPDATE") upds += count;

        if (row.modul === "PENJUALAN") sales += count;
        if (row.modul === "PEMBELIAN") purch += count;
        if (row.modul === "KAS_BANK") cash += count;
        if (row.modul === "AKUNTANSI" || row.modul === "HUTANG" || row.modul === "PIUTANG") acc += count;
      }

      setSummaryStats({
        totalDeletions: dels,
        totalUpdates: upds,
        totalRecords: dels + upds,
        salesCount: sales,
        purchaseCount: purch,
        cashBankCount: cash,
        accountingCount: acc,
      });
    } catch (err) {
      console.warn("Gagal memuat ringkasan audit:", err);
    }
  };

  // 2. Load Paginated Logs
  const loadAuditLogs = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search,
    targetModule: string = selectedModule,
    targetAction: string = selectedAction
  ) => {
    setLoading(true);
    try {
      const res = await api.audit.getLogs({
        modul: targetModule !== "ALL" ? targetModule : undefined,
        action: targetAction !== "ALL" ? targetAction : undefined,
        search: targetSearch || undefined,
        limit: targetLimit,
        page: targetPage,
      });

      const paginated = normalizePaginated<AuditLogItem>(res, targetPage, targetLimit);
      setLogs(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
    } catch (err) {
      console.error("Gagal memuat log audit:", err);
      toast.error("Gagal mengambil data log audit dari database.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Open Detail Forensic Modal
  const handleOpenDetail = async (id: number) => {
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const res = await api.audit.getDetail(id);
      setSelectedDetail(res);
    } catch (err) {
      console.error("Gagal mengambil detail log:", err);
      toast.error("Gagal membuka snapshot data log forensik.");
    } finally {
      setDetailLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("JSON disalin ke clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    setPage(1);
    loadAuditLogs(1, pageSize, search, selectedModule, selectedAction);
  }, [selectedModule, selectedAction]);

  // Auto-refresh interval (every 10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAuditLogs(page, pageSize, search, selectedModule, selectedAction);
      loadSummary();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedModule, selectedAction, search, page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAuditLogs(1, pageSize, search, selectedModule, selectedAction);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadAuditLogs(newPage, pageSize, search, selectedModule, selectedAction);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadAuditLogs(1, newSize, search, selectedModule, selectedAction);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case "PENJUALAN":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center space-x-1.5 w-fit">
            <Receipt className="w-3 h-3 text-emerald-400" />
            <span>PENJUALAN</span>
          </span>
        );
      case "PEMBELIAN":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-950 text-blue-400 border border-blue-800/80 flex items-center space-x-1.5 w-fit">
            <ShoppingCart className="w-3 h-3 text-blue-400" />
            <span>PEMBELIAN</span>
          </span>
        );
      case "KAS_BANK":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-950 text-amber-400 border border-amber-800/80 flex items-center space-x-1.5 w-fit">
            <Coins className="w-3 h-3 text-amber-400" />
            <span>KAS & BANK</span>
          </span>
        );
      case "AKUNTANSI":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-950 text-purple-400 border border-purple-800/80 flex items-center space-x-1.5 w-fit">
            <BookOpen className="w-3 h-3 text-purple-400" />
            <span>JURNAL AKUN</span>
          </span>
        );
      case "HUTANG":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-950 text-rose-400 border border-rose-800/80 flex items-center space-x-1.5 w-fit">
            <ArrowDownLeft className="w-3 h-3 text-rose-400" />
            <span>BAYAR HUTANG</span>
          </span>
        );
      case "PIUTANG":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center space-x-1.5 w-fit">
            <ArrowUpRight className="w-3 h-3 text-cyan-400" />
            <span>BAYAR PIUTANG</span>
          </span>
        );
      case "DEPOSIT":
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-950 text-indigo-400 border border-indigo-800/80 flex items-center space-x-1.5 w-fit">
            <HandCoins className="w-3 h-3 text-indigo-400" />
            <span>DEPOSIT</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 w-fit">
            {mod}
          </span>
        );
    }
  };

  const getActionBadge = (action: string) => {
    if (action === "DELETE") {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-950/90 text-rose-300 border border-rose-700/80 flex items-center space-x-1 shadow-sm shadow-rose-950/50 w-fit">
          <Trash2 className="w-3 h-3 text-rose-400" />
          <span>HAPUS</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-950/80 text-amber-300 border border-amber-700/80 flex items-center space-x-1 shadow-sm shadow-amber-950/50 w-fit">
        <Edit3 className="w-3 h-3 text-amber-400" />
        <span>KOREKSI</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>Jejak Audit Forensik Transaksi</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">
                  Active Trigger
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pengawasan real-time terhadap setiap operasi penghapusan (DELETE) dan perubahan (UPDATE) data transaksi &amp; akuntansi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <label className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 cursor-pointer hover:border-zinc-700 transition-all">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span>Auto-Refresh (10s)</span>
          </label>

          <button
            onClick={() => {
              loadAuditLogs();
              loadSummary();
              toast.success("Data audit diperbarui");
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Log Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow-md">
          <div className="p-3 bg-zinc-800/80 text-zinc-300 rounded-xl border border-zinc-700">
            <Activity className="w-5 h-5 text-zinc-200" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Rekaman Audit</div>
            <div className="text-2xl font-black text-white font-mono mt-0.5">{totalItems} Log</div>
          </div>
        </div>

        {/* Total Deletions Card */}
        <div className="bg-zinc-900/90 border border-rose-950/60 rounded-2xl p-4 flex items-center space-x-3 shadow-md relative overflow-hidden">
          <div className="p-3 bg-rose-950/80 text-rose-400 rounded-xl border border-rose-800/80">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
              <span>Data Dihapus</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block"></span>
            </div>
            <div className="text-2xl font-black text-rose-400 font-mono mt-0.5">{summaryStats.totalDeletions} Aksi</div>
          </div>
        </div>

        {/* Total Updates Card */}
        <div className="bg-zinc-900/90 border border-amber-950/60 rounded-2xl p-4 flex items-center space-x-3 shadow-md">
          <div className="p-3 bg-amber-950/80 text-amber-400 rounded-xl border border-amber-800/80">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Data Dikoreksi</div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">{summaryStats.totalUpdates} Aksi</div>
          </div>
        </div>

        {/* Modul Akuntansi & Kas Card */}
        <div className="bg-zinc-900/90 border border-purple-950/60 rounded-2xl p-4 flex items-center space-x-3 shadow-md">
          <div className="p-3 bg-purple-950/80 text-purple-400 rounded-xl border border-purple-800/80">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Kas &amp; Akuntansi</div>
            <div className="text-2xl font-black text-purple-300 font-mono mt-0.5">
              {summaryStats.cashBankCount + summaryStats.accountingCount} Aksi
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Module Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {[
              { id: "ALL", label: "Semua Modul" },
              { id: "PENJUALAN", label: "Penjualan (JL)" },
              { id: "PEMBELIAN", label: "Pembelian (BL)" },
              { id: "KAS_BANK", label: "Kas & Bank" },
              { id: "AKUNTANSI", label: "Jurnal Akuntansi" },
              { id: "HUTANG", label: "Bayar Hutang" },
              { id: "PIUTANG", label: "Bayar Piutang" },
              { id: "DEPOSIT", label: "Deposit" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedModule(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedModule === tab.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                    : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action Filter Pills & Search */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                onClick={() => setSelectedAction("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedAction === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedAction("DELETE")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedAction === "DELETE"
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : "text-zinc-400 hover:text-rose-400"
                }`}
              >
                Hapus
              </button>
              <button
                onClick={() => setSelectedAction("UPDATE")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedAction === "UPDATE"
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "text-zinc-400 hover:text-amber-400"
                }`}
              >
                Koreksi
              </button>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari No Bukti, User, Tabel..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </form>
          </div>
        </div>
      </div>

      {/* 4. Main Audit Table */}
      <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {loading && logs.length > 0 && (
          <div className="absolute inset-0 z-10 bg-zinc-950/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-2xl">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memperbarui log audit...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700 tracking-wider">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-3">Aksi</th>
                <th className="py-3 px-3">Modul &amp; Tabel</th>
                <th className="py-3 px-3">No. Transaksi</th>
                <th className="py-3 px-3">Pelaku (User &amp; IP)</th>
                <th className="py-3 px-4">Perubahan Nilai (Lama &rarr; Baru)</th>
                <th className="py-3 px-3 text-right">Nilai Transaksi</th>
                <th className="py-3 px-4 text-center">Snapshot Forensik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-emerald-500" />
                    Menghubungkan ke database audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500">
                    <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="font-bold text-zinc-400">Belum ada catatan aktivitas audit yang sesuai.</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Setiap kali kasir/operator melakukan edit atau hapus transaksi di iPos, rekaman akan otomatis muncul di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-zinc-800/50 transition-colors ${
                      row.action_type === "DELETE" ? "bg-rose-950/10" : ""
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{formatDateTime(row.created_at)}</span>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">{getActionBadge(row.action_type)}</td>

                    {/* Module & Table */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="space-y-1">
                        {getModuleBadge(row.modul)}
                        <div className="font-mono text-[10px] text-zinc-400 flex items-center space-x-1">
                          <Layers className="w-3 h-3 text-zinc-600" />
                          <span>{row.table_name}</span>
                        </div>
                      </div>
                    </td>

                    {/* No Transaksi */}
                    <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                      <span className="bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                        {row.notransaksi}
                      </span>
                    </td>

                    {/* User & IP */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-zinc-200 font-bold flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{row.user_app || "SYSTEM"}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center space-x-1">
                          <Monitor className="w-3 h-3 text-zinc-600" />
                          <span>{row.ip_client || "Local Engine"}</span>
                        </div>
                      </div>
                    </td>

                    {/* Perubahan Nilai (Diff Badge) */}
                    <td className="py-3 px-4 max-w-md">
                      <AuditDiffBadge
                        rawDiff={row.perubahan_kolom}
                        actionType={row.action_type}
                        currency={row.matauang || "IDR"}
                        inModal={false}
                      />
                    </td>

                    {/* Nilai Transaksi */}
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {row.total_transaksi ? (
                        <span className={row.action_type === "DELETE" ? "text-rose-400" : "text-white"}>
                          {formatCurrency(Number(row.total_transaksi), row.matauang || "IDR")}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Detail Button */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetail(row.id)}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 border border-zinc-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Lihat Bukti</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        disabled={loading}
        pageSizeOptions={[25, 50, 100, 200]}
        className="mt-4"
      />

      {/* 6. Modal Forensik Snapshot JSON */}
      {(selectedDetail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-2xl border ${
                    selectedDetail?.action_type === "DELETE"
                      ? "bg-rose-950 text-rose-400 border-rose-800"
                      : "bg-amber-950 text-amber-400 border-amber-800"
                  }`}
                >
                  {selectedDetail?.action_type === "DELETE" ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <Edit3 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center space-x-2">
                    <span>Snapshot Forensik Data</span>
                    {selectedDetail && getActionBadge(selectedDetail.action_type)}
                    <span className="font-mono text-xs text-zinc-400 font-normal">
                      #{selectedDetail?.id}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    No Transaksi:{" "}
                    <span className="text-white font-mono font-bold">
                      {selectedDetail?.notransaksi}
                    </span>{" "}
                    | Tabel: <span className="font-mono text-zinc-300">{selectedDetail?.table_name}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDetail(null)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subheader / Tab Toggle */}
            <div className="px-6 py-2.5 bg-zinc-50 dark:bg-zinc-950/90 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setModalTab("VISUAL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    modalTab === "VISUAL"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/20"
                      : "bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white dark:border-zinc-800"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Dokumen Bukti Visual (Mudah Dipahami)</span>
                </button>
                <button
                  onClick={() => setModalTab("RAW")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    modalTab === "RAW"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/20"
                      : "bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white dark:border-zinc-800"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Kode Database Asli (Raw JSON)</span>
                </button>
              </div>

              <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                {modalTab === "VISUAL" ? "Format tampilan nota arsip audit" : "Struktur payload JSON database"}
              </span>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {detailLoading ? (
                <div className="py-20 text-center text-zinc-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
                  Mengambil rekaman snapshot forensik JSON...
                </div>
              ) : selectedDetail ? (
                <>
                  {/* Summary of modification message with visual diff badge */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-300 dark:border-amber-800/80 shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] text-amber-900 dark:text-amber-300 uppercase font-black tracking-wider">
                        Kronologi Forensik &bull; Perubahan Nilai (Lama &rarr; Baru)
                      </span>
                    </div>
                    <div className="pt-1">
                      <AuditDiffBadge
                        rawDiff={selectedDetail.perubahan_kolom}
                        actionType={selectedDetail.action_type}
                        currency={selectedDetail.matauang || "IDR"}
                        inModal={true}
                      />
                    </div>
                  </div>

                  {modalTab === "VISUAL" ? (
                    /* ------------------------------------------------------------- */
                    /* TAMPILAN 1: DOKUMEN BUKTI NOTA VISUAL (MUDAH DIPAHAMI)        */
                    /* ------------------------------------------------------------- */
                    (() => {
                      const data = selectedDetail.action_type === "DELETE"
                        ? (selectedDetail.data_lama_parsed || parseSnapshot(selectedDetail.data_lama) || {})
                        : (selectedDetail.data_baru_parsed || parseSnapshot(selectedDetail.data_baru) || {});
                      const oldData = selectedDetail.data_lama_parsed || parseSnapshot(selectedDetail.data_lama) || {};

                      const isDelete = selectedDetail.action_type === "DELETE";
                      const docType = getDocTypeLabel(selectedDetail.table_name, selectedDetail.modul);
                      const valuta = data?.matauang || selectedDetail.matauang || "IDR";

                      return (
                        <div className="space-y-4">
                          {/* Lembar Dokumen Fisik / Nota Visual */}
                          <div className="audit-voucher-sheet border-2 border-zinc-300 dark:border-zinc-700/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            {/* Watermark Stempel Merah / Amber */}
                            {isDelete ? (
                              <div className="absolute right-6 top-6 rotate-[-12deg] pointer-events-none border-2 border-rose-500 bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 px-5 py-2 rounded-xl font-black tracking-widest text-xs uppercase shadow-md flex items-center space-x-2">
                                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                <span>TELAH DIHAPUS</span>
                              </div>
                            ) : (
                              <div className="absolute right-6 top-6 rotate-[-12deg] pointer-events-none border-2 border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 px-5 py-2 rounded-xl font-black tracking-widest text-xs uppercase shadow-md flex items-center space-x-2">
                                <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span>DATA DIKOREKSI</span>
                              </div>
                            )}

                            {/* Header Dokumen Nota */}
                            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 mb-5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-base font-black tracking-wider text-zinc-900 dark:text-white uppercase flex items-center space-x-2">
                                    <span>CV. BARUNA ARTHA LESTARI</span>
                                  </h4>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                                    Arsip Bukti Forensik Transaksi &bull; Kantor:{" "}
                                    <span className="font-bold text-zinc-900 dark:text-white">
                                      {data?.kodekantor || selectedDetail.kodekantor || "UTM (Pusat)"}
                                    </span>
                                  </p>
                                </div>
                                <div className="text-left sm:text-right">
                                  <div className="flex items-center sm:justify-end gap-1.5">
                                    <span className="inline-block px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                                      {docType}
                                    </span>
                                    <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                      {valuta}
                                    </span>
                                  </div>
                                  <div className="text-sm font-black font-mono text-zinc-900 dark:text-white mt-1">
                                    {data?.notransaksi || selectedDetail.notransaksi}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Identitas Rekanan & Info Transaksi */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 audit-voucher-card p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-5">
                              <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold">Tanggal Transaksi</div>
                                <div className="text-xs font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
                                  {data?.tanggal ? formatDateTime(data.tanggal) : formatDateTime(selectedDetail.created_at)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold">
                                  {selectedDetail.modul === "PEMBELIAN" ? "Pemasok / Supplier" : "Pelanggan / Rekanan"}
                                </div>
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {data?.kodesupel || selectedDetail.kodesupel || "-"}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold">Metode / Cara Bayar</div>
                                <div className="text-xs font-bold text-zinc-900 dark:text-white mt-0.5">
                                  {data?.carabayar === "TN"
                                    ? "TUNAI / CASH"
                                    : data?.carabayar === "KD"
                                    ? "KREDIT / TEMPO"
                                    : data?.carabayar || data?.tipe || "-"}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold">Kasir / Pembuat Awal</div>
                                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-0.5 flex items-center space-x-1">
                                  <User className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{data?.user1 || "Kasir Toko"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Rincian Spesifik Modul (Barang, Kas, atau Jurnal) */}
                            {/* KASUS A: RINCIAN ITEM / BARANG (Penjualan / Pembelian) */}
                            {(data?.kodeitem || selectedDetail.kodeitem) ? (
                              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden mb-5">
                                <table className="w-full text-xs">
                                  <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 uppercase text-[10px] font-bold">
                                    <tr>
                                      <th className="py-2.5 px-4 text-left">Nama / Kode Barang</th>
                                      <th className="py-2.5 px-3 text-center">Kuantitas</th>
                                      <th className="py-2.5 px-4 text-right">Harga Satuan</th>
                                      <th className="py-2.5 px-4 text-right">Potongan</th>
                                      <th className="py-2.5 px-4 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950/40">
                                    <tr>
                                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                                        {data?.kodeitem || selectedDetail.kodeitem}
                                      </td>
                                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        {data?.jumlah || 1} {data?.satuan || "PCS"}
                                      </td>
                                      <td className="py-3 px-4 text-right font-mono text-zinc-800 dark:text-zinc-300">
                                        {formatCurrency(Number(data?.harga || 0), valuta)}
                                      </td>
                                      <td className="py-3 px-4 text-right font-mono text-zinc-500 dark:text-zinc-400">
                                        {formatCurrency(Number(data?.potongan || 0), valuta)}
                                      </td>
                                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-white">
                                        {formatCurrency(Number(data?.total || selectedDetail.total_transaksi || 0), valuta)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            ) : null}

                            {/* KASUS B: KAS & BANK (Akun Asal, Akun Tujuan, Nilai Kas) */}
                            {(selectedDetail.modul === "KAS_BANK" || data?.kodeacc) && !data?.kodeitem ? (
                              <div className="audit-voucher-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-5 space-y-3">
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">
                                  Alokasi Posisi Rekening Kas &amp; Bank
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Akun Kas Utama</div>
                                    <div className="text-sm font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                      {data?.kodeacc || "-"}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Rekening Kasir / Bank Penampung</div>
                                  </div>
                                  {data?.kodeaccto && (
                                    <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Akun Tujuan / Lawan</div>
                                      <div className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5">
                                        {data?.kodeaccto}
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Pos Biaya / Rekening Transfer</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {/* KASUS C: LEMBAR JURNAL UMUM (Debet / Kredit) */}
                            {selectedDetail.modul === "AKUNTANSI" && data?.posisi && (
                              <div className="audit-voucher-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-5">
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-2">
                                  Rincian Ayat Jurnal Terhapus
                                </div>
                                <div className="grid grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center font-mono">
                                  <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Kode Akun</span>
                                    <span className="font-bold text-zinc-900 dark:text-white text-sm">{data?.kodeacc || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Posisi</span>
                                    <span className={`font-black text-sm px-2 py-0.5 rounded ${
                                      data?.posisi === "D"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                                        : "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                                    }`}>
                                      {data?.posisi === "D" ? "DEBET (D)" : "KREDIT (K)"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Nominal Jurnal</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                                      {formatCurrency(Number(data?.debet || data?.kredit || data?.jumlah || 0), valuta)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Tabel Rincian Nilai Finansial Faktur (Untuk Faktur Header) */}
                            <div className="audit-voucher-card border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
                              {data?.subtotal !== undefined && (
                                <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium">Subtotal Transaksi</span>
                                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                    {formatCurrency(Number(data.subtotal), valuta)}
                                  </span>
                                </div>
                              )}
                              {data?.potnomfaktur ? (
                                <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium">Potongan / Diskon Faktur</span>
                                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                    - {formatCurrency(Number(data.potnomfaktur), valuta)}
                                  </span>
                                </div>
                              ) : null}
                              {data?.pajak ? (
                                <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium">Pajak (PPN)</span>
                                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                    + {formatCurrency(Number(data.pajak), valuta)}
                                  </span>
                                </div>
                              ) : null}
                              {data?.biayalain ? (
                                <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium">Biaya Tambahan / Ongkos</span>
                                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                    + {formatCurrency(Number(data.biayalain), valuta)}
                                  </span>
                                </div>
                              ) : null}

                              {/* Garis Pembatas Total */}
                              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex justify-between items-center">
                                <div>
                                  <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider block">
                                    {isDelete ? "TOTAL UANG / NILAI YANG DIHAPUS" : "TOTAL AKHIR TRANSAKSI"}
                                  </span>
                                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    Nominal yang tercatat pada database sebelum aksi terjadi
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`text-xl font-black font-mono ${
                                      isDelete ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {formatCurrency(
                                      Number(
                                        data?.totalakhir ||
                                        data?.totalbayar ||
                                        data?.total ||
                                        data?.jumlah ||
                                        selectedDetail.total_transaksi ||
                                        0
                                      ),
                                      valuta
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Keterangan / Memo */}
                            {data?.keterangan && (
                              <div className="mt-4 p-3 audit-voucher-card rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 flex items-start space-x-2">
                                <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase text-[10px] shrink-0 mt-0.5">
                                  Catatan Memo:
                                </span>
                                <span>{data.keterangan}</span>
                              </div>
                            )}

                            {/* Footer Informasi Forensik Penghapusan */}
                            <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${isDelete ? "bg-rose-500" : "bg-amber-500"} animate-pulse`}></div>
                                <span>
                                  {isDelete ? "Dihapus / Ditindaklanjuti oleh:" : "Dikoreksi / Diubah oleh:"}{" "}
                                  <strong className="text-zinc-900 dark:text-white font-bold">{selectedDetail.user_app || "SYSTEM"}</strong>
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 font-mono text-zinc-600 dark:text-zinc-400">
                                <span>IP: {selectedDetail.ip_client || "Local Engine"}</span>
                                <span>&bull;</span>
                                <span>{formatDateTime(selectedDetail.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* ------------------------------------------------------------- */
                    /* TAMPILAN 2: RAW JSON ASLI DATABASE                            */
                    /* ------------------------------------------------------------- */
                    selectedDetail.action_type === "DELETE" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-1.5">
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Payload JSON Lengkap Sebelum Dihapus:</span>
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(selectedDetail.data_lama_parsed || selectedDetail.data_lama, null, 2),
                                "old"
                              )
                            }
                            className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 border border-zinc-200 dark:border-zinc-700 transition"
                          >
                            {copiedKey === "old" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "old" ? "Tersalin!" : "Salin JSON"}</span>
                          </button>
                        </div>
                        <pre className="audit-voucher-code border border-rose-200 dark:border-rose-950/80 text-rose-700 dark:text-rose-200/90 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
                          {JSON.stringify(selectedDetail.data_lama_parsed || selectedDetail.data_lama, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Data Sebelum Koreksi (Data Lama):</span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(selectedDetail.data_lama_parsed || selectedDetail.data_lama, null, 2),
                                  "old"
                                )
                              }
                              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 border border-zinc-200 dark:border-zinc-700 transition"
                            >
                              {copiedKey === "old" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>Salin</span>
                            </button>
                          </div>
                          <pre className="audit-voucher-code border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(selectedDetail.data_lama_parsed || selectedDetail.data_lama, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Data Sesudah Koreksi (Data Baru):</span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(selectedDetail.data_baru_parsed || selectedDetail.data_baru, null, 2),
                                  "new"
                                )
                              }
                              className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 border border-zinc-200 dark:border-zinc-700 transition"
                            >
                              {copiedKey === "new" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>Salin</span>
                            </button>
                          </div>
                          <pre className="audit-voucher-code border border-emerald-200 dark:border-emerald-950/80 text-emerald-700 dark:text-emerald-200/90 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(selectedDetail.data_baru_parsed || selectedDetail.data_baru, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex justify-end">
              <button
                onClick={() => setSelectedDetail(null)}
                className="audit-modal-btn-close px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
              >
                <span>Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
