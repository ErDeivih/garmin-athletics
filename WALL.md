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
- [ ] Watch-app Connect IQ propia (después del camino A). — **en curso**: `watch/lyfta-watch/`
  diseñada, implementada y compilada para fr255 y 4 perfiles más; backend `/watch/today` y
  `/watch/sets` probado; sensor de repeticiones y estimación de fuerza añadidos. Capturas del
  simulador pendientes del permiso de firewall.

**Terminado cuando**: creo una rutina, sale en el reloj sola el día que toca, la ejecuto sin tocar el
reloj y el análisis está completo.

## Evidencia

- Frontend: 41/41 pruebas en 18 ficheros.
- Backend: 19/19 scripts (incluye perfil IMU en seco, auto-carga, watch-app, rutas y calendario recurrente).
- Capturas: `frontend-nuevo/screenshots/` — 29 capturas nuevas y numeradas (01–29).
- Prueba final en seco: plan -> dry-run -> reloj -> 3 series -> sesión guardada; capturas 27–29.\n- Biblioteca: fases, series y pesos por serie visibles; filtro por foco.
- Actividades: filtros por deporte, texto y rango Desde/Hasta con atajos de 30 días/mes.
- Regresión visual: `npm run visual` compara planificador, envío y sesión con `pixelmatch` (4 pantallas, 0 píxeles distintos en la última pasada).
- Envío al reloj: botón único con estado **Pendiente / Enviado / Error** y guía de sincronización; cubierto por pruebas y regresión visual.
- Gimnasio móvil: pesos por serie con − / + al planificar y después, envío desde Lyfta con estado y edición posterior; guardado automático y última marca como respaldo.
- El nombre visible se configura en `frontend-nuevo/src/config/marca.ts`. La sesión, el tema, las secciones y los borradores de la versión anterior se pueden recuperar. La prueba de sesión antigua falla antes del cambio y pasa después.
- Contrato HTTP en una base de pruebas: 140/140. Humo a 390 × 844: 20 capturas de este pase, sin errores de navegador. La cuenta nueva no tenía actividad GPS; el detalle de actividad se cubre con la prueba específica y la captura existente.
