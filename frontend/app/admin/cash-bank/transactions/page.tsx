"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Receipt,
  X,
} from "lucide-react";

export default function CashBankTransactionsPage() {
  const [activeTab, setActiveTab] = useState<"OUT" | "IN" | "TRANSFER">("OUT");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Form Fields
  const [selectedKasBank, setSelectedKasBank] = useState<string>("1-1110");
  const [selectedLawan, setSelectedLawan] = useState<string>("6-1100");
  const [selectedKasTujuan, setSelectedKasTujuan] = useState<string>("1-1120");
  const [amount, setAmount] = useState<number>(50000);
  const [keterangan, setKeterangan] = useState<string>("");

  useEffect(() => {
    async function loadAccounts() {
      try {
        const accs = await api.cashBank.getAccounts();
        setAccounts(accs || []);
        if (accs && accs.length >= 2) {
          setSelectedKasBank(accs[0].kodeacc);
          setSelectedKasTujuan(accs[1].kodeacc);
        }
      } catch (err) {
        console.error("Gagal memuat akun kas & bank:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  // Update default account lawan when switching tabs
  useEffect(() => {
    setErrorMsg(null);
    setResult(null);
    if (activeTab === "OUT") {
      setSelectedLawan("6-1100"); // Biaya Operasional / Listrik / Air
      setKeterangan("Biaya operasional kantor");
    } else if (activeTab === "IN") {
      setSelectedLawan("8-1100"); // Pendapatan Lain-lain
      setKeterangan("Penerimaan pendapatan operasional");
    } else {
      setKeterangan("Mutasi kas ke bank");
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg("Nominal transaksi harus lebih besar dari 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setResult(null);

    try {
      let res: any;
      if (activeTab === "OUT") {
        res = await api.cashBank.recordCashOut({
          kodekantor: "UTM",
          kodeaccKasBank: selectedKasBank,
          kodeaccBiaya: selectedLawan,
          jumlah: amount,
          keterangan: keterangan || "Pengeluaran Kas Operasional",
          user: "ADMIN",
        });
      } else if (activeTab === "IN") {
        res = await api.cashBank.recordCashIn({
          kodekantor: "UTM",
          kodeaccKasBank: selectedKasBank,
          kodeaccLawan: selectedLawan,
          jumlah: amount,
          keterangan: keterangan || "Penerimaan Kas Masuk",
          user: "ADMIN",
        });
      } else {
        if (selectedKasBank === selectedKasTujuan) {
          throw new Error("Rekening sumber dan rekening tujuan mutasi tidak boleh sama.");
        }
        res = await api.cashBank.transfer({
          kodekantor: "UTM",
          kodeaccAsal: selectedKasBank,
          kodeaccTujuan: selectedKasTujuan,
          jumlah: amount,
          keterangan: keterangan || "Transfer kas internal",
          user: "ADMIN",
        });
      }

      setResult(res);
      // Reload account balances
      const updatedAccs = await api.cashBank.getAccounts();
      setAccounts(updatedAccs || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memproses transaksi kas/bank.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentKasBank = accounts.find((a) => a.kodeacc === selectedKasBank);
  const currentKasTujuan = accounts.find((a) => a.kodeacc === selectedKasTujuan);

  return (
    <div className="space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <span>Transaksi Kas Masuk, Keluar & Mutasi Bank</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Pencatatan voucher operasional pengeluaran biaya (KK), penerimaan kas lain-lain (KM), dan transfer antar rekening.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("OUT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeTab === "OUT"
                ? "bg-red-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Kas Keluar (Biaya)</span>
          </button>
          <button
            onClick={() => setActiveTab("IN")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeTab === "IN"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Kas Masuk (Lain)</span>
          </button>
          <button
            onClick={() => setActiveTab("TRANSFER")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeTab === "TRANSFER"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Mutasi Antar-Rekening</span>
          </button>
        </div>
      </div>

      {/* Success Receipt Alert */}
      {result && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 p-5 rounded-2xl space-y-3 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Transaksi Kas/Bank Berhasil Dicatat & Diposting!</span>
            </div>
            <button onClick={() => setResult(null)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-900/60 p-3 rounded-xl border border-emerald-800/40">
            <div>
              <span className="text-zinc-400">No. Bukti Kas:</span>
              <div className="font-mono font-bold text-emerald-300 text-sm">
                {result.notransaksi}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Nominal:</span>
              <div className="font-mono font-bold text-white text-sm">
                {formatRupiah(result.jumlah)}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Tanggal:</span>
              <div className="font-mono font-bold text-zinc-300">
                {new Date(result.tanggal).toLocaleDateString("id-ID")}
              </div>
            </div>
            <div>
              <span className="text-zinc-400">Keterangan:</span>
              <div className="font-medium text-zinc-300 truncate">{result.keterangan}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Transaction Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <span className="text-sm font-bold text-white flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>
                {activeTab === "OUT"
                  ? "Formulir Pengeluaran Kas Operasional (KK)"
                  : activeTab === "IN"
                  ? "Formulir Penerimaan Kas Masuk (KM)"
                  : "Formulir Transfer / Mutasi Antar Kas & Bank"}
              </span>
            </span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md font-mono">
              Kantor: UTM
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Source Account */}
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">
                {activeTab === "IN" ? "Akun Kas/Bank Penerima" : "Akun Kas/Bank Sumber Dana"}
              </label>
              <select
                value={selectedKasBank}
                onChange={(e) => setSelectedKasBank(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.kodeacc} value={acc.kodeacc}>
                    {acc.kodeacc} - {acc.namaacc}
                  </option>
                ))}
              </select>
              {currentKasBank && (
                <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                  Saldo: {formatRupiah(currentKasBank.saldoAkhir || currentKasBank.saldo)}
                </div>
              )}
            </div>

            {/* Target / Lawan Account */}
            {activeTab === "TRANSFER" ? (
              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">
                  Akun Kas/Bank Tujuan Transfer
                </label>
                <select
                  value={selectedKasTujuan}
                  onChange={(e) => setSelectedKasTujuan(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.kodeacc} value={acc.kodeacc}>
                      {acc.kodeacc} - {acc.namaacc}
                    </option>
                  ))}
                </select>
                {currentKasTujuan && (
                  <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                    Saldo: {formatRupiah(currentKasTujuan.saldoAkhir || currentKasTujuan.saldo)}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-zinc-300 font-bold mb-1.5">
                  {activeTab === "OUT" ? "Akun Beban / Biaya (Debit)" : "Akun Pendapatan Lawan (Kredit)"}
                </label>
                <select
                  value={selectedLawan}
                  onChange={(e) => setSelectedLawan(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
                >
                  {activeTab === "OUT" ? (
                    <>
                      <option value="6-1100">6-1100 - Biaya Operasional Toko</option>
                      <option value="6-1200">6-1200 - Biaya Gaji & Upah Pegawai</option>
                      <option value="6-1300">6-1300 - Biaya Listrik, Air & Internet</option>
                      <option value="6-1400">6-1400 - Biaya Perlengkapan Kantor</option>
                      <option value="6-9900">6-9900 - Biaya Lain-lain</option>
                    </>
                  ) : (
                    <>
                      <option value="8-1100">8-1100 - Pendapatan Operasional Lain</option>
                      <option value="8-1200">8-1200 - Pendapatan Jasa / Parkir</option>
                      <option value="3-1100">3-1100 - Setoran Modal Pemilik</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* Nominal Amount */}
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-bold mb-1.5">
                Nominal Transaksi (Rp)
              </label>
              <input
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-emerald-600 rounded-xl px-4 py-3 text-emerald-400 font-mono font-bold text-lg text-right focus:outline-none shadow-inner"
              />
            </div>

            {/* Keterangan */}
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-bold mb-1.5">
                Keterangan / Keperluan Transaksi
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Misal: Pembayaran tagihan token PLN toko bulan ini"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-3 rounded-xl text-xs font-bold text-white flex items-center space-x-2 transition-all shadow-lg cursor-pointer ${
                activeTab === "OUT"
                  ? "bg-red-600 hover:bg-red-500 shadow-red-950/60"
                  : activeTab === "IN"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-950/60"
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memposting Jurnal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Simpan Transaksi{" "}
                    {activeTab === "OUT"
                      ? "Kas Keluar"
                      : activeTab === "IN"
                      ? "Kas Masuk"
                      : "Mutasi Kas"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Account Balances Side Panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="text-xs font-bold text-white flex items-center space-x-2 pb-2 border-b border-zinc-800">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Ringkasan Saldo Kas & Bank Terkini</span>
          </div>

          <div className="space-y-3">
            {accounts.map((acc) => {
              const saldo = Number(acc.saldoAkhir || acc.saldo || 0);
              return (
                <div
                  key={acc.kodeacc}
                  className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition-all"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-zinc-400 font-bold">{acc.kodeacc}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {acc.tipe || "Aset"}
                    </span>
                  </div>
                  <div className="font-bold text-white text-xs mt-1 truncate">
                    {acc.namaacc}
                  </div>
                  <div className="font-mono font-bold text-sm text-emerald-400 mt-1">
                    {formatRupiah(saldo)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
