import { create } from "zustand";

export interface CashierShift {
  idkasir: number;
  user: string;
  kantor: string;
  shift: number;
  modalAwal: number;
  openedAt: string;
  isActive: boolean;
}

interface PosShiftState {
  currentShift: CashierShift | null;
  setShift: (shift: CashierShift | null) => void;
  openShift: (data: Omit<CashierShift, "isActive">) => void;
  closeShift: () => void;
}

export const usePosShiftStore = create<PosShiftState>((set) => ({
  currentShift: {
    idkasir: 1,
    user: "KASIR-01",
    kantor: "UTM",
    shift: 1,
    modalAwal: 500000,
    openedAt: new Date().toISOString(),
    isActive: true,
  },
  setShift: (shift) => set({ currentShift: shift }),
  openShift: (data) =>
    set({
      currentShift: {
        ...data,
        isActive: true,
      },
    }),
  closeShift: () => set({ currentShift: null }),
}));
