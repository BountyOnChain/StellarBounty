# Changelog

All notable changes to StellarBounty are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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
