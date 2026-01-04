#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

AWS_PROFILE="${AWS_PROFILE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
SECRETS_FILE="${SECRETS_FILE:-$REPO_ROOT/.env.deploy}"
STATE_FILE="${STATE_FILE:-$REPO_ROOT/aws-resources.json}"

AMPLIFY_APP_NAME="${AMPLIFY_APP_NAME:-voice-test-and-debug-bench}"
AMPLIFY_APP_ID="${AMPLIFY_APP_ID:-}"
AMPLIFY_BRANCH="${AMPLIFY_BRANCH:-main}"
AMPLIFY_PLATFORM="${AMPLIFY_PLATFORM:-WEB_COMPUTE}"
AMPLIFY_REPOSITORY="${AMPLIFY_REPOSITORY:-}"
AMPLIFY_ACCESS_TOKEN="${AMPLIFY_ACCESS_TOKEN:-}"
AMPLIFY_OAUTH_TOKEN="${AMPLIFY_OAUTH_TOKEN:-}"
AMPLIFY_START_JOB="${AMPLIFY_START_JOB:-true}"

log_info() {
  echo "[INFO] $1"
}

log_error() {
  echo "[ERROR] $1" >&2
}

show_usage() {
  cat <<EOF
Usage: ./deploy-amplify.sh

Required (one of):
  - AMPLIFY_APP_ID (use an existing Amplify app)
  - AMPLIFY_REPOSITORY + AMPLIFY_ACCESS_TOKEN/AMPLIFY_OAUTH_TOKEN (create a new app)

LiveKit configuration:
  - Provide LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET via environment
  - OR create $SECRETS_FILE with those values (not committed)
  - Optional: LIVEKIT_DOMAIN (used to build LIVEKIT_URL as wss://<domain>)

CloudWatch logs (optional):
  - NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS, ENABLE_CLOUDWATCH_LOGS
  - CLOUDWATCH_REGION, CLOUDWATCH_LOG_GROUP, CLOUDWATCH_STREAM_PREFIX, CLOUDWATCH_LOGS_TOKEN
  - Note: Amplify blocks env vars starting with AWS_

Optional:
  AMPLIFY_APP_NAME=voice-test-and-debug-bench
  AMPLIFY_BRANCH=main
  AMPLIFY_PLATFORM=WEB_COMPUTE
  AMPLIFY_START_JOB=true|false
  AWS_PROFILE=dev AWS_REGION=us-east-1
EOF
}

if ! command -v aws >/dev/null 2>&1; then
  log_error "AWS CLI not found."
  exit 1
fi

if [ -f "$SECRETS_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$SECRETS_FILE"
  set +a
fi

LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-}"
LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-}"
LIVEKIT_URL="${LIVEKIT_URL:-}"
CLOUDWATCH_REGION="${CLOUDWATCH_REGION:-}"
CLOUDWATCH_LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-}"
CLOUDWATCH_STREAM_PREFIX="${CLOUDWATCH_STREAM_PREFIX:-}"
CLOUDWATCH_LOGS_TOKEN="${CLOUDWATCH_LOGS_TOKEN:-}"
ENABLE_CLOUDWATCH_LOGS="${ENABLE_CLOUDWATCH_LOGS:-}"
NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS="${NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS:-}"
APP_CLOUDWATCH_REGION="${CLOUDWATCH_REGION:-${AWS_REGION:-}}"

if [ -z "$LIVEKIT_URL" ] && [ -n "$LIVEKIT_DOMAIN" ]; then
  LIVEKIT_URL="wss://${LIVEKIT_DOMAIN}"
fi

if [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ] || [ -z "$LIVEKIT_URL" ]; then
  log_error "Missing LiveKit settings. Ensure LIVEKIT_URL (or LIVEKIT_DOMAIN), LIVEKIT_API_KEY, LIVEKIT_API_SECRET are set."
  exit 1
fi

ENV_MAP="LIVEKIT_URL=${LIVEKIT_URL},LIVEKIT_API_KEY=${LIVEKIT_API_KEY},LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}"

append_env() {
  local key="$1"
  local value="$2"
  if [ -n "$value" ]; then
    ENV_MAP="${ENV_MAP},${key}=${value}"
  fi
}

append_env "CLOUDWATCH_REGION" "$APP_CLOUDWATCH_REGION"
append_env "CLOUDWATCH_LOG_GROUP" "$CLOUDWATCH_LOG_GROUP"
append_env "CLOUDWATCH_STREAM_PREFIX" "$CLOUDWATCH_STREAM_PREFIX"
append_env "CLOUDWATCH_LOGS_TOKEN" "$CLOUDWATCH_LOGS_TOKEN"
append_env "ENABLE_CLOUDWATCH_LOGS" "$ENABLE_CLOUDWATCH_LOGS"
append_env "NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS" "$NEXT_PUBLIC_ENABLE_CLOUDWATCH_LOGS"

