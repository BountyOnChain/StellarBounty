# Operations Runbook

## Smart Contract Operations

**Critical Constraint:** Soroban contracts are immutable. Once deployed, they cannot be upgraded or modified. This affects all operational procedures involving smart contracts.

### Contract Monitoring

- **No Upgrade Path**: Monitor contract behavior carefully as bugs cannot be fixed post-deployment
- **Event Logging**: Track all contract events for audit trails and debugging
- **State Verification**: Regularly verify contract state matches expected values
- **Address Management**: Maintain permanent records of deployed contract addresses

### Incident Response

If critical issues are discovered in deployed contracts:

1. **Assess Impact**: Determine severity and affected users
2. **Communication**: Notify users of the issue and any workarounds
3. **Migration Planning**: Plan deployment of new contract instance if necessary
4. **User Migration**: Guide users to migrate to new contract address
5. **State Preservation**: Document existing state as it cannot be transferred

### Contract Address Records

Maintain a permanent record of all deployed contract addresses:

| Network | Contract Address | Deployment Date | Notes |
|---------|------------------|-----------------|-------|
| testnet | TBD | TBD | Development testing |
| mainnet | TBD | TBD | Production deployment |

## Authentication Reliability

### Nonce TTL Monitoring

**Constraint:** Authentication nonce TTL is hardcoded to 5 minutes (300,000ms) by default. This can cause authentication failures for users with slow connections.

#### Monitoring Metrics

Track the following metrics to identify nonce expiration issues:

- **Nonce expiration rate**: Percentage of authentication failures due to expired nonces
- **Average authentication time**: Time between challenge request and verification
- **Regional failure rates**: Authentication failures by geographic region
- **Wallet-specific failures**: Failure rates by wallet implementation

#### Operational Recommendations

- **Environment Configuration**: Set `AUTH_NONCE_TTL_MS` explicitly in production (consider 10-15 minutes)
- **Error Tracking**: Monitor logs for "Invalid or expired nonce" errors
- **User Support**: Prepare troubleshooting guides for nonce expiration issues
- **Performance Testing**: Regularly test authentication flows under various network conditions

## Database Backup & Restore

### Overview

This document describes the database backup and restore procedures for StellarBounty. Automated backups run daily via GitHub Actions, and a daily verification workflow ensures backups are restorable.

**Backend database:** PostgreSQL (16+)

---

### Backup Strategy

| Schedule | Type | Storage | Retention |
|----------|------|---------|-----------|
| Daily at 02:00 UTC | Full `pg_dump` (custom format, compressed) | S3 object storage | 30 days |
| Daily at 04:00 UTC | Verification (latest, 14-day, and WAL-PITR-style restore checks) | Ephemeral (CI) | — |

---

### Backup Script: `scripts/backup-db.sh`

Creates a timestamped, compressed PostgreSQL dump using `pg_dump --format=custom`.

#### Usage

```bash
# Prerequisites
export DATABASE_URL="postgresql://user:password@host:5432/stellar_bounty"

# Local backup only
./scripts/backup-db.sh

# Local backup + S3 upload
./scripts/backup-db.sh --s3
```

#### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string |
| `BACKUP_DIR` | `./backups` | No | Local backup directory |
| `BACKUP_S3_BUCKET` | `stellar-bounty-db-backups` | No | S3 bucket for remote storage |
| `BACKUP_RETENTION_DAYS` | `7` | No | Local backup retention period |
| `AWS_DEFAULT_REGION` | `us-east-1` | No | AWS region |

> AWS credentials are obtained automatically via OIDC; static
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are no longer required
> for CI. See "AWS OIDC Trust" below.

#### Output

- **Backup file:** `backups/stellar_bounty_YYYYMMDD_HHMMSS.dump`
- **Latest symlink:** `backups/latest.dump` (always points to most recent backup)

#### Crontab Example (self-hosted)

If you prefer a cron job instead of GitHub Actions:

```bash
# Run daily at 2:00 AM
0 2 * * * cd /path/to/StellarBounty && DATABASE_URL="postgresql://..." ./scripts/backup-db.sh --s3 >> /var/log/stellar-bounty-backup.log 2>&1
```

---

### Restore Script: `scripts/restore-db.sh`

Restores a PostgreSQL database from a custom-format dump.

#### Usage

```bash
# Prerequisites
export DATABASE_URL="postgresql://user:password@host:5432/stellar_bounty"

# Restore latest local backup
./scripts/restore-db.sh

# Restore specific backup file
./scripts/restore-db.sh ./backups/stellar_bounty_20260616_020000.dump

# Restore from S3
./scripts/restore-db.sh --s3 latest.dump

# Skip confirmation prompt (non-interactive / CI)
export CONFIRM_DESTROY=yes
./scripts/restore-db.sh backups/latest.dump
```

#### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | **Target** PostgreSQL connection string |
| `BACKUP_DIR` | `./backups` | No | Local backup directory |
| `BACKUP_S3_BUCKET` | `stellar-bounty-db-backups` | No | S3 bucket for remote download |
| `CONFIRM_DESTROY` | — | No | Set to `yes` to skip destructive warning |
| `AWS_DEFAULT_REGION` | `us-east-1` | No | AWS region |

> AWS credentials are obtained automatically via OIDC; static
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are no longer required
> for CI. See "AWS OIDC Trust" below.

#### ⚠️  Important

- **This is a destructive operation.** The target database will be dropped and recreated.
- Always test restores on a staging environment first.
- After restore, run database migrations to bring the schema up to date:

```bash
npm run migration:run
```

---

### GitHub Actions Workflows

#### 1. Database Backup (`backup.yml`)

- **Trigger:** Daily at 02:00 UTC (`0 2 * * *`) + manual dispatch
- **Steps:**
  1. Start a PostgreSQL service container
  2. Install PostgreSQL client tools
  3. Run `scripts/backup-db.sh` against the service DB
  4. Configure AWS credentials from GitHub Secrets
  5. Upload backup to S3
  6. Verify backup file integrity
  7. Create GitHub Issue on failure

- **Required variables / secrets** (no AWS access keys):
  - `AWS_ACCOUNT_ID`            (variable — your AWS account id)
  - `AWS_DEFAULT_REGION`        (variable, defaults to `us-east-1`)
  - `BACKUP_S3_BUCKET`          (variable — defaults to `stellar-bounty-db-backups`)

AWS credentials are obtained via OIDC; see "AWS OIDC Trust" below.

#### 2. Backup Verification (`backup-verify.yml`)

- **Trigger:** Daily at 04:00 UTC + on push to `main` that modifies backup scripts + manual dispatch
- **Steps:**
  1. Start a PostgreSQL service container
  2. Create test tables with sample data (bounties, nonces, submissions)
  3. Run `scripts/backup-db.sh`
  4. Verify backup file exists and is a valid custom-format dump
  5. Run three restore verifications:
     - Latest backup restore
     - 14-day-old backup restore
     - WAL-PITR-style restore at a -3h snapshot
  6. Verify each restore's data integrity and produce a diff on mismatch
  7. Clean up test databases
  8. Create a high-priority infrastructure GitHub Issue on failure

---

### Setting Up S3 Bucket

If using AWS S3 for backup storage, create a bucket with the following configuration:

```bash
# Create bucket
aws s3 mb s3://stellar-bounty-db-backups --region us-east-1

# Enable versioning (optional but recommended)
aws s3api put-bucket-versioning \
  --bucket stellar-bounty-db-backups \
  --versioning-configuration Status=Enabled

# Set lifecycle policy — expire after 30 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket stellar-bounty-db-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-backups",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": { "Days": 30 }
    }]
  }'

# Restrict access with bucket policy (example)
aws s3api put-bucket-policy \
  --bucket stellar-bounty-db-backups \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::ACCOUNT_ID:role/github-actions-role"
        },
        "Action": [
          "s3:PutObject",
          "s3:GetObject"
        ],
        "Resource": "arn:aws:s3:::stellar-bounty-db-backups/*"
      }
    ]
  }'
```

> **Note:** Replace `ACCOUNT_ID` with your actual AWS account ID and create an appropriate IAM role for GitHub Actions OIDC.

---

### Disaster Recovery Procedure

In the event of a database failure, follow these steps:

1. **Stop the application** to prevent further data writes:

   ```bash
   docker-compose down backend
   ```

2. **Restore the latest backup:**

   ```bash
   export DATABASE_URL="postgresql://postgres:password@localhost:5432/stellar_bounty"
   ./scripts/restore-db.sh backups/latest.dump
   ```

  Or restore from S3 if local backups are unavailable (OIDC works for
  self-hosted dev too — use `aws sso login` or an AWS profile):

  ```bash
  ./scripts/restore-db.sh --s3 latest.dump
  ```

3. **Run migrations:**

   ```bash
   npm run migration:run
   ```

4. **Verify data integrity:**

   ```bash
   # Quick row counts
   PGPASSWORD=password psql -h localhost -U postgres -d stellar_bounty -c "SELECT COUNT(*) FROM bounties;"
   PGPASSWORD=password psql -h localhost -U postgres -d stellar_bounty -c "SELECT COUNT(*) FROM nonces;"
   PGPASSWORD=password psql -h localhost -U postgres -d stellar_bounty -c "SELECT COUNT(*) FROM submissions;"
   ```

