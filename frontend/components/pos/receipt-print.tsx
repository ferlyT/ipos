"use client";

import { forwardRef } from "react";
import { formatRupiah, formatDateTime } from "@/lib/utils";
import type { CartItem, CustomerInfo } from "@/stores/pos-cart.store";

export interface ReceiptData {
  noTransaksi: string;
  tanggal: string | Date;
  kasir: string;
  kantor: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  discountNota: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
}

interface ReceiptPrintProps {
  data: ReceiptData | null;
}

export const ReceiptPrint = forwardRef<HTMLDivElement, ReceiptPrintProps>(({ data }, ref) => {
  if (!data) return null;

  return (
    <div
      id="receipt-print-area"
      ref={ref}
      className="hidden print:block font-mono text-[11px] leading-tight text-black p-2 max-w-[80mm] mx-auto bg-white"
    >
      {/* Header Toko */}
      <div className="text-center mb-2">
        <h1 className="font-bold text-sm tracking-wide">CV. BARUNA ARTHA LESTARI</h1>
        <p className="text-[10px]">JL. CUMI RAYA BLOK B NO.1 MUARA BARU</p>
        <p className="text-[10px]">PELABUHAN MUARA BARU 14440</p>
        <p className="text-[10px]">TELP: (021) 666-0000</p>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* Info Transaksi */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>No: {data.noTransaksi}</span>
          <span>{data.kantor}</span>
        </div>
        <div className="flex justify-between">
          <span>Tgl: {formatDateTime(data.tanggal)}</span>
          <span>Kasir: {data.kasir}</span>
        </div>
        <div>
          <span>Pelanggan: {data.customer.nama}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* Daftar Item */}
      <div className="space-y-1 my-1">
        {data.items.map((item, idx) => (
          <div key={idx} className="text-[10px]">
            <div className="font-bold truncate">{item.namaitem}</div>
            <div className="flex justify-between pl-2">
              <span>
                {item.qty} {item.satuan} x {formatRupiah(item.harga)}
                {item.potongan > 0 ? ` (Disc: -${formatRupiah(item.potongan)})` : ""}
              </span>
              <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* Kalkulasi Total */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatRupiah(data.subtotal)}</span>
        </div>
        {data.discountNota > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Diskon Nota:</span>
            <span>-{formatRupiah(data.discountNota)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>PPN 11%:</span>
          <span>{formatRupiah(data.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-xs pt-0.5 border-t border-dotted border-black">
          <span>TOTAL:</span>
          <span>{formatRupiah(data.grandTotal)}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span>BAYAR ({data.paymentMethod}):</span>
          <span>{formatRupiah(data.amountPaid)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>KEMBALI:</span>
          <span>{formatRupiah(data.changeAmount)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-2" />

      {/* Footer Nota */}
      <div className="text-center text-[9px] space-y-0.5 pt-1">
        <p className="font-bold">*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
        <p>BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR / DIKEMBALIKAN</p>
        <p className="text-[8px] text-gray-500">iPos 4.0 Modern Enterprise POS Engine</p>
      </div>
    </div>
  );
});

ReceiptPrint.displayName = "ReceiptPrint";
