# WALL â€” garmin (Lyfta)

Copiado del bloque 1 de `F:\EspacioCodigo\_flujo-dsh\MAPA-DE-OBJETIVOS.md`. Se marca aquÃ­ y se
actualiza el estado en `ESTADO-AGENTE.md`.

**Objetivo final**: sustituir a la app de Garmin para David, con lo que Garmin hace mal resuelto:
crear entrenamientos de gimnasio, llevarlos al reloj y analizar todo.

- [x] Editor de calibraciÃ³n IMU por ejercicio (en la app). â€” 2026-11-05. Perfil versionado, editor
  manual (duraciÃ³n, sensibilidad, eje, inicio de serie), activar/desactivar y API de calibraciÃ³n en
  seco. La captura guiada desde el reloj llega con la watch-app (bloque aparte).
- [x] Filtros y vueltas del detalle de Actividad. â€” 2026-11-05. Filtros por deporte/texto contra la
  API, quitar filtros, estados vacÃ­os; vueltas registradas por el reloj en el detalle.
- [x] Actividades con el juego completo de grÃ¡ficas y datos. â€” 2026-11-05. Resumen ampliado
  (distancia, duraciÃ³n, ritmo, FC media/mÃ¡x, cadencia, potencia, desnivel, bajada, altitud,
  calorÃ­as, carga), zonas de FC, recorrido, FC/ritmo/altitud/velocidad, parciales, vueltas y meteo;
  las grÃ¡ficas sin datos no se pintan.
- [ ] Prueba real en el Forerunner 255 (necesita 2FA de David).
- [x] Despliegue web para el mÃ³vil. â€” 2026-11-09. La app y la API se sirven desde el
  servidor de casa en **dos puertas**: `http://192.168.1.139:8010` (red de casa, sin
  Tailscale) y `http://100.117.58.93:8010` (tailnet/WireGuard, desde cualquier sitio).
  Nada expuesto a Internet. Manifiesto e iconos PWA, fallback de rutas profundas y la
  base de David migrada (46 actividades, plantilla, credencial de Garmin). Flujo completo
  recorrido contra el despliegue (instancia desechable, capturas a 390 px en
  `docs/capturas-movil/`). Ver `DESPLIEGUE.md` y `docs/revision-interfaz-movil.md`.
  **HTTPS activo desde el 2026-11-10**: Tailscale Serve termina el TLS con certificado
  vÃ¡lido en `https://servidor.tail4263a0.ts.net` (PWA instalable y arranque sin cobertura
  verificados). Nota: el servidor anuncia el sufijo `tail4263a0.ts.net`; el nombre
  `ta4283ad.ts.net` del panel aÃºn no resuelve.
- [x] Pesos por serie en la sesiÃ³n guardada. â€” 2026-11-09. El borrador de Â«EntrenarÂ»
  rellenaba todas las series con la Ãºltima marca o el peso del ejercicio e ignoraba
  `set_targets`; ahora cada serie toma su objetivo (objetivo > Ãºltima marca > peso del
  ejercicio) y la sesiÃ³n guarda 60/65/70 con tonelaje 1420 kg. Prueba rojoâ†’verde en
  `frontend-nuevo/src/test/session-pesos.test.tsx` y verificaciÃ³n en el despliegue con
  capturas antes/despuÃ©s. Detalle en `docs/revision-interfaz-movil.md` Â§4.
- [x] App lista para uso real desde el mÃ³vil. â€” 2026-11-10. Tres pasos de instalaciÃ³n en
  `docs/USO-MOVIL.md`; tarjeta visible Â«Reloj real Â· pendienteÂ» en Gimnasio (se apaga con
  `AVISO_RELOJ_REAL`); flujo completo verificado (plan 60/65/70, envÃ­o, correcciÃ³n
  posterior a 62,5 y sesiÃ³n en el historial con 1420 kg). **HTTPS activo** por Tailscale
  Serve: instalable y con arranque sin cobertura en `https://servidor.tail4263a0.ts.net`.
