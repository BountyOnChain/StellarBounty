import { expect, test, type Page } from "@playwright/test";

async function seedWallet(page: Page, network: string) {
  await page.addInitScript(
    ({ walletNetwork }) => {
      window.localStorage.setItem(
        "stellar-bounty.wallet",
        JSON.stringify({
          publicKey: "GTESTWALLETNETWORK0000000000000000000000000000000000000000",
          freighterNetwork: walletNetwork,
        }),
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: "GTESTWALLETNETWORK0000000000000000000000000000000000000000" }),
      ).toString("base64url");
      window.localStorage.setItem(
        "stellar-bounty.auth-token",
        `header.${payload}.signature`,
      );
    },
    { walletNetwork: network },
  );
}

test.describe("network mismatch banner", () => {
  test("shows banner when wallet network does not match app network", async ({ page }) => {
    await seedWallet(page, "MAINNET");
    await page.goto("/");

    const banner = page.getByRole("alert");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Network mismatch");
    await expect(banner).toContainText("MAINNET");
    await expect(banner).toContainText("TESTNET");
  });

  test("does not show banner when wallet network matches app network", async ({ page }) => {
    await seedWallet(page, "TESTNET");
    await page.goto("/");

    const banner = page.getByRole("alert");
    await expect(banner).toHaveCount(0);
  });

  test("banner is dismissible and stays hidden across routes", async ({ page }) => {
    await seedWallet(page, "MAINNET");
    await page.goto("/");

    const banner = page.getByRole("alert");
    await expect(banner).toBeVisible();

    // Dismiss the banner
    await page.getByRole("button", { name: /dismiss network warning/i }).click();
    await expect(banner).not.toBeVisible();

    // Navigate to another page — banner should stay hidden
    await page.goto("/bounties");
    await expect(banner).not.toBeVisible();
  });

  test("does not show banner when no wallet is connected", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("alert");
    await expect(banner).toHaveCount(0);
  });
});