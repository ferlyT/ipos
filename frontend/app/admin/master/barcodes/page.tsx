"use client";

import { useState, useEffect, useRef } from "react";
import { api, normalizePaginated } from "@/lib/api-client";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import {
  Barcode,
  Printer,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  RefreshCw,
  Settings,
  Layers,
  Sparkles,
  Grid,
  Tag,
  Store,
  Calendar,
} from "lucide-react";

interface PrintQueueItem {
  kodeitem: string;
  namaitem: string;
  barcode: string;
  satuan: string;
  hargajual: number;
  qtyToPrint: number;
}

// Lightweight Code 128 SVG generator using character hash patterns
function BarcodeSVG({ code, width = 160, height = 45 }: { code: string; width?: number; height?: number }) {
  // Generate consistent pseudo barcode bar pattern based on char codes
  const bars: { x: number; w: number }[] = [];
  let currentX = 5;
  const totalWidth = width - 10;
  const hash = code || "0000000000";

  let i = 0;
  while (currentX < totalWidth - 6) {
    const charCode = hash.charCodeAt(i % hash.length) + i;
    const barW = (charCode % 3) + 1;
    const spaceW = ((charCode >> 1) % 3) + 1;
    bars.push({ x: currentX, w: barW });
    currentX += barW + spaceW;
    i++;
  }

  return (
    <svg width={width} height={height} className="mx-auto block" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" />
      {bars.map((b, idx) => (
        <rect key={idx} x={b.x} y={2} width={b.w} height={height - 4} fill="#000000" />
      ))}
    </svg>
  );
}

