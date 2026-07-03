#!/bin/sh
set -eu

missing=""
for key in \
  NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY
do
  eval "value=\${$key:-}"
  if [ -z "$value" ]; then
    missing="$missing $key"
  fi
done

if [ -n "$missing" ]; then
  echo "maacare: missing required environment variables:$missing" >&2
  echo "maacare: pass them with --env-file .env or -e KEY=value" >&2
  exit 1
fi

exec "$@"
