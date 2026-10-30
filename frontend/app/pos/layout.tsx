"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Store, User, Clock, LayoutDashboard, Monitor } from "lucide-react";

export default function PosLayout({ children }: { children: ReactNode }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Header Bar POS */}
      <header className="h-12 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-emerald-400 font-extrabold tracking-tight">
            <Monitor className="w-5 h-5" />
            <span className="text-base">iPos 4.0</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
              POS Terminal
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-700" />

          <div className="flex items-center space-x-1.5 text-xs text-zinc-300">
            <Store className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold">CV. BARUNA ARTHA LESTARI</span>
            <span className="text-[10px] text-zinc-400 font-mono">[Gudang: UTM]</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-xs text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kasir: <strong className="text-white">ADMIN / KASIR-01</strong></span>
            <span className="text-zinc-500">•</span>
            <span>Shift 1</span>
          </div>

          <div className="flex items-center space-x-1.5 text-xs font-mono text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-emerald-400">{time || "00:00:00"}</span>
          </div>

          <Link
            href="/admin/dashboard"
            className="flex items-center space-x-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1 rounded-md border border-zinc-700 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Portal Admin</span>
          </Link>
        </div>
      </header>

      {/* Main POS Content */}
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
