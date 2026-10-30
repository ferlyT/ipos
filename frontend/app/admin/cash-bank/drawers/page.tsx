"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  WalletCards,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Monitor,
  DollarSign,
  X,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export default function CashDrawersPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Modal Open Drawer State
  const [isOpenModalActive, setIsOpenModalActive] = useState<boolean>(false);
  const [openUser, setOpenUser] = useState<string>("ADMIN");
  const [openShift, setOpenShift] = useState<string>("1");
  const [openComputer, setOpenComputer] = useState<string>("POS-KASIR-01");
  const [openModalAwal, setOpenModalAwal] = useState<number>(200000);
  const [isOpening, setIsOpening] = useState<boolean>(false);

  // Modal Close Drawer State
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<any | null>(null);
  const [closeUangFisik, setCloseUangFisik] = useState<number>(0);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadShifts = async (targetPage: number = page, targetLimit: number = pageSize) => {
    setLoading(true);
    try {
      const res = await api.cashBank.getDrawers(targetLimit, targetPage);
      const paginated = normalizePaginated<any>(res, targetPage, targetLimit);
      setShifts(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
    } catch (err: any) {
      console.error("Gagal memuat sesi kasir:", err);
      setErrorMsg(err.message || "Gagal memuat sesi kasir.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts(1, pageSize);
  }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadShifts(newPage, pageSize);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadShifts(1, newSize);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOpenDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpening(true);
    setErrorMsg(null);
    try {
      await api.cashBank.openDrawer({
        user: openUser,
        modalAwal: openModalAwal,
        shift: parseInt(openShift) || 1,
        kodekantor: "UTM",
      });
      setIsOpenModalActive(false);
      setToastMsg(`Sesi shift baru kasir ${openUser} berhasil dibuka!`);
      await loadShifts();
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuka sesi shift kasir.");
    } finally {
      setIsOpening(false);
    }
  };

  const handleCloseDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftToClose) return;

    setIsClosing(true);
    setErrorMsg(null);
    try {
      await api.cashBank.closeDrawer({
        idkasir: 0,
        user: selectedShiftToClose.namaUser,
        uangFisik: closeUangFisik,
        keterangan: `Tutup shift ${selectedShiftToClose.notransaksi}`,
      });
      setSelectedShiftToClose(null);
      setToastMsg(`Shift ${selectedShiftToClose.notransaksi} berhasil ditutup dan direkonsiliasi.`);
      await loadShifts();
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menutup sesi shift kasir.");
    } finally {
      setIsClosing(false);
    }
  };

  const activeSessions = shifts.filter((s) => s.statusShift === "OPEN");
  const closedSessions = shifts.filter((s) => s.statusShift === "CLOSED");

  const filteredShifts = shifts.filter(
    (s) =>
      s.notransaksi.toLowerCase().includes(search.toLowerCase()) ||
      s.namaUser.toLowerCase().includes(search.toLowerCase()) ||
      s.namaKomputer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <WalletCards className="w-6 h-6 text-emerald-400" />
            <span>Laporan & Rekonsiliasi Shift Laci Kasir (Cash Drawers)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitoring sesi kasir, penerimaan kas harian, modal awal laci, dan rekonsiliasi selisih kas fisik (over/short).
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setIsOpenModalActive(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buka Shift Baru</span>
          </button>

          <button
            onClick={() => loadShifts()}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sesi Kasir Aktif</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {activeSessions.length} Kasir Sedang Buka
            </div>
            <div className="text-[10px] text-zinc-500 font-medium">Shift Berjalan</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sesi Selesai Direkonsiliasi</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {closedSessions.length} Shift Selesai
            </div>
            <div className="text-[10px] text-zinc-500 font-medium">Riwayat Tercatat</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Modal Kas Awal</div>
            <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
              {formatRupiah(shifts.reduce((s, it) => s + (Number(it.kasAwal) || 0), 0))}
            </div>
            <div className="text-[10px] text-zinc-500 font-medium">Uang Persiapan Kembalian</div>
          </div>
        </div>
      </div>

      {/* Shift Table Filter & Search */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-sm font-bold text-white flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Daftar Sesi Shift Kasir (tbl_kaslaci)</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no sesi, kasir, komputer..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div ref={tableRef} className="relative overflow-x-auto rounded-xl border border-zinc-800">
          {loading && shifts.length > 0 && (
            <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
              <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Memuat sesi shift...</span>
              </div>
            </div>
          )}
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-2.5 px-3">No. Sesi</th>
                <th className="py-2.5 px-3">Kasir & Terminal</th>
                <th className="py-2.5 px-2 text-center">Shift</th>
                <th className="py-2.5 px-3">Waktu Mulai</th>
                <th className="py-2.5 px-3 text-right">Modal Awal</th>
                <th className="py-2.5 px-3 text-right">Kas Akhir Sistem</th>
                <th className="py-2.5 px-3 text-right">Fisik Kasir</th>
                <th className="py-2.5 px-3 text-right">Selisih</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat riwayat sesi kasir...
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    Belum ada sesi shift kasir yang tercatat. Buka shift baru untuk memulai.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((s: any) => {
                  const isOpen = s.statusShift === "OPEN";
                  const selisih = Number(s.selisih || 0);
                  return (
                    <tr key={s.notransaksi} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-2.5 px-3 font-mono font-bold text-white">{s.notransaksi}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white flex items-center space-x-1">
                          <User className="w-3 h-3 text-zinc-500" />
                          <span>{s.namaUser}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center space-x-1 mt-0.5">
                          <Monitor className="w-3 h-3" />
                          <span>{s.namaKomputer}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold font-mono">{s.shift}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                        {formatDateTime(s.wktMulai)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                        {formatRupiah(s.kasAwal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {formatRupiah(s.kasAkhirSistem)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {s.kasFisik !== null ? formatRupiah(s.kasFisik) : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {s.selisih !== null ? (
                          <span className={selisih < 0 ? "text-red-400" : selisih > 0 ? "text-amber-400" : "text-emerald-400"}>
                            {selisih > 0 ? `+${formatRupiah(selisih)}` : formatRupiah(selisih)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOpen
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {isOpen ? "AKTIF" : "DITUTUP"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isOpen ? (
                          <button
                            onClick={() => {
                              setSelectedShiftToClose(s);
                              setCloseUangFisik(s.kasAkhirSistem || 0);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition-all shadow"
                          >
                            Tutup Shift
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-bold">Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
          className="mt-4"
        />
      </div>

      {/* Modal: Buka Shift Kasir Baru */}
      {isOpenModalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Unlock className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Buka Sesi Shift Kasir Baru</h3>
              </div>
              <button onClick={() => setIsOpenModalActive(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOpenDrawer} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Nama Kasir / Operator</label>
                <input
                  type="text"
                  value={openUser}
                  onChange={(e) => setOpenUser(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">Shift Kerja</label>
                  <select
                    value={openShift}
                    onChange={(e) => setOpenShift(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="1">Shift 1 (Pagi)</option>
                    <option value="2">Shift 2 (Siang/Sore)</option>
                    <option value="3">Shift 3 (Malam)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">Terminal Komputer</label>
                  <input
                    type="text"
                    value={openComputer}
                    onChange={(e) => setOpenComputer(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Modal Awal Laci (Rp)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={openModalAwal}
                  onChange={(e) => setOpenModalAwal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400"
                  required
                />
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div>&bull; Modal awal akan disimpan ke laci kasir dan dicatat di database.</div>
                <div>&bull; Kasir dapat memulai transaksi penjualan ritel di menu POS Kasir.</div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpenModalActive(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOpening}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
                >
                  {isOpening ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Buka Shift Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tutup Shift & Rekonsiliasi Kas */}
      {selectedShiftToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Tutup Shift & Rekonsiliasi Kas</h3>
              </div>
              <button onClick={() => setSelectedShiftToClose(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseDrawer} className="p-5 space-y-4">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-400">No. Sesi:</span>
                  <span className="font-mono font-bold text-white">{selectedShiftToClose.notransaksi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Kasir:</span>
                  <span className="font-bold text-white">{selectedShiftToClose.namaUser}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Modal Awal:</span>
                  <span className="font-mono text-zinc-300">{formatRupiah(selectedShiftToClose.kasAwal)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-800">
                  <span className="text-zinc-400">Saldo Akhir di Sistem:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {formatRupiah(selectedShiftToClose.kasAkhirSistem)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Hitungan Uang Fisik di Laci Kasir (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={closeUangFisik}
                  onChange={(e) => setCloseUangFisik(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-black text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Calculated Variance */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex justify-between items-center text-xs">
                <span className="text-zinc-400">Selisih Fisik vs Sistem:</span>
                <span
                  className={`font-mono font-black text-sm ${
                    closeUangFisik - selectedShiftToClose.kasAkhirSistem < 0
                      ? "text-red-400"
                      : closeUangFisik - selectedShiftToClose.kasAkhirSistem > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {closeUangFisik - selectedShiftToClose.kasAkhirSistem > 0
                    ? `+${formatRupiah(closeUangFisik - selectedShiftToClose.kasAkhirSistem)}`
                    : formatRupiah(closeUangFisik - selectedShiftToClose.kasAkhirSistem)}
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedShiftToClose(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isClosing}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow"
                >
                  {isClosing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Konfirmasi Tutup Shift</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
