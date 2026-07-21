# Authentication API Examples

Base URL: `http://localhost:4000/api/v1`

All Stellar addresses use the `G...` format (Ed25519 public key).

---

## 1. Get Challenge Nonce

Request a signing challenge to authenticate with your Stellar keypair.

### cURL

```bash
curl -s "http://localhost:4000/api/v1/auth/challenge?address=GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX" \
  | jq
```

### node-fetch (Node.js)

```js
const address = "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX";

const res = await fetch(
  `http://localhost:4000/api/v1/auth/challenge?address=${address}`
);
const { nonce } = await res.json();
console.log("Nonce:", nonce);
```

### Freighter (Stellar browser wallet)

```js
import { signAuthPayload } from "@stellar/freighter-api";

const address = "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX";
const res = await fetch(
  `http://localhost:4000/api/v1/auth/challenge?address=${address}`
);
const { nonce } = await res.json();

// Sign using Freighter
const signedPayload = await signAuthPayload(address, nonce);
console.log("Signature:", signedPayload);
```

### Example Response

```json
{
  "nonce": "f8a9f3d6a0e6c4b2d8e1f5a3b7c9d2e4f6a8b0c3d5e7f9a1b3c5d7e9f1a3b5"
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Invalid address format | Ensure address starts with `G` and is 56 characters |
| 429 | Rate limited | Wait 60s; challenge endpoint allows 5 requests/minute |

---

## 2. Verify Signature & Get JWT

Exchange a signed nonce for a JWT access token.

### cURL

```bash
curl -s -X POST "http://localhost:4000/api/v1/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
    "signature": "MEUCIQDZ9...IDAQAB",
    "nonce": "f8a9f3d6a0e6c4b2..."
  }' | jq
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: "GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX",
    signature: signedPayload,
    nonce,
  }),
});
const { accessToken } = await res.json();
console.log("JWT:", accessToken);
```

### Example Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJHRFhQNFc1TTJLMk43S0RYUDRXNU0ySzJON0tEWFBUYXRlcm1pbiJ9.abc123..."
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Invalid/expired nonce | Request a new challenge and sign it immediately |
| 401 | Signature verification failed | Re-sign the exact nonce string with your Stellar secret key |
| 429 | Rate limited | Wait 60s; verify allows 10 requests/minute |

---

## 3. Refresh Access Token

Get a new access token using a refresh token.

### cURL

```bash
curl -s -X POST "http://localhost:4000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGci..."}' | jq
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/auth/refresh", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken: refreshToken }),
});
const { accessToken } = await res.json();
```

### Example Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 401 | Invalid or revoked refresh token | Re-authenticate using challenge/verify flow |

---

## 4. Revoke Token

Blacklist an access or refresh token to invalidate it.

### cURL

```bash
curl -s -X POST "http://localhost:4000/api/v1/auth/revoke" \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGci..."}' | jq
```

### node-fetch (Node.js)

```js
const res = await fetch("http://localhost:4000/api/v1/auth/revoke", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: accessToken }),
});
const { revoked } = await res.json();
console.log("Revoked:", revoked);
```

### Example Response

```json
{
  "revoked": true
}
```

### Common Errors

| Status | Error | Remediation |
|--------|-------|-------------|
| 400 | Missing or invalid token | Ensure `token` field is a valid JWT string |
