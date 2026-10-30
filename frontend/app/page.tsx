import Link from "next/link";
import { Monitor, LayoutDashboard, Database, Server, Store, ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6 md:p-12 font-sans">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-950/60">
            iP
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>iPos 4.0 Modern Enterprise</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                v1.0 Enterprise
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Sistem POS Ritel & Akuntansi Terintegrasi PostgreSQL 8.4
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
            <Store className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-300 font-semibold">CV. BARUNA ARTHA LESTARI</span>
          </div>
        </div>
      </header>

      {/* Main Choice Portal */}
      <main className="max-w-4xl mx-auto w-full my-auto py-12">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Pilih Mode Akses Sistem
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            Akses antarmuka kasir cepat untuk transaksi kasir atau portal backoffice untuk analitik dan pengelolaan data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: POS Kasir */}
          <Link
            href="/pos"
            className="group relative bg-zinc-900/80 hover:bg-zinc-850 border-2 border-zinc-800 hover:border-emerald-500 rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-emerald-950/40 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Monitor className="w-7 h-7" />
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Layar Penuh Kasir
                </span>
                <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                  Dedicated POS Terminal
                </h3>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Antarmuka kasir toko berkecepatan tinggi dengan 100% kontrol keyboard (<kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded">F1</kbd>-<kbd className="font-mono bg-zinc-800 px-1 py-0.5 rounded">F12</kbd>), barcode scanner otomatis, dan cetak struk kasir thermal 58mm/80mm.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-zinc-800/80 flex items-center justify-between font-bold text-sm text-emerald-400">
              <span>Buka Terminal Kasir [F8]</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Backoffice ERP */}
          <Link
            href="/admin/dashboard"
            className="group relative bg-zinc-900/80 hover:bg-zinc-850 border-2 border-zinc-800 hover:border-indigo-500 rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-indigo-950/40 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <LayoutDashboard className="w-7 h-7" />
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                  Manajemen & Analitik
                </span>
                <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                  Backoffice & Executive BI
                </h3>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Dashboard finansial real-time, grafik tren omzet tahun 2026, analisis profitabilitas per item, kontrol inventaris Pareto ABC, dead stock mengendap, dan katalog master barang.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-zinc-800/80 flex items-center justify-between font-bold text-sm text-indigo-400">
              <span>Masuk Portal Backoffice</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>

      {/* Footer System Status Bar */}
      <footer className="border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>PostgreSQL: <strong>i4_barunatrial (Port 5444)</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1.5">
            <Server className="w-4 h-4 text-emerald-500" />
            <span>REST API: <strong>Bun 1.3 (Port 3001)</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-zinc-400" />
          <span>Arsitektur Rekonstruksi Resmi iPos 4.0</span>
        </div>
      </footer>
    </div>
  );
}
