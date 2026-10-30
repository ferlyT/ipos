import { test, expect } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

test.describe("POS Cashier Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all API calls and provide CORS headers + mocked data
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const url = req.url();

      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (url.includes("/api/master/barcode")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              kodeitem: "BRG001",
              namaitem: "Kopi Kapal Api Special",
              satuan: "PCS",
              hargajual: 5000,
              hargajual1: 5000,
            },
          }),
        });
        return;
      }

      if (url.includes("/api/master/items")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                kodeitem: "BRG001",
                namaitem: "Kopi Kapal Api Special",
                satuan: "PCS",
                hargajual: 5000,
              },
            ],
          }),
        });
        return;
      }

      if (url.includes("/api/master/resolve-price")) {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              finalUnitPrice: 5000,
              tierLevel: 1,
            },
          }),
        });
        return;
      }

      if (url.includes("/api/sales/invoices") && req.method() === "POST") {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              notransaksi: "JL99887766",
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  test("should scan/input barcode, add item to cart, and complete tender payment", async ({
    page,
  }) => {
    await page.goto("/pos");

    // Check header POS terminal
    await expect(page.locator("header")).toContainText(/POS Terminal/i);

    // Wait until hydration finishes and barcode input receives focus
    const barcodeInput = page.locator('input[placeholder*="Scan Barcode"]');
    await expect(barcodeInput).toBeVisible();
    await expect(barcodeInput).toBeFocused({ timeout: 10000 });

    // Type barcode and submit form
    await barcodeInput.fill("BRG001");
    await barcodeInput.press("Enter");

    // Verify item is added to the cart table
    const cartTable = page.locator("table");
    await expect(cartTable).toBeVisible({ timeout: 8000 });
    await expect(cartTable).toContainText("Kopi Kapal Api Special");
    await expect(cartTable).toContainText("BRG001");

    // Open Tender modal
    const bayarButton = page.getByRole("button", { name: /BAYAR SEKARANG \[F8\]/i });
    await expect(bayarButton).toBeEnabled();
    await bayarButton.click();

    // Verify modal appears
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Pembayaran Kasir [F8]");

    // Input payment amount: Rp 10.000
    const paymentInput = page.locator("#amount-paid-input");
    await paymentInput.fill("10000");

    // Verify change (kembalian) display
    await expect(modal).toContainText(/KEMBALIAN KASIR/i);

    // Submit payment
    const prosesBtn = page.getByRole("button", { name: /Proses & Cetak Struk/i });
    await expect(prosesBtn).toBeEnabled();
    await prosesBtn.click();

    // Verify modal is closed
    await expect(modal).toBeHidden({ timeout: 5000 });
  });
});
