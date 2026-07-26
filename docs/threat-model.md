# Threat Model: StellarBounty

**Date:** 2026-07-26
**Status:** Draft
**Owner:** StellarBounty Team

---

## Overview

This document enumerates threats to the StellarBounty system using the STRIDE methodology. Each threat is assessed for severity, current mitigation status, and residual risk. The scope covers the full stack: Soroban smart contract, NestJS backend, Next.js frontend, PostgreSQL database, and infrastructure.

---

## Threat Assessment Summary

| ID | Category | Threat | Severity | Status |
|----|----------|--------|----------|--------|
| S-01 | Spoofing | Authentication nonce replay | High | Mitigated |
| S-02 | Spoofing | JWT token forgery | Critical | Mitigated |
| S-03 | Spoofing | Address substitution in submissions | Medium | Mitigated |
| T-01 | Tampering | Stored XSS via bounty descriptions | High | Mitigated |
| T-02 | Tampering | Contract parameter fuzzing | High | Mitigated |
| T-03 | Tampering | Bounty status manipulation via API | Medium | Mitigated |
| T-04 | Tampering | Database migration tampering | Medium | Partially Mitigated |
| R-01 | Repudiation | Missing audit trail on approval | Medium | Partially Mitigated |
| R-02 | Repudiation | Missing audit trail on submission rejections | Low | Mitigated |
| I-01 | Information Disclosure | JWT signing key compromise | Critical | Partially Mitigated |
| I-02 | Information Disclosure | Nonce leakage in logs | Low | Mitigated |
| I-03 | Information Disclosure | Database connection string exposure | Critical | Mitigated |
| D-01 | Denial of Service | Stellar RPC back-pressure | High | Partially Mitigated |
| D-02 | Denial of Service | Rate-limit exhaustion on auth endpoints | Medium | Mitigated |
| D-03 | Denial of Service | Database connection pool exhaustion | Medium | Partially Mitigated |
| E-01 | Elevation of Privilege | Arbitrator compromise | Critical | Mitigated |
| E-02 | Elevation of Privilege | JWT role escalation | High | Mitigated |
| E-03 | Elevation of Privilege | Soft-delete bypass | Low | Mitigated |

---

## S — Spoofing

### S-01: Authentication Nonce Replay

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/auth/auth.service.ts` |

**Description:** An attacker could capture a signed nonce from a previous authentication session and replay it to obtain a valid JWT without possessing the private key.

**Attack Vector:**
1. Attacker intercepts a signed nonce via network sniffing (if TLS is misconfigured) or from client-side logs
2. Attacker replays the signed nonce to `POST /api/v1/auth/verify`
3. Backend verifies the signature and issues a JWT

**Mitigations:**
- Nonces are single-use: immediately deleted from the `nonces` table after verification (`auth.service.ts:66-68`)
- Nonces have a 5-minute TTL (`AUTH_NONCE_TTL_MS`, default 300000ms)
- Nonces are 32-byte random hex values generated via `crypto.randomBytes(32)` (`auth.service.ts:29`)
- Rate limiting on verify endpoint (10 req/60s, `AUTH_VERIFY_RATE_LIMIT_MAX`)
- TLS enforced in production (HTTP-to-HTTPS redirect in `main.ts:46`)

**Residual Risk:** Low. If an attacker intercepts the signed nonce and replays it within the same 5-minute window before the legitimate user completes verification, they could obtain a JWT. This requires both TLS compromise and precise timing.

**References:**
- `apps/backend/src/auth/auth.service.ts:55-68` — nonce verification and deletion
- `apps/backend/src/auth/auth.service.ts:23` — nonce TTL configuration

---

### S-02: JWT Token Forgery

| Attribute | Value |
|-----------|-------|
| **Severity** | Critical |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/auth/jwt.strategy.ts` |

**Description:** An attacker who obtains or guesses the `JWT_SECRET` can forge arbitrary JWT tokens, impersonating any user.

**Attack Vector:**
1. Attacker extracts `JWT_SECRET` from environment variable leakage, source code exposure, or server compromise
2. Attacker crafts a JWT with any `sub` (Stellar address) and signs it with the secret
3. Attacker uses the forged JWT to call authenticated endpoints

