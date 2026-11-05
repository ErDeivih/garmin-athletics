# WALL — garmin (PULSO)

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
- [ ] Watch-app Connect IQ propia (después del camino A). — **en curso**: `watch/pulso-watch/`
  diseñada, implementada y compilada para fr255 y 4 perfiles más; backend `/watch/today` y
  `/watch/sets` probado; sensor de repeticiones y estimación de fuerza añadidos. Capturas del
  simulador pendientes del permiso de firewall.

**Terminado cuando**: creo una rutina, sale en el reloj sola el día que toca, la ejecuto sin tocar el
reloj y el análisis está completo.

## Evidencia

- Frontend: 35/35 pruebas en 15 ficheros.
- Backend: 16/16 scripts (incluye perfil IMU en seco, auto-carga, watch-app, rutas y calendario recurrente).
- Capturas: `frontend-nuevo/screenshots/` — 18 capturas nuevas y numeradas (01–18).
