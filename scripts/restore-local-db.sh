#!/usr/bin/env bash
# Restaura un respaldo sobre la base local. CUIDADO: reemplaza los datos actuales.
# Uso:  bash scripts/restore-local-db.sh /ruta/al/respaldo.sql.gz
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$DIR/docker/supabase/.env.local"
CONTAINER="libreria-db"
ARCHIVO="${1:-}"

[ -n "$ARCHIVO" ] && [ -f "$ARCHIVO" ] || { echo "Indicá el archivo de respaldo a restaurar."; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Falta $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

read -r -p "Esto reemplaza TODOS los datos actuales. Escribí SI para continuar: " ok
[ "$ok" = "SI" ] || { echo "Cancelado."; exit 1; }

gunzip -c "$ARCHIVO" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
  psql -U postgres -d postgres

echo "Restauración terminada. Reiniciá los servicios: cd docker/supabase && docker compose restart"