**Mitigations:**
- `JWT_SECRET` is loaded from environment variables, never hardcoded (`auth.module.ts:26`)
- `.env` files are gitignored (see `.gitignore`)
- Backend runs in a Docker container with read-only root filesystem
- Secrets are not logged (structured logging redacts known secret patterns)
- Token revoke endpoint (`POST /api/v1/auth/revoke`) available for incident response

**Residual Risk:** Medium. A single shared `JWT_SECRET` means any service that has access to it can forge tokens. Key rotation is manual and there is no automatic rekeying mechanism. See I-01 for key rotation recommendations.

**References:**
- `apps/backend/src/auth/jwt.strategy.ts:15-25` — JWT extraction and validation
- `docs/adr/0002-jwt-key-model.md` — JWT key model decision record

---

### S-03: Address Substitution in Submissions

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/submissions/submissions.service.ts` |

**Description:** A malicious contributor could submit work under another user's Stellar address to frame them or cause confusion.

**Attack Vector:**
1. Contributor submits work to a bounty with `link` and `notes` fields
2. The `contributorAddress` is extracted from the JWT `sub` claim, not from request body
3. However, if the JWT itself is compromised (see S-02), the attacker can impersonate any address

**Mitigations:**
- `contributorAddress` is set server-side from `req.user.address` (JWT `sub`), not from client-supplied data (`submissions.service.ts:34-36`)
- Global ValidationPipe enforces `whitelist: true` and `forbidNonWhitelisted: true` on all DTOs
- Bounty owner verification uses `ownerAddress` from the database, not from request parameters

**Residual Risk:** Low. Address substitution is only possible through JWT forgery (S-02), which is independently mitigated.

**References:**
- `apps/backend/src/submissions/dto/create-submission.dto.ts` — DTO fields (no contributorAddress)
- `apps/backend/src/submissions/submissions.service.ts:34` — address from JWT

---

## T — Tampering

### T-01: Stored XSS via Bounty Descriptions

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/bounties/bounties.service.ts`, `apps/frontend/` |

**Description:** An attacker could inject JavaScript into a bounty title or description. If another user views the bounty, the script executes in their browser, potentially stealing their JWT or wallet session.

**Attack Vector:**
1. Attacker creates a bounty with `title` or `description` containing `<script>alert('xss')</script>`
2. The malicious content is stored in PostgreSQL
3. When another user visits the bounty detail page, the script executes in their browser context

**Mitigations:**
- Backend: Description is sanitized via `sanitize-html` before storage (`bounties.service.ts:62`), stripping all HTML tags
- Backend: DTO validation enforces `@IsString()` and `@MaxLength(5000)` on description, `@MaxLength(200)` on title (`create-bounty.dto.ts`)
- Frontend: Content Security Policy headers configured via Helmet (`main.ts:35`) — `default-src 'self'; script-src 'self'; object-src 'none'`
- Frontend: React's built-in JSX escaping prevents script execution in rendered content
- Frontend: `react-markdown` renders descriptions as Markdown (safe by default, no raw HTML)

**Residual Risk:** Low. Backend sanitization removes HTML before storage, providing defense-in-depth before content reaches the frontend. CSP provides an additional layer of protection.

**References:**
- `apps/backend/src/common/utils/sanitize-description.ts` — HTML sanitization logic
- `apps/backend/src/main.ts:35` — CSP header configuration
- `apps/frontend/components/MarkdownRenderer.tsx` — Safe Markdown rendering

---

### T-02: Contract Parameter Fuzzing

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Status** | Mitigated |
| **Component** | `apps/contracts/src/lib.rs` |

**Description:** An attacker could call Soroban contract functions with malformed or unexpected parameters to trigger undefined behavior, state corruption, or fund loss.

**Attack Vector:**
1. Attacker calls `approve()` with an invalid status (not UnderReview)
2. Attacker calls `resolve()` with a winner address that is neither owner nor contributor
3. Attacker attempts reentrancy by interleaving contract calls

**Mitigations:**
- All state-changing functions validate current status via `assert_status(expected)` guards
- `resolve()` validates `winner ∈ {owner, contributor}` via `InvalidWinner` check (`lib.rs:215-220`)
- Reentrancy guard (`LOCKED` storage flag, `lib.rs:18`) prevents nested calls
- Single initialization guard prevents re-initialization attacks
- Every function has explicit `require_auth()` calls for appropriate roles
- Test suite with 30+ tests covering all state transitions and edge cases

