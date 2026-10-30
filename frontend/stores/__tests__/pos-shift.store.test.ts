import { describe, it, expect, beforeEach } from "vitest";
import { usePosShiftStore } from "../pos-shift.store";

describe("usePosShiftStore", () => {
  beforeEach(() => {
    usePosShiftStore.getState().closeShift();
  });

  it("should support openShift and closeShift lifecycle", () => {
    expect(usePosShiftStore.getState().currentShift).toBeNull();

    // Open Shift
    usePosShiftStore.getState().openShift({
      idkasir: 10,
      user: "KASIR-TEST",
      kantor: "CABANG-01",
      shift: 2,
      modalAwal: 300000,
      openedAt: "2026-10-30T08:00:00Z",
    });

    const shift = usePosShiftStore.getState().currentShift;
    expect(shift).not.toBeNull();
    expect(shift?.idkasir).toBe(10);
    expect(shift?.user).toBe("KASIR-TEST");
    expect(shift?.modalAwal).toBe(300000);
    expect(shift?.isActive).toBe(true);

    // Close Shift
    usePosShiftStore.getState().closeShift();
    expect(usePosShiftStore.getState().currentShift).toBeNull();
  });
});
