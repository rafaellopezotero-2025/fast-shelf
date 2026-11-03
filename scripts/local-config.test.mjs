import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareLocalConfig, readOfflineBuildEnv, validateLocalUrl } from './local-config.mjs';

test('La instalación sin internet rechaza una dirección de nube', () => {
  assert.throws(() => validateLocalUrl('https://fast-shelf.lovable.app', 'API'));
  assert.throws(() => validateLocalUrl('https://example.com', 'API'));
  assert.equal(validateLocalUrl('http://192.168.0.10:8000', 'API'), 'http://192.168.0.10:8000');
});

test('La configuración offline ignora variables de nube heredadas', () => {
  const root = mkdtempSync(join(tmpdir(), 'offline-env-'));
  const previous = process.env.VITE_SUPABASE_URL;
  try {
    process.env.VITE_SUPABASE_URL = 'https://example.com';
    writeFileSync(join(root, '.env.offline.local'), 'VITE_SUPABASE_URL=http://127.0.0.1:8000\nVITE_SUPABASE_PUBLISHABLE_KEY=test.public.key\nVITE_LOCAL_ONLY=true\nVITE_LOCAL_SITE_URL=http://127.0.0.1:3000\n');
    assert.equal(readOfflineBuildEnv(root).VITE_SUPABASE_URL, 'http://127.0.0.1:8000');
  } finally {
    if (previous === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('La aplicación local no recibe contraseñas ni claves de servicio', () => {
  const root = mkdtempSync(join(tmpdir(), 'local-config-'));
  try {
    const dir = join(root, 'docker/supabase');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.env.local'), 'PUBLIC_URL=http://127.0.0.1:8000\nSITE_URL=http://127.0.0.1:3000\nPOSTGRES_PASSWORD=test-only-private-password\nJWT_SECRET=test-only-secret-longer-than-32-characters\nANON_KEY=test.public.key\nSERVICE_ROLE_KEY=test-only-private-service-key\n');
    writeFileSync(join(dir, 'kong.yml'), 'keys: [${ANON_KEY}, ${SERVICE_ROLE_KEY}]');
    prepareLocalConfig(root);
    const browser = readFileSync(join(root, '.env.offline.local'), 'utf8');
    assert.ok(browser.includes('VITE_SUPABASE_URL=http://127.0.0.1:8000'));
    assert.ok(!browser.includes('test-only-private-password'));
    assert.ok(!browser.includes('test-only-private-service-key'));
    assert.ok(!readFileSync(join(dir, 'kong.generated.local.yml'), 'utf8').includes('${'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});