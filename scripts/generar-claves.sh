#!/usr/bin/env bash
# Genera las claves de la base local y las escribe en docker/supabase/.env
# Uso:  bash scripts/generar-claves.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$DIR/docker/supabase/.env.local"
umask 077

if [ -f "$ENV_FILE" ] && grep -q '^JWT_SECRET=.' "$ENV_FILE"; then
  echo "Las claves locales ya existen; no se regeneran para conservar usuarios y sesiones."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$DIR/docker/supabase/.env.example" "$ENV_FILE"
  echo "Creé $ENV_FILE a partir del ejemplo."
fi

node - "$ENV_FILE" <<'JS'
const fs = require('fs');
const crypto = require('crypto');
const file = process.argv[2];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = crypto.randomBytes(48).toString('base64url');
const dbPass = crypto.randomBytes(24).toString('base64url');

const token = (role) => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ role, iss: 'supabase', iat: now, exp: now + 60 * 60 * 24 * 365 * 10 });
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

let env = fs.readFileSync(file, 'utf8');
const set = (k, v) => {
  env = env.match(new RegExp(`^${k}=.*$`, 'm'))
    ? env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`)
    : `${env.trimEnd()}\n${k}=${v}\n`;
};

set('POSTGRES_PASSWORD', dbPass);
set('JWT_SECRET', secret);
set('ANON_KEY', token('anon'));
set('SERVICE_ROLE_KEY', token('service_role'));
fs.writeFileSync(file, env);

fs.chmodSync(file, 0o600);
console.log('Claves locales generadas y guardadas sin mostrarlas.');
JS

echo
echo "Listo. Revisá $ENV_FILE y completá PUBLIC_URL y SITE_URL con la IP de tu servidor."