update_state_file() {
  if [ -z "$AMPLIFY_APP_ID" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    log_error "python3 not found; skipping frontend AWS state update."
    return 0
  fi

  local compute_role_arn service_role_arn default_domain app_url
  compute_role_arn=$(aws amplify get-app \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.computeRoleArn' --output text 2>/dev/null || echo "")
  service_role_arn=$(aws amplify get-app \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.iamServiceRoleArn' --output text 2>/dev/null || echo "")
  default_domain=$(aws amplify get-app \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.defaultDomain' --output text 2>/dev/null || echo "")

  app_url=""
  if [ -n "$default_domain" ] && [ "$default_domain" != "None" ]; then
    app_url="https://${AMPLIFY_BRANCH}.${default_domain}"
  fi

  STATE_FILE="$STATE_FILE" \
  AMPLIFY_APP_ID="$AMPLIFY_APP_ID" \
  AMPLIFY_APP_NAME="$AMPLIFY_APP_NAME" \
  AMPLIFY_BRANCH="$AMPLIFY_BRANCH" \
  AWS_REGION="$AWS_REGION" \
  APP_URL="$app_url" \
  COMPUTE_ROLE_ARN="$compute_role_arn" \
  SERVICE_ROLE_ARN="$service_role_arn" \
  CLOUDWATCH_LOG_GROUP="$CLOUDWATCH_LOG_GROUP" \
  CLOUDWATCH_STREAM_PREFIX="$CLOUDWATCH_STREAM_PREFIX" \
  APP_CLOUDWATCH_REGION="$APP_CLOUDWATCH_REGION" \
  python3 - <<'PY'
import datetime
import json
import os

path = os.environ["STATE_FILE"]
data = {}
if os.path.exists(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
    except Exception:
        data = {}

amplify = data.get("amplify", {})
amplify.update({
    "app_id": os.environ.get("AMPLIFY_APP_ID") or None,
    "app_name": os.environ.get("AMPLIFY_APP_NAME") or None,
    "branch": os.environ.get("AMPLIFY_BRANCH") or None,
    "region": os.environ.get("AWS_REGION") or None,
    "app_url": os.environ.get("APP_URL") or None,
    "compute_role_arn": os.environ.get("COMPUTE_ROLE_ARN") or None,
    "service_role_arn": os.environ.get("SERVICE_ROLE_ARN") or None,
})
data["amplify"] = amplify

cloudwatch = data.get("cloudwatch", {})
cloudwatch.update({
    "region": os.environ.get("APP_CLOUDWATCH_REGION") or None,
    "log_group": os.environ.get("CLOUDWATCH_LOG_GROUP") or None,
    "stream_prefix": os.environ.get("CLOUDWATCH_STREAM_PREFIX") or None,
})
data["cloudwatch"] = cloudwatch
data["updated_at"] = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

  log_info "Updated frontend AWS state: $STATE_FILE"
}

if [ -z "$AMPLIFY_APP_ID" ]; then
  log_info "Looking up Amplify app by name: ${AMPLIFY_APP_NAME}"
  AMPLIFY_APP_ID=$(aws amplify list-apps     --profile "$AWS_PROFILE" --region "$AWS_REGION"     --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId | [0]"     --output text)
  if [ "$AMPLIFY_APP_ID" = "None" ]; then
    AMPLIFY_APP_ID=""
  fi
fi

if [ -z "$AMPLIFY_APP_ID" ]; then
  if [ -z "$AMPLIFY_REPOSITORY" ]; then
    log_error "AMPLIFY_APP_ID not found and AMPLIFY_REPOSITORY not set."
    show_usage
    exit 1
  fi

  TOKEN_FLAG=""
  if [ -n "$AMPLIFY_ACCESS_TOKEN" ]; then
    TOKEN_FLAG=(--access-token "$AMPLIFY_ACCESS_TOKEN")
  elif [ -n "$AMPLIFY_OAUTH_TOKEN" ]; then
    TOKEN_FLAG=(--oauth-token "$AMPLIFY_OAUTH_TOKEN")
  else
    log_error "Missing repo token. Set AMPLIFY_ACCESS_TOKEN or AMPLIFY_OAUTH_TOKEN."
    exit 1
  fi

  log_info "Creating Amplify app: ${AMPLIFY_APP_NAME}"
  AMPLIFY_APP_ID=$(aws amplify create-app     --profile "$AWS_PROFILE" --region "$AWS_REGION"     --name "$AMPLIFY_APP_NAME"     --platform "$AMPLIFY_PLATFORM"     --repository "$AMPLIFY_REPOSITORY"     "${TOKEN_FLAG[@]}"     --environment-variables "$ENV_MAP"     --enable-branch-auto-build     --query 'app.appId' --output text)
  log_info "Amplify app created: ${AMPLIFY_APP_ID}"
else
  log_info "Using Amplify app: ${AMPLIFY_APP_ID}"
fi

if ! aws amplify get-branch   --profile "$AWS_PROFILE" --region "$AWS_REGION"   --app-id "$AMPLIFY_APP_ID"   --branch-name "$AMPLIFY_BRANCH" >/dev/null 2>&1; then
  log_info "Creating Amplify branch: ${AMPLIFY_BRANCH}"
  aws amplify create-branch     --profile "$AWS_PROFILE" --region "$AWS_REGION"     --app-id "$AMPLIFY_APP_ID"     --branch-name "$AMPLIFY_BRANCH"     --enable-auto-build >/dev/null
fi

log_info "Updating Amplify environment variables for ${AMPLIFY_BRANCH}"
aws amplify update-branch   --profile "$AWS_PROFILE" --region "$AWS_REGION"   --app-id "$AMPLIFY_APP_ID"   --branch-name "$AMPLIFY_BRANCH"   --environment-variables "$ENV_MAP" >/dev/null

if [ "${AMPLIFY_START_JOB}" = "true" ]; then
  log_info "Starting Amplify build (RELEASE) on ${AMPLIFY_BRANCH}"
  aws amplify start-job     --profile "$AWS_PROFILE" --region "$AWS_REGION"     --app-id "$AMPLIFY_APP_ID"     --branch-name "$AMPLIFY_BRANCH"     --job-type RELEASE >/dev/null
fi

update_state_file

log_info "Amplify deploy triggered."
log_info "App ID: ${AMPLIFY_APP_ID}"
log_info "Branch: ${AMPLIFY_BRANCH}"
log_info "LIVEKIT_URL: ${LIVEKIT_URL}"
log_info "Check build status in the Amplify Console."
