"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { usePosCartStore, type CustomerInfo } from "@/stores/pos-cart.store";
import { usePosKeyboard } from "@/hooks/use-pos-keyboard";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { ItemSearchModal } from "@/components/pos/item-search-modal";
import { CustomerModal } from "@/components/pos/customer-modal";
import { TenderModal } from "@/components/pos/tender-modal";
import { ReceiptPrint, type ReceiptData } from "@/components/pos/receipt-print";
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  DollarSign,
  User,
  Plus,
  Minus,
  AlertCircle,
  HelpCircle,
  X,
  Award,
  RotateCcw,
} from "lucide-react";

export default function PosPage() {
  const {
    items,
    selectedIndex,
    customer,
    discountNota,
    taxPercent,
    addItem,
    setItems,
    updateQty,
    updateDiscount,
    removeItem,
    setSelectedIndex,
    setCustomer,
    clearCart,
    getSubtotal,
    getTaxAmount,
    getGrandTotal,
  } = usePosCartStore();

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto focus input barcode
  useEffect(() => {
    if (!isSearchOpen && !isCustomerOpen && !isTenderOpen && !isHelpOpen) {
      barcodeInputRef.current?.focus();
    }
  }, [isSearchOpen, isCustomerOpen, isTenderOpen, isHelpOpen]);

  // Handle Barcode Scan / Submit
  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    setErrorMsg(null);
    try {
      // 1. Cari via barcode eksak
      let found = null;
      try {
        found = await api.master.getItemByBarcode(query);
      } catch {
        found = null;
      }

      // 2. Jika tidak ditemukan via barcode, cari via kode/nama item
      if (!found) {
        const results = await api.master.getItems(query, 1);
        if (results && results.length > 0) {
          found = results[0];
        }
      }

      if (!found) {
        setErrorMsg(`Barang dengan barcode/kode '${query}' tidak ditemukan.`);
        return;
      }

      // Resolusi harga bertingkat jika ada pelanggan member
      let harga = Number(found.hargajual || found.hargajual1 || 0);
      try {
        const resolved = await api.master.resolvePrice({
          itemCode: found.kodeitem,
          unit: found.satuan || "PCS",
          qty: 1,
          customerCode: customer.kode !== "UMUM" ? customer.kode : undefined,
        });
        if (resolved && resolved.finalUnitPrice) {
          harga = resolved.finalUnitPrice;
        }
      } catch {
        // Fallback ke harga standar
      }

      addItem({
        kodeitem: found.kodeitem,
        namaitem: found.namaitem,
        satuan: found.satuan || "PCS",
        qty: 1,
        harga,
        potongan: 0,
      });

      setBarcodeInput("");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat barang.");
    }
  };

  // Handle Dynamic Customer Change & Recalculate Cart
  const handleCustomerSelect = async (newCustomer: CustomerInfo) => {
    setCustomer(newCustomer);

    // Otomatis hitung ulang harga item di keranjang jika sudah ada barang
    if (items.length > 0) {
      const toastId = toast.loading(
        `Menyesuaikan harga ${items.length} item untuk ${newCustomer.nama}...`
      );
      try {
        const recalculated = await Promise.all(
          items.map(async (it) => {
            try {
              const res = await api.master.resolvePrice({
                itemCode: it.kodeitem,
                unit: it.satuan,
                qty: it.qty,
                customerCode: newCustomer.kode !== "UMUM" ? newCustomer.kode : undefined,
              });
              const newUnitPrice = Number(
                res?.finalUnitPrice ?? res?.standardUnitPrice ?? it.harga
              );
              return {
                ...it,
                harga: newUnitPrice,
                subtotal: it.qty * newUnitPrice - it.potongan,
              };
            } catch {
              return it;
            }
          })
        );

        setItems(recalculated);
        toast.success(
          `Pelanggan diubah: ${newCustomer.nama}. Harga ${recalculated.length} barang disesuaikan!`,
          { id: toastId }
        );
      } catch {
        toast.dismiss(toastId);
        toast.success(`Pelanggan diset ke ${newCustomer.nama}`);
      }
    } else {
      toast.success(`Pelanggan diset ke ${newCustomer.nama}`);
    }
  };

  // Keyboard Shortcuts Hook
  usePosKeyboard({
    enabled: !isSearchOpen && !isCustomerOpen && !isTenderOpen && !isHelpOpen,
    onF1: () => setIsHelpOpen(true),
    onF2: () => setIsSearchOpen(true),
    onF3: () => {
      if (items[selectedIndex]) {
        const input = prompt(
          `Ubah kuantitas untuk ${items[selectedIndex].namaitem}:`,
          items[selectedIndex].qty.toString()
        );
        if (input !== null) {
          const qty = parseFloat(input);
          if (!isNaN(qty) && qty > 0) updateQty(selectedIndex, qty);
        }
      }
    },
    onF5: () => {
      if (items[selectedIndex]) {
        const input = prompt(
          `Masukkan potongan diskon (Rp) untuk ${items[selectedIndex].namaitem}:`,
          items[selectedIndex].potongan.toString()
        );
        if (input !== null) {
          const pot = parseFloat(input);
          if (!isNaN(pot)) updateDiscount(selectedIndex, pot);
        }
      }
    },
    onF7: () => {
      setIsCustomerOpen(true);
    },
    onF8: () => {
      if (items.length > 0) setIsTenderOpen(true);
    },
    onF9: () => {
      if (receiptData) {
        window.print();
      } else {
        toast.error("Belum ada transaksi sebelumnya untuk dicetak ulang.");
      }
    },
    onDelete: () => {
      if (items[selectedIndex]) removeItem(selectedIndex);
    },
    onArrowUp: () => setSelectedIndex(Math.max(0, selectedIndex - 1)),
    onArrowDown: () => setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1)),
    onEscape: () => {
      setBarcodeInput("");
      setErrorMsg(null);
      barcodeInputRef.current?.focus();
    },
  });

  // Konfirmasi Pembayaran Selesai & Kirim ke Database Backend
  const handlePaymentSuccess = async (payment: {
    method: string;
    amountPaid: number;
    changeAmount: number;
  }) => {
    const now = new Date();
    let invoiceNo = `JL${Date.now().toString().slice(-8)}`;

    try {
      const res = await api.sales.createInvoice({
        notransaksi: invoiceNo,
        kodekantor: "UTM",
        tanggal: now.toISOString().split("T")[0],
        kodesupel: customer.kode || "UMUM",
        carabayar: payment.method === "TUNAI" ? "TN" : payment.method,
        subtotal: getSubtotal(),
        potonganNota: discountNota,
        pajak: getTaxAmount(),
        biayalain: 0,
        totalakhir: getGrandTotal(),
        user: "ADMIN",
        items: items.map((it) => ({
          kodeitem: it.kodeitem,
          jumlah: it.qty,
          satuan: it.satuan,
          harga: it.harga,
          potongan: it.potongan,
        })),
      });

      if (res && res.notransaksi) {
        invoiceNo = res.notransaksi;
      }
    } catch (err) {
      console.error("Gagal menyimpan transaksi ke database:", err);
      // Tetap melanjutkan cetak struk agar kasir tidak terhambat
    }

    const receipt: ReceiptData = {
      noTransaksi: invoiceNo,
      tanggal: now,
      kasir: "ADMIN / KASIR-01",
      kantor: "UTM (Gudang Utama)",
      customer,
      items: [...items],
      subtotal: getSubtotal(),
      discountNota,
      taxAmount: getTaxAmount(),
      grandTotal: getGrandTotal(),
      paymentMethod: payment.method,
      amountPaid: payment.amountPaid,
      changeAmount: payment.changeAmount,
    };

    setReceiptData(receipt);
    setIsTenderOpen(false);

    // Memicu cetak dialog browser
    setTimeout(() => {
      window.print();
      clearCart();
      barcodeInputRef.current?.focus();
    }, 150);
  };

  const grandTotal = getGrandTotal();

  return (
    <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
      {/* 1. Barcode & Customer Bar */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        <form onSubmit={handleBarcodeSubmit} className="col-span-8 flex items-center gap-2">
          <div className="relative flex-1">
            <Barcode className="w-5 h-5 absolute left-3.5 top-3.5 text-zinc-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / Masukkan Kode Barang lalu tekan [Enter]..."
              className="w-full bg-zinc-900 border-2 border-emerald-500/60 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-white pl-11 pr-4 py-3 rounded-xl font-mono text-base font-bold placeholder:text-zinc-500 outline-hidden transition-all"
            />
          </div>
          <button
            type="submit"
            className="h-full px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-sm transition-all flex items-center space-x-1.5 shrink-0"
          >
            <span>Scan [Enter]</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="h-full px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold rounded-xl text-sm transition-all flex items-center space-x-1.5 shrink-0"
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Cari [F2]</span>
          </button>
        </form>

        <div className="col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 flex items-center justify-between">
          <div
            onClick={() => setIsCustomerOpen(true)}
            className="flex items-center space-x-2.5 truncate cursor-pointer group flex-1"
            title="Klik atau tekan F7 untuk mengganti pelanggan"
          >
            <div className="p-2 bg-zinc-800 group-hover:bg-emerald-950/60 group-hover:text-emerald-400 rounded-xl text-emerald-400 transition shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                  Pelanggan [F7]
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {customer.grup || "General"}
                </span>
                {customer.kode !== "UMUM" && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-amber-950/70 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded font-mono font-bold">
                    <Award className="w-2.5 h-2.5 text-amber-400" />
                    <span>{customer.poin || 0} Pts</span>
                  </span>
                )}
              </div>
              <div className="text-sm font-bold truncate text-white group-hover:text-emerald-300 transition">
                {customer.nama}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            {customer.kode !== "UMUM" && (
              <button
                type="button"
                onClick={() =>
                  handleCustomerSelect({
                    kode: "UMUM",
                    nama: "PELANGGAN UMUM",
                    grup: "General",
                  })
                }
                className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded-lg font-semibold border border-zinc-700 transition"
                title="Kembalikan ke Pelanggan UMUM"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCustomerOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg font-bold transition shadow-xs"
              title="Ganti Pelanggan [F7]"
            >
              Ganti [F7]
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between animate-fade-in shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Main Work Area: Cart Table (Left) + Order Summary (Right) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Cart Table Container */}
        <div className="col-span-8 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 bg-zinc-850 border-b border-zinc-800 flex items-center justify-between text-xs font-bold text-zinc-400">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>KERANJANG TRANSAKSI KASIR</span>
              <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full text-[10px]">
                {items.length} Barang
              </span>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  toast.success("Keranjang belanja dikosongkan");
                }}
                className="text-red-400 hover:text-red-300 text-xs font-semibold"
              >
                Kosongkan [Esc]
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
                <ShoppingCart className="w-12 h-12 text-zinc-700 mb-2 stroke-1" />
                <p className="font-semibold text-sm">Keranjang Belanja Masih Kosong</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                  Scan barcode produk atau tekan <kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded">F2</kbd> untuk mencari barang dari katalog produk.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-800/60 text-zinc-400 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Barang</th>
                    <th className="py-2.5 px-2 text-center w-16">Satuan</th>
                    <th className="py-2.5 px-3 text-center w-24">Qty [F3]</th>
                    <th className="py-2.5 px-3 text-right w-28">Harga</th>
                    <th className="py-2.5 px-3 text-right w-24">Pot [F5]</th>
                    <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {items.map((it, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <tr
                        key={it.id}
                        onClick={() => setSelectedIndex(idx)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-950/40 text-emerald-200 border-l-4 border-emerald-500 font-semibold"
                            : "hover:bg-zinc-800/40 text-zinc-200"
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-zinc-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-sm leading-tight text-white">{it.namaitem}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{it.kodeitem}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-zinc-300">
                          {it.satuan}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(idx, it.qty - 1);
                              }}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-sm text-center w-8">
                              {it.qty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQty(idx, it.qty + 1);
                              }}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                          {formatRupiah(it.harga)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-400">
                          {it.potongan > 0 ? `-${formatRupiah(it.potongan)}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-emerald-400">
                          {formatRupiah(it.subtotal)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(idx);
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Summary Panel */}
        <div className="col-span-4 flex flex-col gap-3">
          {/* Grand Total Big Display */}
          <div className="bg-zinc-900 border-2 border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between shrink-0 shadow-xl shadow-emerald-950/20">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
              TOTAL TAGIHAN BELANJA
            </span>
            <div className="text-4xl 2xl:text-5xl font-black text-white font-mono tracking-tight my-2">
              {formatRupiah(grandTotal)}
            </div>
            <div className="text-xs text-zinc-400 flex justify-between border-t border-zinc-800 pt-2">
              <span>Jumlah Item: {formatNumber(items.reduce((s, it) => s + it.qty, 0))} Pcs</span>
              <span>Pajak PPN (11%): Termasuk</span>
            </div>
          </div>

          {/* Breakdown Details Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex-1 flex flex-col justify-between text-xs space-y-3">
            <div className="space-y-2.5">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal Barang:</span>
                <span className="font-mono text-white font-semibold">{formatRupiah(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-zinc-400 items-center">
                <span>Diskon Faktur (Nota):</span>
                <span className="font-mono text-red-400 font-semibold">
                  {discountNota > 0 ? `-${formatRupiah(discountNota)}` : "Rp 0"}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>PPN 11%:</span>
                <span className="font-mono text-white font-semibold">{formatRupiah(getTaxAmount())}</span>
              </div>
            </div>

            {/* Main Action Checkout Button */}
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => setIsTenderOpen(true)}
              className={`w-full py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center space-x-2 shadow-2xl transition-all ${
                items.length === 0
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700"
                  : "bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-zinc-950 shadow-emerald-500/30 cursor-pointer"
              }`}
            >
              <DollarSign className="w-6 h-6 stroke-[3]" />
              <span>BAYAR SEKARANG [F8]</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Keyboard Shortcut Bottom Bar */}
      <footer className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 font-medium">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F1</kbd> Bantuan</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F2</kbd> Cari Barang</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F3</kbd> Ubah Qty</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F5</kbd> Diskon Item</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F7</kbd> Ganti Pelanggan</span>
          <span><kbd className="font-mono bg-emerald-600 px-1.5 py-0.5 rounded text-white font-bold">F8</kbd> Bayar Kasir</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">F9</kbd> Cetak Ulang</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">Del</kbd> Hapus Baris</span>
          <span><kbd className="font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-white font-bold">Esc</kbd> Reset / Batal</span>
        </div>
      </footer>

      {/* Modals & Print Area */}
      <ItemSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectItem={(item) => {
          addItem({
            kodeitem: item.kodeitem,
            namaitem: item.namaitem,
            satuan: item.satuan || "PCS",
            qty: 1,
            harga: Number(item.hargajual || item.hargajual1 || 0),
            potongan: 0,
          });
        }}
      />

      <CustomerModal
        isOpen={isCustomerOpen}
        onClose={() => setIsCustomerOpen(false)}
        onSelectCustomer={handleCustomerSelect}
        currentCustomerKode={customer.kode}
      />

      <TenderModal
        isOpen={isTenderOpen}
        grandTotal={grandTotal}
        onClose={() => setIsTenderOpen(false)}
        onConfirm={handlePaymentSuccess}
      />

      {/* Hidden Receipt Component for @media print */}
      <ReceiptPrint data={receiptData} />

      {/* F1 Help Modal */}
      {isHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Panduan Pintasan Tombol POS</h3>
              </div>
              <button onClick={() => setIsHelpOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Scan Barcode / Kode:</span>
                <span className="font-mono font-bold text-white">Langsung ketik lalu [Enter]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Pencarian Barang Manual:</span>
                <span className="font-mono font-bold text-emerald-400">[F2]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Ubah Kuantitas (Qty):</span>
                <span className="font-mono font-bold text-emerald-400">[F3]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Potongan / Diskon Item:</span>
                <span className="font-mono font-bold text-emerald-400">[F5]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Ganti Pelanggan:</span>
                <span className="font-mono font-bold text-emerald-400">[F7]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Bayar & Checkout:</span>
                <span className="font-mono font-bold text-emerald-400">[F8]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Cetak Ulang Struk:</span>
                <span className="font-mono font-bold text-emerald-400">[F9]</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Hapus Baris Terpilih:</span>
                <span className="font-mono font-bold text-red-400">[Delete]</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Navigasi Baris Keranjang:</span>
                <span className="font-mono font-bold text-white">[Panah Atas / Bawah]</span>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
            >
              Tutup [Esc]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
