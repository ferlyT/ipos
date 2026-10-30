"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  QrCode,
  ArrowRightLeft,
  PackagePlus,
  ShoppingCart,
  Search,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Box,
  Layers,
  MapPin,
  Barcode,
  Sparkles,
} from "lucide-react";

type WmsMode = "PUTAWAY" | "PICKING" | "RELOCATE" | "INQUIRY";

export default function WmsScannerPage() {
  const [mode, setMode] = useState<WmsMode>("INQUIRY");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Common Scanner Input
  const [scanInput, setScanInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // --- 1. State Mode INQUIRY (Cek Rak) ---
  const [inquiryBin, setInquiryBin] = useState<string>("");
  const [inquiryData, setInquiryData] = useState<any | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState<boolean>(false);

  // --- 2. State Mode RELOCATE (Pindah Rak) ---
  const [relFromBin, setRelFromBin] = useState<string>("");
  const [relToBin, setRelToBin] = useState<string>("");
  const [relItemCode, setRelItemCode] = useState<string>("");
  const [relQty, setRelQty] = useState<number>(1);
  const [relStep, setRelStep] = useState<"FROM" | "ITEM" | "TO" | "QTY">("FROM");

  // --- 3. State Mode PUTAWAY (Masuk Rak) ---
  const [inboundTasks, setInboundTasks] = useState<any[]>([]);
  const [activeInboundTask, setActiveInboundTask] = useState<any | null>(null);
  const [putawayItem, setPutawayItem] = useState<any | null>(null);
  const [putawayTargetBin, setPutawayTargetBin] = useState<string>("");

  // --- 4. State Mode PICKING (Ambil Barang) ---
  const [outboundTasks, setOutboundTasks] = useState<any[]>([]);
  const [activeOutboundTask, setActiveOutboundTask] = useState<any | null>(null);

  // Sound Synthesizer via Web Audio API
  const playSound = (type: "success" | "error") => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high note
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        if (navigator.vibrate) navigator.vibrate(80);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
      }
    } catch {
      // Audio context might be restricted before user interaction
    }
  };

  // Keep input auto-focused for hardware barcode scanners
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, relStep]);

  // Load Inbound Tasks
  const loadInboundTasks = async () => {
    try {
      const res = await api.wms.getInboundTasks();
      setInboundTasks(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Outbound Tasks
  const loadOutboundTasks = async () => {
    try {
      const res = await api.wms.getOutboundTasks();
      setOutboundTasks(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (mode === "PUTAWAY") loadInboundTasks();
    if (mode === "PICKING") loadOutboundTasks();
  }, [mode]);

  // Handle Barcode Scan Submit
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = scanInput.trim().toUpperCase();
    if (!barcode) return;
    setScanInput("");

    // --- Mode INQUIRY ---
    if (mode === "INQUIRY") {
      setInquiryBin(barcode);
      setInquiryLoading(true);
      try {
        const res = await api.wms.getBinDetail(barcode);
        if (res && res.bin) {
          setInquiryData(res);
          playSound("success");
          setFeedback({ type: "success", msg: `Rak ${barcode} terdeteksi (${res.stocks.length} variasi barang)` });
        } else {
          playSound("error");
          setFeedback({ type: "error", msg: `Rak ${barcode} tidak terdaftar di sistem` });
        }
      } catch (err: any) {
        playSound("error");
        setFeedback({ type: "error", msg: err.message || "Gagal memuat rak" });
      } finally {
        setInquiryLoading(false);
      }
      return;
    }

    // --- Mode RELOCATE ---
    if (mode === "RELOCATE") {
      if (relStep === "FROM") {
        setRelFromBin(barcode);
        setRelStep("ITEM");
        playSound("success");
        setFeedback({ type: "info", msg: `Bin Asal: ${barcode}. Sekarang scan Barcode Barang.` });
      } else if (relStep === "ITEM") {
        setRelItemCode(barcode);
        setRelStep("TO");
        playSound("success");
        setFeedback({ type: "info", msg: `Barang: ${barcode}. Sekarang scan Barcode Bin Tujuan.` });
      } else if (relStep === "TO") {
        if (barcode === relFromBin) {
          playSound("error");
          setFeedback({ type: "error", msg: "Bin tujuan tidak boleh sama dengan bin asal!" });
          return;
        }
        setRelToBin(barcode);
        setRelStep("QTY");
        playSound("success");
        setFeedback({ type: "info", msg: `Bin Tujuan: ${barcode}. Masukkan jumlah & tekan Pindahkan.` });
      }
      return;
    }

    // --- Mode PUTAWAY (Barang Masuk) ---
    if (mode === "PUTAWAY" && activeInboundTask) {
      // Cek apakah barcode yang discan adalah barang dalam task atau bin tujuan
      const matchedItem = activeInboundTask.items.find(
        (it: any) => it.kodeitem.toUpperCase() === barcode || it.barcode?.toUpperCase() === barcode
      );

      if (matchedItem) {
        setPutawayItem(matchedItem);
        setPutawayTargetBin(matchedItem.target_bin || "");
        playSound("success");
        setFeedback({ type: "info", msg: `Item ${matchedItem.namaitem} dipilih. Target rak: ${matchedItem.target_bin}` });
      } else if (putawayItem && barcode.startsWith("BIN-")) {
        // Scan konfirmasi bin
        try {
          await api.wms.putaway({
            notask: activeInboundTask.task.notask,
            kodekantor: activeInboundTask.task.kodekantor,
            kodebin: barcode,
            kodeitem: putawayItem.kodeitem,
            jumlah: putawayItem.jumlah_order - putawayItem.jumlah_received,
            operator: "SCANNER_OPERATOR",
          });
          playSound("success");
          setFeedback({ type: "success", msg: `Berhasil menaruh ${putawayItem.namaitem} ke rak ${barcode}!` });
          setPutawayItem(null);
          // Reload task detail
          const updated = await api.wms.getInboundTaskDetail(activeInboundTask.task.notask);
          setActiveInboundTask(updated);
        } catch (err: any) {
          playSound("error");
          setFeedback({ type: "error", msg: err.message || "Gagal putaway ke rak" });
        }
      } else {
        playSound("error");
        setFeedback({ type: "error", msg: `Barcode ${barcode} tidak cocok dengan item atau format rak` });
      }
      return;
    }

    // --- Mode PICKING (Ambil Barang) ---
    if (mode === "PICKING" && activeOutboundTask) {
      // Cari baris item yang belum selesai
      const currentItem = activeOutboundTask.items.find((i: any) => i.status !== "PICKED");
      if (!currentItem) {
        setFeedback({ type: "info", msg: "Semua item pada tugas ini sudah selesai diambil!" });
        return;
      }

      // Validasi scan bin atau scan barcode item
      const isBinMatch = barcode === currentItem.source_bin.toUpperCase();
      const isItemMatch = barcode === currentItem.kodeitem.toUpperCase() || barcode === currentItem.barcode?.toUpperCase();

      if (isBinMatch || isItemMatch) {
        try {
          const qtyToPick = currentItem.jumlah_order - currentItem.jumlah_picked;
          await api.wms.pick({
            notask: activeOutboundTask.task.notask,
            kodeitem: currentItem.kodeitem,
            source_bin: currentItem.source_bin,
            jumlah: qtyToPick,
            operator: "SCANNER_OPERATOR",
          });
          playSound("success");
          setFeedback({ type: "success", msg: `Berhasil mengambil ${qtyToPick} ${currentItem.satuan} ${currentItem.namaitem}!` });
          // Reload detail
          const updated = await api.wms.getOutboundTaskDetail(activeOutboundTask.task.notask);
          setActiveOutboundTask(updated);
        } catch (err: any) {
          playSound("error");
          setFeedback({ type: "error", msg: err.message || "Gagal memproses picking" });
        }
      } else {
        playSound("error");
        setFeedback({ type: "error", msg: `Barcode salah! Diharapkan bin: ${currentItem.source_bin} atau item: ${currentItem.kodeitem}` });
      }
      return;
    }
  };

  // Submit Relocation final
  const handleExecuteRelocation = async () => {
    try {
      await api.wms.relocate({
        kodekantor: "GD",
        from_bin: relFromBin,
        to_bin: relToBin,
        kodeitem: relItemCode,
        jumlah: relQty,
        operator: "SCANNER_OPERATOR",
        keterangan: "Relokasi cepat via Mobile Scanner",
      });
      playSound("success");
      setFeedback({ type: "success", msg: `Berhasil memindahkan ${relQty} unit ${relItemCode} dari ${relFromBin} ke ${relToBin}!` });
      // Reset
      setRelStep("FROM");
      setRelFromBin("");
      setRelToBin("");
      setRelItemCode("");
      setRelQty(1);
    } catch (err: any) {
      playSound("error");
      setFeedback({ type: "error", msg: err.message || "Gagal relokasi" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Mobile App Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Link href="/admin/wms/layout" className="p-1 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-1.5">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <span className="font-bold tracking-tight text-white text-base">iPos WMS Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Nonaktifkan suara beep scanner" : "Aktifkan suara beep scanner"}
            className={`p-2 rounded-lg border transition focus:ring-2 focus:ring-emerald-500 focus:outline-hidden ${
              soundEnabled
                ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-400"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
            title="Toggle Audio Beep"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Mode Selector Tabs (Mobile Touch Friendly) */}
      <div className="grid grid-cols-4 bg-slate-900/80 border-b border-slate-800 p-1 gap-1">
        <button
          onClick={() => {
            setMode("INQUIRY");
            setActiveInboundTask(null);
            setActiveOutboundTask(null);
          }}
          className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
            mode === "INQUIRY" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Cek Rak</span>
        </button>
        <button
          onClick={() => {
            setMode("PUTAWAY");
            setActiveOutboundTask(null);
          }}
          className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
            mode === "PUTAWAY" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span>Putaway</span>
        </button>
        <button
          onClick={() => {
            setMode("PICKING");
            setActiveInboundTask(null);
          }}
          className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
            mode === "PICKING" ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Picking</span>
        </button>
        <button
          onClick={() => {
            setMode("RELOCATE");
            setActiveInboundTask(null);
            setActiveOutboundTask(null);
            setRelStep("FROM");
          }}
          className={`py-2 text-xs font-semibold rounded-md flex flex-col items-center gap-1 transition ${
            mode === "RELOCATE" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Relokasi</span>
        </button>
      </div>

      {/* Main Barcode Scanner Input Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 sticky top-[57px] z-20">
        <form onSubmit={handleBarcodeSubmit} className="relative">
          <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan / Ketik Barcode Rak atau Barang..."
            className="w-full bg-slate-950 border-2 border-emerald-500/80 rounded-xl pl-10 pr-20 py-2.5 text-sm font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition"
          >
            ENTER
          </button>
        </form>
      </div>

      {/* Feedback Banner (Audio/Haptic Visual Alert) */}
      {feedback && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mx-3 mt-3 p-3 rounded-xl border flex items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 ${
            feedback.type === "success"
              ? "bg-emerald-950/70 border-emerald-600 text-emerald-300"
              : feedback.type === "error"
              ? "bg-rose-950/70 border-rose-600 text-rose-300"
              : "bg-blue-950/70 border-blue-600 text-blue-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          )}
          <span className="flex-1">{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup notifikasi"
            className="text-slate-400 hover:text-white p-1 rounded-sm focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
          >
            &times;
          </button>
        </div>
      )}

      {/* Content Area Based on Mode */}
      <div className="flex-1 p-3 overflow-y-auto pb-20">
        {/* --- 1. VIEW: INQUIRY (Cek Rak) --- */}
        {mode === "INQUIRY" && (
          <div className="space-y-3">
            {!inquiryData ? (
              <div className="text-center py-12 px-4 bg-slate-900/40 rounded-2xl border border-slate-800/80">
                <MapPin className="w-12 h-12 text-blue-500/50 mx-auto mb-3" />
                <h3 className="font-semibold text-base text-slate-200">Siap Memindai Rak</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Arahkan scanner hardware atau ketik kode barcode rak (contoh: <code className="text-blue-400">BIN-GD-A-01-1-01</code>)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Rak Summary Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                        {inquiryData.bin.namazone || "Zona Umum"}
                      </span>
                      <h2 className="text-lg font-black text-white mt-1.5 font-mono">{inquiryData.bin.kodebin}</h2>
                      <p className="text-xs text-slate-400">
                        Lorong {inquiryData.bin.aisle} &bull; Rak {inquiryData.bin.rack} &bull; Lantai {inquiryData.bin.tier} &bull; Slot {inquiryData.bin.slot}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        {formatNumber(inquiryData.bin.total_qty || 0)} <span className="text-xs text-slate-400">unit</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Utilisasi: <span className="font-semibold text-slate-200">{inquiryData.bin.occupancy_pct}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* List Barang di Rak */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
                    <span>Daftar Barang Tersimpan</span>
                    <span>{inquiryData.stocks.length} Item</span>
                  </div>

                  {inquiryData.stocks.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 text-center text-xs text-slate-500">
                      Rak ini kosong (0 unit tersimpan)
                    </div>
                  ) : (
                    inquiryData.stocks.map((item: any) => (
                      <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-xs font-bold text-white">{item.kodeitem}</div>
                          <div className="text-xs text-slate-300 font-medium">{item.namaitem}</div>
                          {item.batch_no && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Batch: {item.batch_no} {item.expired_date && `• Exp: ${item.expired_date}`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-400 font-mono">
                            {formatNumber(item.jumlah)} <span className="text-[10px] text-slate-400">{item.satuan || "PCS"}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- 2. VIEW: RELOCATE (Pindah Rak Cepat) --- */}
        {mode === "RELOCATE" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" /> Alur Pemindahan Barang Antar Rak
              </h3>

              <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold">
                <div className={`p-2 rounded-lg border ${relStep === "FROM" ? "bg-purple-950 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-500"}`}>
                  1. Bin Asal
                  <div className="font-mono truncate mt-0.5 text-white">{relFromBin || "-"}</div>
                </div>
                <div className={`p-2 rounded-lg border ${relStep === "ITEM" ? "bg-purple-950 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-500"}`}>
                  2. Barang
                  <div className="font-mono truncate mt-0.5 text-white">{relItemCode || "-"}</div>
                </div>
                <div className={`p-2 rounded-lg border ${relStep === "TO" ? "bg-purple-950 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-500"}`}>
                  3. Bin Tujuan
                  <div className="font-mono truncate mt-0.5 text-white">{relToBin || "-"}</div>
                </div>
                <div className={`p-2 rounded-lg border ${relStep === "QTY" ? "bg-purple-950 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-500"}`}>
                  4. Eksekusi
                  <div className="font-mono truncate mt-0.5 text-white">{relQty} Unit</div>
                </div>
              </div>

              {relStep === "QTY" && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Jumlah Unit Dipindah:</label>
                    <input
                      type="number"
                      min="1"
                      value={relQty}
                      onChange={(e) => setRelQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono text-white text-sm"
                    />
                  </div>
                  <button
                    onClick={handleExecuteRelocation}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-purple-900/40"
                  >
                    Konfirmasi Pindahkan Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- 3. VIEW: PUTAWAY (Penerimaan & Masuk Rak) --- */}
        {mode === "PUTAWAY" && (
          <div className="space-y-3">
            {!activeInboundTask ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                  <span>Antrean Tugas Penerimaan (Inbound)</span>
                  <button onClick={loadInboundTasks} className="hover:text-white">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {inboundTasks.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                    Tidak ada tugas penerimaan aktif
                  </div>
                ) : (
                  inboundTasks.map((t) => (
                    <div
                      key={t.notask}
                      onClick={async () => {
                        const detail = await api.wms.getInboundTaskDetail(t.notask);
                        setActiveInboundTask(detail);
                      }}
                      className="bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-xl p-3.5 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">{t.notask}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            t.status === "COMPLETED"
                              ? "bg-emerald-950 text-emerald-400"
                              : "bg-amber-950 text-amber-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Ref: {t.notransaksi_ref || "-"}</div>
                      <div className="text-xs text-slate-300 font-medium">{t.namasupel || "Supplier"}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/80">
                        <span>Total: {t.total_items} Barang</span>
                        <span className="text-emerald-400 font-mono">
                          {formatNumber(t.total_qty_received)} / {formatNumber(t.total_qty_order)} Unit
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setActiveInboundTask(null);
                      setPutawayItem(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Ganti Tugas
                  </button>
                  <span className="font-mono text-xs font-bold text-emerald-400">{activeInboundTask.task.notask}</span>
                </div>

                <div className="space-y-2">
                  {activeInboundTask.items.map((item: any) => {
                    const isSelected = putawayItem?.kodeitem === item.kodeitem;
                    const isDone = item.status === "STORED";
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!isDone) {
                            setPutawayItem(item);
                            setPutawayTargetBin(item.target_bin || "");
                          }
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer ${
                          isDone
                            ? "bg-emerald-950/20 border-emerald-800/40 opacity-75"
                            : isSelected
                            ? "bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500"
                            : "bg-slate-900 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-mono text-xs font-bold text-white">{item.kodeitem}</div>
                            <div className="text-xs text-slate-300 font-medium">{item.namaitem}</div>
                          </div>
                          {isDone ? (
                            <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded font-bold">
                              TERSIMPAN
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-bold text-amber-400">
                              {item.jumlah_received} / {item.jumlah_order} {item.satuan}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-400" /> Target Rak:
                          </span>
                          <span className="font-mono font-bold text-blue-400">{item.target_bin || "-"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- 4. VIEW: PICKING (Ambil Barang Outbound) --- */}
        {mode === "PICKING" && (
          <div className="space-y-3">
            {!activeOutboundTask ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                  <span>Antrean Tugas Pengambilan (Picking Outbound)</span>
                  <button onClick={loadOutboundTasks} className="hover:text-white">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {outboundTasks.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                    Tidak ada tugas picking outbound aktif
                  </div>
                ) : (
                  outboundTasks.map((t) => (
                    <div
                      key={t.notask}
                      onClick={async () => {
                        const detail = await api.wms.getOutboundTaskDetail(t.notask);
                        setActiveOutboundTask(detail);
                      }}
                      className="bg-slate-900 border border-slate-800 hover:border-amber-500 rounded-xl p-3.5 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">{t.notask}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            t.status === "PACKED"
                              ? "bg-emerald-950 text-emerald-400"
                              : "bg-amber-950 text-amber-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Tujuan: {t.tujuan || "-"}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/80">
                        <span>{t.total_items} Barang (Rute Terurut)</span>
                        <span className="text-amber-400 font-mono">
                          {formatNumber(t.total_qty_picked)} / {formatNumber(t.total_qty_order)} Unit
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setActiveOutboundTask(null)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Ganti Tugas
                  </button>
                  <span className="font-mono text-xs font-bold text-amber-400">{activeOutboundTask.task.notask}</span>
                </div>

                <div className="space-y-2">
                  {activeOutboundTask.items.map((item: any, idx: number) => {
                    const isPicked = item.status === "PICKED";
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition ${
                          isPicked
                            ? "bg-emerald-950/20 border-emerald-800/40 opacity-70"
                            : idx === 0 || activeOutboundTask.items[idx - 1]?.status === "PICKED"
                            ? "bg-amber-950/40 border-amber-500 ring-1 ring-amber-500"
                            : "bg-slate-900 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          <span className="text-amber-400 font-mono">LANGKAH {item.sequence_order || idx + 1}</span>
                          <span>Lorong {item.aisle || "-"} &bull; Rak {item.rack || "-"}</span>
                        </div>

                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-mono text-xs font-bold text-white">{item.kodeitem}</div>
                            <div className="text-xs text-slate-300 font-medium">{item.namaitem}</div>
                          </div>
                          <div className="text-right">
                            {isPicked ? (
                              <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded font-bold">
                                SELESAI
                              </span>
                            ) : (
                              <div className="text-sm font-mono font-black text-amber-400">
                                {item.jumlah_order} {item.satuan}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" /> Ambil dari Bin:
                          </span>
                          <span className="font-mono font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                            {item.source_bin}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
