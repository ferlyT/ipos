import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_MAP: Record<string, { symbol: string; locale: string; decimals?: number }> = {
  IDR: { symbol: "Rp", locale: "id-ID", decimals: 2 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  SGD: { symbol: "S$", locale: "en-SG", decimals: 2 },
  MYR: { symbol: "RM", locale: "ms-MY", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2 },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2 },
  JPY: { symbol: "¥", locale: "ja-JP", decimals: 0 },
  AUD: { symbol: "A$", locale: "en-AU", decimals: 2 },
  CNY: { symbol: "¥", locale: "zh-CN", decimals: 2 },
};

export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCode: string = "IDR",
  decimals: number = 2
): string {
  const curr = (currencyCode || "IDR").toUpperCase();
  const cfg = CURRENCY_MAP[curr];
  const dec = cfg?.decimals !== undefined ? cfg.decimals : decimals;

  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    const sym = cfg ? cfg.symbol : curr;
    return dec > 0 ? `${sym} 0,${"0".repeat(dec)}` : `${sym} 0`;
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (cfg) {
    const formatted = new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(num);

    return `${cfg.symbol} ${formatted}`;
  }

  // Fallback mata uang kustom/lainnya
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return `${curr} ${formatted}`;
}

export function formatRupiah(amount: number | string | null | undefined, decimals: number = 2): string {
  return formatCurrency(amount, "IDR", decimals);
}

export function formatNumber(val: number | string | null | undefined, decimals: number = 2): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return decimals > 0 ? `0,${"0".repeat(decimals)}` : "0";
  }
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  let d: Date;
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, day] = dateStr.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function terbilang(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "Nol Rupiah";
  const num = Math.floor(Math.abs(Number(n) || 0));
  if (num === 0) return "Nol Rupiah";

  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

  function toWords(x: number): string {
    if (x < 12) return satuan[x];
    if (x < 20) return toWords(x - 10) + " Belas";
    if (x < 100) return toWords(Math.floor(x / 10)) + " Puluh " + toWords(x % 10);
    if (x < 200) return "Seratus " + toWords(x - 100);
    if (x < 1000) return toWords(Math.floor(x / 100)) + " Ratus " + toWords(x % 100);
    if (x < 2000) return "Seribu " + toWords(x - 1000);
    if (x < 1000000) return toWords(Math.floor(x / 1000)) + " Ribu " + toWords(x % 1000);
    if (x < 1000000000) return toWords(Math.floor(x / 1000000)) + " Juta " + toWords(x % 1000000);
    if (x < 1000000000000) return toWords(Math.floor(x / 1000000000)) + " Miliar " + toWords(x % 1000000000);
    return toWords(Math.floor(x / 1000000000000)) + " Triliun " + toWords(x % 1000000000000);
  }

  return toWords(num).replace(/\s+/g, " ").trim() + " Rupiah";
}
