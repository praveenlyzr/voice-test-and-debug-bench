#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AWS_PROFILE="${AWS_PROFILE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
SECRETS_FILE="${SECRETS_FILE:-$REPO_ROOT/secrets}"
STATE_FILE="${STATE_FILE:-$REPO_ROOT/aws-resources.json}"

AMPLIFY_APP_NAME="${AMPLIFY_APP_NAME:-livekit-frontend}"
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

log_warn() {
  echo "[WARN] $1"
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

Optional:
  AMPLIFY_APP_NAME=livekit-frontend
  AMPLIFY_BRANCH=main
  AMPLIFY_PLATFORM=WEB_COMPUTE
  AMPLIFY_START_JOB=true|false
  AWS_PROFILE=dev AWS_REGION=us-east-1

The script reads LiveKit settings from livekit/secrets and aws-resources.json.
EOF
}

if ! command -v aws >/dev/null 2>&1; then
  log_error "AWS CLI not found."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  log_error "jq not found. Install it: brew install jq"
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

if [ -z "$LIVEKIT_URL" ]; then
  if [ -n "$LIVEKIT_DOMAIN" ]; then
    LIVEKIT_URL="wss://${LIVEKIT_DOMAIN}"
  elif [ -f "$STATE_FILE" ]; then
    ELASTIC_IP=$(jq -r '.backend.elastic_ip // empty' "$STATE_FILE")
    if [ -n "$ELASTIC_IP" ]; then
      LIVEKIT_URL="ws://${ELASTIC_IP}:7880"
    fi
  fi
fi

if [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ] || [ -z "$LIVEKIT_URL" ]; then
  log_error "Missing LiveKit settings. Ensure LIVEKIT_API_KEY/SECRET and LIVEKIT_URL (or LIVEKIT_DOMAIN) are set."
  exit 1
fi

ENV_MAP="LIVEKIT_URL=${LIVEKIT_URL},LIVEKIT_API_KEY=${LIVEKIT_API_KEY},LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}"

if [ -z "$AMPLIFY_APP_ID" ]; then
  log_info "Looking up Amplify app by name: ${AMPLIFY_APP_NAME}"
  AMPLIFY_APP_ID=$(aws amplify list-apps \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId | [0]" \
    --output text)
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
  AMPLIFY_APP_ID=$(aws amplify create-app \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --name "$AMPLIFY_APP_NAME" \
    --platform "$AMPLIFY_PLATFORM" \
    --repository "$AMPLIFY_REPOSITORY" \
    "${TOKEN_FLAG[@]}" \
    --environment-variables "$ENV_MAP" \
    --enable-branch-auto-build \
    --query 'app.appId' --output text)
  log_info "Amplify app created: ${AMPLIFY_APP_ID}"
else
  log_info "Using Amplify app: ${AMPLIFY_APP_ID}"
fi

if ! aws amplify get-branch \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$AMPLIFY_BRANCH" >/dev/null 2>&1; then
  log_info "Creating Amplify branch: ${AMPLIFY_BRANCH}"
  aws amplify create-branch \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$AMPLIFY_BRANCH" \
    --enable-auto-build >/dev/null
fi

log_info "Updating Amplify environment variables for ${AMPLIFY_BRANCH}"
aws amplify update-branch \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$AMPLIFY_BRANCH" \
  --environment-variables "$ENV_MAP" >/dev/null

if [ "${AMPLIFY_START_JOB}" = "true" ]; then
  log_info "Starting Amplify build (RELEASE) on ${AMPLIFY_BRANCH}"
  aws amplify start-job \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$AMPLIFY_BRANCH" \
    --job-type RELEASE >/dev/null
fi

log_info "Amplify deploy triggered."
log_info "App ID: ${AMPLIFY_APP_ID}"
log_info "Branch: ${AMPLIFY_BRANCH}"
log_info "LIVEKIT_URL: ${LIVEKIT_URL}"
log_info "Check build status in the Amplify Console."
