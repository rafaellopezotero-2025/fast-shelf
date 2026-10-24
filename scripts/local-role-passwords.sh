#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/docker/supabase/.env.local"; set +a
ready=false
for i in $(seq 1 60); do
  if docker exec libreria-db pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
if [ "$ready" != true ]; then echo "La base local no inició."; exit 1; fi
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" libreria-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres --set=db_password="$POSTGRES_PASSWORD" <<'SQL' >/dev/null
ALTER ROLE authenticator WITH PASSWORD :'db_password';
ALTER ROLE supabase_auth_admin WITH PASSWORD :'db_password';
SQL