import { describe, it, expect, beforeEach } from "vitest";
import { usePosCartStore } from "../pos-cart.store";

describe("usePosCartStore", () => {
  beforeEach(() => {
    usePosCartStore.getState().clearCart();
  });

  it("should initialize with default empty state", () => {
    const state = usePosCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.selectedIndex).toBe(0);
    expect(state.discountNota).toBe(0);
    expect(state.taxPercent).toBe(11);
    expect(state.customer.kode).toBe("UMUM");
    expect(state.getSubtotal()).toBe(0);
    expect(state.getTaxAmount()).toBe(0);
    expect(state.getGrandTotal()).toBe(0);
  });

  it("should add a new item and calculate subtotal correctly", () => {
    const { addItem, getSubtotal, getTaxAmount, getGrandTotal } = usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Indomie Goreng",
      satuan: "PCS",
      qty: 2,
      harga: 3500,
      potongan: 500,
    });

    const state = usePosCartStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].kodeitem).toBe("BRG001");
    expect(state.items[0].qty).toBe(2);
    // Subtotal = 2 * 3500 - 500 = 6500
    expect(state.items[0].subtotal).toBe(6500);
    expect(getSubtotal()).toBe(6500);

    // Tax 11% dari 6500 = 715
    expect(getTaxAmount()).toBe(715);
    // Grand Total = 6500 + 715 = 7215
    expect(getGrandTotal()).toBe(7215);
  });

  it("should aggregate quantity if same item with same unit is added again", () => {
    const { addItem } = usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Indomie Goreng",
      satuan: "PCS",
      qty: 2,
      harga: 3500,
      potongan: 0,
    });

    addItem({
      kodeitem: "BRG001",
      namaitem: "Indomie Goreng",
      satuan: "PCS",
      qty: 3,
      harga: 3500,
      potongan: 0,
    });

    const state = usePosCartStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].qty).toBe(5);
    expect(state.items[0].subtotal).toBe(17500);
  });

  it("should create separate cart rows if same item has different unit", () => {
    const { addItem } = usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Indomie Goreng",
      satuan: "PCS",
      qty: 2,
      harga: 3500,
      potongan: 0,
    });

    addItem({
      kodeitem: "BRG001",
      namaitem: "Indomie Goreng",
      satuan: "DUS",
      qty: 1,
      harga: 130000,
      potongan: 0,
    });

    const state = usePosCartStore.getState();
    expect(state.items.length).toBe(2);
    expect(state.items[0].satuan).toBe("PCS");
    expect(state.items[1].satuan).toBe("DUS");
  });

  it("should update quantity and auto-remove when qty <= 0", () => {
    const { addItem, updateQty } = usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Kopi Hitam",
      satuan: "PCS",
      qty: 2,
      harga: 5000,
      potongan: 0,
    });

    updateQty(0, 4);
    let state = usePosCartStore.getState();
    expect(state.items[0].qty).toBe(4);
    expect(state.items[0].subtotal).toBe(20000);

    // Update qty to 0 -> should remove item
    updateQty(0, 0);
    state = usePosCartStore.getState();
    expect(state.items.length).toBe(0);
  });

  it("should calculate discountNota and update tax & grand total correctly", () => {
    const { addItem, setDiscountNota, getSubtotal, getTaxAmount, getGrandTotal } =
      usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Barang A",
      satuan: "PCS",
      qty: 10,
      harga: 10000,
      potongan: 0,
    });

    expect(getSubtotal()).toBe(100000);

    // Beri diskon nota Rp 20.000 -> DPP = 80.000
    setDiscountNota(20000);
    expect(usePosCartStore.getState().discountNota).toBe(20000);

    // Tax 11% dari 80.000 = 8.800
    expect(getTaxAmount()).toBe(8800);
    // Grand Total = 80.000 + 8.800 = 88.800
    expect(getGrandTotal()).toBe(88800);
  });

  it("should reset all fields on clearCart", () => {
    const { addItem, setDiscountNota, setCustomer, clearCart } = usePosCartStore.getState();

    addItem({
      kodeitem: "BRG001",
      namaitem: "Barang A",
      satuan: "PCS",
      qty: 1,
      harga: 10000,
      potongan: 0,
    });
    setDiscountNota(5000);
    setCustomer({ kode: "CUST-01", nama: "PT Toko Makmur", grup: "Grosir" });

    clearCart();

    const state = usePosCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.discountNota).toBe(0);
    expect(state.customer.kode).toBe("UMUM");
    expect(state.customer.nama).toBe("PELANGGAN UMUM");
  });
});
