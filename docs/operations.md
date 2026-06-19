# Operations Runbook

## Database Backup & Restore

### Overview

This document describes the database backup and restore procedures for StellarBounty. Automated backups run daily via GitHub Actions, and a weekly verification workflow ensures backups are restorable.

**Backend database:** PostgreSQL (16+)

---

### Backup Strategy

| Schedule | Type | Storage | Retention |
|----------|------|---------|-----------|
| Daily at 02:00 UTC | Full `pg_dump` (custom format, compressed) | S3 object storage | 30 days |
| Weekly on Sunday at 04:00 UTC | Verification (restore + integrity check) | Ephemeral (CI) | — |

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
| `AWS_ACCESS_KEY_ID` | — | For S3 | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | For S3 | AWS secret key |
| `AWS_DEFAULT_REGION` | `us-east-1` | No | AWS region |

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
| `AWS_ACCESS_KEY_ID` | — | For S3 | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | For S3 | AWS secret key |
| `AWS_DEFAULT_REGION` | `us-east-1` | No | AWS region |

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

- **Required Secrets:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `BACKUP_S3_BUCKET` (optional — defaults to `stellar-bounty-db-backups`)

#### 2. Backup Verification (`backup-verify.yml`)

- **Trigger:** Weekly on Sunday at 04:00 UTC + on push to `main` that modifies backup scripts + manual dispatch
- **Steps:**
  1. Start a PostgreSQL service container
  2. Create test tables with sample data (bounties, nonces, submissions)
  3. Run `scripts/backup-db.sh`
  4. Verify backup file exists and is a valid custom-format dump
  5. Create a fresh database and restore the backup into it
  6. Verify data integrity (row counts, content checks)
  7. Clean up test databases
  8. Create GitHub Issue on failure

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

   Or restore from S3 if local backups are unavailable:

   ```bash
   export AWS_ACCESS_KEY_ID="..."
   export AWS_SECRET_ACCESS_KEY="..."
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
- Use IAM roles (OIDC) for GitHub Actions instead of long-lived access keys where possible.
- Backups should be encrypted at rest (S3 server-side encryption is enabled by default).
- Never commit backup files to the Git repository. The `backups/` directory is included in `.gitignore`.

---

### Troubleshooting

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `pg_dump: error: connection to server ... failed` | DATABASE_URL incorrect or database not running | Verify PostgreSQL is running and connection string is correct |
| `pg_restore: error: could not open input file` | Backup file path incorrect | Check the file exists: `ls -la backups/` |
| `ERROR: must be owner of ...` | Running as non-superuser | Use `--no-owner` flag (already in scripts) |
| S3 upload fails | Missing credentials | Verify AWS credentials are set and have `s3:PutObject` permission |
| Backup verification fails in CI | Schema mismatch | Update verification workflow to match current schema |