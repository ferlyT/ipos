"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Store,
  Monitor,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);

  // If already logged in, redirect
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (currentUser.role === "KASIR") {
        router.push("/pos");
      } else {
        router.push("/admin/dashboard");
      }
    }
  }, [isAuthenticated, currentUser, redirectUrl, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userid.trim() || !password) {
      setErrorMsg("Harap masukkan User ID dan kata sandi");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.auth.login(userid.trim().toUpperCase(), password);
      if (res && res.token && res.user) {
        setAuth(res.token, res.user, res.permissions);

        // Smart Role-Based Redirection
        if (redirectUrl) {
          router.push(redirectUrl);
        } else if (res.user.role === "KASIR") {
          router.push("/pos");
        } else {
          router.push("/admin/dashboard");
        }
      } else {
        setErrorMsg("Respon autentikasi tidak valid dari server");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "User ID atau kata sandi tidak valid");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUserid(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-7 md:p-8 shadow-2xl backdrop-blur-xl space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="text-2xl font-black tracking-tight text-white">Masuk Sistem</h2>
        <p className="text-xs text-slate-400">
          Masukkan identitas pengguna terdaftar iPos 4.0 untuk memulai sesi kerja.
        </p>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-600 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            User ID / Nama Pengguna:
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              required
              placeholder="Contoh: ADMIN atau KASIR"
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 transition"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Kata Sandi:
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="Masukkan kata sandi..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Memverifikasi Sesi...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Sistem</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Quick Access Account Presets */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
          Akses Cepat Pengujian (Demo Accounts):
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleQuickFill("ADMIN", "admin")}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group"
          >
            <div>
              <div className="font-bold text-white group-hover:text-emerald-400 font-mono text-[11px]">ADMIN</div>
              <div className="text-[10px] text-slate-400">Pass: admin</div>
            </div>
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill("KASIR", "kasir")}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group"
          >
            <div>
              <div className="font-bold text-white group-hover:text-emerald-400 font-mono text-[11px]">KASIR</div>
              <div className="text-[10px] text-slate-400">Pass: kasir</div>
            </div>
            <Monitor className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4 max-w-5xl mx-auto w-full">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-950/60 group-hover:scale-105 transition-transform">
            iP
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center space-x-2">
              <span>iPos 4.0 Modern Enterprise</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                Auth Gate
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">PostgreSQL 8.4 • CV. Baruna Artha Lestari</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main Login Card with Suspense */}
      <main className="max-w-md mx-auto w-full my-auto py-8">
        <Suspense fallback={
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span>Memuat formulir otentikasi...</span>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </main>

      {/* Footer Bar */}
      <footer className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 max-w-5xl mx-auto w-full gap-2">
        <div className="flex items-center gap-2 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sistem Keamanan JWT & BCrypt Terverifikasi (OWASP Standards)</span>
        </div>
        <Link href="/" className="text-[11px] text-slate-400 hover:text-white underline">
          Kembali ke Halaman Pemilihan Portal
        </Link>
      </footer>
    </div>
  );
}
