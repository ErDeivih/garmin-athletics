#!/usr/bin/env node
/**
 * Recorre el flujo móvil completo contra una instancia DESPLEGADA (no local):
 * planificar pesos por serie → editar → enviar al reloj → entrenar → sesión
 * guardada, y captura cada pantalla a 390 px de ancho.
 *
 * Pensado para la instancia desechable de `deploy/instancia-verificacion.sh`,
 * que es una copia de la base real sin credencial Garmin: el envío al reloj no
 * puede salir hacia Garmin. El mapeo del workout se comprueba con `dry_run`.
 *
 * Uso: node scripts/flujo-movil-desplegado.mjs [url] [dirCapturas]
 */
import { copyFileSync, mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const APP = (process.argv[2] ?? 'http://192.168.1.139:8011').replace(/\/$/, '');
const OUT = process.argv[3] ?? join(here, '..', '..', 'docs', 'capturas-movil');
mkdirSync(OUT, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge instalado.');

const stamp = Date.now();
const email = `flujo+${stamp}@example.com`;
const password = 'secreto-123';
const api = (path) => `${APP}${path}`;

const checks = {};
const capturas = [];

async function apiJson(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(api(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

// ---------- Datos de partida: cuenta y plantilla con pesos por serie ----------
const registration = await apiJson('/api/v1/auth/register', {
  method: 'POST',
  body: { email, username: `flujo${stamp}`, display_name: 'Atleta de prueba', password },
});
if (registration.status !== 201) throw new Error(`No se pudo crear la cuenta: ${registration.status}`);
const token = registration.json.access_token;

const catalogo = await apiJson('/api/v1/strength/exercises?q=press%20de%20banca', { token });
const ejercicio = catalogo.json.items[0];
if (!ejercicio) throw new Error('Falta el press de banca en el catálogo.');
const nombreEjercicio = ejercicio.name;

const plantilla = await apiJson('/api/v1/strength/templates', {
  method: 'POST',
  token,
  body: {
    name: 'Empuje A',
    weekday: (new Date().getDay() + 6) % 7,
    focus: 'push',
    exercises: [{
      exercise_id: ejercicio.id,
      sets: 3,
      reps: 8,
      weight_kg: 60,
      rest_seconds: 60,
      set_targets: [
        { weight_kg: 60, reps: 8 },
        { weight_kg: 65, reps: 8 },
        { weight_kg: 70, reps: 6 },
      ],
    }],
  },
});
if (plantilla.status !== 201) throw new Error(`No se pudo crear la plantilla: ${plantilla.status} ${JSON.stringify(plantilla.json)}`);
const templateId = plantilla.json.id;
checks.plantilla_creada = `set_targets=${plantilla.json.exercises[0].set_targets.map((t) => t.weight_kg).join('/')}`;

// ---------- Navegador móvil ----------
const browser = await chromium.launch({ executablePath, headless: true });
const pagina = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const erroresConsola = [];
pagina.on('console', (message) => { if (message.type() === 'error') erroresConsola.push(message.text()); });
pagina.on('pageerror', (error) => erroresConsola.push(String(error)));

async function captura(nombre, { espera = 300 } = {}) {
  await pagina.waitForTimeout(espera);
  const tmp = join(tmpdir(), `lyfta-flujo-${nombre}-${Date.now()}.png`);
  // Viewport real del móvil (390 × 844), sin `fullPage`: con la página entera
  // la barra fija se pinta a media altura y parece que tapa contenido.
  await pagina.screenshot({ path: tmp, fullPage: false });
  const destino = join(OUT, `${nombre}.png`);
  for (let intento = 0; intento < 5; intento += 1) {
    try { copyFileSync(tmp, destino); break; } catch (error) {
      if (intento === 4) throw error;
      await pagina.waitForTimeout(200);
    }
  }
  try { unlinkSync(tmp); } catch { /* temporal en %TEMP% */ }
  capturas.push(`${nombre}.png`);
}

try {
  // 1. La app desplegada abre en el móvil: login.
  await pagina.goto(APP, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /^entra en /i }).waitFor({ timeout: 20000 });
  checks.titulo = await pagina.title();
  await captura('01-login-movil');

  // 2. Entrar y ver el gimnasio con el entreno de hoy.
  await pagina.getByLabel(/correo/i).fill(email);
  await pagina.getByLabel(/contraseña/i).fill(password);
  await pagina.getByRole('button', { name: /^entrar$/i }).click();

  // Primera vez: la app enseña la introducción en tres pasos antes del panel.
  const intro = pagina.getByRole('heading', { name: /cómo funciona/i });
  await intro.waitFor({ timeout: 8000 }).then(async () => {
    await captura('00-onboarding', { espera: 500 });
    await pagina.getByRole('button', { name: /empezar/i }).click();
  }).catch(() => {});

  await pagina.getByRole('heading', { name: 'Hoy', exact: true }).waitFor({ timeout: 20000 });

  await pagina.getByRole('link', { name: 'Gimnasio' }).click();
  await pagina.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();
  await pagina.getByRole('button', { name: /^enviar al reloj$/i }).waitFor({ timeout: 20000 });
  await captura('02-gimnasio-movil');

  // 3. Ruta profunda directa (recarga / icono de la pantalla de inicio) al plan
  //    con pesos por serie. Esto solo funciona con el fallback SPA del servidor.
  await pagina.goto(`${APP}/gimnasio/plantillas/${templateId}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /editar pesos/i }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: new RegExp(`subir peso serie 2 de ${nombreEjercicio}`, 'i') }).waitFor();
  const pesosVisibles = await pagina.getByText(/^6[05]|^70/).count();
  checks.pesos_visibles = pesosVisibles;
  await captura('03-plan-pesos', { espera: 600 });

  // 4. Editar una serie con − / + y comprobar que se guarda en el servidor.
  await pagina.getByRole('button', { name: new RegExp(`subir peso serie 2 de ${nombreEjercicio}`, 'i') }).click();
  await pagina.getByText(/guardado a las/i).waitFor({ timeout: 15000 });
  const trasSubir = await apiJson(`/api/v1/strength/templates/${templateId}`, { token });
  const pesoSubido = trasSubir.json.exercises[0].set_targets[1].weight_kg;
  checks.edicion_guardada = `${65} -> ${pesoSubido}`;
  await captura('03b-edicion-serie', { espera: 500 });
  await pagina.getByRole('button', { name: new RegExp(`bajar peso serie 2 de ${nombreEjercicio}`, 'i') }).click();
  await pagina.getByText(/guardado a las/i).waitFor({ timeout: 15000 });
  await pagina.waitForTimeout(500);
  const trasBajar = await apiJson(`/api/v1/strength/templates/${templateId}`, { token });
  const pesoRestaurado = trasBajar.json.exercises[0].set_targets[1].weight_kg;
  if (pesoSubido === 65 || pesoRestaurado !== 65) {
    throw new Error(`La edición de pesos no se guardó: ${pesoSubido} / ${pesoRestaurado}`);
  }

  // 5. Volver al gimnasio y capturar el bloque de envío al reloj.
  await pagina.getByRole('link', { name: /^gimnasio$/i }).first().click();
  await pagina.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();
  const botonEnviar = pagina.getByRole('button', { name: /^enviar al reloj$/i });
  await botonEnviar.waitFor({ timeout: 15000 });
  await captura('04-envio-pendiente');

  // 6. Mapeo del workout con dry_run: no toca la cuenta de Garmin.
  const plantillaActual = await apiJson(`/api/v1/strength/templates/${templateId}`, { token });
  const dryRun = await apiJson('/api/v1/strength/push-to-garmin', {
    method: 'POST',
    token,
    body: {
      routine_name: plantillaActual.json.name,
      dry_run: true,
      push_to_device: false,
      exercises: plantillaActual.json.exercises.flatMap((item) =>
        item.exercise
          ? [{
              name: item.exercise.name,
              sets: item.sets,
              reps: item.reps,
              weight_kg: item.weight_kg,
              rest_seconds: item.rest_seconds,
              set_targets: item.set_targets,
            }]
          : []),
    },
  });
  const serializado = JSON.stringify(dryRun.json);
  checks.dry_run = {
    status: dryRun.status,
    estado: dryRun.json?.status,
    unmapped: dryRun.json?.unmapped_exercises,
    pesos_en_payload: [60, 65, 70].every((peso) => serializado.includes(String(peso))),
  };
  if (dryRun.status !== 200 || dryRun.json?.status !== 'dry_run') {
    throw new Error(`dry_run no devolvió dry_run: ${dryRun.status} ${serializado.slice(0, 300)}`);
  }
  if (!checks.dry_run.pesos_en_payload) {
    throw new Error(`El payload no lleva los tres pesos por serie: ${serializado.slice(0, 400)}`);
  }

  // 7. Enviar al reloj de verdad (esta copia no tiene credencial Garmin: debe
  //    fallar limpio y enseñar el error, no colgarse ni enviar nada).
  const respuestaEnvio = pagina.waitForResponse((r) => r.url().includes('push-to-garmin'), { timeout: 20000 });
  await botonEnviar.click();
  const envio = await respuestaEnvio;
  checks.envio_sin_credencial = { status: envio.status(), esperado: 400 };
  await pagina.getByText(/no se pudo|error/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  await captura('05-envio-error', { espera: 800 });

  // 7b. Confirmación de envío correcto. La cuenta real no se toca: la respuesta
  //     de Garmin se sustituye en el navegador SOLO para capturar el estado
  //     «Enviado al reloj». Queda marcado como simulado en el dossier.
  await pagina.route('**/api/v1/strength/push-to-garmin', (ruta) => ruta.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'sent', workout_id: 'simulado', mapped_exercises: 1, unmapped_exercises: [], pushed_to_device: true }),
  }));
  await botonEnviar.click();
  await pagina.getByText(/enviado al reloj/i).first().waitFor({ timeout: 20000 });
  await captura('04b-envio-enviado', { espera: 600 });
  checks.envio_confirmado_simulado = true;
  await pagina.unroute('**/api/v1/strength/push-to-garmin');

  // 8. Entrenar: marcar las tres series (60 / 65 / 70) y terminar.
  await pagina.getByRole('link', { name: /empezar sesión/i }).click();
  await pagina.getByRole('heading', { name: 'Entrenar', exact: true }).waitFor({ timeout: 20000 });
  for (const serie of [1, 2, 3]) {
    await pagina.getByRole('checkbox', { name: new RegExp(`serie ${serie} de ${nombreEjercicio}`, 'i') }).click();
    await pagina.waitForTimeout(700);
  }
  await captura('06-entrenar', { espera: 500 });

  // 8b. Sin conexión: el borrador de la sesión vive en el propio móvil. Se
  //     cambia un peso sin red, se comprueba que la recarga falla (sobre HTTP no
  //     hay service worker que sirva el shell) y que al volver la serie sigue ahí.
  const contextoRed = pagina.context();
  const pesoSerie1 = pagina.getByLabel(new RegExp(`peso serie 1 de ${nombreEjercicio}`, 'i'));
  await contextoRed.setOffline(true);
  await pesoSerie1.fill('61');
  const borradorSinRed = await pagina.evaluate(() => {
    const clave = Object.keys(localStorage).find((llave) => llave.startsWith('lyfta.session'));
    return clave ? localStorage.getItem(clave) : null;
  });
  checks.sin_conexion = {
    borrador_guardado: Boolean(borradorSinRed && borradorSinRed.includes('"weight":"61"')),
  };
  let recargaSinRed = 'ok';
  try {
    await pagina.reload({ timeout: 8000 });
  } catch {
    recargaSinRed = 'falla (sin HTTPS no hay service worker que sirva el shell)';
  }
  checks.sin_conexion.recarga_sin_red = recargaSinRed;
  await contextoRed.setOffline(false);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Entrenar', exact: true }).waitFor({ timeout: 20000 });
  checks.sin_conexion.peso_restaurado_al_volver = await pagina
    .getByLabel(new RegExp(`peso serie 1 de ${nombreEjercicio}`, 'i'))
    .inputValue();
  // Vuelve al objetivo del plan para que la sesión guardada sea 60/65/70.
  await pagina.getByLabel(new RegExp(`peso serie 1 de ${nombreEjercicio}`, 'i')).fill('60');

  await pagina.getByRole('button', { name: /terminar sesión/i }).first().click();
  await pagina.getByRole('heading', { name: /sesión terminada/i }).waitFor({ timeout: 20000 });
  await captura('07-sesion-terminada', { espera: 600 });

  // 9. Sesión guardada: editar pesos reales y comprobar el servidor.
  await pagina.getByRole('link', { name: /editar pesos reales/i }).click();
  await pagina.getByRole('heading', { name: /editar pesos reales/i }).waitFor({ timeout: 20000 });
  await captura('08-sesion-guardada', { espera: 600 });

  const sesiones = await apiJson('/api/v1/strength/sessions?limit=5', { token });
  const ultima = sesiones.json.items?.[0] ?? sesiones.json[0];
  const detalle = await apiJson(`/api/v1/strength/sessions/${ultima.id}`, { token });
  const series = detalle.json.exercises.flatMap((e) => e.sets);
  const pesosGuardados = series.map((s) => Number(s.weight_kg));
  const esperados = [60, 65, 70];
  // Hallazgo abierto: la sesión debe guardar los pesos por serie del plan. Hoy
  // la pantalla de entrenar rellena todas las series con el peso del ejercicio
  // (SessionPage.tsx:115-116), así que aquí se registra lo que pasa de verdad.
  checks.sesion_guardada = {
    id: ultima.id,
    series: series.length,
    pesos: pesosGuardados,
    esperado: esperados,
    coincide: JSON.stringify(pesosGuardados) === JSON.stringify(esperados),
  };
  if (series.length !== 3) throw new Error(`Se esperaban 3 series, hay ${series.length}`);

  // 9. Corregir un peso DESPUÉS de entrenar y comprobar que persiste.
  await pagina.getByRole('button', { name: new RegExp(`subir peso serie 1 de ${nombreEjercicio}`, 'i') }).click();
  await pagina.waitForTimeout(1400);
  const corregida = await apiJson(`/api/v1/strength/sessions/${ultima.id}`, { token });
  const pesosCorregidos = corregida.json.exercises
    .flatMap((ejercicio) => ejercicio.sets)
    .map((serie) => Number(serie.weight_kg));
  checks.correccion_post_entreno = { pesos: pesosCorregidos, esperado: [62.5, 65, 70] };
  if (JSON.stringify(pesosCorregidos) !== JSON.stringify([62.5, 65, 70])) {
    throw new Error(`La corrección posterior no persistió: ${JSON.stringify(pesosCorregidos)}`);
  }
  await captura('09-editar-tras-entrenar', { espera: 500 });
  // Se deja como se entrenó (60) para que el historial cuadre con la sesión.
  await pagina.getByRole('button', { name: new RegExp(`bajar peso serie 1 de ${nombreEjercicio}`, 'i') }).click();
  await pagina.waitForTimeout(1400);

  // 10. La sesión aparece en el historial del gimnasio.
  await pagina.goto(`${APP}/gimnasio`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor({ timeout: 20000 });
  const historial = pagina.getByText(/últimas sesiones/i).first();
  await historial.waitFor({ timeout: 20000 });
  await historial.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(400);
  await captura('10-historial-sesion', { espera: 400 });
  checks.historial = true;

  // 11. Historial completo: fecha, duración, volumen y series por sesión.
  await pagina.goto(`${APP}/gimnasio/historial`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Historial', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByText(/1420 kg/).first().waitFor({ timeout: 20000 });
  await captura('11-historial-completo', { espera: 500 });

  // 12. Detalle con el peso planificado frente al real.
  await pagina.goto(`${APP}/gimnasio/sesiones/${ultima.id}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /editar pesos reales/i }).waitFor({ timeout: 20000 });
  await pagina.getByText(/plan 65 kg/i).waitFor({ timeout: 15000 });
  await captura('12-planificado-vs-real', { espera: 500 });
  checks.planificado_visible = true;

  // 13. Biblioteca: búsqueda y filtro por foco.
  await pagina.goto(`${APP}/gimnasio/biblioteca`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByLabel(/buscar por nombre/i).fill('empuje');
  await pagina.getByText('Empuje A').first().waitFor({ timeout: 20000 });
  await captura('13-biblioteca-filtros', { espera: 500 });

  // 14. Duplicar el plan para reutilizarlo.
  await pagina.getByText('Empuje A').first().click();
  const botonDuplicar = pagina.getByRole('button', { name: /duplicar plan/i });
  await botonDuplicar.waitFor({ timeout: 20000 });
  await botonDuplicar.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);
  await captura('14-biblioteca-duplicar', { espera: 300 });
  await botonDuplicar.click();
  await pagina.getByText(/copia creada/i).waitFor({ timeout: 20000 });
  checks.duplicado = true;
  await captura('15-biblioteca-copia', { espera: 600 });

  // 16. Editor de pesos rápido: copiar la serie anterior y aplicar a todas.
  await pagina.goto(`${APP}/gimnasio/plantillas/${templateId}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /editar pesos/i }).waitFor({ timeout: 20000 });
  await pagina.getByLabel(new RegExp(`peso para todas las series de ${nombreEjercicio}`, 'i')).waitFor();
  await captura('16-editor-rapido', { espera: 500 });
  await pagina.getByRole('button', { name: new RegExp(`copiar peso de la serie anterior a la serie 2 de ${nombreEjercicio}`, 'i') }).click();
  const enBloque = pagina.getByLabel(new RegExp(`peso para todas las series de ${nombreEjercicio}`, 'i'));
  await enBloque.fill('62.5');
  await pagina.getByRole('button', { name: /aplicar a todas/i }).first().click();
  await pagina.waitForTimeout(1400);
  await captura('17-editor-aplicado', { espera: 500 });
  const trasBloque = await apiJson(`/api/v1/strength/templates/${templateId}`, { token });
  const pesosBloque = trasBloque.json.exercises[0].set_targets.map((t) => Number(t.weight_kg));
  checks.editor_en_bloque = { pesos: pesosBloque, esperado: [62.5, 62.5, 62.5] };
  if (JSON.stringify(pesosBloque) !== JSON.stringify([62.5, 62.5, 62.5])) {
    throw new Error(`El peso en bloque no se guardó: ${JSON.stringify(pesosBloque)}`);
  }

  // 18. Biblioteca con exportar/importar JSON.
  await pagina.goto(`${APP}/gimnasio/biblioteca`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: /exportar planes/i }).waitFor();
  await captura('18-biblioteca-json', { espera: 400 });
  checks.biblioteca_json = true;

  // 19. Ajustes: unidades y aviso de uso sin conexión.
  await pagina.goto(`${APP}/ajustes`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByText(/funciona sin conexión/i).waitFor();
  await captura('19-ajustes-unidades', { espera: 400 });
  await pagina.getByRole('button', { name: /libras/i }).click();
  await pagina.waitForTimeout(400);

  // 20. Con libras activadas, el editor enseña los pesos en lb.
  await pagina.goto(`${APP}/gimnasio/plantillas/${templateId}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /editar pesos/i }).waitFor({ timeout: 20000 });
  await pagina.getByText(/lb/).first().waitFor();
  await captura('20-editor-libras', { espera: 500 });
  checks.unidades_lb = true;
  // Se vuelve a kg para no dejar la preferencia cambiada en las capturas.
  await pagina.goto(`${APP}/ajustes`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('button', { name: /kilogramos/i }).click();
  await pagina.waitForTimeout(300);

  // 21. Progreso por ejercicio y semana, con gráfico.
  await pagina.goto(`${APP}/gimnasio/progreso`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Progreso', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByRole('img', { name: /volumen por semana/i }).waitFor({ timeout: 20000 });
  await captura('21-progreso', { espera: 500 });
  checks.progreso = true;

  // 22. Aplicar la plantilla a un día concreto.
  await pagina.goto(`${APP}/gimnasio/biblioteca`, { waitUntil: 'domcontentloaded' });
  await pagina.getByText('Empuje A').first().click();
  const dia = pagina.getByLabel(/día para aplicarla/i);
  await dia.waitFor({ timeout: 20000 });
  await dia.fill('2026-11-13');
  await pagina.getByRole('button', { name: /aplicar al día/i }).click();
  await pagina.getByText(/añadido al calendario/i).waitFor({ timeout: 20000 });
  checks.aplicar_dia = true;
  await captura('22-aplicar-dia', { espera: 500 });

  // 23. Guardar la sesión entrenada como plantilla reutilizable.
  await pagina.goto(`${APP}/gimnasio/sesiones/${ultima.id}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: /editar pesos reales/i }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: /guardar como plantilla/i }).click();
  await pagina.getByText(/plantilla creada/i).waitFor({ timeout: 20000 });
  checks.plantilla_desde_sesion = true;
  await captura('23-guardar-plantilla', { espera: 500 });

  // 24. Exportar el historial a CSV/JSON desde la lista de sesiones.
  await pagina.goto(`${APP}/gimnasio/historial`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Historial', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: /exportar csv/i }).waitFor();
  await captura('24-exportar-historial', { espera: 400 });
  checks.exportar_historial = true;

  // 25. Resumen de la semana: volumen, series por grupo y adherencia.
  await pagina.goto(`${APP}/gimnasio/semana`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Semana', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByText(/adherencia al plan/i).waitFor({ timeout: 20000 });
  await captura('25-resumen-semanal', { espera: 500 });
  checks.resumen_semanal = true;

  // El único error esperado es el 400 del envío sin credencial Garmin (paso 7):
  // el navegador apunta en consola cualquier respuesta >= 400.
  const erroresReales = erroresConsola.filter((texto) => !/400 \(Bad Request\)/.test(texto));
  checks.errores_consola_esperados = erroresConsola.length - erroresReales.length;
  if (erroresReales.length > 0) {
    throw new Error(`Errores de consola en el navegador: ${erroresReales.join(' | ')}`);
  }

  const informe = {
    app: APP,
    cuenta: email,
    plantilla: templateId,
    checks,
    capturas,
    erroresConsola,
    resultado: checks.sesion_guardada.coincide ? 'OK' : 'OK con hallazgo: la sesión no guarda los pesos por serie',
  };
  writeFileSync(join(OUT, 'informe-flujo.json'), JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
} finally {
  await browser.close();
}
