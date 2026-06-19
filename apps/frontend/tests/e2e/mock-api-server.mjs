import http from "node:http";

const port = Number(process.argv[2] ?? process.env.E2E_API_PORT ?? 4100);
const ownerAddress = "GOWNERTESTWALLET000000000000000000000000000000000000000000";
const contributorAddress = "GCONTRIBUTORTESTWALLET000000000000000000000000000000000";

let nextBountyId;
let nextSubmissionId;
let bounties;
let submissions;

function resetState() {
  nextBountyId = 3;
  nextSubmissionId = 2;
  bounties = [
    {
      id: "bounty-1",
      title: "Build a wallet onboarding flow",
      description: "Create a smooth wallet onboarding flow for new contributors.",
      rewardAmount: "750",
      reward: "750 XLM",
      deadline: "2026-07-20T00:00:00.000Z",
      status: "open",
      ownerAddress,
      openSubmissionCount: 1,
    },
    {
      id: "bounty-2",
      title: "Polish dashboard empty states",
      description: "Improve empty states across dashboard tables.",
      rewardAmount: "250",
      reward: "250 XLM",
      deadline: "2026-08-01T00:00:00.000Z",
      status: "in_progress",
      ownerAddress: "GOTHEROWNERTESTWALLET000000000000000000000000000000000",
      openSubmissionCount: 0,
    },
  ];

  submissions = [
    {
      id: "submission-1",
      bountyId: "bounty-1",
      bountyTitle: "Build a wallet onboarding flow",
      contributorAddress,
      link: "https://github.com/example/wallet-flow/pull/1",
      notes: "Initial implementation and tests.",
      status: "pending",
      createdAt: "2026-06-13T10:00:00.000Z",
    },
  ];
}

resetState();

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function visibleBounties(searchParams) {
  const owner = searchParams.get("owner");
  if (owner) {
    return bounties
      .filter((bounty) => bounty.ownerAddress === owner)
      .map((bounty) => ({
        id: bounty.id,
        title: bounty.title,
        rewardAmount: bounty.rewardAmount,
        openSubmissionCount: submissions.filter(
          (submission) => submission.bountyId === bounty.id && submission.status === "pending",
        ).length,
        status: bounty.status,
      }));
  }

  return bounties;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  // The real backend applies a global prefix of "api/v1" via
  // `app.setGlobalPrefix('api/v1')` (see apps/backend/src/main.ts), so all
  // routes the frontend calls land under `/api/v1/...`. Strip that prefix
  // here so this mock mirrors the same routing shape used in production and
  // existing route matchers (`/bounties`, `/submissions`, etc.) still apply.
  // `(?=\/|$)` anchors the strip to a segment boundary so that hypothetical
  // paths like `/api/v10` or `/api/v1bounties` (no slash) aren't accidentally
  // rewritten; NestJS's `setGlobalPrefix('api/v1')` also only mounts at the
  // segment boundary.
  const pathname = url.pathname.replace(/^\/api\/v1(?=\/|$)/, "") || "/";

  if (pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && pathname === "/__reset") {
    resetState();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/bounties") {
    sendJson(response, 200, visibleBounties(url.searchParams));
    return;
  }

  if (request.method === "POST" && pathname === "/bounties") {
    const body = await readJson(request);
    const bounty = {
      id: `bounty-${nextBountyId++}`,
      title: String(body.title ?? "Untitled bounty"),
      description: String(body.description ?? ""),
      rewardAmount: String(body.rewardAmount ?? "0"),
      reward: `${body.rewardAmount ?? "0"} XLM`,
      deadline: String(body.deadline ?? ""),
      status: "open",
      ownerAddress: String(body.ownerAddress ?? ownerAddress),
      openSubmissionCount: 0,
    };
    bounties.unshift(bounty);
    sendJson(response, 201, bounty);
    return;
  }

  const bountyMatch = pathname.match(/^\/bounties\/([^/]+)$/);
  if (request.method === "GET" && bountyMatch) {
    const bounty = bounties.find((item) => item.id === decodeURIComponent(bountyMatch[1]));
    sendJson(response, bounty ? 200 : 404, bounty ?? { message: "Bounty not found" });
    return;
  }

  const createSubmissionMatch = pathname.match(/^\/bounties\/([^/]+)\/submissions$/);
  if (request.method === "POST" && createSubmissionMatch) {
    const bountyId = decodeURIComponent(createSubmissionMatch[1]);
    const bounty = bounties.find((item) => item.id === bountyId);
    if (!bounty) {
      sendJson(response, 404, { message: "Bounty not found" });
      return;
    }

    const body = await readJson(request);
    const submission = {
      id: `submission-${nextSubmissionId++}`,
      bountyId,
      bountyTitle: bounty.title,
      contributorAddress: String(body.submitter ?? contributorAddress),
      link: String(body.link ?? ""),
      notes: String(body.notes ?? ""),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    submissions.unshift(submission);
    bounty.openSubmissionCount += 1;
    sendJson(response, 201, submission);
    return;
  }

  if (request.method === "GET" && createSubmissionMatch) {
    const bountyId = decodeURIComponent(createSubmissionMatch[1]);
    sendJson(response, 200, submissions.filter((submission) => submission.bountyId === bountyId));
    return;
  }

  const approveMatch = pathname.match(/^\/bounties\/([^/]+)\/submissions\/([^/]+)\/approve$/);
  if (request.method === "PATCH" && approveMatch) {
    const bountyId = decodeURIComponent(approveMatch[1]);
    const submissionId = decodeURIComponent(approveMatch[2]);
    const submission = submissions.find(
      (item) => item.bountyId === bountyId && item.id === submissionId,
    );
    const bounty = bounties.find((item) => item.id === bountyId);
    if (!submission || !bounty) {
      sendJson(response, 404, { message: "Submission not found" });
      return;
    }

    submission.status = "approved";
    bounty.status = "completed";
    bounty.openSubmissionCount = 0;
    sendJson(response, 200, submission);
    return;
  }

  if (request.method === "GET" && pathname === "/submissions") {
    const contributor = url.searchParams.get("contributor");
    sendJson(
      response,
      200,
      submissions
        .filter((submission) => !contributor || submission.contributorAddress === contributor)
        .map((submission) => ({
          id: submission.id,
          bountyTitle: submission.bountyTitle,
          createdAt: submission.createdAt,
          status: submission.status,
        })),
    );
    return;
  }

  sendJson(response, 404, { message: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock API listening on http://127.0.0.1:${port}`);
});
