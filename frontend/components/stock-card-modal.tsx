"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate } from "@/lib/utils";
import {
  X,
  History,
  Printer,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  MapPin,
  Tag,
  DollarSign,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface StockCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  kodeitem: string | null;
  startDate: string;
  endDate: string;
  office?: string;
  showFinancial?: boolean;
}

export function StockCardModal({
  isOpen,
  onClose,
  kodeitem,
  startDate,
  endDate,
  office = "UTM",
  showFinancial = true,
}: StockCardModalProps) {
  const [currentStart, setCurrentStart] = useState<string>(startDate);
  const [currentEnd, setCurrentEnd] = useState<string>(endDate);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStart(startDate);
    setCurrentEnd(endDate);
  }, [startDate, endDate]);

  const loadStockCard = (start: string, end: string) => {
    if (!isOpen || !kodeitem) return;

    setLoading(true);
    setError(null);

    api.inventory
      .getItemStockCard({
        kodeitem,
        startDate: start,
        endDate: end,
        office,
      })
      .then((res) => {
        setData(res);
      })
      .catch((err: any) => {
        console.error("Gagal memuat kartu stok:", err);
        setError(err.message || "Gagal memuat riwayat kartu stok item.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen || !kodeitem) {
      setData(null);
      setError(null);
      return;
    }
    loadStockCard(currentStart, currentEnd);
  }, [isOpen, kodeitem, currentStart, currentEnd, office]);

  const handlePrevMonth = () => {
    const d = new Date(currentStart);
    const prevM = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const lastDay = new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0).getDate();
    const y = prevM.getFullYear();
    const mStr = String(prevM.getMonth() + 1).padStart(2, "0");
    const s = `${y}-${mStr}-01`;
    const e = `${y}-${mStr}-${String(lastDay).padStart(2, "0")}`;
    setCurrentStart(s);
    setCurrentEnd(e);
  };

  const handleNextMonth = () => {
    const d = new Date(currentStart);
    const nextM = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const lastDay = new Date(nextM.getFullYear(), nextM.getMonth() + 1, 0).getDate();
    const y = nextM.getFullYear();
    const mStr = String(nextM.getMonth() + 1).padStart(2, "0");
    const s = `${y}-${mStr}-01`;
    const e = `${y}-${mStr}-${String(lastDay).padStart(2, "0")}`;
    setCurrentStart(s);
    setCurrentEnd(e);
  };

  if (!isOpen || !kodeitem) return null;

  const handleExportCSV = () => {
    if (!data || !data.transactions || data.transactions.length === 0) return;

    const headers = [
      "Tanggal",
      "No. Transaksi",
      "Tipe",
      "Pihak / Rekanan",
      "Keterangan",
      "Masuk",
      "Keluar",
      "Saldo Akhir",
      ...(showFinancial ? ["Harga Satuan", "Total Transaksi", "Nilai Saldo"] : []),
    ];

    const rows = data.transactions.map((t: any) => [
      `"${t.tanggal}"`,
      `"${t.notransaksi}"`,
      `"${t.tipeLabel}"`,
      `"${(t.pihak || "").replace(/"/g, '""')}"`,
      `"${(t.keterangan || "").replace(/"/g, '""')}"`,
      t.masuk,
      t.keluar,
      t.saldo,
      ...(showFinancial ? [t.harga, t.totalNilai, t.nilaiSaldo] : []),
    ]);

    // Tambahkan baris Saldo Awal di paling atas
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        `"KARTU STOK: ${data.item.kodeitem} - ${data.item.namaitem}"`,
        `"Periode: ${data.period.startDate} s/d ${data.period.endDate}"`,
        `"Saldo Awal: ${data.saldoAwal} ${data.item.satuan}"`,
        "",
        headers.join(","),
        ...rows.map((r: any) => r.join(",")),
      ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `kartu_stok_${data.item.kodeitem.replace(/[^a-zA-Z0-9]/g, "_")}_${data.period.startDate}_${data.period.endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header Dialog */}
        <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center space-x-2">
                <span>Kartu Stok & Riwayat Mutasi Item</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {kodeitem}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || !data || data.transactions?.length === 0}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Unduh CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !data}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer print:hidden"
              title="Cetak Kartu Stok"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 text-center text-zinc-400 font-medium">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-500" />
              Mengkalkulasi alur kronologis kartu stok...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/80 border border-red-800 rounded-2xl text-red-300 text-xs flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Item Info Card */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Nama Barang
                  </span>
                  <div className="text-white font-bold text-sm mt-0.5 truncate">
                    {data.item.namaitem}
                  </div>
                  <div className="text-zinc-400 text-[11px] font-mono mt-0.5">
                    Satuan: <span className="text-emerald-400 font-bold">{data.item.satuan}</span> • Rak: {data.item.rak}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Periode Laporan
                  </span>
                  <div className="text-zinc-200 font-bold text-xs mt-0.5 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-xs">{formatDate(data.period.startDate)} - {formatDate(data.period.endDate)}</span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-0.5">
                    Gudang: <span className="font-bold text-white">{data.period.office}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Harga Pokok (HPP)
                  </span>
                  <div className="text-emerald-400 font-mono font-black text-sm mt-0.5">
                    {formatRupiah(data.item.hargapokok)}
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-0.5">
                    Per {data.item.satuan}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Stok Fisik Saat Ini
                  </span>
                  <div className="text-white font-mono font-black text-sm mt-0.5">
                    {formatNumber(data.item.stokSaatIni)} {data.item.satuan}
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-0.5">
                    Di Gudang {data.period.office}
                  </div>
                </div>
              </div>

              {/* KPI Badges Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-zinc-850 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Saldo Awal
                  </div>
                  <div className="font-mono text-base font-black text-white mt-0.5">
                    {formatNumber(data.saldoAwal)} <span className="text-xs text-zinc-400 font-normal">{data.item.satuan}</span>
                  </div>
                  {showFinancial && (
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {formatRupiah(data.nilaiAwal)}
                    </div>
                  )}
                </div>

                <div className="bg-zinc-850 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Total Masuk (+)</span>
                  </div>
                  <div className="font-mono text-base font-black text-emerald-400 mt-0.5">
                    +{formatNumber(data.totalMasuk)} <span className="text-xs text-zinc-400 font-normal">{data.item.satuan}</span>
                  </div>
                  {showFinancial && (
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {formatRupiah(data.totalMasuk * data.item.hargapokok)}
                    </div>
                  )}
                </div>

                <div className="bg-zinc-850 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center space-x-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Total Keluar (-)</span>
                  </div>
                  <div className="font-mono text-base font-black text-red-400 mt-0.5">
                    -{formatNumber(data.totalKeluar)} <span className="text-xs text-zinc-400 font-normal">{data.item.satuan}</span>
                  </div>
                  {showFinancial && (
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {formatRupiah(data.totalKeluar * data.item.hargapokok)}
                    </div>
                  )}
                </div>

                <div className="bg-zinc-850 border border-zinc-800 rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                    Saldo Akhir
                  </div>
                  <div className="font-mono text-base font-black text-blue-400 mt-0.5">
                    {formatNumber(data.saldoAkhir)} <span className="text-xs text-zinc-400 font-normal">{data.item.satuan}</span>
                  </div>
                  {showFinancial && (
                    <div className="text-[11px] font-mono text-blue-300 font-bold mt-0.5">
                      {formatRupiah(data.nilaiAkhir)}
                    </div>
                  )}
                </div>
              </div>

              {/* Ledger Table */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
                      <tr>
                        <th className="py-3 px-3.5">Tanggal</th>
                        <th className="py-3 px-3">No. Transaksi</th>
                        <th className="py-3 px-2.5">Tipe</th>
                        <th className="py-3 px-3.5">Rekanan / Pelanggan / Keterangan</th>
                        <th className="py-3 px-3 text-right text-emerald-400">Masuk (+)</th>
                        <th className="py-3 px-3 text-right text-red-400">Keluar (-)</th>
                        <th className="py-3 px-3 text-right text-white">Saldo Akhir</th>
                        {showFinancial && (
                          <>
                            <th className="py-3 px-3 text-right">Harga (Rp)</th>
                            <th className="py-3 px-3.5 text-right">Nilai Saldo (Rp)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium">
                      {/* Baris Pembuka: Saldo Awal */}
                      <tr className="bg-zinc-900/60 font-bold text-zinc-300">
                        <td className="py-2.5 px-3.5 font-mono text-zinc-400">
                          {formatDate(data.period.startDate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-400">
                          -
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                            SALDO AWAL
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-400 italic">
                          Saldo awal periode per tanggal {data.period.startDate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-500">-</td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-500">-</td>
                        <td className="py-2.5 px-3 text-right font-mono text-white text-sm">
                          {formatNumber(data.saldoAwal)}
                        </td>
                        {showFinancial && (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                              {formatRupiah(data.item.hargapokok)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono text-zinc-300">
                              {formatRupiah(data.nilaiAwal)}
                            </td>
                          </>
                        )}
                      </tr>

                      {/* Baris Transaksi Kronologis */}
                      {data.transactions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={showFinancial ? 9 : 7}
                            className="py-8 text-center text-zinc-500"
                          >
                            Tidak ada transaksi mutasi item pada rentang periode ini.
                          </td>
                        </tr>
                      ) : (
                        data.transactions.map((tx: any, idx: number) => {
                          const isIn = tx.arah === "IN";
                          return (
                            <tr key={idx} className="hover:bg-zinc-850/50 text-zinc-300">
                              <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-zinc-400">
                                {tx.tanggal}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                                {tx.notransaksi}
                              </td>
                              <td className="py-2.5 px-2.5 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    isIn
                                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                      : "bg-red-950 text-red-300 border-red-800"
                                  }`}
                                >
                                  {tx.tipeLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 max-w-xs truncate">
                                <div className="font-bold text-zinc-200 truncate">
                                  {tx.pihak !== "-" ? tx.pihak : tx.keterangan}
                                </div>
                                {tx.pihak !== "-" && tx.keterangan !== "-" && (
                                  <div className="text-[10px] text-zinc-500 truncate">
                                    {tx.keterangan}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                                {tx.masuk > 0 ? `+${formatNumber(tx.masuk)}` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-red-400">
                                {tx.keluar > 0 ? `-${formatNumber(tx.keluar)}` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-sm">
                                {formatNumber(tx.saldo)}
                              </td>
                              {showFinancial && (
                                <>
                                  <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                                    {formatRupiah(tx.harga)}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono text-zinc-300">
                                    {formatRupiah(tx.nilaiSaldo)}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-zinc-900 font-bold border-t border-zinc-800">
                      <tr>
                        <td colSpan={4} className="py-3 px-3.5 text-right text-zinc-400">
                          Total Pergerakan Periode Ini:
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                          +{formatNumber(data.totalMasuk)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-red-400 text-sm">
                          -{formatNumber(data.totalKeluar)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-blue-400 text-sm">
                          {formatNumber(data.saldoAkhir)}
                        </td>
                        {showFinancial && (
                          <>
                            <td></td>
                            <td className="py-3 px-3.5 text-right font-mono text-blue-300 text-sm">
                              {formatRupiah(data.nilaiAkhir)}
                            </td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-850 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-400 shrink-0">
          <span>
            {data ? `Menampilkan ${data.transactions?.length || 0} riwayat pergerakan stok.` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
