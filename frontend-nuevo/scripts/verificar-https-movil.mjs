#!/usr/bin/env node
/**
 * Comprueba lo que pasará cuando la app se sirva por HTTPS: contexto seguro,
 * service worker e **arranque sin cobertura**.
 *
 * Se usa contra un HTTPS de pruebas con certificado autofirmado (el navegador
 * ignora el error de certificado). El build y el servidor son los mismos; lo
 * único que cambia es el esquema. Cuando David active el certificado del tailnet,
 * este es el comportamiento que tendrá en el móvil.
 *
 * Uso: node scripts/verificar-https-movil.mjs https://127.0.0.1:8444
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'docs', 'capturas-movil');
mkdirSync(OUT, { recursive: true });
const URL_APP = (process.argv[2] ?? 'https://127.0.0.1:8444').replace(/\/$/, '');

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

const browser = await chromium.launch({
  executablePath,
  headless: true,
  // El certificado es autofirmado: se ignora el error a nivel de navegador para
  // que el origen cuente como seguro (con el certificado real del tailnet no
  // haría falta). `ignoreHTTPSErrors` del contexto no basta para el service worker.
  args: ['--ignore-certificate-errors'],
});
const contexto = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  ignoreHTTPSErrors: true,
});
const pagina = await contexto.newPage();
const informe = { url: URL_APP, pasos: {} };

try {
  await pagina.goto(URL_APP, { waitUntil: 'networkidle', timeout: 30_000 });
  await pagina.getByRole('heading', { name: /^entra en /i }).waitFor({ timeout: 20_000 });

  informe.pasos.contexto = await pagina.evaluate(() => ({
    seguro: window.isSecureContext,
    protocolo: location.protocol,
  }));

  // El service worker se registra al cargar; se espera a que quede activo y a
  // que controle la página (tras una recarga).
  await pagina.waitForFunction(
    () => navigator.serviceWorker.getRegistrations().then((r) => r.some((x) => x.active)),
    null,
    { timeout: 20_000 },
  );
  await pagina.reload({ waitUntil: 'networkidle' });
  informe.pasos.serviceWorker = await pagina.evaluate(async () => ({
    controlado: Boolean(navigator.serviceWorker.controller),
    registros: (await navigator.serviceWorker.getRegistrations()).map((r) => ({
      ambito: r.scope,
      estado: r.active?.state ?? null,
    })),
  }));

  const cdp = await contexto.newCDPSession(pagina);
  try {
    const resultado = await cdp.send('Page.getInstallabilityErrors');
    informe.pasos.instalabilidad = resultado.installabilityErrors ?? [];
  } catch (error) {
    informe.pasos.instalabilidad = { noDisponible: String(error).slice(0, 160) };
  }

  // Sin cobertura: recargar tiene que servir el shell desde el service worker.
  await contexto.setOffline(true);
  let arranqueSinCobertura = false;
  try {
    await pagina.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    await pagina.getByRole('heading', { name: /^entra en /i }).waitFor({ timeout: 15_000 });
    arranqueSinCobertura = true;
  } catch (error) {
    informe.pasos.errorSinCobertura = String(error).slice(0, 200);
  }
  await pagina.screenshot({ path: join(OUT, 'https-arranque-sin-cobertura.png') });
  informe.pasos.arranqueSinCobertura = arranqueSinCobertura;
  informe.pasos.captura = 'https-arranque-sin-cobertura.png';
  await contexto.setOffline(false);

  informe.resultado = arranqueSinCobertura ? 'OK: instala y arranca sin cobertura' : 'FALLO';
  writeFileSync(join(OUT, 'informe-https.json'), JSON.stringify(informe, null, 2));
  console.log(JSON.stringify(informe, null, 2));
  if (!arranqueSinCobertura) process.exitCode = 1;
} finally {
  await browser.close();
}