- [x] Portfolio de candidatura. â€” 2026-11-10. `PORTFOLIO.md` con problema, competencias
  (producto mÃ³vil, hardware, offline), capturas, enlace, estado y tecnologÃ­as.
- [x] Biblioteca de entrenamientos completa. â€” 2026-11-10. Planes con nombre, bÃºsqueda por
  texto, filtro por foco y rango de fechas (servidor) y **duplicado** con sus pesos por
  serie. Guion de contrato `tests/test_gym_library.py` (rojo â†’ verde) y capturas
  `13/14/15-biblioteca-*.png`.
- [x] Editor de pesos rÃ¡pido. â€” 2026-11-10. BotÃ³n para copiar la serie anterior, peso en
  bloque (Â«aplicar a todasÂ») y guardado automÃ¡tico sin salir de la pantalla. Prueba
  `plan-editor-bulk.test.tsx` (rojo â†’ verde) y capturas `16/17-editor-*.png`.
- [x] Historial de sesiones. â€” 2026-11-10. PÃ¡gina `/gimnasio/historial` con fecha, duraciÃ³n,
  volumen y series; el detalle muestra el peso **planificado frente al real**. Guion de
  contrato `test_gym_library.py` y capturas `11-historial-completo.png`,
  `12-planificado-vs-real.png`.
- [x] Portabilidad, ajustes y onboarding. â€” 2026-11-10. Exportar/importar planes en JSON
  (biblioteca), ajustes con unidades kg/lb aplicadas a toda la app, tema claro/oscuro y
  aviso de uso sin conexiÃ³n, y onboarding de tres pasos en la primera visita (repetible
  desde Ajustes). Pruebas rojo â†’ verde: `planes-json`, `ajustes-unidades`, `onboarding`;
  capturas `00-onboarding`, `18-biblioteca-json`, `19-ajustes-unidades`,
  `20-editor-libras`.
- [x] Progreso y plantillas de entrenamiento. â€” 2026-11-10. Panel `/gimnasio/progreso`
  con volumen (kgÃ—reps), series, mejor serie y grÃ¡fico semanal por ejercicio
  (`GET /strength/progress`); guardar una sesiÃ³n entrenada como plantilla y **aplicar una
  plantilla a un dÃ­a concreto** (evento de calendario). Pruebas rojo â†’ verde: `progreso`,
  `plantilla-desde-sesion`, `aplicar-dia`, `tests/test_gym_progress.py`. Capturas
  `21-progreso`, `22-aplicar-dia`, `23-guardar-plantilla`.
- [ ] Watch-app Connect IQ propia (despuÃ©s del camino A). â€” **en curso**: `watch/lyfta-watch/`
  diseÃ±ada, implementada y compilada para fr255 y 4 perfiles mÃ¡s; backend `/watch/today` y
  `/watch/sets` probado; sensor de repeticiones y estimaciÃ³n de fuerza aÃ±adidos. Capturas del
  simulador pendientes del permiso de firewall.

**Terminado cuando**: creo una rutina, sale en el reloj sola el dÃ­a que toca, la ejecuto sin tocar el
reloj y el anÃ¡lisis estÃ¡ completo.

## Evidencia

