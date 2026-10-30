"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import {
  Sliders,
  Building,
  DollarSign,
  Percent,
  Calendar,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  FileText,
} from "lucide-react";

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [namaPerusahaan, setNamaPerusahaan] = useState<string>("");
  const [alamat1, setAlamat1] = useState<string>("");
  const [alamat2, setAlamat2] = useState<string>("");
  const [telepon, setTelepon] = useState<string>("");
  const [npwp, setNpwp] = useState<string>("");
  const [defaultPajakJual, setDefaultPajakJual] = useState<number>(11);
  const [defaultPajakBeli, setDefaultPajakBeli] = useState<number>(11);
  const [hariJatuhTempoDefault, setHariJatuhTempoDefault] = useState<number>(10);
  const [metodeHpp, setMetodeHpp] = useState<string>("FIFO");
  const [mataUangUtama, setMataUangUtama] = useState<string>("IDR");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.system.getSettings();
      if (data) {
        setNamaPerusahaan(data.namaPerusahaan || "");
        setAlamat1(data.alamat1 || "");
        setAlamat2(data.alamat2 || "");
        setTelepon(data.telepon || "");
        setNpwp(data.npwp || "");
        setDefaultPajakJual(data.defaultPajakJual || 11);
        setDefaultPajakBeli(data.defaultPajakBeli || 11);
        setHariJatuhTempoDefault(data.hariJatuhTempoDefault || 10);
        setMetodeHpp(data.metodeHpp || "FIFO");
        setMataUangUtama(data.mataUangUtama || "IDR");
      }
    } catch (err: any) {
      console.error("Gagal memuat pengaturan sistem:", err);
      setErrorMsg(err.message || "Gagal memuat pengaturan sistem.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.system.updateSettings({
        namaPerusahaan,
        alamat1,
        alamat2,
        telepon,
        npwp,
        defaultPajakJual,
        defaultPajakBeli,
        hariJatuhTempoDefault,
      });
      setToastMsg("Pengaturan perusahaan & sistem berhasil diperbarui ke database!");
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  };

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
            <Sliders className="w-6 h-6 text-emerald-400" />
            <span>Pengaturan Perusahaan & Sistem Toko</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Konfigurasi identitas kop surat faktur, alamat toko, tarif PPN default, dan parameter akuntansi (tbl_conf).
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
          <p className="text-xs">Memuat konfigurasi sistem...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Identitas Perusahaan & Kop Surat Faktur */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
              <Building className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Identitas Toko & Kop Faktur (tbl_conf)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Nama Perusahaan / Toko (CMP_NAMA)
                </label>
                <input
                  type="text"
                  value={namaPerusahaan}
                  onChange={(e) => setNamaPerusahaan(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Alamat Baris 1 (CMP_ALAMAT1)
                </label>
                <input
                  type="text"
                  value={alamat1}
                  onChange={(e) => setAlamat1(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Alamat Baris 2 (CMP_ALAMAT2)
                </label>
                <input
                  type="text"
                  value={alamat2}
                  onChange={(e) => setAlamat2(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Nomor Telepon / Kontak (CMP_TELP)
                </label>
                <input
                  type="text"
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value)}
                  placeholder="Contoh: (021) 582-9988"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  NPWP Toko (CMP_NPWP)
                </label>
                <input
                  type="text"
                  value={npwp}
                  onChange={(e) => setNpwp(e.target.value)}
                  placeholder="Contoh: 01.234.567.8-012.000"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Pajak, Kebijakan Kredit, & Parameter Keuangan */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
              <Percent className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Parameter Transaksi & Pajak</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Default PPN Penjualan (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultPajakJual}
                  onChange={(e) => setDefaultPajakJual(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Default PPN Pembelian (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultPajakBeli}
                  onChange={(e) => setDefaultPajakBeli(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Termin Jatuh Tempo Standar (Hari)
                </label>
                <input
                  type="number"
                  min={1}
                  value={hariJatuhTempoDefault}
                  onChange={(e) => setHariJatuhTempoDefault(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Akuntansi & Nilai Baku Sistem (Read-only status) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Kebijakan Akuntansi Baku Sistem</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-zinc-400">Metode Penilaian HPP:</span>
                  <div className="font-bold text-white text-sm mt-0.5">{metodeHpp} (First-In, First-Out)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  AKTIF
                </span>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-zinc-400">Mata Uang Pembukuan Utama:</span>
                  <div className="font-bold text-white text-sm mt-0.5">{mataUangUtama} (Rupiah Indonesia)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800">
                  STANDARD
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Pengaturan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
