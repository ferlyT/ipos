"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Package, Check, X } from "lucide-react";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api-client";

interface ItemSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: any) => void;
}

export function ItemSearchModal({ isOpen, onClose, onSelectItem }: ItemSearchModalProps) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      loadItems("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const loadItems = async (q: string) => {
    setLoading(true);
    try {
      const data = await api.master.getItems(q, 30);
      setItems(data || []);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Gagal mencari item:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadItems(val);
  };

  // Keyboard navigation & Focus trap (WCAG 2.1.1, 2.1.2)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) {
        onSelectItem(items[selectedIndex]);
        onClose();
      }
      return;
    }

    // Modal focus trap
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-search-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header Modal */}
        <div className="bg-zinc-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <h2 id="item-search-modal-title" className="text-lg font-bold">
              Cari Barang / Katalog Produk [F2]
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian barang"
            className="text-zinc-400 hover:text-white p-1 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Input Pencarian */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-zinc-400" aria-hidden="true" />
            <input
              id="item-search-input"
              ref={inputRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Ketik nama barang, kode item, atau scan barcode..."
              aria-label="Cari nama barang, kode item, atau scan barcode"
              aria-autocomplete="list"
              aria-controls="item-search-list"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>

        {/* Daftar Barang */}
        <div
          id="item-search-list"
          role="listbox"
          aria-label="Daftar barang"
          className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 p-2"
        >
          {loading ? (
            <div role="status" className="p-8 text-center text-zinc-400 text-sm font-medium">
              Memuat data barang...
            </div>
          ) : items.length === 0 ? (
            <div role="status" className="p-8 text-center text-zinc-400 text-sm">
              Tidak ada barang yang cocok dengan pencarian "{search}"
            </div>
          ) : (
            items.map((it, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={it.kodeitem}
                  id={`item-option-${it.kodeitem}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    onSelectItem(it);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectItem(it);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/50 text-emerald-900 dark:text-emerald-200"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <Package className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-tight flex items-center space-x-2">
                        <span>{it.namaitem}</span>
                        {it.jenis && (
                          <span className="text-[10px] py-0.5 px-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md font-semibold">
                            {it.jenis}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Kode: <span className="font-mono">{it.kodeitem}</span> | Satuan:{" "}
                        <span className="font-semibold">{it.satuan || "PCS"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(it.hargajual)}
                    </div>
                    {isSelected && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-end mt-0.5">
                        <Check className="w-3 h-3 mr-0.5" aria-hidden="true" /> Tekan [Enter]
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigasi */}
        <div className="bg-zinc-100 dark:bg-zinc-800 p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400">
          <div>
            Gunakan <kbd className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-sm">↑</kbd>{" "}
            <kbd className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-sm">↓</kbd> untuk navigasi,{" "}
            <kbd className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-sm">Enter</kbd> untuk memilih
          </div>
          <div>Ditemukan {formatNumber(items.length)} barang</div>
        </div>
      </div>
    </div>
  );
}
