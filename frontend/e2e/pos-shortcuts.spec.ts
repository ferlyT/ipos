import { test, expect } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

test.describe("POS Keyboard Shortcuts Flow", () => {
  test("should open item search modal on F2 or Cari button and close on Escape", async ({
    page,
  }) => {
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              kodeitem: "ITEM-A",
              namaitem: "Biskuit Roma Kelapa",
              satuan: "BKS",
              hargajual: 8500,
            },
          ],
        }),
      });
    });

    await page.goto("/pos");

    // Wait until hydration finishes (barcode input gets focused by useEffect)
    const barcodeInput = page.locator('input[placeholder*="Scan Barcode"]');
    await expect(barcodeInput).toBeVisible();
    await expect(barcodeInput).toBeFocused({ timeout: 10000 });

    // Press F2 on keyboard
    await page.keyboard.press("F2");

    // Modal search should appear
    const searchModal = page.getByRole("dialog");
    await expect(searchModal).toBeVisible({ timeout: 5000 });
    await expect(searchModal).toContainText(/Cari Barang/i);

    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await expect(searchModal).toBeHidden();
  });
});
