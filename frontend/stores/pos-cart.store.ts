import { create } from "zustand";

export interface CartItem {
  id: string;
  kodeitem: string;
  namaitem: string;
  satuan: string;
  qty: number;
  harga: number;
  potongan: number;
  subtotal: number;
}

export interface CustomerInfo {
  kode: string;
  nama: string;
  grup: string;
  telepon?: string;
  alamat?: string;
  poin?: number;
}

interface PosCartState {
  items: CartItem[];
  selectedIndex: number;
  customer: CustomerInfo;
  discountNota: number;
  taxPercent: number;
  
  // Actions
  addItem: (item: Omit<CartItem, "id" | "subtotal">) => void;
  setItems: (items: CartItem[]) => void;
  updateQty: (index: number, qty: number) => void;
  updatePrice: (index: number, harga: number) => void;
  updateDiscount: (index: number, potongan: number) => void;
  removeItem: (index: number) => void;
  setSelectedIndex: (idx: number) => void;
  setCustomer: (customer: CustomerInfo) => void;
  setDiscountNota: (amount: number) => void;
  clearCart: () => void;
  
  // Computed getters
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getGrandTotal: () => number;
}

export const usePosCartStore = create<PosCartState>((set, get) => ({
  items: [],
  selectedIndex: 0,
  customer: {
    kode: "UMUM",
    nama: "PELANGGAN UMUM",
    grup: "General",
  },
  discountNota: 0,
  taxPercent: 11,

  addItem: (newItem) => {
    set((state) => {
      const existingIdx = state.items.findIndex(
        (it) => it.kodeitem === newItem.kodeitem && it.satuan === newItem.satuan
      );

      if (existingIdx >= 0) {
        const updated = [...state.items];
        const current = updated[existingIdx];
        const newQty = current.qty + (newItem.qty || 1);
        updated[existingIdx] = {
          ...current,
          qty: newQty,
          subtotal: newQty * current.harga - current.potongan,
        };
        return { items: updated, selectedIndex: existingIdx };
      }

      const id = `${newItem.kodeitem}-${Date.now()}`;
      const qty = newItem.qty || 1;
      const subtotal = qty * newItem.harga - (newItem.potongan || 0);

      const items = [
        ...state.items,
        {
          ...newItem,
          id,
          qty,
          potongan: newItem.potongan || 0,
          subtotal,
        },
      ];

      return {
        items,
        selectedIndex: items.length - 1,
      };
    });
  },

  setItems: (items) => {
    set((state) => ({
      items,
      selectedIndex: Math.max(0, Math.min(state.selectedIndex, items.length - 1)),
    }));
  },

  updateQty: (index, qty) => {
    if (qty <= 0) {
      get().removeItem(index);
      return;
    }
    set((state) => {
      const updated = [...state.items];
      if (!updated[index]) return state;
      updated[index] = {
        ...updated[index],
        qty,
        subtotal: qty * updated[index].harga - updated[index].potongan,
      };
      return { items: updated };
    });
  },

  updatePrice: (index, harga) => {
    set((state) => {
      const updated = [...state.items];
      if (!updated[index]) return state;
      updated[index] = {
        ...updated[index],
        harga,
        subtotal: updated[index].qty * harga - updated[index].potongan,
      };
      return { items: updated };
    });
  },

  updateDiscount: (index, potongan) => {
    set((state) => {
      const updated = [...state.items];
      if (!updated[index]) return state;
      updated[index] = {
        ...updated[index],
        potongan,
        subtotal: updated[index].qty * updated[index].harga - potongan,
      };
      return { items: updated };
    });
  },

  removeItem: (index) => {
    set((state) => {
      const updated = state.items.filter((_, i) => i !== index);
      const newIdx = Math.max(0, Math.min(index, updated.length - 1));
      return { items: updated, selectedIndex: newIdx };
    });
  },

  setSelectedIndex: (idx) => set({ selectedIndex: idx }),
  setCustomer: (customer) => set({ customer }),
  setDiscountNota: (amount) => set({ discountNota: Math.max(0, amount) }),
  clearCart: () =>
    set({
      items: [],
      selectedIndex: 0,
      discountNota: 0,
      customer: { kode: "UMUM", nama: "PELANGGAN UMUM", grup: "General" },
    }),

  getSubtotal: () => {
    return get().items.reduce((sum, it) => sum + it.subtotal, 0);
  },

  getTaxAmount: () => {
    const subtotal = get().getSubtotal();
    const dpp = Math.max(0, subtotal - get().discountNota);
    return dpp * (get().taxPercent / 100);
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    const dpp = Math.max(0, subtotal - get().discountNota);
    return Math.round(dpp + get().getTaxAmount());
  },
}));
