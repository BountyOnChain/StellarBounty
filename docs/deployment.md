# Deployment — StellarBounty

## Soroban Contract Build

Use deterministic toolchain pinning:

```bash
stellar-cli --version   # pin exact version
rustc --version         # pin channel
cargo build --target wasm32-unknown-unknown --locked
```

Verify reproducibility:

```bash
cargo build --target wasm32-unknown-unknown --release
sha256sum target/wasm32-unknown-unknown/release/*.wasm
```

## Frontend + Backend

```bash
cp .env.example .env
# fill DATABASE_URL, JWT secret, Stellar RPC
docker compose up
```

## Notes

- Pin toolchain versions in CI.
- WASM hash diff = non-determinism introduced by std or dep versions.