export default function BarcodeDesignerPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Design & Label Configurations
  const [storeName, setStoreName] = useState<string>("IPOS 4.0 STORE");
  const [template, setTemplate] = useState<"shelf" | "compact" | "sheet">("shelf");
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showBarcodeText, setShowBarcodeText] = useState<boolean>(true);
  const [showDate, setShowDate] = useState<boolean>(true);
  const [currentDateStr, setCurrentDateStr] = useState<string>("30/10/26");

  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
      })
    );
  }, []);

  const loadCatalog = async (
    targetPage: number = page,
    targetLimit: number = pageSize,
    targetSearch: string = search
  ) => {
    setLoading(true);
    try {
      const res = await api.master.getBarcodeCatalog(targetSearch, targetLimit, targetPage);
      const paginated = normalizePaginated<any>(res, targetPage, targetLimit);
      setCatalog(paginated.items);
      setTotalItems(paginated.pagination.total);
      setTotalPages(paginated.pagination.totalPages);
      setPage(paginated.pagination.page);
    } catch (err) {
      console.error("Gagal memuat katalog barcode:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog(1, pageSize, "");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCatalog(1, pageSize, search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadCatalog(newPage, pageSize, search);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadCatalog(1, newSize, search);
  };

  const addToQueue = (item: any) => {
    setQueue((prev) => {
      const existing = prev.find((q) => q.kodeitem === item.kodeitem);
      if (existing) {
        return prev.map((q) =>
          q.kodeitem === item.kodeitem ? { ...q, qtyToPrint: q.qtyToPrint + 1 } : q
        );
      }
      return [
        ...prev,
        {
          kodeitem: item.kodeitem,
          namaitem: item.namaitem,
          barcode: item.barcode || item.kodeitem,
          satuan: item.satuan || "PCS",
          hargajual: Number(item.hargajual || 0),
          qtyToPrint: 1,
        },
      ];
    });
  };

  const updateQueueQty = (kodeitem: string, qty: number) => {
    setQueue((prev) =>
      prev.map((q) => (q.kodeitem === kodeitem ? { ...q, qtyToPrint: Math.max(1, qty) } : q))
    );
  };

  const removeFromQueue = (kodeitem: string) => {
    setQueue((prev) => prev.filter((q) => q.kodeitem !== kodeitem));
  };

  const clearQueue = () => setQueue([]);

  const addAllToQueue = () => {
    catalog.forEach((item) => addToQueue(item));
  };

  const handlePrint = () => {
    window.print();
  };

  // Flatten queue items according to qtyToPrint for physical label rendering
  const flattenedLabels: PrintQueueItem[] = [];
  queue.forEach((item) => {
    for (let i = 0; i < item.qtyToPrint; i++) {
      flattenedLabels.push(item);
    }
  });

  return (
    <div className="space-y-6">
      {/* Title & Print Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Barcode className="w-6 h-6 text-emerald-400" />
            <span>Cetak Label Barcode & Price Tag Designer</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Desain dan cetak label rak harga (Shelf Tag), stiker barcode produk, atau lembar stiker A4 multi-kolom langsung ke printer barcode/laser.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handlePrint}
            disabled={flattenedLabels.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak {flattenedLabels.length} Label Sekarang</span>
          </button>
        </div>
      </div>

      {/* Main Studio: Left Catalog & Settings, Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left Column (5 spans): Catalog Selector & Print Queue */}
        <div className="lg:col-span-5 space-y-4">
          {/* Catalog Search & Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span>Pilih Barang dari Katalog (3.109 SKU)</span>
              </span>
              <button
                onClick={addAllToQueue}
                disabled={catalog.length === 0}
                className="text-[11px] font-bold text-emerald-400 hover:underline"
              >
                + Tambah Semua ({catalog.length})
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama barang, kode SKU, atau barcode..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </form>

            <div className="overflow-y-auto max-h-60 space-y-1.5 pr-1">
              {loading ? (
                <div className="py-8 text-center text-zinc-500 text-xs">Memuat katalog...</div>
              ) : catalog.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">Barang tidak ditemukan.</div>
              ) : (
                catalog.map((it: any) => (
                  <div
                    key={it.kodeitem}
                    className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between hover:border-zinc-700 transition-all text-xs"
                  >
                    <div className="max-w-[220px]">
                      <div className="font-bold text-white truncate">{it.namaitem}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        {it.kodeitem} &bull; {it.barcode}
                      </div>
                      <div className="font-mono font-bold text-emerald-400 text-[11px] mt-0.5">
                        {formatRupiah(it.hargajual)} / {it.satuan}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToQueue(it)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Pilih</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              disabled={loading}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>

          {/* Print Queue List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Antrean Label ({queue.length} SKU, Total {flattenedLabels.length} Lembar)</span>
              </span>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-[11px] text-red-400 font-bold hover:underline"
                >
                  Kosongkan
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-56 space-y-2 pr-1">
              {queue.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                  Pilih barang di atas untuk menambahkan ke antrean cetak label.
                </div>
              ) : (
                queue.map((q) => (
                  <div
                    key={q.kodeitem}
                    className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="max-w-[190px]">
                      <div className="font-bold text-white truncate">{q.namaitem}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{q.barcode}</div>
                      <div className="text-[11px] font-mono text-emerald-400 font-bold">
                        {formatRupiah(q.hargajual)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-zinc-500">Jml:</span>
                        <input
                          type="number"
                          min={1}
                          value={q.qtyToPrint}
                          onChange={(e) => updateQueueQty(q.kodeitem, parseInt(e.target.value) || 1)}
                          className="w-12 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-center font-mono font-bold text-white text-xs"
                        />
                      </div>
                      <button
                        onClick={() => removeFromQueue(q.kodeitem)}
                        className="p-1 text-zinc-500 hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Design Layout Options */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 text-xs">
            <div className="font-bold text-white flex items-center space-x-1.5">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Pengaturan Format & Tampilan Label</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Pilih Format / Ukuran Label:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplate("shelf")}
                  className={`p-2 rounded-xl text-center border font-bold transition-all ${
                    template === "shelf"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-[10px]">Tag Rak Toko</div>
                  <div className="text-[9px] font-mono text-zinc-500">65 x 35 mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplate("compact")}
                  className={`p-2 rounded-xl text-center border font-bold transition-all ${
                    template === "compact"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-[10px]">Stiker Produk</div>
                  <div className="text-[9px] font-mono text-zinc-500">40 x 20 mm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplate("sheet")}
                  className={`p-2 rounded-xl text-center border font-bold transition-all ${
                    template === "sheet"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="text-[10px]">Lembar A4 (30)</div>
                  <div className="text-[9px] font-mono text-zinc-500">T&J 108</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Nama Toko / Header:
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-zinc-300">Tampil Harga</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBarcodeText}
                  onChange={(e) => setShowBarcodeText(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-zinc-300">Teks Barcode</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span className="text-zinc-300">Tgl Cetak</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column (7 spans): Live Visual Preview Canvas */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Pratinjau Hasil Cetak Langsung</span>
            </span>
            <span className="text-zinc-500 font-mono">
              {flattenedLabels.length} Label Siap Cetak
            </span>
          </div>

          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-y-auto max-h-[600px] flex items-start justify-center">
            {flattenedLabels.length === 0 ? (
              <div className="py-20 text-center text-zinc-500 space-y-2">
                <Barcode className="w-12 h-12 text-zinc-700 mx-auto" />
                <p className="text-xs">Antrean cetak kosong. Tambahkan barang dari katalog di sebelah kiri.</p>
              </div>
            ) : (
              <div
                className={`grid gap-3 w-full ${
                  template === "shelf"
                    ? "grid-cols-1 sm:grid-cols-2"
                    : template === "compact"
                    ? "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-3"
                }`}
              >
                {flattenedLabels.map((lbl, idx) => (
                  <div
                    key={idx}
                    className="bg-white text-zinc-900 p-2.5 rounded-lg shadow border border-zinc-300 flex flex-col justify-between"
                    style={{
                      minHeight: template === "shelf" ? "125px" : template === "compact" ? "85px" : "100px",
                    }}
                  >
                    {/* Header Toko */}
                    <div className="flex justify-between items-center text-[9px] font-bold text-zinc-600 border-b border-zinc-200 pb-0.5">
                      <span className="truncate">{storeName}</span>
                      {showDate && <span className="font-mono text-[8px]">{currentDateStr}</span>}
                    </div>

                    {/* Product Name */}
                    <div className="py-1">
                      <div className="font-bold text-[11px] leading-tight text-zinc-950 line-clamp-2">
                        {lbl.namaitem}
                      </div>
                      <div className="text-[9px] font-mono text-zinc-500">{lbl.kodeitem}</div>
                    </div>

                    {/* Barcode Graphics */}
                    <div className="py-0.5 text-center">
                      <BarcodeSVG
                        code={lbl.barcode}
                        width={template === "compact" ? 120 : 160}
                        height={template === "compact" ? 30 : 38}
                      />
                      {showBarcodeText && (
                        <div className="font-mono text-[9px] tracking-widest text-zinc-700 mt-0.5 font-bold">
                          {lbl.barcode}
                        </div>
                      )}
                    </div>

                    {/* Price Tag Footer */}
                    {showPrice && (
                      <div className="pt-1 border-t border-zinc-200 flex justify-between items-baseline">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">{lbl.satuan}</span>
                        <div className="font-black text-sm text-zinc-950 font-mono">
                          {formatRupiah(lbl.hargajual)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== DIRECT PRINT ONLY CONTAINER (@media print) ===================== */}
      <div className="hidden print:block w-full bg-white text-zinc-900 p-0 m-0">
        <div
          className={`grid gap-2 ${
            template === "shelf"
              ? "grid-cols-2"
              : template === "compact"
              ? "grid-cols-3"
              : "grid-cols-3"
          }`}
          style={{ width: "100%" }}
        >
          {flattenedLabels.map((lbl, idx) => (
            <div
              key={idx}
              className="bg-white text-zinc-900 p-2 border border-zinc-400 flex flex-col justify-between break-inside-avoid"
              style={{
                minHeight: template === "shelf" ? "125px" : template === "compact" ? "85px" : "100px",
              }}
            >
              <div className="flex justify-between items-center text-[9px] font-bold text-zinc-700 border-b border-zinc-300 pb-0.5">
                <span className="truncate">{storeName}</span>
                {showDate && <span className="font-mono text-[8px]">{currentDateStr}</span>}
              </div>

              <div className="py-1">
                <div className="font-bold text-[11px] leading-tight text-zinc-950 line-clamp-2">
                  {lbl.namaitem}
                </div>
                <div className="text-[9px] font-mono text-zinc-600">{lbl.kodeitem}</div>
              </div>

              <div className="py-0.5 text-center">
                <BarcodeSVG
                  code={lbl.barcode}
                  width={template === "compact" ? 120 : 155}
                  height={template === "compact" ? 28 : 36}
                />
                {showBarcodeText && (
                  <div className="font-mono text-[9px] tracking-widest text-zinc-800 font-bold">
                    {lbl.barcode}
                  </div>
                )}
              </div>

              {showPrice && (
                <div className="pt-0.5 border-t border-zinc-300 flex justify-between items-baseline">
                  <span className="text-[9px] font-bold text-zinc-600">{lbl.satuan}</span>
                  <div className="font-black text-sm text-zinc-950 font-mono">
                    {formatRupiah(lbl.hargajual)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
