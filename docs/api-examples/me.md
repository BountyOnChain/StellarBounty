# User Profile API Examples

Base URL: `http://localhost:4000/api/v1`

All `/me` endpoints require authentication (`Authorization: Bearer <JWT>`).

---

## 1. Get Saved Bounties

Retrieve the list of bounties saved by the authenticated user.

### cURL

```bash
curl -s "http://localhost:4000/api/v1/me/saved-bounties" \
  -H "Authorization: Bearer $JWT" | jq
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/me/saved-bounties", {
  headers: { Authorization: `Bearer ${jwt}` },
});
const savedBounties = await res.json();
console.log(`You have saved ${savedBounties.length} bounties`);
```

### Freighter (Stellar browser wallet)

```js
import { signAuthPayload } from "@stellar/freighter-api";

// After authenticating via challenge/verify flow:
const res = await fetch("http://localhost:4000/api/v1/me/saved-bounties", {
  headers: { Authorization: `Bearer ${jwt}` },
});
const savedBounties = await res.json();
```

### Example Response

```json
[
  {
    "id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
    "address": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
    "bountyId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-01-18T09:00:00.000Z",
    "title": "Build a Stellar payment integration",
    "rewardAmount": "10000000",
    "deadline": "2025-12-31T23:59:59.000Z",
    "status": "open"
  }
]
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Unauthorized | Provide a valid JWT in the Authorization header |
