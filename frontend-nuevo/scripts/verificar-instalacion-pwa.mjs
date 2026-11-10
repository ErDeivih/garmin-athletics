#!/usr/bin/env node
/**
 * Verifica la PWA en una ventana de aplicación (equivalente visible a la app
 * instalada: sin barra de direcciones ni pestañas) y comprueba el arranque sin
 * cobertura.
 *
 * No existe una API para pulsar «Instalar» desde un script; lo que sí se puede
 * verificar es lo que decide la instalación (contexto seguro, manifiesto y
 * service worker) y cómo se ve la app ya instalada, que es una ventana `--app`.
 *
 * Uso: node scripts/verificar-instalacion-pwa.mjs [url]
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'docs', 'capturas-movil');
mkdirSync(OUT, { recursive: true });
const URL_APP = (process.argv[2] ?? 'https://servidor.tail4263a0.ts.net').replace(/\/$/, '');

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge instalado.');

const perfil = mkdtempSync(join(tmpdir(), 'lyfta-perfil-'));
const informe = { url: URL_APP, navegador: executablePath };

/** Captura la página en el tamaño de un móvil y devuelve el estado de la app. */
async function estado(pagina) {
  return pagina.evaluate(async () => ({
    displayMode: ['standalone', 'minimal-ui', 'browser']
      .filter((modo) => window.matchMedia(`(display-mode: ${modo})`).matches),
    contexto_seguro: window.isSecureContext,
    serviceWorkers: 'serviceWorker' in navigator
      ? (await navigator.serviceWorker.getRegistrations()).map((r) => ({
        ambito: r.scope,
        estado: r.active?.state ?? null,
      }))
      : [],
    controlado: 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false,
    ventana: { ancho: window.innerWidth, alto: window.innerHeight },
  }));
}

let contexto;
try {
  // Ventana de aplicación: es lo más parecido a la app instalada (sin chrome).
  // Si no hay escritorio disponible, se sigue con una ventana normal.
  try {
    contexto = await chromium.launchPersistentContext(perfil, {
      executablePath,
      headless: false,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      args: [`--app=${URL_APP}`, '--window-size=420,900', '--window-position=40,40', '--no-first-run'],
    });
    informe.modo = 'ventana de aplicación (--app)';
  } catch (error) {
    informe.modo = `ventana normal (--app no disponible: ${String(error).slice(0, 120)})`;
    contexto = await chromium.launchPersistentContext(perfil, {
      executablePath,
      headless: false,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
  }

  const pagina = contexto.pages()[0] ?? await contexto.newPage();
  await pagina.goto(URL_APP, { waitUntil: 'networkidle', timeout: 40_000 });
  await pagina.getByRole('heading', { name: /^entra en /i }).waitFor({ timeout: 25_000 });

  // El service worker se registra al cargar; se recarga para que controle.
  await pagina.waitForFunction(
    () => navigator.serviceWorker.getRegistrations().then((r) => r.some((x) => x.active)),
    null,
    { timeout: 25_000 },
  );
  await pagina.reload({ waitUntil: 'networkidle' });
  informe.instalada = await estado(pagina);
  await pagina.screenshot({ path: join(OUT, 'pwa-instalada-ventana.png') });

  // Sin cobertura: recargar tiene que servir la app desde el service worker.
  await contexto.setOffline(true);
  let arranque = false;
  try {
    await pagina.reload({ waitUntil: 'domcontentloaded', timeout: 25_000 });
    await pagina.getByRole('heading', { name: /^entra en /i }).waitFor({ timeout: 20_000 });
    arranque = true;
  } catch (error) {
    informe.errorSinCobertura = String(error).slice(0, 200);
  }
  // Prueba de que la página la sirvió el service worker y no la red: sin red,
  // `workerStart > 0` y transferencia 0. Además `onLine` es false.
  informe.sinCobertura = await pagina.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      onLine: navigator.onLine,
      workerStart: nav ? Math.round(nav.workerStart) : null,
      transferSize: nav ? nav.transferSize : null,
      tipo: nav ? nav.type : null,
      url: location.href,
    };
  });
  await pagina.screenshot({ path: join(OUT, 'pwa-instalada-sin-cobertura.png') });
  informe.arranqueSinCobertura = arranque;
  await contexto.setOffline(false);

  informe.resultado = arranque
    ? 'OK: la app instalada abre sin cobertura'
    : 'FALLO: no abre sin cobertura';
  writeFileSync(join(OUT, 'informe-instalacion.json'), JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
  if (!arranque) process.exitCode = 1;
} finally {
  if (contexto) await contexto.close();
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* perfil temporal */ }
}
