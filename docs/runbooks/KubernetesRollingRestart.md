# Runbook — Kubernetes Rolling Restart without Breaking the Circuit Breaker

> Originally tracked as part of #425, dependency #50 (liveness vs readiness).

## Why this matters

The NestJS backend opens a circuit breaker around the Stellar Soroban
RPC client (`apps/backend/src/common/circuit-breaker.ts`). The breaker
has a warm-up window: for the first few seconds after process start, an
empty half-open state can re-route any RPC failure as "open". A naive
rolling restart — *recreate all pods at once* — drains the warm-up
budget and trips the breaker across all replicas at the same time.

The deployment is configured so that this **cannot happen by accident**,
but operators should still understand the procedure for an intentional
restart (config bump, base image CVE patch, leaked secret rotation).

## What the chart enforces

| Resource | Setting | Why |
|---|---|---|
| `Deployment.spec.strategy.rollingUpdate.maxSurge` | `1` | Only one new pod at a time |
| `Deployment.spec.strategy.rollingUpdate.maxUnavailable` | `0` | Never below the desired replica count |
| `readinessProbe` | `/api/v1/health` | Service traffic drops before the pod goes hot |
| `livenessProbe` | `/api/v1/health` | Only restarts if the pod itself is dead |
| HPA `minReplicas` | `2` | At least one healthy pod always exists |
| PDB `minAvailable` | `1` | Voluntary drains can't drop below 1 |
| `topologySpreadConstraints` | hostname skew ≤ 1 | Pods land on different nodes |

Together: during a rolling restart, the old pod stays in the service
endpoints until the new pod's readinessProbe returns 2xx. RPC calls
keep hitting a warm pod until the new pod is verified healthy.

## Procedure

### 1. Trigger

```bash
# Helm-driven:
helm upgrade sb ./infrastructure/helm/stellar-bounty \
  --namespace stellar-bounty \
  --reuse-values \
  --set image.backend.tag=1.2.3

# Or kustomize-driven (raw manifests):
kubectl set image deployment/backend \
  backend=stellar-bounty/backend:1.2.3 \
  -n stellar-bounty
```

### 2. Observe

```bash
# Watch the rollout:
kubectl rollout status deployment/{{ include "stellar-bounty.fullname" . }}-backend \
  -n stellar-bounty --timeout=5m

# Confirm probes are doing their job (CRITICAL):
kubectl get pods -n stellar-bounty \
  -l app.kubernetes.io/name=backend \
  -o custom-columns=NAME:.metadata.name,READY:.status.conditions[*].status,AGE:.metadata.creationTimestamp
```

The new pod will appear with `READY=false` while the readiness probe
is in `initialDelaySeconds` (default 10s). Service traffic is
**not** sent to it during this window.

### 3. Validate Loki signals

```bash
# (If you have Loki running.) Open Grafana → Explore → Loki:
#   {service="stellar-bounty-backend",namespace="stellar-bounty"} | json | level="error"
# You should see ZERO burst of `Error: circuit breaker is open` during
# the rollout. If you do, the readiness gap is wrong and you need to
# raise readinessProbe.initialDelaySeconds in the chart.
```

### 4. Roll back (if needed)

```bash
helm rollback sb 1 -n stellar-bounty
# or:
kubectl rollout undo deployment/{{ include "stellar-bounty.fullname" . }}-backend \
  -n stellar-bounty
```

### 5. Node drain (voluntary disruption)

```bash
# PDB ensures ≥1 pod stays available during drain, while the rolling
# update ensures the SLO replicas during a regular rollout.
kubectl drain <node> --ignore-errors --timeout=10m
# Confirm the evicted pod was rescheduled elsewhere:
kubectl get pods -n stellar-bounty -o wide
```

## What to look for in #425 acceptance

The Helm chart's `NOTES.txt` prints:

```bash
helm status sb --namespace stellar-bounty
kubectl get pods -n stellar-bounty -l app.kubernetes.io/part-of=stellar-bounty
```

Both must show `READY`/`Running` for **all** backend pods within
120 seconds of `helm install` for the chart to satisfy its acceptance
criterion (`helm install succeeds on a kind cluster; readiness probe
flips healthy after boot`).

## Related alert

`HighErrorRate` in `infrastructure/prometheus/rules.yml` pages if the
5xx rate stays above 5% for 2 minutes. If the rolling restart triggers
it, abort the rollout and roll back — something is wrong with readiness,
not with RPC.
