# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Stellar transaction simulation before submission (#167)
- TypeORM connection retry and configurable pool settings (#165)
- Backup Stellar RPC URL with automatic failover (#169)
- Playwright E2E tests integrated into CI pipeline (#181)
- `/api/v1/` prefix for API versioning (#171)
- Rate limiting on bounty and submission endpoints (#159)
- Input sanitization to prevent stored XSS (#160)
- Soft-delete and restore for bounties (#173)
- JSON-structured logger with request correlation (#176)
- Strobe reward amount to XLM conversion for display (#175)
- Frontend unit tests for shared components (#180)
- Health check endpoint for Stellar RPC connectivity (#179)
- Event emission on all state-changing contract functions (#174)
- Dependency vulnerability scanning in CI (#157)
- Pagination on GET /bounties endpoint

### Security
- Moved JWT tokens from localStorage to httpOnly cookies (#154)
- Replaced all `unwrap()` with proper error handling using `ContractError` enum (#156)

## [0.1.0] - 2026-06-16

### Added
- Initial release of StellarBounty
- Bounty creation, submission, and review workflow
- Stellar wallet authentication via Freighter
- Soroban smart contract integration
- Frontend with Next.js and React
- Backend with NestJS and TypeORM
- PostgreSQL database
- Docker Compose for local development
- Prometheus metrics endpoint
- Swagger API documentation
