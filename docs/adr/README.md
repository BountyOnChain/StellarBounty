# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the StellarBounty project. ADRs document significant architectural decisions, their rationale, and consequences.

## Purpose

ADRs serve as:
- A canonical historical record of major decisions
- Rationale and trade-offs for current design choices
- Onboarding material for new team members
- Reference points for future feature work

## Creating a New ADR

To scaffold a new ADR:

```bash
npm run adr:new
```

This will:
1. Determine the next ADR number
2. Prompt you for a title
3. Create a new file with the template filled in
4. You then edit it to add context, decision, and consequences

Example:
```bash
$ npm run adr:new
Enter ADR title (will be formatted as 0006-your-title-slug.md): Use PostgreSQL for State Sync
✓ Created: docs/adr/0006-use-postgresql-for-state-sync.md
```

## ADR Format

Each ADR uses the following structure:

```markdown
# ADR NNNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded | Deprecated
**Author(s):** 

## Context
Why this decision was needed. What constraints or problems led to it?

## Decision
What was decided. Be clear and concise.

## Rationale
Why this decision was made. What were the alternatives and why were they rejected?

## Consequences
What becomes easier or harder? What risks or trade-offs exist?

## References
Related issues, PRs, docs, or external links.
```

## Status Legend

- **Proposed**: Under discussion; not yet approved.
- **Accepted**: Approved and being used.
- **Superseded**: Replaced by a newer ADR (link to the new one in References).
- **Deprecated**: No longer relevant (link to explanation in References).

## Current ADRs

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-soroban-immutability.md) | Soroban Immutability | Accepted |
| [0002](0002-jwt-key-model.md) | JWT Key Model | Accepted |
| [0003](0003-hex-encoded-nonce-message.md) | Hex-Encoded Nonce Message | Accepted |
| [0004](0004-symbol-short-storage-keys.md) | Symbol-Short Storage Keys | Accepted |
| [0005](0005-outbox-state-sync.md) | Outbox vs. Inline State Sync | Accepted |

## Best Practices

1. **Discuss Before Writing**: Major decisions should be discussed in issues or PRs before an ADR is created.
2. **Link to ADRs**: Reference relevant ADRs in PR descriptions and code comments.
3. **Keep It Concise**: ADRs are reference material, not exhaustive specifications.
4. **Update When Context Changes**: If a decision is superseded, update the ADR to reflect that.
5. **Include Team Input**: ADRs should represent team consensus, not individual opinions.

## References

- [ADR Format Inspiration](https://adr.github.io/)
- [Why ADRs Matter](https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/)
