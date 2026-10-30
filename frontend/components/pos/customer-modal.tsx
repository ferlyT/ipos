"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  User,
  UserCheck,
  UserPlus,
  Phone,
  MapPin,
  CreditCard,
  X,
  Check,
  RefreshCw,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import type { CustomerInfo } from "@/stores/pos-cart.store";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerInfo) => void;
  currentCustomerKode?: string;
}

export function CustomerModal({
  isOpen,
  onClose,
  onSelectCustomer,
  currentCustomerKode,
}: CustomerModalProps) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Customer Form State
  const [newKode, setNewKode] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newTelepon, setNewTelepon] = useState("");
  const [newAlamat, setNewAlamat] = useState("");
  const [newGrup, setNewGrup] = useState("General");
  const [customerGroups, setCustomerGroups] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addNamaRef = useRef<HTMLInputElement>(null);

  // Load customer list & customer groups on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setShowAddForm(false);
      setSelectedIndex(0);
      loadCustomers("");
      loadGroups();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showAddForm) {
      const generatedKode = `PL${Date.now().toString().slice(-6)}`;
      setNewKode(generatedKode);
      setNewNama("");
      setNewTelepon("");
      setNewAlamat("");
      setNewGrup(customerGroups[0]?.kodegrup || "General");
      setTimeout(() => addNamaRef.current?.focus(), 50);
    }
  }, [showAddForm, customerGroups]);

  const loadGroups = async () => {
    try {
      const groups = await api.master.getCustomerGroups();
      setCustomerGroups(groups || []);
    } catch {
      setCustomerGroups([]);
    }
  };

  const loadCustomers = async (q: string) => {
    setLoading(true);
    try {
      const data = await api.master.getContacts("PL", q, 50);
      setCustomers(data || []);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Gagal mencari pelanggan:", err);
      toast.error("Gagal memuat daftar pelanggan");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadCustomers(val);
  };

  const selectUmum = () => {
    onSelectCustomer({
      kode: "UMUM",
      nama: "PELANGGAN UMUM",
      grup: "General",
    });
    onClose();
  };

  const handleSelect = async (c: any) => {
    let poin = 0;
    try {
      const loyalty = await api.sales.getLoyalty(c.kode);
      if (loyalty?.points) poin = Number(loyalty.points);
    } catch {
      // ignore
    }

    onSelectCustomer({
      kode: c.kode,
      nama: c.nama,
      grup: c.grup || c.kgrup || "General",
      telepon: c.telepon || "",
      alamat: c.alamat || "",
      poin,
    });
    onClose();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        kode: newKode.trim() || `PL${Date.now().toString().slice(-6)}`,
        tipe: "PL" as const,
        nama: newNama.trim(),
        telepon: newTelepon.trim(),
        alamat: newAlamat.trim(),
        grup: newGrup,
      };

      await api.master.createContact(payload);
      toast.success(`Pelanggan baru '${payload.nama}' berhasil didaftarkan!`);

      // Immediately select new customer
      onSelectCustomer({
        kode: payload.kode,
        nama: payload.nama,
        grup: payload.grup,
        telepon: payload.telepon,
        alamat: payload.alamat,
        poin: 0,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pelanggan baru");
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard navigation & accessibility (WCAG)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAddForm) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAddForm(false);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "F1") {
      e.preventDefault();
      selectUmum();
      return;
    }

    if (e.key === "F4") {
      e.preventDefault();
      setShowAddForm(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(customers.length - 1, prev + 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (customers[selectedIndex]) {
        handleSelect(customers[selectedIndex]);
      }
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-modal-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="customer-modal-title"
                className="text-base font-bold text-white flex items-center gap-2"
              >
                <span>{showAddForm ? "Tambah Pelanggan Baru" : "Pilih Pelanggan Kasir"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  F7
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {showAddForm
                  ? "Daftarkan pelanggan atau member baru langsung ke database iPos 4.0"
                  : "Cari data pelanggan terdaftar, member diskon bertingkat, atau poin loyalitas"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                title="Daftar Pelanggan Baru [F4]"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Member Baru [F4]</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela pelanggan"
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode A: Form Tambah Pelanggan Baru */}
        {showAddForm ? (
          <form onSubmit={handleCreateCustomer} className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Kode Pelanggan (Otomatis/Manual):
                </label>
                <input
                  type="text"
                  required
                  value={newKode}
                  onChange={(e) => setNewKode(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Grup Member / Pelanggan:
                </label>
                <select
                  value={newGrup}
                  onChange={(e) => setNewGrup(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="General">General (Umum)</option>
                  {customerGroups.map((g, idx) => (
                    <option key={g.kodegrup ? `${g.kodegrup}-${idx}` : idx} value={g.kodegrup}>
                      {g.kodegrup} - {g.namagrup || g.kodegrup}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Nama Lengkap Pelanggan: *
              </label>
              <input
                ref={addNamaRef}
                type="text"
                required
                placeholder="Contoh: Bpk. Bambang Wijaya / Toko Sejahtera"
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  No. Telepon / WhatsApp:
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={newTelepon}
                    onChange={(e) => setNewTelepon(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Alamat Singkat / Kota:
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Contoh: Surabaya Timur"
                    value={newAlamat}
                    onChange={(e) => setNewAlamat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
              >
                Batal [Esc]
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan & Pilih Pelanggan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Mode B: Pencarian & Daftar Pelanggan */
          <>
            {/* Search Bar + Shortcut UMUM */}
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/50">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ketik nama pelanggan, kode, no telp, atau kota..."
                  value={search}
                  onChange={handleSearchChange}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 transition"
                />
              </div>

              <button
                type="button"
                onClick={selectUmum}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition shrink-0"
                title="Pilih Pelanggan Non-Member / Umum [F1]"
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pelanggan UMUM [F1]</span>
              </button>
            </div>

            {/* List Results */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/80 max-h-[50vh]">
              {loading ? (
                <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Mencari data pelanggan iPos 4.0...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-zinc-300">
                    Tidak ditemukan pelanggan dengan kata kunci &quot;{search}&quot;
                  </div>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Pelanggan belum terdaftar di sistem. Anda dapat mendaftarkannya sekarang.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Daftarkan Sebagai Pelanggan Baru</span>
                  </button>
                </div>
              ) : (
                customers.map((c, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isCurrent = currentCustomerKode === c.kode;

                  return (
                    <div
                      key={c.kode || idx}
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? "bg-emerald-950/40 text-emerald-200 border-l-4 border-emerald-500 font-semibold"
                          : "hover:bg-zinc-800/40 text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCurrent
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {c.nama ? c.nama.slice(0, 2).toUpperCase() : "PL"}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {c.nama}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                Terpilih
                              </span>
                            )}
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded font-mono">
                              {c.grup || c.kgrup || "General"}
                            </span>
                          </div>

                          <div className="text-[11px] text-zinc-400 flex items-center gap-3 mt-0.5 font-mono">
                            <span>ID: {c.kode}</span>
                            {c.telepon && (
                              <span className="flex items-center gap-1 text-zinc-500">
                                <Phone className="w-3 h-3" />
                                <span>{c.telepon}</span>
                              </span>
                            )}
                            {c.kota && (
                              <span className="flex items-center gap-1 text-zinc-500">
                                <MapPin className="w-3 h-3" />
                                <span>{c.kota}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-3">
                        {c.limitpiutang > 0 ? (
                          <div className="text-[10px] text-zinc-400">
                            Limit:{" "}
                            <span className="font-mono font-semibold text-zinc-200">
                              {formatRupiah(c.limitpiutang)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-500 font-mono">Tanpa Limit</div>
                        )}
                        <span className="text-[10px] text-emerald-400 font-bold opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 mt-0.5">
                          <span>Pilih</span>
                          <Check className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer & Shortcut Help */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-400">
              <div className="flex items-center space-x-3">
                <span>
                  <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    &uarr;&darr;
                  </kbd>{" "}
                  Pilih
                </span>
                <span>
                  <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    Enter
                  </kbd>{" "}
                  Konfirmasi
                </span>
                <span>
                  <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    F1
                  </kbd>{" "}
                  UMUM
                </span>
                <span>
                  <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    F4
                  </kbd>{" "}
                  Member Baru
                </span>
                <span>
                  <kbd className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    Esc
                  </kbd>{" "}
                  Tutup
                </span>
              </div>

              <div className="text-zinc-500 font-mono">
                {customers.length} Pelanggan Terdaftar
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
