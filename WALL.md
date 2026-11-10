# WALL — garmin (Lyfta)

Copiado del bloque 1 de `F:\EspacioCodigo\_flujo-dsh\MAPA-DE-OBJETIVOS.md`. Se marca aquí y se
actualiza el estado en `ESTADO-AGENTE.md`.

**Objetivo final**: sustituir a la app de Garmin para David, con lo que Garmin hace mal resuelto:
crear entrenamientos de gimnasio, llevarlos al reloj y analizar todo.

- [x] Editor de calibración IMU por ejercicio (en la app). — 2026-11-05. Perfil versionado, editor
  manual (duración, sensibilidad, eje, inicio de serie), activar/desactivar y API de calibración en
  seco. La captura guiada desde el reloj llega con la watch-app (bloque aparte).
- [x] Filtros y vueltas del detalle de Actividad. — 2026-11-05. Filtros por deporte/texto contra la
  API, quitar filtros, estados vacíos; vueltas registradas por el reloj en el detalle.
- [x] Actividades con el juego completo de gráficas y datos. — 2026-11-05. Resumen ampliado
  (distancia, duración, ritmo, FC media/máx, cadencia, potencia, desnivel, bajada, altitud,
  calorías, carga), zonas de FC, recorrido, FC/ritmo/altitud/velocidad, parciales, vueltas y meteo;
  las gráficas sin datos no se pintan.
- [ ] Prueba real en el Forerunner 255 (necesita 2FA de David).
- [x] Despliegue web para el móvil. — 2026-11-09. La app y la API se sirven desde el
  servidor de casa en **dos puertas**: `http://192.168.1.139:8010` (red de casa, sin
  Tailscale) y `http://100.117.58.93:8010` (tailnet/WireGuard, desde cualquier sitio).
  Nada expuesto a Internet. Manifiesto e iconos PWA, fallback de rutas profundas y la
  base de David migrada (46 actividades, plantilla, credencial de Garmin). Flujo completo
  recorrido contra el despliegue (instancia desechable, capturas a 390 px en
  `docs/capturas-movil/`). Ver `DESPLIEGUE.md` y `docs/revision-interfaz-movil.md`.
  Queda para cerrar del todo: HTTPS en el tailnet para service worker e instalación de
  Android (lo activa David en el panel de Tailscale).
- [x] Pesos por serie en la sesión guardada. — 2026-11-09. El borrador de «Entrenar»
  rellenaba todas las series con la última marca o el peso del ejercicio e ignoraba
  `set_targets`; ahora cada serie toma su objetivo (objetivo > última marca > peso del
  ejercicio) y la sesión guarda 60/65/70 con tonelaje 1420 kg. Prueba rojo→verde en
  `frontend-nuevo/src/test/session-pesos.test.tsx` y verificación en el despliegue con
  capturas antes/después. Detalle en `docs/revision-interfaz-movil.md` §4.
- [x] App lista para uso real desde el móvil. — 2026-11-10. Tres pasos de instalación en
  `docs/USO-MOVIL.md`; tarjeta visible «Reloj real · pendiente» en Gimnasio (se apaga con
  `AVISO_RELOJ_REAL`); flujo completo verificado (plan 60/65/70, envío, corrección
  posterior a 62,5 y sesión en el historial con 1420 kg); servicio por HTTPS comprobado
  como instalable y con arranque sin cobertura. Falta el interruptor HTTPS del tailnet
  (solo David) para que eso ocurra en el móvil real.
- [x] Portfolio de candidatura. — 2026-11-10. `PORTFOLIO.md` con problema, competencias
  (producto móvil, hardware, offline), capturas, enlace, estado y tecnologías.
- [ ] Watch-app Connect IQ propia (después del camino A). — **en curso**: `watch/lyfta-watch/`
  diseñada, implementada y compilada para fr255 y 4 perfiles más; backend `/watch/today` y
  `/watch/sets` probado; sensor de repeticiones y estimación de fuerza añadidos. Capturas del
  simulador pendientes del permiso de firewall.

**Terminado cuando**: creo una rutina, sale en el reloj sola el día que toca, la ejecuto sin tocar el
reloj y el análisis está completo.

## Evidencia

- Frontend: 51/51 pruebas en 21 ficheros (incluye PWA, servido SPA, pesos por serie y aviso del reloj real).
- Backend: 21/21 scripts (incluye perfil IMU en seco, auto-carga, watch-app, rutas, calendario recurrente, servido del frontend y corrección de pesos por serie).
- Despliegue: `deploy/verify-server.sh` en verde el 2026-11-09 — salud, rutas profundas, cabeceras del service worker y datos migrados. Captura del móvil contra la URL desplegada: `frontend-nuevo/screenshots/30-despliegue-login.png`.
- Flujo móvil contra el despliegue: `scripts/flujo-movil-desplegado.mjs` recorre plan (60/65/70) → edición guardada en servidor → `dry_run` con `unmapped: []` → envío sin credencial (400 limpio) → 3 series → sesión guardada **con 60/65/70** (`coincide: true`); 8 capturas a 390 px e informe en `docs/capturas-movil/`, con las de antes en `antes/`.
- Revisión de interfaz: `docs/revision-interfaz-movil.md` — inventario de las 6 pantallas del flujo, 17 capturas a 390 px, 10 problemas con evidencia y su arreglo CSS/texto, y el antes/después del arreglo de pesos por serie.
- Regresión visual: 4/4 pantallas, 0 píxeles distintos, con la línea base actualizada por la tarjeta «Reloj real» (se regeneró en la instancia de verificación).
- Uso real desde el móvil: `docs/USO-MOVIL.md` — pasos de instalación por plataforma y puerta, qué se guarda sin cobertura y qué falta (HTTPS). Comprobado con el navegador en las dos puertas y en un contexto seguro: `docs/capturas-movil/informe-pwa.json`.
- Capturas: `frontend-nuevo/screenshots/` — 29 capturas nuevas y numeradas (01–29).
- Prueba final en seco: plan -> dry-run -> reloj -> 3 series -> sesión guardada; capturas 27–29.\n- Biblioteca: fases, series y pesos por serie visibles; filtro por foco.
- Actividades: filtros por deporte, texto y rango Desde/Hasta con atajos de 30 días/mes.
- Regresión visual: `npm run visual` compara planificador, envío y sesión con `pixelmatch` (4 pantallas, 0 píxeles distintos en la última pasada).
- Envío al reloj: botón único con estado **Pendiente / Enviado / Error** y guía de sincronización; cubierto por pruebas y regresión visual.
- Gimnasio móvil: pesos por serie con − / + al planificar y después, envío desde Lyfta con estado y edición posterior; guardado automático y última marca como respaldo.
- El nombre visible se configura en `frontend-nuevo/src/config/marca.ts`. La sesión, el tema, las secciones y los borradores de la versión anterior se pueden recuperar. La prueba de sesión antigua falla antes del cambio y pasa después.
- Contrato HTTP en una base de pruebas: 140/140. Humo a 390 × 844: 20 capturas de este pase, sin errores de navegador. La cuenta nueva no tenía actividad GPS; el detalle de actividad se cubre con la prueba específica y la captura existente.
