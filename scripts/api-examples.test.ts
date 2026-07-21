/**
 * Smoke tests for API examples documented in docs/api-examples/.
 *
 * Run against a live backend:
 *   API_BASE_URL=http://localhost:4000 npx ts-node scripts/api-examples.test.ts
 *
 * Requires a valid STELLAR_SECRET_KEY env var for authenticated endpoints.
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";
const SECRET_KEY = process.env.STELLAR_SECRET_KEY || "";

let passed = 0;
let failed = 0;

async function assert(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (err: any) {
    failed++;
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
  }
}

function assertEquals(
  actual: any,
  expected: any,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

async function request(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  return res;
}

async function authenticate(): Promise<string> {
  if (!SECRET_KEY) {
    throw new Error(
      "STELLAR_SECRET_KEY required for authenticated endpoint tests",
    );
  }

  const StellarSdk = await import("@stellar/stellar-sdk");
  const keypair = StellarSdk.Keypair.fromSecret(SECRET_KEY);
  const address = keypair.publicKey();

  // 1. Get challenge
  const challengeRes = await request(
    `/api/v1/auth/challenge?address=${address}`,
  );
  assertTrue(challengeRes.ok, `Challenge request failed: ${challengeRes.status}`);
  const { nonce } = (await challengeRes.json()) as { nonce: string };
  assertTrue(typeof nonce === "string" && nonce.length > 0, "Nonce must be a non-empty string");

  // 2. Sign and verify
  const signature = keypair.sign(Buffer.from(nonce)).toString("base64");
  const verifyRes = await request("/api/v1/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address, signature, nonce }),
  });
  assertTrue(verifyRes.ok, `Verify request failed: ${verifyRes.status}`);
  const { accessToken } = (await verifyRes.json()) as { accessToken: string };
  assertTrue(typeof accessToken === "string" && accessToken.length > 0, "Access token must be a non-empty string");

  return accessToken;
}

// ── Auth Tests ────────────────────────────────────────────────────────────

async function testAuthChallenge(): Promise<void> {
  const res = await request("/api/v1/auth/challenge?address=GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX");
  assertEquals(res.status, 200, "Challenge should return 200");
  const body = (await res.json()) as any;
  assertTrue(typeof body.nonce === "string", "Response must contain nonce string");
}

async function testAuthChallengeInvalidAddress(): Promise<void> {
  const res = await request("/api/v1/auth/challenge?address=INVALID");
  assertTrue(res.status === 400 || res.status === 429, "Invalid address should return 400 or 429");
}

// ── Bounties Tests ────────────────────────────────────────────────────────

async function testListBounties(): Promise<void> {
  const res = await request("/api/v1/bounties");
  assertEquals(res.status, 200, "List bounties should return 200");
  const body = (await res.json()) as any;
  assertTrue(Array.isArray(body.data), "Response must contain data array");
  assertTrue(typeof body.total === "number", "Response must contain total");
  assertTrue(typeof body.page === "number", "Response must contain page");
  assertTrue(typeof body.pageSize === "number", "Response must contain pageSize");
  assertTrue(typeof body.totalPages === "number", "Response must contain totalPages");
}

async function testListBountiesWithFilters(): Promise<void> {
  const res = await request("/api/v1/bounties?page=1&limit=5&status=open");
  assertEquals(res.status, 200, "Filtered list should return 200");
  const body = (await res.json()) as any;
  assertTrue(body.data.length <= 5, "Should respect limit parameter");
}

async function testGetBountyNotFound(): Promise<void> {
  const res = await request("/api/v1/bounties/00000000-0000-0000-0000-000000000000");
  assertEquals(res.status, 404, "Non-existent bounty should return 404");
}

async function testCreateBountyAuthRequired(): Promise<void> {
  const res = await request("/api/v1/bounties", {
    method: "POST",
    body: JSON.stringify({ title: "test", description: "test" }),
  });
  assertTrue(res.status === 401 || res.status === 429, "Create without auth should return 401 or 429");
}

// ── Submissions Tests ─────────────────────────────────────────────────────

async function testSubmissionsAuthRequired(): Promise<void> {
  const fakeBountyId = "00000000-0000-0000-0000-000000000000";
  const res = await request(
    `/api/v1/bounties/${fakeBountyId}/submissions`,
  );
  assertTrue(
    res.status === 401 || res.status === 404 || res.status === 429,
    "Submissions without auth should return 401/404/429",
  );
}

// ── Me Tests ──────────────────────────────────────────────────────────────

async function testSavedBountiesAuthRequired(): Promise<void> {
  const res = await request("/api/v1/me/saved-bounties");
  assertTrue(
    res.status === 401 || res.status === 429,
    "Saved bounties without auth should return 401 or 429",
  );
}

// ── Health Tests ──────────────────────────────────────────────────────────

async function testHealthCheck(): Promise<void> {
  const res = await request("/api/v1/health");
  assertEquals(res.status, 200, "Health check should return 200");
  const body = (await res.json()) as any;
  assertTrue(typeof body.status === "string", "Health must contain status field");
  assertTrue(
    ["ok", "degraded", "down"].includes(body.status),
    "Health status must be ok, degraded, or down",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nRunning API example tests against ${BASE_URL}\n`);

  console.log("Auth:");
  await assert("GET /auth/challenge returns nonce", testAuthChallenge);
  await assert("GET /auth/challenge rejects invalid address", testAuthChallengeInvalidAddress);

  console.log("\nBounties:");
  await assert("GET /bounties returns paginated list", testListBounties);
  await assert("GET /bounties with filters respects limit", testListBountiesWithFilters);
  await assert("GET /bounties/:id returns 404 for missing", testGetBountyNotFound);
  await assert("POST /bounties requires authentication", testCreateBountyAuthRequired);

  console.log("\nSubmissions:");
  await assert("GET /bounties/:id/submissions requires auth", testSubmissionsAuthRequired);

  console.log("\nMe:");
  await assert("GET /me/saved-bounties requires auth", testSavedBountiesAuthRequired);

  console.log("\nHealth:");
  await assert("GET /health returns status", testHealthCheck);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
