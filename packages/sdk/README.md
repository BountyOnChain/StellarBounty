# @stellar-bounty/sdk

Type-safe SDK for the [StellarBounty](https://github.com/BountyOnChain/StellarBounty) API.  
Authenticate with a Stellar wallet, manage bounties, submit work, and paginate results — **zero need to re-implement auth**.

## Install

```bash
npm install @stellar-bounty/sdk
```

## Usage

```ts
import { StellarBountyClient, paginate } from "@stellar-bounty/sdk";

// 1. Initialize
const client = new StellarBountyClient({
  apiUrl: "http://localhost:4000", // or your production URL
});

// 2. Authenticate with a Stellar wallet
//    signMessage: your wallet's sign function (e.g. Freighter's signMessage)
const token = await client.authenticate(publicKey, async (nonce) => {
  return signMessage(nonce, { address: publicKey });
});

// 3. List bounties (paginated)
const page = await client.listBounties({ status: "open", limit: 10 });
console.log(page.data[0].title);
console.log(page.data[0].rewardAmount); // string of stroops

// 4. Create a bounty
const bounty = await client.createBounty({
  title: "Build a Stellar integration",
  description: "Implement a payment gateway that supports XLM and USDC...",
  rewardAmount: "10000000", // 1 XLM in stroops
  ownerAddress: "GABC...",
});

// 5. Submit work
const submission = await client.submitWork(bounty.id, {
  link: "https://github.com/user/repo/pull/123",
  notes: "Includes tests and deployment link.",
});

// 6. Paginate through all results
for await (const b of paginate((cursor) =>
  client.listBounties({ cursor, limit: 50 })
)) {
  console.log(b.title);
}

// 7. Handle errors
import { StellarBountyApiError } from "@stellar-bounty/sdk";
try {
  await client.createBounty({ ... });
} catch (err) {
  if (err instanceof StellarBountyApiError && err.code === "BOUNTY_TITLE_TAKEN") {
    console.error("Title already exists");
  }
}
```

## API Reference

### `new StellarBountyClient(config)`

| Option | Type | Description |
|---|---|---|
| `apiUrl` | `string` | Base URL of the StellarBounty API |

### `client.authenticate(publicKey, signMessage)`

Request a challenge nonce, sign with wallet, and store the access token.

Returns `Promise<string>` — the access token.

### Bounty Methods

| Method | Description | Returns |
|---|---|---|
| `listBounties(input?)` | List bounties with pagination and filters | `Promise<Paginated<Bounty>>` |
| `getBounty(id)` | Get a single bounty by ID | `Promise<Bounty>` |
| `createBounty(input)` | Create a new bounty | `Promise<Bounty>` |
| `updateBounty(id, patch)` | Update a bounty | `Promise<Bounty>` |
| `deleteBounty(id)` | Soft-delete a bounty | `Promise<{ deleted: true }>` |
| `restoreBounty(id)` | Restore a soft-deleted bounty | `Promise<Bounty>` |
| `saveBounty(id)` | Save a bounty to your list | `Promise<SavedBounty>` |
| `unsaveBounty(id)` | Remove a saved bounty | `Promise<{ deleted: true }>` |

### Submission Methods

| Method | Description | Returns |
|---|---|---|
| `submitWork(bountyId, input)` | Submit work to a bounty | `Promise<Submission>` |
| `listSubmissions(bountyId)` | List submissions for a bounty | `Promise<Submission[]>` |
| `approveSubmission(bountyId, subId)` | Approve a submission (owner only) | `Promise<Submission>` |
| `rejectSubmission(bountyId, subId)` | Reject a submission (owner only) | `Promise<Submission>` |

### `client.clearToken()`

Remove the stored access token.

## Types

```ts
type BountyStatus = "open" | "in_progress" | "approval_queued" | "completed" | "cancelled";
type SubmissionStatus = "pending" | "approved" | "rejected";

interface Bounty {
  id: string;
  title: string;
  description: string;
  rewardAmount: string;   // stroops as string
  deadline: string | null;
  status: BountyStatus;
  ownerAddress: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Submission {
  id: string;
  bountyId: string;
  contributorAddress: string;
  link: string;
  notes?: string | null;
  status: SubmissionStatus;
  createdAt: string;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextCursor?: string | null;
}
```

## OpenAPI

The canonical API schema is exported by the backend at `/api/v1/docs` (Swagger). Integrators can use it for client generation if desired.

## License

MIT
