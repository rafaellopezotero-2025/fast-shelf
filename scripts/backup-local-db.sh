#!/usr/bin/env bash
# Respaldo de la base local. Guarda una copia comprimida y conserva las últimas 14.
# Uso:  bash scripts/backup-local-db.sh [carpeta-destino]
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$DIR/docker/supabase/.env.local"
DEST="${1:-$HOME/respaldos-libreria}"
CONTAINER="libreria-db"
RETENCION=14

[ -f "$ENV_FILE" ] || { echo "Falta $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

mkdir -p "$DEST"
ARCHIVO="$DEST/libreria-$(date +%Y%m%d-%H%M).sql.gz"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
  pg_dumpall -U postgres | gzip > "$ARCHIVO"

echo "Respaldo creado: $ARCHIVO"

ls -1t "$DEST"/libreria-*.sql.gz 2>/dev/null | tail -n +$((RETENCION + 1)) | while read -r viejo; do
  rm -f "$viejo"
  echo "Eliminé respaldo viejo: $viejo"
done
