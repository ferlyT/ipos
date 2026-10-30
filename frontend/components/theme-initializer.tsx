"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme.store";

export function ThemeInitializer() {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const applyThemeToDom = useThemeStore((s) => s.applyThemeToDom);

  useEffect(() => {
    applyThemeToDom(currentTheme);
  }, [currentTheme, applyThemeToDom]);

  return null;
}
