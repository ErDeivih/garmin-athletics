import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTheme } from './lib/theme';
import { migrateLegacyStorage } from './lib/storageMigration';
import './styles/app.css';

// Conserva sesión, tema, banderas y borradores de la marca anterior.
migrateLegacyStorage();

// El tema (oscuro o claro) se aplica antes del primer render para que no haya
// un destello del tema contrario.
initTheme();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Falta el nodo #root en index.html.');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// La app instalada abre desde el icono del móvil: el service worker guarda el
// shell para que arranque sin cobertura y sirve los assets ya descargados. En
// desarrollo no se registra, para no servir una versión vieja mientras se
// programa. Si el navegador no lo soporta (o el contexto no es seguro, por
// ejemplo una IP sin HTTPS) la app funciona igual: solo pierde el offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker no se rompe nada
    });
  });
}
