"use client";

import { useState, useEffect, useRef } from "react";
import { formatRupiah } from "@/lib/utils";
import { DollarSign, CreditCard, Banknote, CheckCircle, XCircle } from "lucide-react";

interface TenderModalProps {
  isOpen: boolean;
  grandTotal: number;
  onClose: () => void;
  onConfirm: (payment: {
    method: string;
    amountPaid: number;
    changeAmount: number;
  }) => void;
}

export function TenderModal({ isOpen, grandTotal, onClose, onConfirm }: TenderModalProps) {
  const [method, setMethod] = useState<string>("TUNAI");
  const [amountPaid, setAmountPaid] = useState<number>(grandTotal);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMethod("TUNAI");
      setAmountPaid(grandTotal);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, grandTotal]);

  // Focus trap for keyboard navigation (WCAG 2.1.1 & 2.1.2)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      // If pressing Enter in input, submit if sufficient
      if (method === "KREDIT" || amountPaid >= grandTotal) {
        e.preventDefault();
        onConfirm({ method, amountPaid, changeAmount: method === "KREDIT" ? 0 : Math.max(0, amountPaid - grandTotal) });
        return;
      }
    }

    if (e.key === "Tab" && modalRef.current) {
      const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  if (!isOpen) return null;

  const changeAmount = method === "KREDIT" ? 0 : Math.max(0, amountPaid - grandTotal);
  const isInsufficient = method !== "KREDIT" && amountPaid < grandTotal;

  const handleQuickAdd = (nominal: number) => {
    setAmountPaid((prev) => prev + nominal);
  };

  const handleSetExact = () => {
    setAmountPaid(grandTotal);
  };

  const handleRoundUp = (roundTo: number) => {
    setAmountPaid(Math.ceil(grandTotal / roundTo) * roundTo);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tender-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header Modal */}
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-6 h-6" aria-hidden="true" />
            <h2 id="tender-modal-title" className="text-xl font-bold tracking-tight">
              Pembayaran Kasir [F8]
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog pembayaran"
            className="text-white/80 hover:text-white text-sm font-semibold px-2 py-1 rounded-md hover:bg-emerald-700/50 focus:ring-2 focus:ring-white focus:outline-hidden"
          >
            Esc (Batal)
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Display Grand Total */}
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
              Total Tagihan Belanja
            </span>
            <div className="text-4xl font-extrabold text-zinc-900 dark:text-white mt-1">
              {formatRupiah(grandTotal)}
            </div>
          </div>

          {/* Pilihan Metode Bayar */}
          <div>
            <label id="payment-methods-label" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Metode Pembayaran
            </label>
            <div
              role="radiogroup"
              aria-labelledby="payment-methods-label"
              className="grid grid-cols-4 gap-2"
            >
              {[
                { id: "TUNAI", label: "Tunai", icon: Banknote },
                { id: "BCA", label: "Bank BCA", icon: CreditCard },
                { id: "MANDIRI", label: "Mandiri", icon: CreditCard },
                { id: "KREDIT", label: "Tempo/Kredit", icon: DollarSign },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setMethod(m.id);
                      if (m.id === "KREDIT") setAmountPaid(0);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-hidden ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/50"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" aria-hidden="true" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Jumlah Bayar */}
          {method !== "KREDIT" && (
            <div>
              <label
                htmlFor="amount-paid-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Jumlah Uang Diterima (Rp)
              </label>
              <div className="relative">
                <input
                  id="amount-paid-input"
                  ref={inputRef}
                  type="number"
                  value={amountPaid || ""}
                  onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                  className="w-full text-2xl font-bold py-3 px-4 rounded-xl border-2 border-emerald-500 dark:border-emerald-600 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/20 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Quick Nominal Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleSetExact}
                  className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  onClick={() => handleRoundUp(50000)}
                  className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  Pas 50rb
                </button>
                <button
                  type="button"
                  onClick={() => handleRoundUp(100000)}
                  className="py-1.5 px-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  Pas 100rb
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(100000)}
                  className="py-1.5 px-2 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  +100.000
                </button>
              </div>
            </div>
          )}

          {/* Display Kembalian */}
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-xl border flex items-center justify-between ${
              isInsufficient
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                {isInsufficient ? "UANG PEMBAYARAN KURANG" : "KEMBALIAN KASIR"}
              </span>
              <span className="text-2xl font-extrabold">
                {isInsufficient
                  ? `-${formatRupiah(grandTotal - amountPaid)}`
                  : formatRupiah(changeAmount)}
              </span>
            </div>
            {isInsufficient ? (
              <XCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
            ) : (
              <CheckCircle className="w-8 h-8 text-emerald-600" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-4 border-t border-zinc-200 dark:border-zinc-800 flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-sm focus:ring-2 focus:ring-zinc-500 focus:outline-hidden"
          >
            [Esc] Batal
          </button>
          <button
            type="button"
            disabled={isInsufficient}
            onClick={() => onConfirm({ method, amountPaid, changeAmount })}
            className={`w-2/3 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all text-sm flex items-center justify-center space-x-2 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden ${
              isInsufficient
                ? "bg-zinc-400 cursor-not-allowed opacity-60"
                : "bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-600/30"
            }`}
          >
            <span>[Enter] Proses & Cetak Struk</span>
          </button>
        </div>
      </div>
    </div>
  );
}
