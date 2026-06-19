import { expect, test, type Page } from "@playwright/test";

const ownerAddress = "GOWNERTESTWALLET000000000000000000000000000000000000000000";
const contributorAddress = "GCONTRIBUTORTESTWALLET000000000000000000000000000000000";

function createJwt(publicKey: string) {
  const payload = Buffer.from(JSON.stringify({ sub: publicKey })).toString("base64url");
  return `header.${payload}.signature`;
}

async function seedWallet(page: Page, address = ownerAddress) {
  await page.addInitScript(
    ({ authToken, walletAddress }) => {
      window.localStorage.setItem(
        "stellar-bounty.wallet",
        JSON.stringify({ publicKey: walletAddress, freighterNetwork: "TESTNET" }),
      );
      window.localStorage.setItem("stellar-bounty.auth-token", authToken);
    },
    { authToken: createJwt(address), walletAddress: address },
  );
}

async function hydrateWallet(page: Page, address = ownerAddress) {
  await seedWallet(page, address);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /disconnect/i })).toBeVisible();
}

test.describe("critical bounty flows", () => {
  test.beforeEach(async ({ request }) => {
    const apiPort = process.env.E2E_API_PORT ?? "4100";
    const response = await request.post(`http://127.0.0.1:${apiPort}/__reset`);
    expect(response.ok()).toBeTruthy();
  });

  test("browses and filters bounty listings", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /open bounties/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Build a wallet onboarding flow" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Polish dashboard empty states" })).toBeVisible();

    await page.goto("/?search=wallet");

    await expect(page.getByRole("heading", { name: "Build a wallet onboarding flow" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Polish dashboard empty states" })).toHaveCount(0);
  });

  test("creates a bounty with all required fields", async ({ page }) => {
    await hydrateWallet(page);
    await page.locator('a[href="/bounties/new"]').dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "Create a New Bounty" })).toBeVisible();

    await page.getByLabel("Title").fill("Write Playwright onboarding tests");
    await page.getByLabel("Reward (XLM)").fill("900");
    await page.getByLabel("Deadline").fill("2026-09-30");
    await page
      .getByPlaceholder("Write your bounty requirements in markdown...")
      .fill("Cover wallet setup, bounty creation, listing filters, and submission review.");

    await page.getByRole("button", { name: "Create Bounty" }).click({ force: true });

    await expect(page).toHaveURL(/\/bounties\/bounty-/);
    await expect(page.getByRole("heading", { name: "Write Playwright onboarding tests" })).toBeVisible();
    await expect(page.getByText("Bounty created successfully.")).toBeVisible();
  });

  test("submits work to an open bounty", async ({ page }) => {
    await hydrateWallet(page, contributorAddress);
    await page.goto("/bounties/bounty-1");
    await expect(page.getByRole("heading", { name: "Submit work" })).toBeVisible();

    await page.getByLabel("Work link").fill("https://github.com/example/wallet-flow/pull/2");
    await page.getByLabel("Notes").fill("Implemented the wallet onboarding flow with tests.");
    await page.getByRole("button", { name: "Submit work" }).click({ force: true });

    await expect(page.getByText("Work submitted successfully.")).toBeVisible();
    await expect(page.getByLabel("Work link")).toHaveValue("");
    await expect(page.getByLabel("Notes")).toHaveValue("");
  });

  test("shows dashboard data for submissions and owner review", async ({ page }) => {
    await hydrateWallet(page, contributorAddress);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Build a wallet onboarding flow" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "pending" })).toBeVisible();

    const ownerPage = await page.context().newPage();
    await hydrateWallet(ownerPage, ownerAddress);
    await ownerPage.goto("/dashboard");
    await ownerPage.getByRole("button", { name: "My Bounties" }).click({ force: true });
    await expect(ownerPage.getByRole("cell", { name: "Build a wallet onboarding flow" })).toBeVisible();
    await expect(ownerPage.getByRole("cell", { name: "1", exact: true })).toBeVisible();
    await ownerPage.close();
  });

  test("approves a submission and reflects the owner dashboard state", async ({ page, request }) => {
    const apiPort = process.env.E2E_API_PORT ?? "4100";

    const response = await request.patch(
      `http://127.0.0.1:${apiPort}/bounties/bounty-1/submissions/submission-1/approve`,
      { headers: { Authorization: "Bearer e2e-token" } },
    );
    expect(response.ok()).toBeTruthy();

    await hydrateWallet(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "My Bounties" }).click({ force: true });

    await expect(page.getByRole("cell", { name: "Build a wallet onboarding flow" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "completed" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "0", exact: true })).toBeVisible();
  });
});
