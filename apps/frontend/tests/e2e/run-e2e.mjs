import { spawn } from "node:child_process";
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const apiPort = process.env.E2E_API_PORT ?? "4100";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3100";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const childEnv = {
  ...process.env,
  E2E_API_PORT: apiPort,
  E2E_FRONTEND_PORT: frontendPort,
  NEXT_PUBLIC_API_URL: apiUrl,
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  HOSTNAME: "127.0.0.1",
  PORT: frontendPort,
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: childEnv,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function copyStandaloneAssets() {
  const standaloneAppDir = path.join(".next", "standalone", "apps", "frontend");

  await cp(path.join(".next", "static"), path.join(standaloneAppDir, ".next", "static"), {
    recursive: true,
  });

  if (existsSync("public")) {
    await cp("public", path.join(standaloneAppDir, "public"), { recursive: true });
  }
}

const mockApi = spawn("node", ["tests/e2e/mock-api-server.mjs", apiPort], {
  env: childEnv,
  stdio: "inherit",
  shell: process.platform === "win32",
});

let exitCode = 0;

try {
  await waitForHealth(`${apiUrl}/health`);
  await run("npm", ["run", "build"]);
  await copyStandaloneAssets();
  await run("npx", ["playwright", "test", ...process.argv.slice(2)]);
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
} finally {
  mockApi.kill();
}

process.exit(exitCode);
