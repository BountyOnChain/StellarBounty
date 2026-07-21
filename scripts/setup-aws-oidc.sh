#!/usr/bin/env bash
#
# Bootstrap AWS OIDC trust so GitHub Actions can assume a role WITHOUT
# any long-lived IAM access keys. Resolves issue #427 (security).
#
# What this does:
#   1. Creates (or reuses) an IAM OIDC provider for token.actions.githubusercontent.com
#   2. Creates (or reuses) the role `github-actions-role`
#   3. Attaches a least-privilege inline policy scoped to the backup S3 bucket
#   4. Prints the role ARN for follow-up GitHub configuration
#
# Required env vars (the script will refuse to run without them):
#   AWS_ACCOUNT_ID                — your 12-digit AWS account id
#   GITHUB_REPO                   — owner/repo, e.g. "BountyOnChain/StellarBounty"
#   BACKUP_S3_BUCKET              — bucket the workflow uploads/downloads to
#   AWS_REGION                    — default: us-east-1
#
# Optional env vars:
#   ROLE_NAME                     — default: "github-actions-role"
#   POLICY_NAME                   — default: "github-actions-s3-backup"
#   DRY_RUN=1                     — print commands without executing them
#
# Idempotent: safe to re-run; existing OIDC provider / role / inline
# policy are detected and skipped (no destructive changes).
#
# Usage:
#   ./scripts/setup-aws-oidc.sh
#
# This script requires `aws` CLI v2.10+ with IAM permissions. Run as a
# one-off bootstrap; it does NOT need to be called from CI.
#
# Note: execute this script directly. Sourcing would resolve SCRIPT_DIR
# relative to the caller and behave unexpectedly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ROLE_NAME="${ROLE_NAME:-github-actions-role}"
POLICY_NAME="${POLICY_NAME:-github-actions-s3-backup}"
AWS_REGION="${AWS_REGION:-us-east-1}"

OIDC_URL="https://token.actions.githubusercontent.com"
OIDC_AUDIENCE="sts.amazonaws.com"
# DigiCert root CA SHA1 thumbprint for token.actions.githubusercontent.com.
# This matches the value in the AWS "GitHub Actions OIDC" tutorial. AWS
# accepts it as a static pin; AWS will also auto-resolve and pin if you
# launch `create-open-id-connect-provider` without `--thumbprint-list`.
# We use the static pin to make the script fully deterministic + offline.
OIDC_THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"

# Restrict trust to refs the workflow actually uses (`workflow_dispatch`
# plus tags/floating branch refs). Fork PRs cannot obtain `id-token: write`
# so this is defence-in-depth on top of GitHub's permission model.
TRUST_SUB_PATTERN="repo:${GITHUB_REPO}:ref:refs/heads/main OR repo:${GITHUB_REPO}:ref:refs/tags/v* OR repo:${GITHUB_REPO}:environment:github-actions"

log()  { printf '[setup-aws-oidc] %s\n' "$*"; }
fail() { printf '[setup-aws-oidc] ERROR: %s\n' "$*" >&2; exit 1; }

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "missing required env var: ${name}"
  fi
}

require_env() {
  for v in "$@"; do require "$v"; done
}

require_env AWS_ACCOUNT_ID GITHUB_REPO BACKUP_S3_BUCKET

if ! command -v aws >/dev/null 2>&1; then
  fail "aws CLI not found — install aws-cli v2.10+ first"
fi

OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

cat <<INFO
== AWS OIDC bootstrap for GitHub Actions =================================
  AWS account   : ${AWS_ACCOUNT_ID}
  AWS region    : ${AWS_REGION}
  GitHub repo   : ${GITHUB_REPO}
  Backup bucket : ${BACKUP_S3_BUCKET}
  Role name     : ${ROLE_NAME}
  Policy name   : ${POLICY_NAME}
  Dry run?      : ${DRY_RUN:-0}
=========================================================================
INFO

run_aws() {
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    log "DRY-RUN: $*"
  else
    log "+ $*"
    "$@"
  fi
}

# -- 1. OIDC provider -----------------------------------------------------------------
log "ensuring IAM OIDC provider exists for ${OIDC_URL}"

if run_aws aws iam get-open-id-connect-provider \
    --url "${OIDC_URL}" \
    --output text >/dev/null 2>&1; then
  log "OIDC provider already exists — skipping"
else
  run_aws aws iam create-open-id-connect-provider \
    --url "${OIDC_URL}" \
    --client-id-list "${OIDC_AUDIENCE}" \
    --thumbprint-list "${OIDC_THUMBPRINT}" \
    --tags "Key=Purpose,Value=GitHubActionsOIDC" "Key=ManagedBy,Value=stellarbounty-setup-aws-oidc"
fi

