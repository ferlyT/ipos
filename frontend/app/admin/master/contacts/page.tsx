"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Truck,
  UserCheck,
} from "lucide-react";

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "PL" | "SU">("ALL");
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Modal Tambah Kontak State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newKode, setNewKode] = useState<string>("");
  const [newTipe, setNewTipe] = useState<"PL" | "SU">("PL");
  const [newNama, setNewNama] = useState<string>("");
  const [newAlamat, setNewAlamat] = useState<string>("");
  const [newKota, setNewKota] = useState<string>("");
  const [newTelepon, setNewTelepon] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newLimit, setNewLimit] = useState<number>(0);
  const [newTermin, setNewTermin] = useState<number>(30);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadContacts = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search,
    targetTab: "ALL" | "PL" | "SU" = activeTab
  ) => {
    setLoading(true);
    try {
      const typeParam = targetTab === "ALL" ? undefined : targetTab;
      const res = await api.master.getContacts(typeParam, targetSearch, targetLimit, targetPage);
      const paginated = normalizePaginated<any>(res, targetPage, targetLimit);
      setContacts(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
    } catch (err) {
      console.error("Gagal memuat kontak:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadContacts(1, pageSize, search, activeTab);
  }, [activeTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadContacts(1, pageSize, search, activeTab);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadContacts(newPage, pageSize, search, activeTab);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadContacts(1, newSize, search, activeTab);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openAddModal = () => {
    const defaultPrefix = activeTab === "SU" ? "SU" : "PL";
    setNewTipe(activeTab === "SU" ? "SU" : "PL");
    setNewKode(`${defaultPrefix}${Date.now().toString().slice(-4)}`);
    setNewNama("");
    setNewAlamat("");
    setNewKota("");
    setNewTelepon("");
    setNewEmail("");
    setNewLimit(0);
    setNewTermin(30);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKode || !newNama) {
      setErrorMessage("Kode dan Nama kontak wajib diisi.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.master.createContact({
        kode: newKode,
        tipe: newTipe,
        nama: newNama,
        alamat: newAlamat,
        kota: newKota,
        telepon: newTelepon,
        email: newEmail,
        limitpiutang: newLimit,
        termin: newTermin,
        grup: "General",
      });

      setToastMessage(`Sukses! Kontak ${newNama} (${newKode}) berhasil ditambahkan.`);
      setIsModalOpen(false);
      loadContacts();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan kontak.");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalCustomers = contacts.filter((c) => c.tipe === "PL").length;
  const totalSuppliers = contacts.filter((c) => c.tipe === "SU").length;
  const totalCreditLimit = contacts.reduce(
    (sum, c) => sum + (Number(c.limitpiutang) || 0),
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

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Master Pelanggan & Supplier (Mitra Bisnis)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Direktori 300+ pelanggan retail/grosir (PL) dan vendor supplier logistik (SU) terintegrasi iPos 4.0.
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
              Semua Mitra
            </button>
            <button
              onClick={() => setActiveTab("PL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "PL"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Pelanggan (PL)
            </button>
            <button
              onClick={() => setActiveTab("SU")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "SU"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Supplier (SU)
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Kontak</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800/60">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Pelanggan Terdaftar
            </div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {totalCustomers} Pelanggan
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-950 text-blue-400 rounded-xl border border-blue-800/60">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Vendor Supplier
            </div>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {totalSuppliers} Supplier
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Plafon Kredit / Limit
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {formatRupiah(totalCreditLimit)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode kontak, nama mitra bisnis, kota..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </form>
        <button
          onClick={() => loadContacts()}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table of Contacts */}
      <div ref={tableRef} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
        {loading && contacts.length > 0 && (
          <div className="absolute inset-0 z-10 bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl text-xs text-white shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memuat data kontak...</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-700">
              <tr>
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-3 text-center">Tipe</th>
                <th className="py-3 px-4">Nama Mitra</th>
                <th className="py-3 px-4">Alamat / Kota</th>
                <th className="py-3 px-4">Telepon / Email</th>
                <th className="py-3 px-4 text-right">Plafon Kredit</th>
                <th className="py-3 px-3 text-center">Termin (Hari)</th>
                <th className="py-3 px-3 text-center">Grup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-medium">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Memuat data mitra bisnis...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Tidak ada kontak yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                contacts.map((c: any) => {
                  const isPL = c.tipe === "PL";
                  return (
                    <tr key={c.kode} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        {c.kode}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isPL
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {isPL ? "PELANGGAN" : "SUPPLIER"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{c.nama}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {c.alamat ? (
                          <div className="truncate max-w-xs">{c.alamat}</div>
                        ) : c.kota ? (
                          <div>{c.kota}</div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {c.telepon || c.email ? (
                          <div>
                            {c.telepon && <div>{c.telepon}</div>}
                            {c.email && (
                              <div className="text-[10px] text-zinc-500 truncate max-w-xs">
                                {c.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {Number(c.limitpiutang) > 0 ? (
                          formatRupiah(c.limitpiutang)
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {c.termin > 0 ? `${c.termin} Hari` : "Tunai"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          {c.grup || "General"}
                        </span>
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

      {/* Modal Tambah Kontak Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-850 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <span>Tambah Kontak Mitra Bisnis Baru</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Daftarkan pelanggan atau supplier baru ke database iPos 4.0
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateContact}>
              <div className="p-6 space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Tipe Mitra
                    </label>
                    <select
                      value={newTipe}
                      onChange={(e) => {
                        const val = e.target.value as "PL" | "SU";
                        setNewTipe(val);
                        setNewKode(`${val}${Date.now().toString().slice(-4)}`);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="PL">PELANGGAN (Customer)</option>
                      <option value="SU">SUPPLIER (Vendor)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Kode Kontak
                    </label>
                    <input
                      type="text"
                      value={newKode}
                      onChange={(e) => setNewKode(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Nama Mitra / Perusahaan
                  </label>
                  <input
                    type="text"
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Misal: CV. MAKMUR SEJAHTERA"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Kota</label>
                    <input
                      type="text"
                      value={newKota}
                      onChange={(e) => setNewKota(e.target.value)}
                      placeholder="Jakarta / Surabaya"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      No. Telepon / HP
                    </label>
                    <input
                      type="text"
                      value={newTelepon}
                      onChange={(e) => setNewTelepon(e.target.value)}
                      placeholder="0812xxxxxxxx"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">
                    Alamat Lengkap
                  </label>
                  <input
                    type="text"
                    value={newAlamat}
                    onChange={(e) => setNewAlamat(e.target.value)}
                    placeholder="Jalan, nomor, ruko..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Plafon Kredit / Limit (Rp)
                    </label>
                    <input
                      type="number"
                      value={newLimit}
                      onChange={(e) => setNewLimit(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      Termin Pembayaran (Hari)
                    </label>
                    <input
                      type="number"
                      value={newTermin}
                      onChange={(e) => setNewTermin(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-zinc-850 border-t border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
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
                      <span>Simpan Kontak</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
