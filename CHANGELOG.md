# Changelog

All notable changes to StellarBounty are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Issue #425 — Kubernetes manifests and Helm chart.** New
  `infrastructure/k8s/` directory ships raw manifests (Deployment,
  Service, StatefulSet, Ingress, HPA, PDB, NetworkPolicy,
  ConfigMap, Kustomization, Promtail DaemonSet) plus a full
  `infrastructure/helm/stellar-bounty/` chart with `values.yaml`,
  `_helpers.tpl`, twelve templates, `NOTES.txt`, and a `README.md`
  that documents the kind install path and per-component knobs.
  Readiness probes separate from liveness so a rolling restart does
  not trip the API circuit breaker (refs #50).
- **Issue #421 — Structured JSON logging to Loki.** `docker-compose.yml`
  now ships Grafana Loki + Promtail services and forces
  `LOG_FORMAT=json` on the backend. New
  `infrastructure/loki/{loki-config,promtail-config}.yaml` define
  the pipeline. New `infrastructure/grafana/datasources/{prometheus,loki}.yaml`
  provision both datasources in Grafana. Promtail lifts
  `level`/`service`/`env` into Loki labels so LogQL can
  `| json | level="error"`. On Kubernetes, the chart installs a
  Promtail DaemonSet with the same pipeline.
- **Issue #423 — Dependency vulnerability scanning in CI.**
  `.github/workflows/ci.yml` replaces the single "security" job with
  three independent audit jobs that fail red on a high-severity
  finding: `audit:backend` (`npm audit --audit-level=high`),
  `audit:frontend` (same), `audit:contracts` (`cargo deny check`).
  Each upload SARIF to the Security tab. Trivy filesystem scan
  remains as an informational job. A new `apps/contracts/deny.toml`
  configures cargo-deny for advisories, bans, licenses, and sources.

### Changed

- `docker-compose.yml` now depends `backend` on `loki` and pins the
  Grafana Loki/Promtail image tags to `3.3.2` for reproducibility.
- `apps/backend` JSON logger continues to emit one log object per line;
  docker-compose forwards those lines to Promtail's default
  json-file driver so no logger contract changed.

### Security

- `cargo-deny` enforces the RustSec advisory DB, allowed licenses,
  and registry sources at PR time on `apps/contracts/`. Crates not on
  `crates.io` will fail CI (lockfile-only builds).
- Production-bound Helm installs require an out-of-band
  `backend-secrets` and `postgres-secrets` Secret; the chart
  intentionally inlines REPLACE_ME placeholders and refuses to render
  real credentials into templates.

## [0.1.0] - 2026-06-16

Initial public development baseline.

### Added

- Monorepo workspace with frontend, backend, and Soroban contract packages.
- Next.js frontend application for browsing and interacting with bounties.
- NestJS backend API for bounty, submission, authentication, health, and metrics flows.
- Soroban contract workspace for escrow-oriented bounty behavior.
- Docker Compose and environment example files for local development.
- CI workflows for frontend, backend, and contract validation.

### Security

- Baseline Helmet, CORS, request ID, validation pipe, and JWT-based backend security configuration.

[Unreleased]: https://github.com/BountyOnChain/StellarBounty/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BountyOnChain/StellarBounty/releases/tag/v0.1.0