**Residual Risk:** Low. The contract's state machine is rigorously guarded. The primary residual risk is a logic error in the status transition validation that existing tests might miss. Formal verification (see `docs/verification-plan.md`) will address this.

**References:**
- `apps/contracts/src/lib.rs:30-45` — status assertion pattern
- `apps/contracts/src/lib.rs:215-220` — winner validation
- `apps/contracts/src/lib.rs:18` — reentrancy guard
- `docs/verification-plan.md` — formal verification roadmap

---

### T-03: Bounty Status Manipulation via API

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/bounties/bounties.service.ts` |

**Description:** A malicious bounty owner could manipulate the off-chain bounty status without on-chain state changes, creating inconsistencies between the database and the Soroban contract.

**Attack Vector:**
1. Owner calls `PATCH /api/v1/bounties/:id` with a new status
2. Backend updates the status in PostgreSQL without checking/calling the on-chain contract
3. The database shows the bounty as "completed" but the contract still holds funds

**Mitigations:**
- Bounty `status` in the database is updated only through the submission approval flow, which calls the Soroban contract (`submissions.service.ts:82-95`)
- Direct `PATCH` on bounties does not allow status changes — the DTO (`update-bounty.dto.ts`) only exposes `title`, `description`, and `deadline`
- The `bounty_contracts` table tracks the on-chain contract ID per bounty per network, enabling reconciliation

**Residual Risk:** Low. Status is a derived field controlled by the contract interaction layer, not directly mutable via the API.

**References:**
- `apps/backend/src/bounties/dto/update-bounty.dto.ts` — mutable fields (no status)
- `apps/backend/src/submissions/submissions.service.ts:82-95` — contract call on approval

---

### T-04: Database Migration Tampering

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Partially Mitigated |
| **Component** | `apps/backend/src/database/migrations/` |

**Description:** A compromised CI/CD pipeline or database admin could modify migration files to alter schema in unintended ways.

**Attack Vector:**
1. Attacker gains write access to the repository or database
2. Attacker modifies a migration file to exfiltrate data or weaken constraints
3. Migration runs on next deployment, corrupting the schema

**Mitigations:**
- `synchronize: false` in TypeORM config — schema changes require explicit migrations (`app.module.ts:38`)
- Migration drift check in CI (`ci.yml`) — detects schema differences between migrations and actual database
- CODEOWNERS file restricts PR approvals to domain teams
- Dependabot configured for dependency updates

**Residual Risk:** Medium. No cryptographic signing of migration files. No database access audit logging for DDL operations.

**References:**
- `apps/backend/src/app.module.ts:38` — `synchronize: false`
- `.github/workflows/ci.yml` — migration drift check
- `.github/CODEOWNERS` — PR restriction

---

## R — Repudiation

### R-01: Missing Audit Trail on Approval

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Partially Mitigated |
| **Component** | `apps/backend/src/submissions/submissions.service.ts` |

**Description:** When a submission is approved or rejected, there is no immutable audit log recording who performed the action, when, and from what IP/device. This makes it difficult to investigate disputes or malicious behavior.

**Attack Vector:**
1. A malicious bounty owner approves a low-quality submission
2. The contributor claims they were unfairly treated
3. Without an audit trail, there is no way to prove who approved it or if the action was authorized

**Mitigations:**
- Audit log middleware (`audit-log.middleware.ts`) logs all requests with `x-request-id`, method, URL, status code, and warns on 4xx+ responses
- Soroban contract publishes events for all state transitions (Outbox pattern — ADR-0005)

**Gaps:**
- Audit log is not persisted to a durable, append-only store — it's part of the application logs and subject to log rotation/deletion
- No structured audit events for approval/rejection actions (who, what, when)
- No cryptographic audit chain or write-once storage

**References:**
- `apps/backend/src/common/middleware/audit-log.middleware.ts` — current audit logging
- `docs/adr/0005-outbox-state-sync.md` — Outbox pattern for contract events

---

### R-02: Missing Audit Trail on Submission Rejections

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/submissions/submissions.service.ts` |

**Description:** Submission rejections are recorded in the database (`submissions.status = 'rejected'`) but with no required reason or evidence.

**Attack Vector:**
1. Owner rejects a submission without providing a reason
2. Contributor has no recourse or evidence of why the rejection occurred

