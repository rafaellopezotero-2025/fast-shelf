// Run against the installed local stack: node scripts/verify-local.mjs
// Uses a disposable vendor account and performs no sales/stock/money changes.
import { randomBytes } from 'node:crypto';
import { readEnv, validateLocalUrl } from './local-config.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(root, 'docker/supabase/.env.local'));
const api = validateLocalUrl(env.PUBLIC_URL, 'PUBLIC_URL');
const site = validateLocalUrl(env.SITE_URL, 'SITE_URL');
const email = `offline-check-${randomBytes(8).toString('hex')}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let userId;
async function request(route, key, token, method = 'GET', body) {
  const response = await fetch(`${api}${route}`, { method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Falló la comprobación local (${response.status}) en ${route.split('?')[0]}.`);
  return response.status === 204 ? null : response.json();
}
try {
  const page = await fetch(site, { signal: AbortSignal.timeout(15000) });
  if (!page.ok || !(await page.text()).includes('/local-only.js')) throw new Error('La aplicación no está instalada en modo local exclusivo.');
  const adminRoles = await request('/rest/v1/user_roles?role=eq.admin&select=id&limit=1', env.SERVICE_ROLE_KEY, env.SERVICE_ROLE_KEY);
  if (!adminRoles.length) throw new Error('Creá primero tu cuenta administradora local; esta prueba no debe convertirse en administrador.');
  const created = await request('/auth/v1/admin/users', env.SERVICE_ROLE_KEY, env.SERVICE_ROLE_KEY, 'POST', { email, password, email_confirm: true });
  userId = created.id;
  if (!userId) throw new Error('No se creó la cuenta temporal.');
  const session = await request('/auth/v1/token?grant_type=password', env.ANON_KEY, env.ANON_KEY, 'POST', { email, password });
  const role = await request('/rest/v1/rpc/bootstrap_usuario', env.ANON_KEY, session.access_token, 'POST', { p_nombre: 'Verificación', p_apellido: 'local', p_email: email });
  if (role !== 'vendedor') throw new Error('La cuenta temporal recibió un permiso inesperado.');
  await request('/rest/v1/profiles?select=id&limit=1', env.ANON_KEY, session.access_token);
  await request('/rest/v1/productos?select=id,stock_actual,stock_reservado&limit=1', env.ANON_KEY, session.access_token);
  await request('/rest/v1/encargos?select=id&limit=1', env.ANON_KEY, session.access_token);
  await request('/rest/v1/maquinas?select=id&limit=1', env.ANON_KEY, session.access_token);
  const refreshed = await request('/auth/v1/token?grant_type=refresh_token', env.ANON_KEY, env.ANON_KEY, 'POST', { refresh_token: session.refresh_token });
  if (!refreshed.access_token) throw new Error('No se renovó la sesión local.');
  console.log('Acceso, permisos, datos y renovación de sesión locales: OK. Ejecutar con internet desconectado para validar aislamiento.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la comprobación local.');
  process.exitCode = 1;
} finally {
  if (userId) {
    try { await request(`/auth/v1/admin/users/${userId}`, env.SERVICE_ROLE_KEY, env.SERVICE_ROLE_KEY, 'DELETE'); }
    catch { console.error('No se pudo retirar la cuenta temporal de verificación.'); process.exitCode = 1; }
  }
}