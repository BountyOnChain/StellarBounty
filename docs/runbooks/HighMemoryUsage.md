# Runbook: HighMemoryUsage

## Alert

- **Name:** `HighMemoryUsage`
- **Trigger:** RSS >80% of container memory limit, sustained for 3m
- **Severity:** warning
- **Team:** backend

## Summary

One or more backend containers are approaching their memory limit. If
left unmitigated, the container will be OOM-killed and the
restart-loop will cycle (brief outages per cycle).

## Impact

- Performance degrades as the GC kicks in harder
- Risk of pod/container OOMKill → multi-second outage

## Triage (first 10 minutes)

1. Confirm which instance: alert label `instance` (host:port).
2. Inspect process breakdown:
   `docker stats <container>` or `ps -o pid,rss,cmd -p <pid>`.
3. Heap snapshot via Node:
   `node --inspect` + connect with Chrome DevTools → take heap dump.
   Look for retained object growth (often a leaked Map).
4. Recent deploys? Compare memory growth against last green release.

## Mitigation

- **Code regression:** roll back via
  `Deploy & Smoke Test` workflow.
- **Traffic spike:** scale out (increase replica count); revisit
  capacity plan.
- **True leak:** schedule restart window with on-call SRE.

## Post-incident

- Add a memory test in CI — `--max-old-space-size` smoke run.
- File an issue with the suspected leak source.
- Bump the container memory limit only as last resort (push back to
  engineering).

## Related

- `apps/backend/src/main.ts`
- `apps/backend/Dockerfile`
- `docs/metrics.md`
