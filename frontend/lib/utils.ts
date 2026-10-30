import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "Rp 0";
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return "0";
  }
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("id-ID").format(num);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
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
