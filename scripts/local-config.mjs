import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter(line => line.trim() && !line.trim().startsWith('#'))
    .map(line => {
      const at = line.indexOf('=');
      if (at < 1) throw new Error('Configuración local inválida.');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }));
}

export function validateLocalUrl(value, name) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '[::1]' || host === '127.0.0.1'
    || /^10\.(\d{1,3}\.){2}\d{1,3}$/.test(host)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  if (!local || !['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} debe ser una dirección local (localhost o IP privada), sin rutas ni credenciales.`);
  }
  return url.origin;
}

export function prepareLocalConfig(root) {
  const dir = path.join(root, 'docker/supabase');
  const env = readEnv(path.join(dir, '.env'));
  const api = validateLocalUrl(env.PUBLIC_URL, 'PUBLIC_URL');
  const site = validateLocalUrl(env.SITE_URL, 'SITE_URL');
  for (const key of ['POSTGRES_PASSWORD', 'JWT_SECRET', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!env[key] || !/^[A-Za-z0-9_.-]+$/.test(env[key])) throw new Error(`Falta una clave local válida: ${key}.`);
  }
  if (env.POSTGRES_PASSWORD.startsWith('cambiame') || env.JWT_SECRET.length < 32) {
    throw new Error('Generá las claves locales antes de continuar.');
  }
  const template = fs.readFileSync(path.join(dir, 'kong.yml'), 'utf8');
  const kong = template.replaceAll('${ANON_KEY}', env.ANON_KEY).replaceAll('${SERVICE_ROLE_KEY}', env.SERVICE_ROLE_KEY);
  if (kong.includes('${')) throw new Error('Quedaron claves sin resolver en la configuración local.');
  fs.writeFileSync(path.join(dir, 'kong.generated.local.yml'), kong, { mode: 0o600 });
  // Only browser-public values. Database passwords and service keys stay out.
  fs.writeFileSync(path.join(root, '.env.offline.local'), [
    `VITE_SUPABASE_URL=${api}`, `VITE_SUPABASE_PUBLISHABLE_KEY=${env.ANON_KEY}`,
    'VITE_SUPABASE_PROJECT_ID=libreria-local', 'VITE_LOCAL_ONLY=true',
    `VITE_LOCAL_SITE_URL=${site}`, '',
  ].join('\n'), { mode: 0o600 });
  return { api, site };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    prepareLocalConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
    console.log('Configuración local preparada, sin claves privadas en la aplicación.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo preparar la configuración local.');
    process.exitCode = 1;
  }
}