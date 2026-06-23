# Deployment

## Smart Contract Deployment

**Critical Constraint:** Soroban contracts are immutable. Once deployed, they cannot be upgraded or modified. This is a fundamental architectural limitation of the Soroban platform.

### Pre-Deployment Checklist

Before deploying Soroban contracts to any network:

- **Thorough Testing**: All contract logic must be comprehensively tested. The current contract includes protection against re-initialization (`ContractError::AlreadyInitialized`) to prevent accidental state corruption.
- **Audit**: Consider a professional security audit for production deployments
- **Network Selection**: Choose the target network carefully (testnet vs mainnet) as contracts cannot be moved between networks
- **Parameter Validation**: Ensure all initialization parameters (owner, amount, token address, arbitrator, timelock duration) are correct before deployment
- **Backup Strategy**: Plan for contract migration in case critical bugs are discovered post-deployment

### Deployment Process

```bash
cd apps/contracts

# Build WASM for deployment
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet (example)
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/stellar_bounty_contracts.wasm --source <your-account> --network testnet

# Deploy to mainnet (example)
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/stellar_bounty_contracts.wasm --source <your-account> --network mainnet
```

### Post-Deployment Considerations

- **Contract Address**: Save the deployed contract address permanently - this cannot be changed
- **No Upgrades**: If bugs are discovered, a new contract must be deployed and users must migrate manually
- **State Migration**: Any existing bounty state cannot be transferred to a new contract
- **Documentation**: Record deployment parameters and contract addresses for future reference

## Backend Deployment

Run the NestJS backend behind a TLS-terminating reverse proxy such as Caddy,
nginx, or Traefik. Do not expose the backend's plain HTTP port directly to the
public internet.

## Backend Environment

Set these values for production deployments:

```env
NODE_ENV=production
TRUST_PROXY=true
PORT=4000
```

`NODE_ENV=production` enables a one-year `Strict-Transport-Security` header
with subdomain coverage. `TRUST_PROXY=true` tells Express to trust the first
proxy hop so logs and request handling can use forwarded protocol and client IP
headers correctly.

## Caddy Example

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:4000
}
```

## nginx Example

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.example.com;
  return 301 https://$host$request_uri;
}
```