- Frontend: 62/62 pruebas en 27 ficheros (incluye PWA, servido SPA, pesos por serie, aviso del reloj real, biblioteca con filtros/duplicado, editor rÃ¡pido, historial, JSON de planes, unidades y onboarding).
- Backend: 22/22 scripts (incluye perfil IMU en seco, auto-carga, watch-app, rutas, calendario recurrente, servido del frontend, correcciÃ³n de pesos y biblioteca/planificado).
- Despliegue: `deploy/verify-server.sh` en verde el 2026-11-09 â€” salud, rutas profundas, cabeceras del service worker y datos migrados. Captura del mÃ³vil contra la URL desplegada: `frontend-nuevo/screenshots/30-despliegue-login.png`.
- Flujo mÃ³vil contra el despliegue: `scripts/flujo-movil-desplegado.mjs` recorre plan (60/65/70) â†’ ediciÃ³n guardada en servidor â†’ `dry_run` con `unmapped: []` â†’ envÃ­o sin credencial (400 limpio) â†’ 3 series â†’ sesiÃ³n guardada **con 60/65/70** (`coincide: true`); 8 capturas a 390 px e informe en `docs/capturas-movil/`, con las de antes en `antes/`.
- RevisiÃ³n de interfaz: `docs/revision-interfaz-movil.md` â€” inventario de las 6 pantallas del flujo, 17 capturas a 390 px, 10 problemas con evidencia y su arreglo CSS/texto, y el antes/despuÃ©s del arreglo de pesos por serie.
- RegresiÃ³n visual: 4/4 pantallas, 0 pÃ­xeles distintos, con la lÃ­nea base regenerada por los cambios de esta tanda (editor rÃ¡pido, enlace al historial y Â«Reloj realÂ») en la instancia de verificaciÃ³n.
- Capturas de la tanda de producto: `docs/capturas-movil/11`â€“`17` (historial, planificado vs real, biblioteca con filtros, duplicar, copia, editor rÃ¡pido y aplicado) y `00`, `18`â€“`20` (onboarding, JSON de planes, ajustes y unidades en lb), a 390 Ã— 844.
- InstalaciÃ³n PWA verificada: ventana de aplicaciÃ³n (`display-mode: standalone`, sin barra
  del navegador) con service worker controlando y **arranque sin cobertura**
  (`onLine: false`, `transferSize: 0`, `workerStart > 0`). Informe
  `docs/capturas-movil/informe-instalacion.json` y capturas `pwa-instalada-ventana.png` /
  `pwa-instalada-sin-cobertura.png`.
- Uso real desde el mÃ³vil: `docs/USO-MOVIL.md` â€” bloque Ãºnico con los tres pasos de instalaciÃ³n, la URL HTTPS exacta, quÃ© se guarda sin cobertura y lo que falta para el reloj. Verificado contra la URL real (`informe-https.json`: contexto seguro, service worker activo, arranque sin cobertura) y con el inspector de Chrome (`informe-pwa.json`: instalable).
- Capturas: `frontend-nuevo/screenshots/` â€” 29 capturas nuevas y numeradas (01â€“29).
- Prueba final en seco: plan -> dry-run -> reloj -> 3 series -> sesiÃ³n guardada; capturas 27â€“29.\n- Biblioteca: fases, series y pesos por serie visibles; filtro por foco.
- Actividades: filtros por deporte, texto y rango Desde/Hasta con atajos de 30 dÃ­as/mes.
- RegresiÃ³n visual: `npm run visual` compara planificador, envÃ­o y sesiÃ³n con `pixelmatch` (4 pantallas, 0 pÃ­xeles distintos en la Ãºltima pasada).
- EnvÃ­o al reloj: botÃ³n Ãºnico con estado **Pendiente / Enviado / Error** y guÃ­a de sincronizaciÃ³n; cubierto por pruebas y regresiÃ³n visual.
- Gimnasio mÃ³vil: pesos por serie con âˆ’ / + al planificar y despuÃ©s, envÃ­o desde Lyfta con estado y ediciÃ³n posterior; guardado automÃ¡tico y Ãºltima marca como respaldo.
- El nombre visible se configura en `frontend-nuevo/src/config/marca.ts`. La sesiÃ³n, el tema, las secciones y los borradores de la versiÃ³n anterior se pueden recuperar. La prueba de sesiÃ³n antigua falla antes del cambio y pasa despuÃ©s.
- Contrato HTTP en una base de pruebas: 140/140. Humo a 390 Ã— 844: 20 capturas de este pase, sin errores de navegador. La cuenta nueva no tenÃ­a actividad GPS; el detalle de actividad se cubre con la prueba especÃ­fica y la captura existente.
