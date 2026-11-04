#!/usr/bin/env node
/**
 * Comprueba contra el backend DE VERDAD que las formas que consume el frontend
 * siguen siendo las que dicen `src/api/types.ts`. No usa el OpenAPI (está casi
 * vacío): llama a los endpoints y valida los campos.
 *
 * Uso:  node scripts/verify-api.mjs [baseUrl]
 *       (por defecto http://127.0.0.1:8010, un backend sobre una COPIA de la BD)
 *
 * Sale con código 1 si algo no cuadra. La idea es la de T-11 del backlog.
 */

const BASE = (process.argv[2] ?? process.env.VERIFY_API_URL ?? 'http://127.0.0.1:8010').replace(/\/$/, '');
const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  if (condition) {
    checks.push(name);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function hasKeys(object, keys, label) {
  const okObject = typeof object === 'object' && object !== null && !Array.isArray(object);
  check(`${label}: es un objeto`, okObject);
  if (!okObject) return false;
  const missing = keys.filter((key) => !(key in object));
  check(`${label}: claves ${keys.join(', ')}`, missing.length === 0, `faltan ${missing.join(', ')}`);
  return true;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const email = `verify+${Date.now()}@example.com`;

const registration = await request('/api/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, username: `verify${Date.now()}`, display_name: 'Verificador', password: 'secreto-123' }),
});
check('POST /auth/register responde 201', registration.status === 201, `estado ${registration.status}: ${JSON.stringify(registration.body)}`);
const token = registration.body?.access_token;
check('register devuelve access_token', typeof token === 'string' && token.length > 20);

// Sin Bearer, los endpoints que exigen sesión tienen que decir 401.
const anonymous = await request('/api/v1/sync/status');
check('GET /sync/status sin Bearer responde 401', anonymous.status === 401, `estado ${anonymous.status}`);

const profile = await request('/api/v1/auth/me', { token });
hasKeys(profile.body, ['id', 'email', 'username', 'display_name', 'created_at'], 'GET /auth/me');

const sync = await request('/api/v1/sync/status', { token });
if (hasKeys(sync.body, ['linked', 'garmin_email', 'needs_reauth', 'last_sync_at', 'activities_7d', 'tss_7d', 'scheduler_running'], 'GET /sync/status')) {
  check('sync/status.linked es boolean', typeof sync.body.linked === 'boolean');
  check('sync/status.activities_7d es number', typeof sync.body.activities_7d === 'number');
}

const daily = await request('/api/v1/metrics/daily', { token });
if (hasKeys(daily.body, ['date', 'biometrics_available', 'sleep', 'hrv', 'resting_hr', 'body_battery', 'stress_avg', 'tsb', 'atl', 'ctl', 'readiness'], 'GET /metrics/daily')) {
  const body = daily.body;
  check('daily.biometrics_available es boolean', typeof body.biometrics_available === 'boolean');
  hasKeys(body.sleep, ['score', 'seconds', 'hours', 'avg_7d', 'efficiency', 'bedtime', 'wakeup'], 'daily.sleep');
  hasKeys(body.hrv, ['overnight', 'weekly_avg', 'status', 'avg_7d'], 'daily.hrv');
  hasKeys(body.body_battery, ['max', 'min', 'wake', 'curve'], 'daily.body_battery');
  hasKeys(body.readiness, ['score', 'status', 'message', 'components'], 'daily.readiness');
  hasKeys(body.readiness.components, ['sleep_contribution', 'hrv_contribution', 'tsb_contribution'], 'daily.readiness.components');
}

const readiness = await request('/api/v1/metrics/readiness', { token });
hasKeys(readiness.body, ['date', 'readiness', 'biometrics_available'], 'GET /metrics/readiness');

const alerts = await request('/api/v1/alerts/', { token });
if (hasKeys(alerts.body, ['date', 'count', 'alerts'], 'GET /alerts/')) {
  check('alerts.alerts es un array', Array.isArray(alerts.body.alerts));
}

const exercises = await request('/api/v1/strength/exercises?limit=3', { token });
if (hasKeys(exercises.body, ['total', 'items', 'muscle_groups', 'equipment'], 'GET /strength/exercises')) {
  check('catálogo.total es number', typeof exercises.body.total === 'number');
  check('catálogo sembrado (>0)', exercises.body.total > 0, `total ${exercises.body.total}`);
  const item = exercises.body.items[0];
  check('catálogo.items[0] existe', Boolean(item));
  if (item) {
    hasKeys(item, ['id', 'name', 'slug', 'muscle_group', 'equipment', 'is_timed', 'is_unilateral', 'is_custom'], 'catálogo.item');
  }
}

const templates = await request('/api/v1/strength/templates', { token });
if (hasKeys(templates.body, ['total', 'items'], 'GET /strength/templates')) {
  check('templates.items es un array', Array.isArray(templates.body.items));
}

const sessions = await request('/api/v1/strength/sessions?limit=5', { token });
if (hasKeys(sessions.body, ['total', 'limit', 'offset', 'items'], 'GET /strength/sessions')) {
  check('sessions.items es un array', Array.isArray(sessions.body.items));
}

const activities = await request('/api/v1/activities/?limit=5', { token });
check('GET /activities/ es un array', Array.isArray(activities.body), typeof activities.body);
check('actividades respeta limit', Array.isArray(activities.body) && activities.body.length <= 5);

const routes = await request('/api/v1/routes/', { token });
check('GET /routes/ es un array', Array.isArray(routes.body), typeof routes.body);

const leaderboard = await request('/api/v1/social/leaderboard?days=7&order_by=weekly_tss', { token });
if (hasKeys(leaderboard.body, ['period_days', 'order_by', 'ranking', 'note'], 'GET /social/leaderboard')) {
  check('social.ranking es un array', Array.isArray(leaderboard.body.ranking));
}

const trends = await request('/api/v1/metrics/trends?metric=hrv&days=7', { token });
if (hasKeys(trends.body, ['metric', 'days', 'series'], 'GET /metrics/trends')) {
  check('trends.series es un array', Array.isArray(trends.body.series));
}

const performance = await request('/api/v1/performance/summary?sport=running&days=30', { token });
hasKeys(performance.body, ['sport', 'days', 'current', 'previous'], 'GET /performance/summary');

const zones = await request('/api/v1/performance/zones?sport=all&days=30', { token });
if (hasKeys(zones.body, ['sport', 'days', 'total_secs', 'zones'], 'GET /performance/zones')) {
  check('zones.zones es un array', Array.isArray(zones.body.zones));
}

const prs = await request('/api/v1/performance/prs', { token });
check('GET /performance/prs es un array', Array.isArray(prs.body), typeof prs.body);

const friends = await request('/api/v1/friends/', { token });
hasKeys(friends.body, ['friends', 'incoming_requests', 'outgoing_requests'], 'GET /friends/');

const today = new Date();
const from = new Date(today);
from.setDate(from.getDate() - 3);
const iso = (date) => date.toISOString().slice(0, 10);
const calendar = await request(`/api/v1/calendar/?from=${iso(from)}&to=${iso(today)}`, { token });
if (hasKeys(calendar.body, ['from', 'to', 'days'], 'GET /calendar/')) {
  check('calendar.days es un array', Array.isArray(calendar.body.days));
}

const logout = await request('/api/v1/auth/logout', { method: 'POST', token });
check('POST /auth/logout responde 200', logout.status === 200, `estado ${logout.status}`);

console.log(JSON.stringify({ base: BASE, checks: checks.length, failures }, null, 2));
if (failures.length > 0) {
  console.error(`\n${failures.length} comprobación(es) fallida(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`\nContrato verificado contra ${BASE}: ${checks.length} comprobaciones, 0 fallos.`);
