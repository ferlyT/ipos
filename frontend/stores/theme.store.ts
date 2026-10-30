"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "dark-slate" | "light-clean" | "midnight-blue" | "emerald-pos";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  bgPreview: string;
  accentPreview: string;
}

export const AVAILABLE_THEMES: ThemeConfig[] = [
  {
    id: "dark-slate",
    name: "Dark Slate",
    description: "Hitam Arang Elegan (Default Enterprise)",
    bgPreview: "#09090b",
    accentPreview: "#10b981",
  },
  {
    id: "light-clean",
    name: "Light Clean",
    description: "Putih Terang Bersih (Operasional Siang Hari)",
    bgPreview: "#f8fafc",
    accentPreview: "#0284c7",
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    description: "Biru Navy Korporat (Deep Professional)",
    bgPreview: "#0b1329",
    accentPreview: "#38bdf8",
  },
  {
    id: "emerald-pos",
    name: "Emerald POS",
    description: "Hijau Ritel Kasir (Segar & Berenergi)",
    bgPreview: "#062018",
    accentPreview: "#34d399",
  },
];

interface ThemeState {
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  applyThemeToDom: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      currentTheme: "dark-slate",

      setTheme: (theme: ThemeId) => {
        set({ currentTheme: theme });
        get().applyThemeToDom(theme);
      },

      applyThemeToDom: (theme: ThemeId) => {
        if (typeof window === "undefined") return;
        const root = document.documentElement;
        root.setAttribute("data-theme", theme);

        // Remove old theme classes
        root.classList.remove("theme-dark-slate", "theme-light-clean", "theme-midnight-blue", "theme-emerald-pos", "dark", "light");

        // Add class
        root.classList.add(`theme-${theme}`);
        if (theme === "light-clean") {
          root.classList.add("light");
        } else {
          root.classList.add("dark");
        }
      },
    }),
    {
      name: "ipos_theme_storage",
    }
  )
);
