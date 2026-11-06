/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { NOMBRE_APP } from './src/config/marca';

// El cliente usa rutas relativas `/api/v1`; en desarrollo el proxy las manda
// al backend real. `VITE_API_PROXY_TARGET` permite apuntar a otro puerto sin
// tocar el código (por ejemplo, una copia de la base de datos en 8010).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'marca',
      transformIndexHtml: (html) => html.replaceAll('__NOMBRE_APP__', NOMBRE_APP),
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    restoreMocks: true,
  },
});
