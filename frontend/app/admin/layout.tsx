"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { useMounted } from "@/hooks/use-mounted";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  ReceiptText,
  Wallet,
  FileSpreadsheet,
  Monitor,
  Store,
  UserCheck,
  ArrowRightLeft,
  ClipboardCheck,
  PackageCheck,
  Coins,
  Tag,
  Users,
  BookOpen,
  Cpu,
  ShieldAlert,
  Barcode,
  Database,
  WalletCards,
  Sliders,
  Award,
  ShieldCheck,
  Layers,
  ClipboardList,
  MapPin,
  CalendarSync,
  LogOut,
} from "lucide-react";

const NAV_GROUPS = [
  {
    group: "Eksekutif & Master",
    items: [
      { href: "/admin/dashboard", label: "Executive BI", icon: LayoutDashboard },
      { href: "/admin/master/items", label: "Master Barang", icon: Package },
      { href: "/admin/master/contacts", label: "Master Kontak (PL/SU)", icon: Users },
      { href: "/admin/master/bom", label: "Perakitan Barang (BOM)", icon: Cpu },
      { href: "/admin/master/barcodes", label: "Cetak Label Barcode", icon: Barcode },
    ],
  },
  {
    group: "Logistik & Gudang",
    items: [
      { href: "/admin/wms/layout", label: "Denah Rak & WMS", icon: Layers },
      { href: "/admin/wms/tasks", label: "Tugas Gudang (Kanban)", icon: ClipboardList },
      { href: "/admin/wms/bins", label: "Master Lokasi Rak", icon: MapPin },
      { href: "/admin/inventory/stock", label: "Stok Multi-Gudang", icon: Boxes },
      { href: "/admin/inventory/transfer", label: "Transfer Antar-Gudang", icon: ArrowRightLeft },
      { href: "/admin/inventory/opname", label: "Stok Opname Fisik", icon: ClipboardCheck },
    ],
  },
  {
    group: "Perdagangan & Order",
    items: [
      { href: "/admin/purchasing/invoices", label: "Pembelian & Hutang", icon: ShoppingCart },
      { href: "/admin/sales/invoices", label: "Penjualan & Piutang", icon: Receipt },
      { href: "/admin/orders/backlog", label: "Backlog Pesanan (PO/SO)", icon: PackageCheck },
      { href: "/admin/orders/promotions", label: "Promosi & Diskon", icon: Tag },
      { href: "/admin/sales/loyalty", label: "Loyalitas Pelanggan", icon: Award },
    ],
  },
  {
    group: "Finansial & Akuntansi",
    items: [
      { href: "/admin/cash-bank/transactions", label: "Kas Masuk / Keluar", icon: Coins },
      { href: "/admin/cash-bank/accounts", label: "Saldo Kas & Bank", icon: Wallet },
      { href: "/admin/cash-bank/drawers", label: "Shift Laci Kasir", icon: WalletCards },
      { href: "/admin/accounting/profit-loss", label: "Laporan Akuntansi", icon: FileSpreadsheet },
      { href: "/admin/accounting/ledger", label: "Buku Besar Umum", icon: BookOpen },
      { href: "/admin/accounting/tax-report", label: "Laporan Pajak Penjualan", icon: ReceiptText },
    ],
  },
  {
    group: "Sistem & Konfigurasi",
    items: [
      { href: "/admin/system/period-closing", label: "Tutup Buku & Periode", icon: CalendarSync },
      { href: "/admin/system/users", label: "Pengguna & Server", icon: UserCheck },
      { href: "/admin/system/roles", label: "Hak Akses & Role Matrix", icon: ShieldCheck },
      { href: "/admin/system/audit", label: "Jejak Audit Forensik", icon: ShieldAlert },
      { href: "/admin/system/database", label: "Diagnostik Database", icon: Database },
      { href: "/admin/system/settings", label: "Konfigurasi Toko", icon: Sliders },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    toast.success("Berhasil keluar dari sesi");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans antialiased">
      {/* Sidebar Navigasi */}
      <aside aria-label="Menu Navigasi Administrator" className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="h-16 border-b border-zinc-800 px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              iP
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight text-white">iPos 4.0</div>
              <div className="text-[10px] text-zinc-400 font-mono">Modern Enterprise</div>
            </div>
          </div>
          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
            PG 8.4
          </span>
        </div>

        {/* Quick Launch POS Terminal */}
        <div className="p-3 border-b border-zinc-800/80">
          <Link
            href="/pos"
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition-all"
          >
            <Monitor className="w-4 h-4" />
            <span>BUKA KASIR POS [F8]</span>
          </Link>
        </div>

        {/* Navigation Menu Grouped */}
        <nav aria-label="Menu Modul Sistem" className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-3 mb-1.5">
                {grp.group}
              </div>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-zinc-800 text-emerald-400 font-bold border-l-3 border-emerald-500 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2 truncate">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="font-bold text-white leading-tight truncate" suppressHydrationWarning>
                {mounted && user ? user.nama : "ADMIN"}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono" suppressHydrationWarning>
                {mounted && user ? user.role : "Superuser"}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition"
            title="Keluar (Logout)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-zinc-900/50 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <Store className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold text-zinc-200">CV. BARUNA ARTHA LESTARI</span>
            <span>•</span>
            <span className="text-zinc-400">Database: i4_barunatrial (Port 5444)</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-700 font-mono font-semibold">
              Kantor: {mounted && user?.kantor ? user.kantor : "UTM"}
            </span>

            {/* Multi-Theme Selector */}
            <ThemeSwitcher />

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition text-xs font-semibold"
              title="Logout dari Sesi"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 bg-zinc-950 focus:outline-hidden">{children}</main>
      </div>
    </div>
  );
}
