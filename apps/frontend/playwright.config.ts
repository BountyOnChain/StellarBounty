import { defineConfig, devices } from "@playwright/test";

const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 4100);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `NEXT_PUBLIC_API_URL=http://127.0.0.1:${apiPort} NEXT_PUBLIC_STELLAR_NETWORK=testnet PORT=${frontendPort} HOSTNAME=127.0.0.1 node .next/standalone/apps/frontend/server.js`,
    url: `http://127.0.0.1:${frontendPort}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