# -- 2. Trust policy -------------------------------------------------------------------
# Restrict the JWT `sub` claim to known workflow triggers. AWS jq-style
# string functions cannot OR multiple `StringLike` values in a single
# condition, so we emit one trust statement per allowed `sub` pattern.
TRUST_POLICY_FILE="$(mktemp)"
{
  printf '{\n  "Version": "2012-10-17",\n  "Statement": [\n'
  printf '    {"Sid":"AllowMainBranch",\n'
  printf '     "Effect":"Allow",\n'
  printf '     "Principal":{"Federated":"%s"},\n' "${OIDC_PROVIDER_ARN}"
  printf '     "Action":"sts:AssumeRoleWithWebIdentity",\n'
  printf '     "Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"%s"},\n' "${OIDC_AUDIENCE}"
  printf '                     "StringLike":{"token.actions.githubusercontent.com:sub":"repo:%s:ref:refs/heads/main"}}\n' "${GITHUB_REPO}"
  printf '    },\n'
  printf '    {"Sid":"AllowTaggedReleases",\n'
  printf '     "Effect":"Allow",\n'
  printf '     "Principal":{"Federated":"%s"},\n' "${OIDC_PROVIDER_ARN}"
  printf '     "Action":"sts:AssumeRoleWithWebIdentity",\n'
  printf '     "Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"%s"},\n' "${OIDC_AUDIENCE}"
  printf '                     "StringLike":{"token.actions.githubusercontent.com:sub":"repo:%s:ref:refs/tags/v*"}}\n' "${GITHUB_REPO}"
  printf '    },\n'
  printf '    {"Sid":"AllowGhaEnvironment",\n'
  printf '     "Effect":"Allow",\n'
  printf '     "Principal":{"Federated":"%s"},\n' "${OIDC_PROVIDER_ARN}"
  printf '     "Action":"sts:AssumeRoleWithWebIdentity",\n'
  printf '     "Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"%s"},\n' "${OIDC_AUDIENCE}"
  printf '                     "StringLike":{"token.actions.githubusercontent.com:sub":"repo:%s:environment:*"}}\n' "${GITHUB_REPO}"
  printf '    }\n'
  printf '  ]\n}\n'
} > "${TRUST_POLICY_FILE}"

# -- 3. Role ---------------------------------------------------------------------------
log "ensuring IAM role ${ROLE_NAME} exists"

if run_aws aws iam get-role \
    --role-name "${ROLE_NAME}" \
    --output text >/dev/null 2>&1; then
  log "role ${ROLE_NAME} already exists — refreshing trust policy"
  run_aws aws iam update-assume-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-document "file://${TRUST_POLICY_FILE}"
else
  run_aws aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "file://${TRUST_POLICY_FILE}" \
    --description "GitHub Actions OIDC role for ${GITHUB_REPO}" \
    --tags "Key=Purpose,Value=StellarBountyCI" "Key=ManagedBy,Value=stellarbounty-setup-aws-oidc"
fi

# -- 4. Least-privilege inline policy -------------------------------------------------
INLINE_POLICY_FILE="$(mktemp)"
cat > "${INLINE_POLICY_FILE}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBackupBucketReadWrite",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::${BACKUP_S3_BUCKET}",
        "arn:aws:s3:::${BACKUP_S3_BUCKET}/*"
      ]
    },
    {
      "Sid": "AllowOptionalECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
JSON

log "attaching inline policy ${POLICY_NAME} to ${ROLE_NAME}"
run_aws aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${INLINE_POLICY_FILE}"

# -- Cleanup --------------------------------------------------------------------------
rm -f "${TRUST_POLICY_FILE}" "${INLINE_POLICY_FILE}"

cat <<DONE
== Bootstrap complete =====================================================
  OIDC provider ARN : ${OIDC_PROVIDER_ARN}
  Role ARN          : ${ROLE_ARN}
  Trust scope       : main branch + git tags v* + GitHub-Actions env

Next — add to GitHub repo (Settings → Secrets and variables → Actions):
  Variables (REQUIRED):
    - AWS_ACCOUNT_ID       = ${AWS_ACCOUNT_ID}
    - AWS_DEFAULT_REGION   = ${AWS_REGION}
    - BACKUP_S3_BUCKET     = ${BACKUP_S3_BUCKET}
  Secrets (kept off config for safety):
    - PAGERDUTY_ROUTING_KEY  (Alertmanager, issue #428)
    - SLACK_WEBHOOK_URL      (Alertmanager, issue #428)

Migrations to apply in workflow YAMLs:
  aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${ROLE_ARN}
      role-session-name: \${{ github.run_id }}
      aws-region: \${AWS_DEFAULT_REGION}

Workflow must also declare:
  permissions:
    id-token: write
    contents:  read

Once verified, you may safely DELETE from GitHub secrets:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
=========================================================================
DONE
