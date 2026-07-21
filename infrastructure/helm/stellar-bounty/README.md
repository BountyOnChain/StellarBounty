# stellar-bounty Helm chart

Helm chart for the full StellarBounty stack:

- **Backend** — NestJS API (`apps/backend`)
- **Frontend** — Next.js SSR (`apps/frontend`)
- **Postgres 16** — StatefulSet with bounded PVC
- **Promtail** — DaemonSet log shipper into Loki
- **Ingress** — TLS-terminating, two backend services on one host
- **HPA / PDB / NetworkPolicy** — autoscaling + availability + defense-in-depth

## Install on `kind`

```bash
# 1. Create the cluster + ingress controller.
kind create cluster --name stellar-bounty
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 2. Pre-create the secret(s) the chart envFroms into. Real credentials
#    come from your secret store of choice; this is just for kind demo:
kubectl create namespace stellar-bounty
kubectl -n stellar-bounty create secret generic backend-secrets \
  --from-literal=JWT_SECRET='dev-jwt-secret' \
  --from-literal=STELLAR_SIGNING_SECRET=''
kubectl -n stellar-bounty create secret generic postgres-secrets \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=password \
  --from-literal=POSTGRES_DB=stellar_bounty

# 3. Install. `READY` flips green once readiness probes flip healthy
#    (Closes #425 acceptance).
helm install sb ./infrastructure/helm/stellar-bounty \
  --namespace stellar-bounty \
  --set ingress.className=nginx \
  --set ingress.hostname=stellar-bounty.local \
  --set ingress.clusterIssuer=''
```

Verify readiness flips healthy:

```bash
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/part-of=stellar-bounty \
  -n stellar-bounty --timeout=120s
```

## Values

All knobs live in `values.yaml`. Common overrides:

| Value | Default | Notes |
|---|---|---|
| `backend.replicaCount` | `2` | Ignored when `backend.hpa.enabled` |
| `backend.hpa.minReplicas` | `2` | Below this, rolling restart flakes |
| `frontend.replicaCount` | `2` | |
| `postgres.persistence.size` | `8Gi` | Bump for >250k submissions |
| `ingress.className` | `REPLACE_WITH_INGRESS_CLASS` | e.g. `nginx` |
| `ingress.hostname` | `REPLACE_WITH_HOSTNAME` | e.g. `bounty.example.com` |
| `ingress.clusterIssuer` | `REPLACE_WITH_CLUSTER_ISSUER` | cert-manager only |
| `secrets.backend.existingSecret` | `backend-secrets` | Pre-create with `kubectl create secret` |
| `secrets.postgres.existingSecret` | `postgres-secrets` | |
| `promtail.lokiUrl` | `http://loki:3100/loki/api/v1/push` | Point at your Loki |
| `networkPolicy.enabled` | `true` | Disable if running in kind/minikube without a CNI that supports policy |

## What deploys by default

```
Release "sb" installed into namespace "stellar-bounty".

COMPONENT       KIND                NOTES
backend         Deployment          ready on /api/v1/health
frontend        Deployment          ready on /
postgres        StatefulSet(1)      8Gi PVC, headless svc
promtail        DaemonSet           ships JSON logs to loki
ingress         Ingress             1 host → backend:4000 / frontend:80
hpa-backend     HorizontalPod…      CPU 70%, 2..8 replicas
pdb-backend     PodDisruptionBud..  minAvailable=1
pdb-frontend    PodDisruptionBud..  minAvailable=1
netpol          2× NetworkPolicy    deny-all + scoped allow
```

## Loki verification (Closes #421)

```bash
# Tail Promtail logs to confirm successful push startup.
kubectl -n stellar-bounty logs -l app.kubernetes.io/name=promtail --tail=50

# Open Grafana → Explore → Loki (provisioned via
# infrastructure/grafana/datasources/loki.yaml) and run:
#   {service="stellar-bounty-backend", namespace="stellar-bounty"} | json | level="error"
```

## Vulnerability scanning (Closes #423)

The CI workflow `.github/workflows/ci.yml` runs three independent audit jobs:

- `Audit · Backend (npm)` — `npm audit --audit-level=high`, SARIF → Security tab
- `Audit · Frontend (npm)` — same
- `Audit · Contracts (cargo-deny)` — `cargo deny check` against
  `apps/contracts/deny.toml`

A high-severity finding surfaces a red CI check.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Pod stuck in `Pending` | PVC can't bind | `kubectl describe pvc` |
| Readiness on backend never flips | DB unreachable | Check `postgres-secrets` exists |
| Promtail `permission denied` on /var/log | kind w/o privileged | Use hostPath w/ `runAsUser: 0` |
| Ingress 502 | backend svc name wrong | Verify `ingress.className` matches a running controller |
| Helm `existing secret not found` | Secret not pre-created | `kubectl create secret` per above |
