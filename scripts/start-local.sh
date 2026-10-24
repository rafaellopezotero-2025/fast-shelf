#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE=(docker compose --project-directory "$ROOT/docker/supabase" --env-file "$ROOT/docker/supabase/.env.local" -f "$ROOT/docker/supabase/docker-compose.yml")
node "$ROOT/scripts/local-config.mjs"
# No downloads at startup: every image must already be installed.
"${COMPOSE[@]}" up -d --pull never db
bash "$ROOT/scripts/local-role-passwords.sh"
"${COMPOSE[@]}" up -d --pull never auth rest kong
bash "$ROOT/scripts/init-local-db.sh"
echo "Servicios locales listos."