# Bounties API Examples

Base URL: `http://localhost:4000/api/v1`

Endpoints marked with 🔒 require an `Authorization: Bearer <JWT>` header.

---

## 1. List Bounties

Retrieve a paginated list of bounties with optional filters.

### cURL

```bash
# Basic list
curl -s "http://localhost:4000/api/v1/bounties" | jq

# With pagination and filters
curl -s "http://localhost:4000/api/v1/bounties?page=1&limit=10&status=open&owner=GABC..." | jq
```

### node-fetch (Node.js)

```js
const params = new URLSearchParams({
  page: "1",
  limit: "10",
  status: "open",
});

const res = await fetch(
  `http://localhost:4000/api/v1/bounties?${params}`
);
const { data, total, page, pageSize, totalPages } = await res.json();
console.log(`Showing ${data.length} of ${total} bounties (page ${page}/${totalPages})`);
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (min: 1) |
| `limit` | integer | 20 | Items per page (min: 1, max: 100) |
| `owner` | string | — | Filter by owner Stellar address |
| `contributor` | string | — | Filter by contributor address |
| `status` | string | — | Filter: `open`, `in_progress`, `completed`, `cancelled` |

### Example Response

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Build a Stellar payment integration",
      "description": "Implement a Stellar payment gateway...",
      "rewardAmount": "10000000",
      "deadline": "2025-12-31T23:59:59.000Z",
      "status": "open",
      "ownerAddress": "GABC...",
      "tags": ["Stellar", "Payment"],
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

---

## 2. Get Single Bounty 🔒

### cURL

```bash
curl -s "http://localhost:4000/api/v1/bounties/550e8400-e29b-41d4-a716-446655440000" | jq
```

### node-fetch (Node.js)

```js
const bountyId = "550e8400-e29b-41d4-a716-446655440000";
const res = await fetch(`http://localhost:4000/api/v1/bounties/${bountyId}`);
const bounty = await res.json();
console.log(bounty.title, bounty.status);
```

### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Build a Stellar payment integration",
  "description": "Implement a Stellar payment gateway that supports XLM and USDC...",
  "rewardAmount": "10000000",
  "deadline": "2025-12-31T23:59:59.000Z",
  "status": "open",
  "ownerAddress": "GABC...",
  "tags": ["Stellar", "Payment", "Integration"],
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 404 | Bounty not found | Verify the bounty UUID is correct |

---

## 3. Create Bounty 🔒

### cURL

```bash
curl -s -X POST "http://localhost:4000/api/v1/bounties" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "title": "Build a Stellar payment integration",
    "description": "Implement a Stellar payment gateway that supports XLM and USDC for merchant checkout.",
    "rewardAmount": "10000000",
    "ownerAddress": "GABC...",
    "tags": ["Stellar", "Payment"],
    "deadline": "2025-12-31T23:59:59Z"
  }' | jq
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/bounties", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  },
  body: JSON.stringify({
    title: "Build a Stellar payment integration",
    description:
      "Implement a Stellar payment gateway that supports XLM and USDC for merchant checkout.",
    rewardAmount: "10000000",
    ownerAddress: "GABC...",
    tags: ["Stellar", "Payment"],
    deadline: "2025-12-31T23:59:59Z",
  }),
});
const bounty = await res.json();
console.log("Created bounty:", bounty.id);
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | 3-200 characters, HTML stripped |
| `description` | string | ✅ | 10-5000 characters, sanitized |
| `rewardAmount` | string | ✅ | Stroops (1 XLM = 10,000,000), range: 1-1,000,000,000 |
| `ownerAddress` | string | ✅ | Valid Stellar public key |
| `tags` | string[] | ❌ | Array of tag strings |
| `deadline` | ISO 8601 | ❌ | Must be in the future |

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Validation failed | Check field constraints (lengths, ranges, formats) |
| 401 | Unauthorized | Provide a valid JWT in the Authorization header |
| 403 | Not the bounty owner | The `ownerAddress` in the request body must match your authenticated wallet address |
| 409 | BOUNTY_TITLE_TAKEN | A bounty with this title already exists. Append a unique suffix or choose a different title. The response includes `existingBountyId`. |

---

## 4. Update Bounty 🔒

### cURL

```bash
curl -s -X PATCH "http://localhost:4000/api/v1/bounties/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "title": "Updated bounty title",
    "rewardAmount": "20000000",
    "status": "in_progress"
  }' | jq
```

### node-fetch (Node.js)

```js
const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      title: "Updated bounty title",
      rewardAmount: "20000000",
      status: "in_progress",
    }),
  }
);
const updated = await res.json();
```

### Request Body (all fields optional)

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | 3-200 characters |
| `description` | string | 10-5000 characters |
| `rewardAmount` | string | Stroops amount |
| `ownerAddress` | string | Stellar public key |
| `tags` | string[] | Array of tag strings |
| `deadline` | ISO 8601 | Future date |
| `status` | string | `open`, `in_progress`, `completed`, `cancelled` |

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Validation failed | Check field constraints |
| 401 | Unauthorized | Re-authenticate to get a fresh JWT |
| 403 | Not the bounty owner | Only the bounty owner can update this bounty |
| 404 | Bounty not found | Verify the bounty UUID |

---

## 5. Delete Bounty 🔒

Soft-deletes a bounty (sets `deletedAt` timestamp).

### cURL

```bash
curl -s -X DELETE "http://localhost:4000/api/v1/bounties/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const res = await fetch(`http://localhost:4000/api/v1/bounties/${bountyId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${jwt}` },
});
const result = await res.json();
// result: { deleted: true }
```

### Example Response

```json
{
  "deleted": true
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Unauthorized | Provide a valid JWT in the Authorization header |
| 404 | Bounty not found | Verify the bounty UUID (non-owners also receive 404 to prevent existence leaks) |

---

## 6. Restore Bounty 🔒

Restores a soft-deleted bounty.

### cURL

```bash
curl -s -X PATCH "http://localhost:4000/api/v1/bounties/550e8400-e29b-41d4-a716-446655440000/restore" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const res = await fetch(
  `http://localhost:4000/api/v1/bounties/${bountyId}/restore`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt}` },
  }
);
const restored = await res.json();
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Unauthorized | Provide a valid JWT in the Authorization header |
| 404 | Bounty not found | Verify the bounty UUID (non-owners also receive 404 to prevent existence leaks) |
