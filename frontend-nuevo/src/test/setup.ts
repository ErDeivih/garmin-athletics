import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Con 36 ficheros y jsdom, 1 s de espera por defecto se queda corto y hace
// fallar pruebas correctas solo por carga. Se amplía a 5 s (no oculta fallos:
// una consulta que no llega sigue fallando, pero con margen).
configure({ asyncUtilTimeout: 5000 });

// jsdom no implementa matchMedia; la app lo usa para elegir la navegación
// de móvil o de escritorio. Las pruebas se ejecutan como móvil (matches: false).
beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

// Cada prueba arranca sin sesión, sin bandera y sin red falsa heredada.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.dataset.theme = 'dark';
});
