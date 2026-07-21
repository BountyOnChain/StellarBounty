# Submissions API Examples

Base URL: `http://localhost:4000/api/v1`

All submission endpoints require authentication (`Authorization: Bearer <JWT>`).

---

## 1. Create Submission

Submit work for a bounty. The `contributorAddress` is taken from your JWT token automatically.

### cURL

```bash
curl -s -X POST "http://localhost:4000/api/v1/bounties/{bountyId}/submissions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "link": "https://github.com/user/project/pull/42",
    "notes": "Includes tests, screenshots, and a deployment link."
  }' | jq
```

### node-fetch (Node.js)

```js
const bountyId = "550e8400-e29b-41d4-a716-446655440000";

const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}/submissions`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      link: "https://github.com/user/project/pull/42",
      notes: "Includes tests, screenshots, and a deployment link.",
    }),
  }
);
const submission = await res.json();
console.log("Submission ID:", submission.id);
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `link` | string (URL) | ✅ | URL to the submitted work |
| `notes` | string | ❌ | Additional notes about the submission |

### Example Response

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bountyId": "550e8400-e29b-41d4-a716-446655440000",
  "contributorAddress": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
  "link": "https://github.com/user/project/pull/42",
  "notes": "Includes tests, screenshots, and a deployment link.",
  "status": "pending",
  "createdAt": "2025-01-20T14:30:00.000Z"
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Unauthorized | Authenticate with a valid JWT |
| 404 | Bounty not found | Verify the bounty UUID exists |

---

## 2. List Submissions for a Bounty

List all submissions for a specific bounty. Only the bounty owner can view submissions.

### cURL

```bash
curl -s "http://localhost:4000/api/v1/bounties/{bountyId}/submissions" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const bountyId = "550e8400-e29b-41d4-a716-446655440000";

const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}/submissions`,
  {
    headers: { Authorization: `Bearer ${jwt}` },
  }
);
const submissions = await res.json();
console.log(`Found ${submissions.length} submissions`);
```

### Example Response

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "bountyId": "550e8400-e29b-41d4-a716-446655440000",
    "contributorAddress": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
    "link": "https://github.com/user/project/pull/42",
    "notes": "Includes tests and screenshots.",
    "status": "pending",
    "createdAt": "2025-01-20T14:30:00.000Z"
  }
]
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 403 | Not the bounty owner | Only the bounty owner can view submissions |
| 404 | Bounty not found | Verify the bounty UUID |

---

## 3. Approve Submission

Approve a submission and trigger on-chain Stellar payment via Soroban smart contract.

### cURL

```bash
curl -s -X PATCH \
  "http://localhost:4000/api/v1/bounties/{bountyId}/submissions/{subId}/approve" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const bountyId = "550e8400-e29b-41d4-a716-446655440000";
const subId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}/submissions/${subId}/approve`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt}` },
  }
);
const result = await res.json();
console.log("Status:", result.status);
```

### Example Response

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bountyId": "550e8400-e29b-41d4-a716-446655440000",
  "contributorAddress": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
  "link": "https://github.com/user/project/pull/42",
  "notes": "Includes tests and screenshots.",
  "status": "approved",
  "createdAt": "2025-01-20T14:30:00.000Z"
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | A submission is already approved | Only one submission can be approved per bounty |
| 403 | Not the bounty owner | Only the bounty owner can approve submissions |
| 404 | Bounty/submission not found | Verify UUIDs |

---

## 4. Reject Submission

Reject a submission for a bounty.

### cURL

```bash
curl -s -X PATCH \
  "http://localhost:4000/api/v1/bounties/{bountyId}/submissions/{subId}/reject" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const bountyId = "550e8400-e29b-41d4-a716-446655440000";
const subId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}/submissions/${subId}/reject`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt}` },
  }
);
const result = await res.json();
console.log("Status:", result.status);
```

### Example Response

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bountyId": "550e8400-e29b-41d4-a716-446655440000",
  "contributorAddress": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
  "link": "https://github.com/user/project/pull/42",
  "notes": "Includes tests and screenshots.",
  "status": "rejected",
  "createdAt": "2025-01-20T14:30:00.000Z"
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 403 | Not the bounty owner | Only the bounty owner can reject submissions |
| 404 | Bounty/submission not found | Verify UUIDs |