5. **Restart the application:**

   ```bash
   docker-compose up -d backend
   ```

6. **Verify application health:**

   ```bash
   curl http://localhost:4000/health
   ```

---

### S3 Backup Lifecycle

Backups stored in S3 are automatically removed after 30 days via the bucket lifecycle policy. To restore from an older backup (within 30 days), list available backups:

```bash
aws s3 ls s3://stellar-bounty-db-backups/
```

Select the desired backup file and restore:

```bash
./scripts/restore-db.sh --s3 stellar_bounty_20260601_020000.dump
```

---

### Security Considerations

- **Backup files contain sensitive data** (user information, authentication nonces). Ensure S3 bucket policy restricts access appropriately.
- Backups should be encrypted at rest (S3 server-side encryption is enabled by default).
- Never commit backup files to the Git repository. The `backups/` directory is included in `.gitignore`.
- Static AWS access keys are no longer used in CI — see "AWS OIDC Trust" below.

---

### AWS OIDC Trust (replaces long-lived IAM access keys)

CI workflows authenticate to AWS via **OIDC federation** instead of
long-lived IAM access keys stored in GitHub secrets. Eliminates a
whole class of credential-leak risk.

#### Why

- **No static secrets in GitHub.** No `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` ever sit in repo secrets.
- **Short-lived credentials.** `aws-actions/configure-aws-credentials@v4`
  mints a session that expires within ~1 hour.
- **Scoped trust.** The trust policy on the IAM role restricts which
  refs / GitHub-Actions environments can assume it via the OIDC JWT
  `sub` claim.
- **Auditable.** Every AWS API call is attributed to a GitHub Actions
  run id via `role-session-name`.

#### One-time bootstrap

Run `scripts/setup-aws-oidc.sh` once per AWS account. The script is
idempotent and prints the role ARN at the end.

```bash
export AWS_ACCOUNT_ID=123456789012              # your AWS account id
export GITHUB_REPO=BountyOnChain/StellarBounty  # owner/repo
export BACKUP_S3_BUCKET=stellar-bounty-db-backups
export AWS_REGION=us-east-1

./scripts/setup-aws-oidc.sh
# Optional: print commands without executing
DRY_RUN=1 ./scripts/setup-aws-oidc.sh
```

The script will (or skip-if-exists):

1. Create an IAM OIDC provider for `token.actions.githubusercontent.com`.
2. Create the `github-actions-role` IAM role with a trust policy
   that restricts JWT `sub` claims to:
   - `repo:BountyOnChain/StellarBounty:ref:refs/heads/main`
   - `repo:BountyOnChain/StellarBounty:ref:refs/tags/v*`
   - `repo:BountyOnChain/StellarBounty:environment:*`
3. Attach the inline policy `github-actions-s3-backup` scoped to
   `s3:PutObject` / `s3:GetObject` / `s3:ListBucket` / `s3:GetBucketLocation`
   on the backup bucket only, plus minimal ECR push permissions.
4. Print the role ARN. Save the output.

#### GitHub repo configuration

In **Settings → Secrets and variables → Actions**:

Variables:

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `AWS_ACCOUNT_ID`     | yes | `123456789012`   | AWS account hosting the role |
| `AWS_DEFAULT_REGION` | yes | `us-east-1`      | Region for S3 + ECR |
| `BACKUP_S3_BUCKET`   | yes | `stellar-bounty-db-backups` | Override of the default backup bucket |
| `BACKEND_URL`        | opt | `https://api.stellarbounty.example` | Override smoke-test target |
| `FRONTEND_URL`       | opt | `https://stellarbounty.example`    | Override smoke-test target |

Secrets (still needed — no AWS keys!):

| Secret | Description |
|--------|-------------|
| `PAGERDUTY_ROUTING_KEY` | PagerDuty Events API v2 routing key. Required by `infrastructure/alertmanager/alertmanager.yml`. |
| `SLACK_WEBHOOK_URL`     | Slack incoming webhook URL for Alertmanager (`#alerts-critical`, `#alerts-warnings`, `#alerts-general`). |

#### After the workflow migration is verified

You may DELETE from GitHub secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

(Retain them in your password manager / AWS account in case the
decommission encounters a regression — but they are no longer used
by this repo.)

#### Workflow snippet

```yaml
permissions:
  contents: read
  id-token: write
steps:
  - uses: actions/checkout@v4
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::${{ vars.AWS_ACCOUNT_ID }}:role/github-actions-role
      role-session-name: stellarbounty-${{ github.run_id }}
      aws-region: ${{ vars.AWS_DEFAULT_REGION || 'us-east-1' }}
```