**Mitigations:**
- Rejection sets `submissions.status = 'rejected'` in PostgreSQL
- The `notes` field on the submission can optionally contain feedback
- Contributor can view their submission status via `GET /api/v1/bounties/:bountyId/submissions`
- Dispute mechanism exists on-chain for contested rejections

**Residual Risk:** Low. On-chain dispute mechanism provides an escalation path.

**References:**
- `apps/backend/src/submissions/submissions.service.ts:100-110` — reject logic

---

## I — Information Disclosure

### I-01: JWT Signing Key Compromise

| Attribute | Value |
|-----------|-------|
| **Severity** | Critical |
| **Status** | Partially Mitigated |
| **Component** | `apps/backend/src/auth/` |

**Description:** The `JWT_SECRET` is a single shared secret used to sign all access tokens. If compromised, an attacker can forge tokens for any user (see S-02). Additionally, there is no automatic key rotation mechanism.

**Attack Vector:**
1. Attacker gains access to the backend environment (e.g., via container breakout, CI/CD compromise, or leaked `.env` file)
2. Attacker extracts `JWT_SECRET`
3. Attacker forges JWTs for any Stellar address
4. Attacker uses forged tokens to call authenticated endpoints

**Mitigations:**
- `JWT_SECRET` loaded from environment variable, not hardcoded
- Backend runs in Docker container with read-only root filesystem
- Secret is not logged
- Token revoke endpoint available (`POST /api/v1/auth/revoke`)

**Gaps:**
- No automated key rotation mechanism (see ADR-0002 for Phase 2 plan)
- No key derivation per user or per session — a single secret compromises all tokens
- Revoked tokens are stored in an in-memory `Set<string>` (lost on server restart)
- No key compromise detection mechanism

**References:**
- `docs/adr/0002-jwt-key-model.md` — JWT key model (Phase 1: single secret, Phase 2: rotation)

---

### I-02: Nonce Leakage in Logs

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/auth/auth.service.ts` |

**Description:** The authentication nonce could be logged in plaintext, enabling an attacker with log access to replay the nonce.

**Attack Vector:**
1. Backend logs the nonce during challenge generation or verification
2. Attacker gains access to log aggregation service (e.g., Grafana Loki, CloudWatch)
3. Attacker extracts nonces and replays them against the verify endpoint

**Mitigations:**
- Structured JSON logging (`JsonLoggerService`) can be configured with redaction patterns
- Nonces are hex-encoded, but not inherently secret — the key insight is that nonces are single-use and short-lived
- Nonce TTL is only 5 minutes, limiting the window of exploitation

**Residual Risk:** Low. The short TTL and single-use nature of nonces limit the impact.

**References:**
- `apps/backend/src/common/utils/json-logger.service.ts` — structured logging

---

### I-03: Database Connection String Exposure

| Attribute | Value |
|-----------|-------|
| **Severity** | Critical |
| **Status** | Mitigated |
| **Component** | Infrastructure |

**Description:** The `DATABASE_URL` environment variable contains the PostgreSQL connection string with credentials. If exposed, attackers gain direct database access.

**Attack Vector:**
1. Attacker gains access to backend environment variables (via container compromise, CI/CD logs, or debug endpoints)
2. Attacker connects directly to PostgreSQL with read/write access

**Mitigations:**
- `DATABASE_URL` loaded from environment, never hardcoded
- `.env` files gitignored
- Backend container uses read-only root filesystem
- Database credentials are scoped to the application user (no admin privileges)
- Database connection uses TLS (via `sslmode=require` in connection string)
- No debug endpoints that leak environment variables in production

**Residual Risk:** Low. Defense-in-depth with multiple layers of access control.

**References:**
- `docker-compose.yml` — environment configuration
- `apps/backend/src/app.module.ts:35-45` — database connection configuration

---

## D — Denial of Service

### D-01: Stellar RPC Back-Pressure

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Status** | Partially Mitigated |
| **Component** | `apps/backend/src/common/utils/stellar-rpc-client.ts` |

**Description:** The Stellar RPC endpoint could become unresponsive or rate-limit the backend, preventing contract interactions (approvals, payouts, cancellations) and causing a denial of service against critical bounty operations.

**Attack Vector:**
1. Attacker floods the Stellar RPC with requests, exhausting rate limits
2. The backend cannot call `submitTransaction()` or `getHealth()` on the RPC
3. Submission approvals fail, contributors cannot get paid
4. Time-locked operations (approve, cancel, resolve) expire without execution

**Mitigations:**
- Circuit breaker pattern (`circuit-breaker.ts:15-40`) — after N consecutive failures, the circuit opens and stops RPC calls
- RPC failover with primary + backup endpoints (`stellar-rpc-retry.ts:20-35`)
- Retry logic with exponential backoff (3 retries) (`stellar-rpc-retry.ts:40-55`)
- Backend health endpoint checks RPC reachability (`health.service.ts:45-60`)
- Prometheus metrics track RPC failures and retries for alerting

**Gaps:**
- No fallback to alternative RPC providers (only primary + backup)
- No local transaction caching or queueing for offline periods
- No RPC request prioritization (critical contract calls vs. health checks)

**References:**
- `apps/backend/src/common/utils/stellar-rpc-client.ts` — RPC client wrapper
- `apps/backend/src/common/utils/stellar-rpc-retry.ts` — retry logic
- `apps/backend/src/common/utils/circuit-breaker.ts` — circuit breaker
- `infrastructure/prometheus/rules.yml` — alerting rules

---

### D-02: Rate-Limit Exhaustion on Auth Endpoints

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/auth/auth.controller.ts` |

