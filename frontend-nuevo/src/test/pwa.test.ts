import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrato de instalación como app del móvil (PWA). Sin esto, David tiene que
 * escribir una URL a mano cada vez y la app no abre desde el icono de la
 * pantalla de inicio. La prueba lee los ficheros del build: son estáticos a
 * propósito para fallar antes de construir la funcionalidad.
 */
const raiz = process.cwd();
const leer = (rel: string) => readFileSync(resolve(raiz, rel), 'utf8');

interface Icono {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifiesto {
  name: string;
  short_name: string;
  start_url: string;
  scope?: string;
  display: string;
  background_color: string;
  theme_color: string;
  lang?: string;
  icons: Icono[];
}

function tamanoPng(rel: string): { ancho: number; alto: number } {
  const buffer = readFileSync(resolve(raiz, rel));
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
}

describe('PWA de Lyfta', () => {
  it('index.html enlaza el manifiesto, los iconos y el modo app de iOS', () => {
    const html = leer('index.html');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.webmanifest');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-title');
  });

  it('el manifiesto declara nombre, arranque en la portada y modo standalone', () => {
    const manifiesto = JSON.parse(leer('public/manifest.webmanifest')) as Manifiesto;
    expect(manifiesto.name).toBe('Lyfta');
    expect(manifiesto.short_name.length).toBeGreaterThan(0);
    expect(manifiesto.start_url).toBe('/');
    expect(manifiesto.scope).toBe('/');
    expect(manifiesto.display).toBe('standalone');
    expect(manifiesto.theme_color).toBe('#0A0E13');
    expect(manifiesto.background_color).toBe('#0A0E13');
    expect(manifiesto.lang).toBe('es');
  });

  it('hay icono de 192, de 512 (instalable) y uno maskable', () => {
    const manifiesto = JSON.parse(leer('public/manifest.webmanifest')) as Manifiesto;
    const tamanos = manifiesto.icons.map((icono) => icono.sizes);
    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
    expect(manifiesto.icons.some((icono) => (icono.purpose ?? '').includes('maskable'))).toBe(true);
    for (const icono of manifiesto.icons) {
      expect(icono.src.startsWith('/')).toBe(true);
      expect(icono.type).toBe('image/png');
    }
  });

  it('los PNG existen y tienen el tamaño que declara el manifiesto', () => {
    const manifiesto = JSON.parse(leer('public/manifest.webmanifest')) as Manifiesto;
    for (const icono of manifiesto.icons) {
      const rel = `public${icono.src}`;
      const { ancho, alto } = tamanoPng(rel);
      expect(`${ancho}x${alto}`).toBe(icono.sizes);
    }
    const apple = tamanoPng('public/icons/apple-touch-icon.png');
    expect(apple).toEqual({ ancho: 180, alto: 180 });
  });

  it('el service worker precarga el shell y nunca cachea la API', () => {
    const sw = leer('public/sw.js');
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("'/'");
    expect(sw).toContain('/api');
    // La API siempre va a la red: un plan viejo en caché sería peor que un error.
    expect(sw).toMatch(/\/api[\s\S]{0,200}(red|network|fetch\()/i);
  });

  it('el registro del service worker solo ocurre en el build de producción', () => {
    const main = leer('src/main.tsx');
    expect(main).toContain('serviceWorker');
    expect(main).toContain("'/sw.js'");
    expect(main).toContain('import.meta.env.PROD');
  });
});
