#!/usr/bin/env node
/**
 * Comprueba si la app se puede INSTALAR como PWA desde cada puerta.
 *
 * Chrome solo considera instalable una página en contexto seguro (HTTPS o
 * localhost) con manifiesto válido y service worker. Esta herramienta lo mira
 * con datos del propio navegador (CDP), no a ojo:
 *   - `window.isSecureContext`
 *   - manifiesto que Chrome ha cargado y sus errores
 *   - service workers registrados y controlando la página
 *   - `Page.getInstallabilityErrors`, si esta versión de Chrome lo expone
 *
 * Uso: node scripts/pwa-instalable.mjs [url...]
 * Sin argumentos comprueba las dos puertas del despliegue.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'docs', 'capturas-movil');
mkdirSync(OUT, { recursive: true });

const urls = process.argv.slice(2);
if (urls.length === 0) {
  urls.push('http://192.168.1.139:8010', 'http://100.117.58.93:8010');
}

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

const browser = await chromium.launch({ executablePath, headless: true });
const informe = [];

try {
  for (const url of urls) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const puerta = new URL(url).host.replace(/[:.]/g, '-');
    const errores = [];
    page.on('pageerror', (error) => errores.push(String(error)));

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    const navegador = await page.evaluate(async () => {
      const registros = 'serviceWorker' in navigator
        ? (await navigator.serviceWorker.getRegistrations()).map((r) => ({
          scope: r.scope,
          activo: Boolean(r.active),
          estado: r.active?.state ?? null,
        }))
        : [];
      const enlace = document.querySelector('link[rel="manifest"]');
      return {
        seguro: window.isSecureContext,
        protocolo: location.protocol,
        manifestEnlazado: enlace ? enlace.getAttribute('href') : null,
        serviceWorkers: registros,
        controladoPorSW: 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false,
      };
    });

    if (navegador.manifestEnlazado) {
      const respuesta = await page.request.get(new URL(navegador.manifestEnlazado, url).toString());
      navegador.manifestStatus = respuesta.status();
    }

    const cdp = await context.newCDPSession(page);
    let manifiestoChrome = null;
    let erroresInstalacion = null;
    try {
      const manifest = await cdp.send('Page.getAppManifest');
      manifiestoChrome = {
        url: manifest.url,
        errores: manifest.errors ?? [],
        tieneDatos: Boolean(manifest.data),
      };
    } catch (error) {
      manifiestoChrome = { noDisponible: String(error) };
    }
    try {
      const resultado = await cdp.send('Page.getInstallabilityErrors');
      erroresInstalacion = resultado.installabilityErrors ?? [];
    } catch (error) {
      erroresInstalacion = { noDisponible: String(error).slice(0, 160) };
    }

    await page.screenshot({ path: join(OUT, `pwa-${puerta}.png`) });
    // `in-incognito` lo pone Chrome porque el navegador de pruebas va en modo
    // privado; no es un defecto de la app (en el móvil no aparece).
    const erroresReales = Array.isArray(erroresInstalacion)
      ? erroresInstalacion.filter((error) => error?.errorId !== 'in-incognito')
      : [];
    const fila = {
      url,
      navegador,
      manifiestoChrome,
      erroresInstalacion,
      erroresInstalacionReales: erroresReales,
      erroresPagina: errores,
      captura: `pwa-${puerta}.png`,
      /* Veredicto explícito, para no tener que interpretar los campos. */
      instalable: Boolean(
        navegador.seguro
        && navegador.serviceWorkers.some((registro) => registro.activo)
        && navegador.controladoPorSW
        && Array.isArray(erroresInstalacion)
        && erroresReales.length === 0,
      ),
    };
    informe.push(fila);
    await context.close();
  }

  writeFileSync(join(OUT, 'informe-pwa.json'), JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
} finally {
  await browser.close();
}
