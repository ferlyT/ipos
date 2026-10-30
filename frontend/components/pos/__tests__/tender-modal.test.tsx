import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TenderModal } from "../tender-modal";

describe("TenderModal", () => {
  it("does not render when isOpen is false", () => {
    render(
      <TenderModal
        isOpen={false}
        grandTotal={100000}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders properly with grandTotal when open", () => {
    render(
      <TenderModal
        isOpen={true}
        grandTotal={75000}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Total Tagihan Belanja/i)).toBeInTheDocument();
    // Default payment method is TUNAI
    const tunaiRadio = screen.getByRole("radio", { name: /Tunai/i });
    expect(tunaiRadio).toHaveAttribute("aria-checked", "true");
  });

  it("calculates kembalian (change) accurately when amount paid exceeds total", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    render(
      <TenderModal
        isOpen={true}
        grandTotal={75000}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    );

    const input = screen.getByLabelText(/Jumlah Uang Diterima/i);
    await user.clear(input);
    await user.type(input, "100000");

    // Change should be 25.000
    expect(screen.getByText(/KEMBALIAN KASIR/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Proses & Cetak Struk/i });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);
    expect(handleConfirm).toHaveBeenCalledWith({
      method: "TUNAI",
      amountPaid: 100000,
      changeAmount: 25000,
    });
  });

  it("disables submit button and shows warning when payment is insufficient", async () => {
    const user = userEvent.setup();

    render(
      <TenderModal
        isOpen={true}
        grandTotal={100000}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/Jumlah Uang Diterima/i);
    await user.clear(input);
    await user.type(input, "50000");

    expect(screen.getByText(/UANG PEMBAYARAN KURANG/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Proses & Cetak Struk/i });
    expect(submitBtn).toBeDisabled();
  });

  it("calls onClose when Esc or Batal button is clicked", async () => {
    const handleClose = vi.fn();
    render(
      <TenderModal
        isOpen={true}
        grandTotal={50000}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    );

    const batalBtn = screen.getByRole("button", { name: /\[Esc\] Batal/i });
    fireEvent.click(batalBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
