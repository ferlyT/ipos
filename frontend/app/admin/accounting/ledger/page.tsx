"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  BookOpen,
  Calendar,
  Search,
  RefreshCw,
  Download,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
} from "lucide-react";

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("1-1110");
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>("2026-12-31");
  const [ledgerData, setLedgerData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load Accounts
  useEffect(() => {
    api.cashBank.getAccounts().then((accs) => {
      const uniqueAccs = Array.from(
        new Map((accs || []).map((a: any) => [a.kodeacc, a])).values()
      );
      setAccounts(uniqueAccs);
    }).catch(console.error);
  }, []);

  const loadLedger = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetAccount: string = selectedAccount,
    targetStart: string = startDate,
    targetEnd: string = endDate
  ) => {
    if (!targetAccount) return;
    setLoading(true);
    try {
      const data = await api.accounting.getLedger(
        targetAccount,
        targetStart,
        targetEnd,
        targetLimit,
        targetPage
      );
      setLedgerData(data || null);
      if (data?.pagination) {
        setPage(data.pagination.page);
      }
    } catch (err) {
      console.error("Gagal memuat buku besar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadLedger(1, pageSize, selectedAccount, startDate, endDate);
  }, [selectedAccount, startDate, endDate]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLedger(newPage, pageSize, selectedAccount, startDate, endDate);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadLedger(1, newSize, selectedAccount, startDate, endDate);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportCSV = () => {
    if (!ledgerData || !ledgerData.mutasi) return;

    const headers = ["Tanggal", "No. Transaksi", "Keterangan", "Debet", "Kredit", "Saldo Berjalan"];
    const rows = ledgerData.mutasi.map((m: any) => [
      `"${m.tanggal}"`,
      `"${m.notransaksi}"`,
      `"${(m.keterangan || "").replace(/"/g, '""')}"`,
      m.debet || 0,
      m.kredit || 0,
      m.saldo || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `BukuBesar_${selectedAccount}_${startDate}_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalDebet =
    ledgerData?.mutasi?.reduce((sum: number, m: any) => sum + (Number(m.debet) || 0), 0) || 0;
  const totalKredit =
    ledgerData?.mutasi?.reduce((sum: number, m: any) => sum + (Number(m.kredit) || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span>Kartu Buku Besar Umum (General Ledger)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Audit rincian mutasi transaksi debet/kredit dan saldo berjalan untuk setiap akun perkiraan.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportCSV}
            disabled={!ledgerData || !ledgerData.mutasi || ledgerData.mutasi.length === 0}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => loadLedger()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-lg shadow-emerald-950/60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
        {/* Account Selector */}
        <div className="flex items-center space-x-3 w-full md:w-auto flex-1">
          <div className="text-xs font-bold text-zinc-400 shrink-0 flex items-center space-x-1.5">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Akun Perkiraan:</span>
          </div>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
          >
            {accounts.length > 0 ? (
              accounts.map((acc) => (
                <option key={acc.kodeacc} value={acc.kodeacc}>
                  {acc.kodeacc} - {acc.namaacc} ({formatRupiah(acc.saldoAkhir || acc.saldo)})
                </option>
              ))
            ) : (
              <>
                <option value="1-1110">1-1110 - KAS KECIL</option>
                <option value="1-1120">1-1120 - BANK BCA</option>
                <option value="1-1121">1-1121 - BANK MANDIRI</option>
                <option value="1-1210">1-1210 - PIUTANG PENJUALAN</option>
                <option value="1-1301">1-1301 - PERSEDIAAN BARANG</option>
                <option value="2-1101">2-1101 - HUTANG DAGANG</option>
                <option value="4-1100">4-1100 - PENDAPATAN JUAL</option>
                <option value="5-1100">5-1100 - HARGA POKOK PENJUALAN</option>
              </>
            )}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center space-x-2 text-xs w-full md:w-auto">
          <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-300 font-mono focus:outline-none focus:border-emerald-500"
          />
          <span className="text-zinc-500">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-300 font-mono focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Saldo Awal
          </div>
          <div className="text-xl font-black text-zinc-300 font-mono mt-0.5">
            {formatRupiah(ledgerData?.saldoAwal || 0)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Per {startDate}</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Total Debet</span>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
            {formatRupiah(totalDebet)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Mutasi Masuk</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Total Kredit</span>
          </div>
          <div className="text-xl font-black text-red-400 font-mono mt-0.5">
            {formatRupiah(totalKredit)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Mutasi Keluar</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Saldo Akhir
          </div>
          <div className="text-xl font-black text-white font-mono mt-0.5">
            {formatRupiah(ledgerData?.saldoAkhir || 0)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Per {endDate}</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        {loading && ledgerData?.mutasi && ledgerData.mutasi.length > 0 && (
          <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memuat buku besar...</span>
            </div>
          </div>
        )}
        <div className="p-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center text-xs">
          <span className="font-bold text-white flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>
              Mutasi Akun: {ledgerData?.akun?.kodeacc || selectedAccount} - {ledgerData?.akun?.namaacc || ""}
            </span>
          </span>
          <span className="text-zinc-400 font-mono">
            Tipe Saldo Normal: {ledgerData?.akun?.tipe === "D" ? "DEBET" : "KREDIT"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-3">Jenis</th>
                <th className="py-3 px-5">Keterangan</th>
                <th className="py-3 px-4 text-right">Debet</th>
                <th className="py-3 px-4 text-right">Kredit</th>
                <th className="py-3 px-4 text-right">Saldo Berjalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat rincian buku besar...
                  </td>
                </tr>
              ) : !ledgerData?.mutasi || ledgerData.mutasi.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Tidak ada mutasi jurnal untuk akun ini pada periode yang dipilih.
                  </td>
                </tr>
              ) : (
                ledgerData.mutasi.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-800/40 text-zinc-300">
                    <td className="py-3 px-4 font-mono text-zinc-400">
                      {formatDate(m.tanggal)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {m.notransaksi}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono">
                        {m.jenis || "Jurnal"}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-zinc-200">
                      {m.keterangan || "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {Number(m.debet) > 0 ? formatRupiah(m.debet) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                      {Number(m.kredit) > 0 ? formatRupiah(m.kredit) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatRupiah(m.saldo)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Component */}
      {ledgerData?.pagination && (
        <Pagination
          currentPage={page}
          totalPages={ledgerData.pagination.totalPages}
          pageSize={pageSize}
          totalItems={ledgerData.pagination.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          disabled={loading}
          className="mt-4"
        />
      )}
    </div>
  );
}