**Description:** An attacker could flood the authentication endpoints to exhaust rate limits, preventing legitimate users from authenticating.

**Attack Vector:**
1. Attacker sends many requests to `GET /api/v1/auth/challenge` from multiple IPs
2. Rate limit is hit (5 req/60s per IP)
3. Legitimate users cannot obtain nonces to authenticate

**Mitigations:**
- Rate limiting via `@nestjs/throttler` — 5 req/60s on challenge, 10 req/60s on verify (`auth.controller.ts:15-20`)
- Global rate limit: 30 req/min (`app.module.ts:28`)
- Trust proxy enabled for accurate IP detection behind reverse proxies (`main.ts:32`)
- Rate limit configuration is environment-variable-driven (`RATE_LIMIT_MAX`, `AUTH_CHALLENGE_RATE_LIMIT_MAX`)

**Residual Risk:** Medium. Distributed attacks from many IPs can still exhaust resources at the application level. A WAF or CDN-level rate limiting would be more effective.

**References:**
- `apps/backend/src/auth/auth.controller.ts:15-20` — rate limit decorators
- `apps/backend/src/app.module.ts:28` — global rate limit configuration

---

### D-03: Database Connection Pool Exhaustion

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Partially Mitigated |
| **Component** | `apps/backend/src/app.module.ts` |

**Description:** An attacker could open many slow or idle database connections to exhaust the connection pool, causing new requests to time out.

**Attack Vector:**
1. Attacker sends many concurrent requests that trigger slow queries
2. Database connection pool (max 20 connections) is exhausted
3. New requests fail with connection timeout errors

**Mitigations:**
- Connection pool configured with `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000` (`app.module.ts:36-42`)
- Slow query threshold set at 250ms with metrics logging
- Retry logic on connection failure (3 attempts, 3s delay)
- Prometheus metrics track database query errors and slow queries

**Gaps:**
- No query timeouts at the TypeORM level (queries can run indefinitely)
- No connection pool draining on shutdown (graceful shutdown exists but may not drain pool)
- Pool size is static — no dynamic scaling based on load

**References:**
- `apps/backend/src/app.module.ts:36-42` — TypeORM connection configuration
- `infrastructure/prometheus/rules.yml` — HighSlowQueryRate alert rule

---

## E — Elevation of Privilege

### E-01: Arbitrator Compromise

| Attribute | Value |
|-----------|-------|
| **Severity** | Critical |
| **Status** | Mitigated |
| **Component** | `apps/contracts/src/lib.rs` |

**Description:** A compromised or malicious arbitrator could resolve disputes in their favor, redirecting funds to an arbitrary address (not the owner or contributor).

**Attack Vector:**
1. Arbitrator account private key is compromised
2. Attacker calls `resolve()` on disputed bounties
3. Attacker specifies a winner address they control
4. After timelock expires, `execute_resolve()` transfers funds to the attacker's address

