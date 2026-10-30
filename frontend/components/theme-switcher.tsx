"use client";

import { useState, useRef, useEffect } from "react";
import { useThemeStore, AVAILABLE_THEMES, type ThemeId } from "@/stores/theme.store";
import { useMounted } from "@/hooks/use-mounted";
import { Palette, Check, Sparkles } from "lucide-react";

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useMounted();
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeThemeId = mounted ? currentTheme : "dark-slate";
  const activeThemeConfig = AVAILABLE_THEMES.find((t) => t.id === activeThemeId) || AVAILABLE_THEMES[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition shadow-sm hover:text-white"
        title="Ganti Tema Warna Antarmuka"
      >
        <div
          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner flex items-center justify-center"
          style={{ backgroundColor: activeThemeConfig.bgPreview }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeThemeConfig.accentPreview }}></div>
        </div>
        <span className="hidden sm:inline">{activeThemeConfig.name}</span>
        <Palette className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-950/95 border border-slate-800/90 shadow-2xl p-2.5 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 mb-1 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" /> Pilih Tema Sistem
            </span>
          </div>

          <div className="space-y-1">
            {AVAILABLE_THEMES.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition ${
                    isActive
                      ? "bg-slate-800/90 text-white font-bold ring-1 ring-emerald-500/50"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-5 rounded-lg border border-white/20 shadow-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: theme.bgPreview }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: theme.accentPreview }}
                      ></div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{theme.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">
                        {theme.description}
                      </div>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
