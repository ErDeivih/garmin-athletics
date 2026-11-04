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

// --- El gimnasio de verdad: crear ejercicio, plantilla y sesión, y validar items ---
const exerciseCreated = await request('/api/v1/strength/exercises', {
  method: 'POST',
  token,
  body: JSON.stringify({ name: `Verificación ${email}`, muscle_group: 'pecho', equipment: 'barra', notes: 'temporal' }),
});
check('POST /strength/exercises responde 201', exerciseCreated.status === 201, `estado ${exerciseCreated.status}: ${JSON.stringify(exerciseCreated.body)}`);
const exerciseId = exerciseCreated.body?.id;
check('ejercicio creado devuelve id', typeof exerciseId === 'string' && exerciseId.length > 0);

const templateCreated = await request('/api/v1/strength/templates', {
  method: 'POST',
  token,
  body: JSON.stringify({
    name: 'Plantilla de verificación',
    weekday: 2,
    focus: 'push',
    exercises: [{ exercise_id: exerciseId, sets: 3, reps: 8, weight_kg: 60, rest_seconds: 120, notes: 'temporal' }],
  }),
});
check('POST /strength/templates responde 201', templateCreated.status === 201, `estado ${templateCreated.status}: ${JSON.stringify(templateCreated.body)}`);
const templateId = templateCreated.body?.id;
if (hasKeys(templateCreated.body, ['id', 'name', 'weekday', 'weekday_label', 'focus', 'notes', 'exercises', 'total_sets', 'estimated_tonnage_kg'], 'plantilla creada')) {
  check('plantilla.total_sets es number', typeof templateCreated.body.total_sets === 'number');
  check('plantilla tiene 3 series', templateCreated.body.total_sets === 3, `total ${templateCreated.body.total_sets}`);
  const templateExercise = templateCreated.body.exercises?.[0];
  if (hasKeys(templateExercise, ['id', 'position', 'exercise', 'sets', 'reps', 'weight_kg', 'rest_seconds', 'notes'], 'plantilla.exercises[0]')) {
    check('plantilla.exercises[0].exercise trae el nombre', typeof templateExercise.exercise?.name === 'string');
  }
}

const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const finishedAt = new Date().toISOString();
const sessionCreated = await request('/api/v1/strength/sessions', {
  method: 'POST',
  token,
  body: JSON.stringify({
    name: 'Sesión de verificación',
    template_id: templateId,
    started_at: startedAt,
    finished_at: finishedAt,
    notes: 'temporal',
    sets: [
      { exercise_id: exerciseId, set_number: 1, weight_kg: 60, reps: 8, rest_seconds: 120 },
      { exercise_id: exerciseId, set_number: 2, weight_kg: 62.5, reps: 6, rest_seconds: 150 },
    ],
  }),
});
check('POST /strength/sessions responde 201', sessionCreated.status === 201, `estado ${sessionCreated.status}: ${JSON.stringify(sessionCreated.body)}`);
const sessionId = sessionCreated.body?.id;
if (hasKeys(sessionCreated.body, ['id', 'name', 'template_id', 'started_at', 'finished_at', 'date', 'duration_min', 'status', 'notes', 'total_tonnage_kg', 'computed_tss', 'activity_id', 'sets_count', 'exercises_count', 'exercises'], 'sesión creada')) {
  check('sesión.status es done', sessionCreated.body.status === 'done');
  check('sesión.sets_count es 2', sessionCreated.body.sets_count === 2, `sets ${sessionCreated.body.sets_count}`);
  check('sesión.total_tonnage_kg = 855', sessionCreated.body.total_tonnage_kg === 855, `tonelaje ${sessionCreated.body.total_tonnage_kg}`);
  check('sesión.activity_id es string', typeof sessionCreated.body.activity_id === 'string');
  const sessionExercise = sessionCreated.body.exercises?.[0];
  if (hasKeys(sessionExercise, ['exercise', 'position', 'sets', 'tonnage_kg'], 'sesión.exercises[0]')) {
    const firstSet = sessionExercise.sets?.[0];
    hasKeys(firstSet, ['id', 'exercise_id', 'set_number', 'weight_kg', 'reps', 'rir', 'is_warmup', 'set_type', 'rest_seconds', 'completed_at'], 'sesión.exercises[0].sets[0]');
  }
}

if (sessionId) {
  const sessionDetail = await request(`/api/v1/strength/sessions/${sessionId}`, { token });
  check('GET /strength/sessions/{id} devuelve la sesión', sessionDetail.status === 200 && sessionDetail.body?.id === sessionId);
}

const lastMarks = await request(`/api/v1/strength/last-marks?exercise_ids=${exerciseId}`, { token });
if (hasKeys(lastMarks.body, ['marks'], 'GET /strength/last-marks')) {
  const mark = lastMarks.body.marks?.[exerciseId];
  hasKeys(mark, ['date', 'weight_kg', 'reps', 'set_number', 'rest_seconds'], 'last-marks.marks[ejercicio]');
  check('last-marks guarda el peso de la primera serie (60)', mark?.weight_kg === 60, `peso ${mark?.weight_kg}`);
}

if (exerciseId) {
  const exerciseDetail = await request(`/api/v1/strength/exercises/${exerciseId}`, { token });
  hasKeys(exerciseDetail.body, ['exercise', 'last', 'pr', 'sessions_count'], 'GET /strength/exercises/{id}');
  check('ficha: sessions_count = 1', exerciseDetail.body?.sessions_count === 1, `cuenta ${exerciseDetail.body?.sessions_count}`);
  check('ficha: PR a 62,5 kg', exerciseDetail.body?.pr?.weight_kg === 62.5, `PR ${exerciseDetail.body?.pr?.weight_kg}`);

  const history = await request(`/api/v1/strength/exercises/${exerciseId}/history`, { token });
  if (hasKeys(history.body, ['exercise', 'pr', 'sessions', 'series'], 'GET /strength/exercises/{id}/history')) {
    check('historial trae 1 sesión', history.body.sessions.length === 1, `sesiones ${history.body.sessions.length}`);
    check('historial trae serie cronológica', Array.isArray(history.body.series) && history.body.series.length === 1);
  }
}

const activities = await request('/api/v1/activities/?limit=5', { token });
check('GET /activities/ es un array', Array.isArray(activities.body), typeof activities.body);
check('actividades respeta limit', Array.isArray(activities.body) && activities.body.length <= 5);
if (Array.isArray(activities.body) && activities.body.length > 0) {
  const activity = activities.body[0];
  hasKeys(activity, ['id', 'source', 'type', 'name', 'start_time', 'duration_min', 'distance_m', 'avg_hr', 'max_hr', 'gain_m', 'has_track', 'tss', 'rpe'], 'actividad de la lista');
  check('la actividad espejo es de fuerza', activity.type === 'strength', `tipo ${activity.type}`);
}

// Limpieza de lo creado en la copia (nunca en la BD real).
if (sessionId) {
  const removed = await request(`/api/v1/strength/sessions/${sessionId}`, { method: 'DELETE', token });
  check('DELETE /strength/sessions/{id}', removed.status === 200, `estado ${removed.status}`);
}
if (templateId) {
  const removed = await request(`/api/v1/strength/templates/${templateId}`, { method: 'DELETE', token });
  check('DELETE /strength/templates/{id}', removed.status === 200, `estado ${removed.status}`);
}
if (exerciseId) {
  const removed = await request(`/api/v1/strength/exercises/${exerciseId}`, { method: 'DELETE', token });
  check('DELETE /strength/exercises/{id}', removed.status === 200, `estado ${removed.status}`);
}

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