**Mitigations:**
- `resolve()` validates `winner ∈ {owner, contributor}` via `InvalidWinner` check (`lib.rs:215-220`) — arbitrator cannot redirect funds to a third party
- Time-locked operations (24h default) provide a window for detecting malicious resolution attempts
- Owner can call `cancel_operation()` before timelock expires to cancel a malicious resolve
- `rotate_arbitrator()` allows owner to change the arbitrator address at any time

**Residual Risk:** Low. Even a fully compromised arbitrator can only select between the owner and contributor as winner, not exfiltrate funds to their own address.

**References:**
- `apps/contracts/src/lib.rs:215-220` — winner validation in `resolve()`
- `apps/contracts/src/lib.rs:50-55` — timelock constants
- `apps/contracts/src/lib.rs:180` — `rotate_arbitrator()`

---

### E-02: JWT Role Escalation

| Attribute | Value |
|-----------|-------|
| **Severity** | High |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/auth/jwt.strategy.ts` |

**Description:** The JWT payload contains a `sub` claim (Stellar address) but no explicit role claim. However, if a future version adds role-based access control (RBAC), an attacker could modify their JWT to escalate privileges.

**Attack Vector:**
1. Attacker obtains their own valid JWT
2. Attacker decodes the JWT and modifies claims (e.g., changes `role` from `user` to `admin`)
3. Attacker uses the modified JWT to call admin-only endpoints

**Mitigations:**
- JWT is signed with `JWT_SECRET` — modifying the payload invalidates the signature (JWT library validates on every request)
- Current JWT payload only contains `sub: address` — no role claims to escalate
- Authorization is based on ownership checks (e.g., `bounty.ownerAddress === req.user.address`) rather than roles

**Residual Risk:** Low. The stateless nature of JWT validation prevents payload tampering. If RBAC is added in the future, the same signature-based protection applies.

**References:**
- `apps/backend/src/auth/jwt.strategy.ts:15-25` — token validation
- `apps/backend/src/auth/auth.service.ts:85` — JWT payload construction

---

### E-03: Soft-Delete Bypass

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated |
| **Component** | `apps/backend/src/bounties/bounties.service.ts` |

**Description:** A malicious user could attempt to access or restore soft-deleted bounties that they do not own.

**Attack Vector:**
1. Bounty owner soft-deletes a bounty (`DELETE /api/v1/bounties/:id`)
2. Another user calls `PATCH /api/v1/bounties/:id/restore`
3. The bounty is restored, revealing information or enabling unauthorized actions

**Mitigations:**
- Soft-delete endpoints (`delete`, `restore`) require JWT authentication
- Restore checks that `req.user.address === bounty.ownerAddress` (`bounties.service.ts:130`)
- Soft-deleted bounties are excluded from list queries by default (`where: { deletedAt: IsNull() }`)
- Bounty detail endpoint returns 404 for soft-deleted bounties

**Residual Risk:** None. Authorization checks prevent unauthorized restore.

**References:**
- `apps/backend/src/bounties/bounties.service.ts:130` — restore authorization
- `apps/backend/src/bounties/bounties.service.ts:45` — default soft-delete filter

---

## Threat Mitigation Backlog

| ID | Threat | Action Required | Priority | Target |
|----|--------|-----------------|----------|--------|
| R-01 | Missing audit trail | Implement append-only audit log for approval/rejection events | High | Q3 2026 |
| D-01 | RPC back-pressure | Add RPC request prioritization and local transaction queue | High | Q3 2026 |
| I-01 | JWT key compromise | Implement automated key rotation (Phase 2 of ADR-0002) | Medium | Q4 2026 |
| D-03 | Connection pool exhaustion | Add query timeouts and dynamic pool sizing | Medium | Q4 2026 |
| T-04 | Migration tampering | Implement cryptographic signing of migration files | Low | Q1 2027 |

---

## References

- `apps/contracts/src/lib.rs` — Soroban escrow contract
- `apps/backend/src/` — NestJS backend source
- `apps/frontend/` — Next.js frontend source
- `docs/architecture.md` — System architecture
- `docs/verification-plan.md` — Contract verification plan
- `docs/adr/0001-soroban-immutability.md` — Immutability constraint
- `docs/adr/0002-jwt-key-model.md` — JWT key model
- `docs/adr/0005-outbox-state-sync.md` — Outbox pattern
- `infrastructure/prometheus/rules.yml` — Prometheus alerting rules
- `infrastructure/alertmanager/alertmanager.yml` — Alertmanager configuration
