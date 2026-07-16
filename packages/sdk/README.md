# @stellar-bounty/sdk

Type-safe SDK for the [StellarBounty](https://github.com/BountyOnChain/StellarBounty) API.  
Authenticate with a Stellar wallet, list bounties, and submit work — **zero need to re-implement auth**.

## Install

```bash
npm install @stellar-bounty/sdk
```

## Usage

```ts
import { StellarBountyClient } from "@stellar-bounty/sdk";

// 1. Initialize
const client = new StellarBountyClient({
  apiUrl: "http://localhost:4000", // or your production URL
});

// 2. Authenticate with a Stellar wallet
//    signMessage: your wallet's sign function (e.g. Freighter's signMessage)
const token = await client.authenticate(publicKey, async (nonce) => {
  return signMessage(nonce, { address: publicKey });
});

// 3. Use the API
const bounties = await client.listBounties();
console.log(bounties[0].title);

// 4. Submit work
const submission = await client.submitWork(
  bounties[0].id,
  "https://github.com/user/repo/pull/123"
);
```

## API Reference

### `new StellarBountyClient(config)`

| Option | Type | Description |
|---|---|---|
| `apiUrl` | `string` | Base URL of the StellarBounty API |

### `client.authenticate(publicKey, signMessage)`

Request a challenge nonce, sign with wallet, and store the access token.

Returns `Promise<string>` — the access token.

### `client.listBounties()`

Returns `Promise<Bounty[]>`.

### `client.getBounty(id)`

Returns `Promise<Bounty>`.

### `client.submitWork(bountyId, content)`

Returns `Promise<Submission>`.

### `client.listSubmissions(bountyId)`

Returns `Promise<Submission[]>`.

### `client.clearToken()`

Remove the stored access token.

## Types

```ts
type BountyStatus = "open" | "in_progress" | "completed" | "cancelled";
type SubmissionStatus = "pending" | "approved" | "rejected";

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: BountyStatus;
  createdAt: string;
  creatorId: string;
}

interface Submission {
  id: string;
  bountyId: string;
  content: string;
  status: SubmissionStatus;
  createdAt: string;
  submitterId: string;
}
```

## License

MIT
