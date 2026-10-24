#!/usr/bin/env bash
set -euo pipefail
# Executed by the official database entrypoint before Auth and REST start.
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --set=db_password="$POSTGRES_PASSWORD" <<'SQL'
ALTER ROLE authenticator WITH PASSWORD :'db_password';
ALTER ROLE supabase_auth_admin WITH PASSWORD :'db_password';
SQL