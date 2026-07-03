#!/usr/bin/env bash
# Build and optionally push the MaaCare production Docker image.
# Usage:
#   ./scripts/docker-build-push.sh                 # build :latest
#   ./scripts/docker-build-push.sh v1.0.0          # build :v1.0.0 and push
#   ./scripts/docker-build-push.sh v1.0.0 --push   # explicit push
#
# Loads NEXT_PUBLIC_* build args from .env.production, then .env (first file found).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE_REPO="${DOCKER_IMAGE_REPO:-alifahmaddev/maacare}"
TAG="${1:-latest}"
PUSH="${DOCKER_PUSH:-0}"

if [[ "${2:-}" == "--push" ]] || [[ "${DOCKER_PUSH:-}" == "1" ]]; then
  PUSH=1
fi

ENV_FILE=""
for candidate in .env.production .env; do
  if [[ -f "$candidate" ]]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [[ -z "$ENV_FILE" ]]; then
  echo "error: create .env.production or .env with NEXT_PUBLIC_* values for the image build" >&2
  exit 1
fi

echo "==> Using env file: $ENV_FILE"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

BUILD_ARGS=(
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}"
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
  --build-arg "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-}"
  --build-arg "NEXT_PUBLIC_FB_APP_ID=${NEXT_PUBLIC_FB_APP_ID:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-}"
  --build-arg "NEXT_PUBLIC_FIREBASE_VAPID_KEY=${NEXT_PUBLIC_FIREBASE_VAPID_KEY:-}"
  --build-arg "NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL:-}"
  --build-arg "NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION:-${TAG}}"
)

FULL_TAG="${IMAGE_REPO}:${TAG}"

echo "==> Building ${FULL_TAG}"
docker build "${BUILD_ARGS[@]}" -t "${FULL_TAG}" .

if [[ "$TAG" != "latest" ]]; then
  docker tag "${FULL_TAG}" "${IMAGE_REPO}:latest"
fi

if [[ "$PUSH" == "1" ]]; then
  echo "==> Pushing ${FULL_TAG}"
  docker push "${FULL_TAG}"
  if [[ "$TAG" != "latest" ]]; then
    docker push "${IMAGE_REPO}:latest"
  fi
fi

echo "==> Done: ${FULL_TAG}"
echo "Run on server:"
echo "  docker pull ${FULL_TAG}"
echo "  docker run -d --name maacare --env-file .env -p 3000:3000 ${FULL_TAG}"
