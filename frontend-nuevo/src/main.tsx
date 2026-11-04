import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTheme } from './lib/theme';
import './styles/app.css';

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
