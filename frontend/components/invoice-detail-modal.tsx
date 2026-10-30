"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatNumber, formatDate, terbilang } from "@/lib/utils";
import { Printer, X, Download, FileText, CheckCircle2, Building, User, Calendar, MapPin, Phone } from "lucide-react";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "sales" | "purchasing" | "transfer";
  notransaksi: string | null;
}

export function InvoiceDetailModal({
  isOpen,
  onClose,
  type,
  notransaksi,
}: InvoiceDetailModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<{ header: any; items: any[] } | null>(null);
  const [viewMode, setViewMode] = useState<"a4" | "thermal">("a4");

  useEffect(() => {
    if (!isOpen || !notransaksi) {
      setData(null);
      return;
    }

    setLoading(true);
    const fetchDetail = async () => {
      try {
        let res: any;
        if (type === "sales") {
          res = await api.sales.getInvoiceDetail(notransaksi);
        } else if (type === "purchasing") {
          res = await api.purchasing.getInvoiceDetail(notransaksi);
        } else {
          res = await api.inventory.getTransferDetail(notransaksi);
        }
        setData(res);
      } catch (err) {
        console.error("Gagal memuat detail faktur:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, notransaksi, type]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const titleMap = {
    sales: "FAKTUR PENJUALAN",
    purchasing: "FAKTUR PEMBELIAN / PENERIMAAN BARANG",
    transfer: "SURAT JALAN MUTASI ANTAR GUDANG",
  };

  const header = data?.header;
  const items = data?.items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header (Non-printable) */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <span>{titleMap[type]}</span>
                {notransaksi && (
                  <span className="text-xs bg-zinc-800 text-emerald-400 font-mono px-2 py-0.5 rounded border border-zinc-700">
                    {notransaksi}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Pratinjau dokumen resmi dan format cetak langsung ke printer printer laser / thermal.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {type === "sales" && (
              <div className="bg-zinc-900 border border-zinc-800 p-0.5 rounded-xl flex mr-2">
                <button
                  type="button"
                  onClick={() => setViewMode("a4")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "a4"
                      ? "bg-zinc-800 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Format A4
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("thermal")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "thermal"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Thermal 80mm
                </button>
              </div>
            )}

            <button
              onClick={handlePrint}
              disabled={loading || !data}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-lg shadow-emerald-950"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Printable Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-900">
          {loading ? (
            <div className="py-20 text-center text-zinc-400 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Memuat data faktur...</p>
            </div>
          ) : !data || !header ? (
            <div className="py-20 text-center text-red-400">
              <p className="text-sm font-bold">Faktur tidak ditemukan atau gagal dimuat.</p>
            </div>
          ) : viewMode === "thermal" && type === "sales" ? (
            /* =================== THERMAL 80MM VIEW =================== */
            <div className="max-w-[340px] mx-auto bg-white text-zinc-900 font-mono text-[11px] p-4 rounded-xl shadow-xl border border-zinc-300 print:max-w-full print:p-0 print:border-none print:shadow-none">
              <div className="text-center pb-3 border-b border-dashed border-zinc-400 space-y-1">
                <div className="text-base font-black tracking-wide">IPOS 4.0 STORE</div>
                <div className="text-[10px] text-zinc-600">Jl. Industri Raya No. 88, Jakarta Pusat</div>
                <div className="text-[10px] text-zinc-600">Telp: (021) 555-0199 | NPWP: 01.234.567.8-012.000</div>
              </div>

              <div className="py-2.5 border-b border-dashed border-zinc-400 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>No. Faktur:</span>
                  <span className="font-bold">{header.notransaksi}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{formatDate(header.tanggal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir / User:</span>
                  <span>{header.kasir || "ADMIN"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-semibold">{header.namapelanggan || "KONSUMEN UMUM"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pembayaran:</span>
                  <span className="font-bold">{header.carabayar === "TN" ? "TUNAI" : "KREDIT / TEMPO"}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2 space-y-2 border-b border-dashed border-zinc-400">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold truncate">{it.namaitem || it.kodeitem}</div>
                    <div className="flex justify-between text-zinc-600">
                      <span>
                        {formatNumber(it.jumlah)} {it.satuan} x {formatNumber(it.harga)}
                        {Number(it.potongan) > 0 && ` (Disc -${formatNumber(it.potongan)})`}
                      </span>
                      <span className="font-bold text-zinc-900">{formatNumber(it.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2.5 border-b border-dashed border-zinc-400 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(header.subtotal)}</span>
                </div>
                {Number(header.potongan) > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Potongan Nota:</span>
                    <span>-{formatRupiah(header.potongan)}</span>
                  </div>
                )}
                {Number(header.pajak) > 0 && (
                  <div className="flex justify-between">
                    <span>PPN (11%):</span>
                    <span>{formatRupiah(header.pajak)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-300">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(header.totalakhir)}</span>
                </div>
              </div>

              <div className="pt-4 text-center text-[10px] text-zinc-500 space-y-1">
                <p className="font-bold">TERIMA KASIH ATAS KUNJUNGAN ANDA</p>
                <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa struk ini.</p>
              </div>
            </div>
          ) : (
            /* =================== FORM A4 / LETTER VIEW =================== */
            <div className="bg-white text-zinc-900 p-8 rounded-xl shadow-xl max-w-3xl mx-auto border border-zinc-300 print:border-none print:shadow-none print:p-0">
              {/* Company Header */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-zinc-900">
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight text-zinc-950">
                    PROGRAM KREATIF iPos 4.0
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Kawasan Niaga Sentra Bisnis Blok B-12, Jakarta Barat
                  </p>
                  <p className="text-xs text-zinc-600">
                    Telp: (021) 582-9988 | Email: billing@programkreatif.com
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-black text-emerald-800 uppercase tracking-wider">
                    {titleMap[type]}
                  </div>
                  <div className="text-xs font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300 inline-block">
                    {header.notransaksi}
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    Tgl: <span className="font-semibold">{formatDate(header.tanggal)}</span>
                  </div>
                </div>
              </div>

              {/* Recipient / Partner Details */}
              <div className="grid grid-cols-2 gap-6 py-4 border-b border-zinc-200 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">
                    {type === "sales" ? "Kepada Yth. Pelanggan:" : type === "purchasing" ? "Dari Yth. Supplier:" : "Gudang Asal:"}
                  </div>
                  <div className="font-black text-zinc-900 text-sm">
                    {type === "transfer"
                      ? `${header.namakantordari || header.kantordari} (KODE: ${header.kantordari})`
                      : header.namapelanggan || header.namasupel || "KONSUMEN UMUM"}
                  </div>
                  {(header.alamat || header.telepon) && (
                    <div className="text-zinc-600 mt-0.5 space-y-0.5">
                      {header.alamat && <div>{header.alamat}</div>}
                      {header.telepon && <div>Telp: {header.telepon}</div>}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-zinc-400 mb-1">
                    Informasi Transaksi:
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Kantor / Cabang:</span>
                    <span className="font-semibold">{header.kodekantor || "UTM"}</span>
                  </div>
                  {type === "transfer" && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Gudang Tujuan:</span>
                      <span className="font-black text-emerald-700">{header.namakantortujuan || header.kantortujuan}</span>
                    </div>
                  )}
                  {header.carabayar && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Metode Pembayaran:</span>
                      <span className="font-bold">
                        {header.carabayar === "TN" ? "Tunai / Cash" : "Kredit / Tempo"}
                      </span>
                    </div>
                  )}
                  {header.jatuhtempo && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Jatuh Tempo:</span>
                      <span className="font-bold text-red-600">{formatDate(header.jatuhtempo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Operator / User:</span>
                    <span className="font-semibold">{header.kasir || header.operator || "ADMIN"}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-900 text-zinc-600 uppercase text-[10px] font-bold">
                      <th className="py-2 px-1 w-8 text-center">No</th>
                      <th className="py-2 px-2">Kode Barang</th>
                      <th className="py-2 px-2">Nama Barang / Deskripsi</th>
                      <th className="py-2 px-2 text-right">Kuantitas</th>
                      <th className="py-2 px-2 text-center">Satuan</th>
                      {type !== "transfer" && (
                        <>
                          <th className="py-2 px-2 text-right">Harga</th>
                          <th className="py-2 px-2 text-right">Diskon</th>
                          <th className="py-2 px-2 text-right">Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="py-2 px-1 text-center font-mono text-zinc-500">{idx + 1}</td>
                        <td className="py-2 px-2 font-mono font-medium text-zinc-700">{it.kodeitem}</td>
                        <td className="py-2 px-2 font-bold text-zinc-900">{it.namaitem}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900">
                          {formatNumber(it.jumlah)}
                        </td>
                        <td className="py-2 px-2 text-center text-zinc-600">{it.satuan}</td>
                        {type !== "transfer" && (
                          <>
                            <td className="py-2 px-2 text-right font-mono text-zinc-700">
                              {formatRupiah(it.harga)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-zinc-500">
                              {Number(it.potongan) > 0 ? formatRupiah(it.potongan) : "-"}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-black text-zinc-900">
                              {formatRupiah(it.total)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Terbilang */}
              {type !== "transfer" && (
                <div className="pt-4 border-t-2 border-zinc-900 grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Terbilang:</div>
                    <div className="text-xs italic font-serif font-bold text-zinc-800 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      "{terbilang(header.totalakhir)}"
                    </div>
                    {header.keterangan && (
                      <div className="text-xs text-zinc-500">
                        <span className="font-bold">Keterangan:</span> {header.keterangan}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-right">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Subtotal:</span>
                      <span className="font-mono font-bold">{formatRupiah(header.subtotal)}</span>
                    </div>
                    {Number(header.potongan) > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Potongan Faktur:</span>
                        <span className="font-mono text-red-600">-{formatRupiah(header.potongan)}</span>
                      </div>
                    )}
                    {Number(header.pajak) > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>PPN (11%):</span>
                        <span className="font-mono font-bold">{formatRupiah(header.pajak)}</span>
                      </div>
                    )}
                    {Number(header.biayalain) > 0 && (
                      <div className="flex justify-between text-zinc-600">
                        <span>Biaya Lain-Lain:</span>
                        <span className="font-mono font-bold">{formatRupiah(header.biayalain)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black pt-2 border-t-2 border-zinc-900 text-zinc-950">
                      <span>TOTAL AKHIR:</span>
                      <span className="font-mono text-emerald-800">{formatRupiah(header.totalakhir)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div className="mt-8 pt-6 border-t border-zinc-200 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="text-zinc-500 mb-14">Tanda Terima / Penerima,</div>
                  <div className="font-bold border-t border-zinc-400 pt-1 text-zinc-800">
                    ( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-14">Bagian Gudang / Ekspedisi,</div>
                  <div className="font-bold border-t border-zinc-400 pt-1 text-zinc-800">
                    ( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-14">Hormat Kami / Kasir,</div>
                  <div className="font-bold border-t border-zinc-400 pt-1 text-zinc-800">
                    {header.kasir || header.operator || "ADMIN"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
