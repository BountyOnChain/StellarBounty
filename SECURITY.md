# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅         |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Report vulnerabilities by emailing **security@bountyonchain.io** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

## Dependency Vulnerability Scanning

Automated scanning runs on every CI build and weekly via Dependabot:

- **npm** (`apps/frontend`, `apps/backend`): `npm audit --audit-level=high` — fails on `high` or `critical` findings
- **Cargo** (`apps/contracts`): `cargo audit` — fails on any advisory
- **Dependabot**: opens PRs weekly for npm and Cargo dependency updates

## Response Process

| Severity | Response SLA |
|----------|-------------|
| Critical | 24 hours     |
| High     | 72 hours     |
| Medium   | 2 weeks      |
| Low      | Next release |

For confirmed vulnerabilities, we will:

1. Develop and test a fix
2. Release a patched version
3. Publish a public advisory after the fix is deployed
