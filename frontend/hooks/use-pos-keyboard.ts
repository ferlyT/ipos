import { useEffect } from "react";

export interface PosKeyboardHandlers {
  onF1?: () => void;
  onF2?: () => void;
  onF3?: () => void;
  onF4?: () => void;
  onF5?: () => void;
  onF7?: () => void;
  onF8?: () => void;
  onF9?: () => void;
  onF10?: () => void;
  onF12?: () => void;
  onEscape?: () => void;
  onDelete?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  enabled?: boolean;
}

export function usePosKeyboard(handlers: PosKeyboardHandlers) {
  const {
    onF1,
    onF2,
    onF3,
    onF4,
    onF5,
    onF7,
    onF8,
    onF9,
    onF10,
    onF12,
    onEscape,
    onDelete,
    onArrowUp,
    onArrowDown,
    enabled = true,
  } = handlers;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tombol fungsi F1 - F12
      switch (e.key) {
        case "F1":
          e.preventDefault();
          onF1?.();
          break;
        case "F2":
          e.preventDefault();
          onF2?.();
          break;
        case "F3":
          e.preventDefault();
          onF3?.();
          break;
        case "F4":
          e.preventDefault();
          onF4?.();
          break;
        case "F5":
          e.preventDefault();
          onF5?.();
          break;
        case "F7":
          e.preventDefault();
          onF7?.();
          break;
        case "F8":
          e.preventDefault();
          onF8?.();
          break;
        case "F9":
          e.preventDefault();
          onF9?.();
          break;
        case "F10":
          e.preventDefault();
          onF10?.();
          break;
        case "F12":
          e.preventDefault();
          onF12?.();
          break;
        case "Escape":
          e.preventDefault();
          onEscape?.();
          break;
        case "Delete":
          // Cek jika pengguna tidak sedang mengetik di input text
          if ((e.target as HTMLElement)?.tagName !== "INPUT") {
            e.preventDefault();
            onDelete?.();
          }
          break;
        case "ArrowUp":
          if ((e.target as HTMLElement)?.tagName !== "INPUT") {
            e.preventDefault();
            onArrowUp?.();
          }
          break;
        case "ArrowDown":
          if ((e.target as HTMLElement)?.tagName !== "INPUT") {
            e.preventDefault();
            onArrowDown?.();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onF1,
    onF2,
    onF3,
    onF4,
    onF5,
    onF7,
    onF8,
    onF9,
    onF10,
    onF12,
    onEscape,
    onDelete,
    onArrowUp,
    onArrowDown,
  ]);
}