The `id-token: write` permission is mandatory — without it GitHub does
not mint an OIDC token and `configure-aws-credentials` fails with
`No OIDC token found`.

#### OIDC backout / troubleshooting

If a workflow fails with `Error: Could not assume role with OIDC` or
`Error: No OIDC token found`:

1. Confirm the workflow declares `permissions: id-token: write` (and
   `contents: read`).
2. Confirm `vars.AWS_ACCOUNT_ID` is set; the role ARN is
   `arn:aws:iam::${AWS_ACCOUNT_ID}:role/github-actions-role`.
3. Re-run `scripts/setup-aws-oidc.sh` (idempotent) and verify the
   role's trust policy contains
   `repo:BountyOnChain/StellarBounty:ref:refs/heads/main`
   (or whichever `sub` pattern matches the failing workflow).
4. Decode the failing JWT (`$_ACTIONS_ID_TOKEN_REQUEST_TOKEN`) and
   confirm the `sub` claim matches the trust policy's `StringLike`.
   Use `jq -R 'split(".") | .[1] | @base64d | fromjson'`.
5. If the JWT's `aud` is not `sts.amazonaws.com`, your GitHub Actions
   setup is mismatched — confirm `OIDC_AUDIENCE` in
   `scripts/setup-aws-oidc.sh` is `sts.amazonaws.com`.

#### Rotating the role

To rotate the IAM role:

1. Run `./scripts/setup-aws-oidc.sh` with `ROLE_NAME=github-actions-role-v2`.
2. Update the `role-to-assume` line in each workflow.
3. After verification, delete the old IAM role via
   `aws iam delete-role --role-name github-actions-role`.

---


### Alertmanager configuration

The repository ships `infrastructure/alertmanager/alertmanager.yml`,
which routes Prometheus alerts by severity:

| Severity | Receiver | Channel |
|----------|----------|---------|
| `critical` | `pagerduty-critical` + `slack-critical` (via `continue: true`) | PagerDuty page + `#alerts-critical` |
| `warning`  | `slack-warnings` | `#alerts-warnings` (12h repeat) |
| `info`     | `slack-default` | `#alerts-general` |
| (unmatched)| `slack-default` | `#alerts-general` |

Alertmanager itself does NOT perform env-var substitution in YAML
configs (unlike Prometheus rule files). The `${...}` placeholders are
resolved by an `envsubst` step before launching — the rendered file
is what Alertmanager loads.

Required env vars on the host:

- `PAGERDUTY_ROUTING_KEY`
- `SLACK_WEBHOOK_URL`

Render templated secrets and launch:

\`\`\`bash
envsubst < infrastructure/alertmanager/alertmanager.yml \
         > /tmp/alertmanager.rendered.yml

docker run --rm \
  --env-file <(printf 'PAGERDUTY_ROUTING_KEY=%s\nSLACK_WEBHOOK_URL=%s\n' \
                "$PAGERDUTY_ROUTING_KEY" "$SLACK_WEBHOOK_URL") \
  -v /tmp/alertmanager.rendered.yml:/etc/alertmanager/alertmanager.yml:ro \
  --network host \
  prom/alertmanager:v0.27.0 \
    --config.file=/etc/alertmanager/alertmanager.yml \
    --storage.path=/alertmanager
\`\`\`

In Kubernetes / Nomad, set the same env vars on the `alertmanager`
pod spec and run the `envsubst` step as an initContainer.

#### Reloading rules

Prometheus rule changes ship via this repo. After merging a PR that
modifies `infrastructure/prometheus/rules.yml`, reload Prometheus:

\`\`\`bash
curl -X POST http://prometheus:9090/-/reload
\`\`\`

Verify the new rules are loaded:

\`\`\`bash
curl -s http://prometheus:9090/api/v1/rules \
  | jq '.data.groups[].rules[] | {name, alert:.alert, labels:.labels}'
\`\`\`

If a fired alert is missing its `runbook_url` annotation, the running
rules are out of sync — re-apply the repo version.

---
### Troubleshooting

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `pg_dump: error: connection to server ... failed` | DATABASE_URL incorrect or database not running | Verify PostgreSQL is running and connection string is correct |
| `pg_restore: error: could not open input file` | Backup file path incorrect | Check the file exists: `ls -la backups/` |
| `ERROR: must be owner of ...` | Running as non-superuser | Use `--no-owner` flag (already in scripts) |
| S3 upload fails | Missing credentials | Verify AWS credentials are set and have `s3:PutObject` permission |
| Backup verification fails in CI | Schema mismatch | Update verification workflow to match current schema |
