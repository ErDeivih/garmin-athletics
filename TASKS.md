# TASKS.md - Plan de Tareas de Desarrollo Granular

> Leyenda 2026-09-10 (verificado contra código): [x] hecho · [~] parcial (detalle en la línea) · [ ] pendiente.

## FASE 1: Entorno Base e Ingesta de Garmin Connect (Python Backend)

- [x] **T-01**: Inicializar la estructura del proyecto backend con FastAPI, Pydantic v2 y SQLAlchemy 2.0 async.
- [x] **T-02**: Crear el módulo de autenticación `GarminClient` utilizando `garminconnect`.
- [x] **T-03**: Implementar la persistencia de cookies/tokens de sesión en disco (`garmin_tokens.json`) para evitar re-logins constantes con 2FA.
- [x] **T-04**: Crear script de prueba para descargar métricas biométricas (`get_stats`, `get_heart_rates`, `get_hrv_data`, `get_sleep_data`).
- [x] **T-05**: Crear endpoint `POST /api/v1/sync/garmin` para disparar sincronización manual.
- [x] **T-06**: Configurar el planificador `APScheduler` para ejecutar la ingesta desatendida diariamente a las 07:00 AM y cada 15 minutos entre las 18:00 y las 22:00.

---

## FASE 2: Base de Datos y Motor Fisiológico (ATL / CTL / TSB)

- [x] **T-07**: Configurar PostgreSQL / Supabase y aplicar scripts de migración (SQL DDL para `daily_biometrics`, `activities`, `strength_logs`, `fatigue_metrics`).
- [x] **T-08**: Programar el servicio `FatigueEngine` en Python que calcule el TSS de cada actividad (EPOC para Garmin, Foster para fútbol/manual).
- [x] **T-09**: Implementar la fórmula de Banister para cálculo exponencial de ATL (7 días), CTL (42 días) y TSB ($TSB = CTL - ATL$).
- [x] **T-10**: Crear el calculador de `ReadinessScore` (0-100) combinando TSB, desviación de HRV respecto a la media de 7 días y puntuación de sueño.

---

## FASE 3: Asistente Adaptativo de Gimnasio (Integración LLM)

- [x] **T-11**: Desarrollar el servicio `GymLLMAdvisor` con integración a DeepSeek V4 Flash / Claude API.
- [x] **T-12**: Diseñar el estructurador de contexto de prompt que serialice la preparación física actual (Readiness, fatiga muscular en piernas por fútbol, etc.).
- [x] **T-13**: Implementar el parser de respuesta estricto con Pydantic para validar el JSON de la rutina sugerida.
- [x] **T-14**: Crear endpoints `GET /api/v1/strength/suggest` y `POST /api/v1/strength/log`.

---

## FASE 4: Frontend Web & App Móvil (Next.js / Vite React)

- [x] **T-15**: Inicializar proyecto Frontend en `frontend/` con Tailwind CSS y componentes Shadcn UI.
- [x] **T-16**: Construir el Dashboard Principal: Widgets de Sueño, HRV, Body Battery y semáforo de Readiness.
- [x] **T-17**: Implementar la gráfica interactiva de Carga Fisiológica (curvas de ATL, CTL y TSB con Recharts).
- [x] **T-18**: Desarrollar la vista optimizada para smartphone de Registro de Gimnasio (interfaz touch-friendly para añadir pesos, repeticiones y guardar).
- [x] **T-19**: Crear el modal de Asistente IA ("Sugerir Rutina con un Clic") con visor de ejercicios recomendados.

> Nota 2026-09-10: rehecho de verdad en Fases 13-14 (Dashboard/Activities/Gym/Routes + `GET /metrics/daily|trends`, `GET /sync/status`). Lo que sigue pendiente de verdad: TrendsPage, rest-timer, PRs, calendario, rendimiento, PWA.

---

## FASE 5: Integración, Pruebas y Despliegue

- [x] **T-20**: Escribir pruebas unitarias con Pytest para la lógica de cálculo de ATL/CTL/TSB y mock de API Garmin.
- [x] **T-21**: Crear `docker-compose.yml` para levantar PostgreSQL y FastAPI localmente en un comando.
- [x] **T-22**: Documentar el proceso de primera autenticación Garmin en el archivo `README.md`.

---

## FASE 6: Multiusuario y Social (Comparativas con Amigos)

- [x] **T-23**: Modelo `User` + `Friendship` y columnas `user_id` en `activities`, `strength_logs`, `daily_biometrics`, `fatigue_metrics` (PK compuesta en tablas diarias).
- [x] **T-24**: Migración idempotente ligera (`ALTER TABLE ADD COLUMN`) para SQLite y PostgreSQL al arrancar.
- [x] **T-25**: Módulo `core/security.py`: hash de contraseñas PBKDF2 + tokens firmados HMAC-SHA256 (stdlib puro, sin dependencias nuevas).
- [x] **T-26**: Endpoints de autenticación `POST /auth/register`, `POST /auth/login`, `GET /auth/me` con dependencias `get_current_user` / `require_current_user`.
- [x] **T-27**: Router de amistades: enviar/aceptar/rechazar solicitudes, listar amigos y eliminar amistad.
- [x] **T-28**: Router social `GET /social/leaderboard` (TSS semanal, CTL/TSB, Readiness de ti + tus amigos) y `GET /social/friends/{id}/summary`.
- [x] **T-29**: Filtrado multiusuario en endpoints existentes (actividades, métricas, gimnasio) manteniendo compatibilidad con datos legacy sin propietario.
- [x] **T-30**: Pruebas unitarias de seguridad (`tests/test_security.py`) y flujo social end-to-end (`tests/test_social_e2e.py`).
- [x] **T-31**: Frontend AuthPanel: login/registro con token persistente en localStorage e interceptor Axios.
- [x] **T-32**: Frontend SocialPage: leaderboard visual semanal (TSS, CTL/TSB, Readiness), gestión de amigos y solicitudes.
- [x] **T-33**: Vinculación Garmin passwordless (SIN guardar contraseñas) + `POST /auth/garmin-mfa` 2FA + `GET /auth/garmin-status` con `needs_reauth` + borrado de tokens al desvincular. (Reescrito 2026-09-10: el HMAC-CTR original guardaba passwords; eliminado.)
- [x] **T-34**: `POST /sync/garmin` por usuario: descarga, persistencia propia de biometría/actividades/fatiga y cálculo de Readiness real.
- [x] **T-35**: Scheduler multiusuario: sincroniza cada cuenta Garmin vinculada a las 07:00 y cada 15 min por la tarde (fallback legacy al `.env` si nadie está vinculado).
- [x] **T-36**: Frontend GarminLink: vinculación/desvinculación de Garmin y botón "Sincronizar ahora" desde el dashboard.

---

## FASE 7: Mapas y Actividades GPS (P0 — correr/bici) [HU-12..HU-17]

- [x] **T-37**: `POST /sync/garmin` async + lógica extraída a `services/sync_service.run_user_sync()` compartido con scheduler.
- [x] **T-38**: Scheduler que persiste vía `run_user_sync()` + jitter; volumen `./data` + `TRACKS_DIR`. Sin `nightly_rollup` separado (el sync recalcula readiness/Banister; suficiente).
- [~] **T-39**: Hecho: `activities` extendida + `routes` + `personal_records` + `calendar_events` + `privacy_zones` + `daily_stats` + migración idempotente. Sin tablas `activity_tracks/streams` (JSON en disco por diseño), sin índices compuestos ni FK.
- [~] **T-40**: Hecho: `track_service.py` (polyline→JSON full-res, Douglas-Peucker al leer, desnivel umbral 2m, bbox, vueltas/meteo/zonas, splits/km, streams, GPX, recorte privacidad). Sin parse GPX de actividad (innecesario), sin Savitzky, sin `gpxpy`.
- [x] **T-41**: `get_activity_full()` con try/except por fuente (backoff el de la lib). Sin `tenacity` ni flag `garmin_reachable`.
- [~] **T-42**: Hecho: `GET /{id}`, `/track`, `/streams`, `/splits`, `/export`, `POST /refresh`, solo propietario. Sin ETag ni acceso amigos.
- [x] **T-43**: CRUD rutas + `from-activity` + export GPX + import GPX multipart + CRUD `/privacy-zones` con recorte real.
- [~] **T-44**: Hecho: Leaflet + detalle + perfil sincronizado + planner OSRM + filtros servidor (sport/fechas/texto) + paginación `X-Total-Count`. Sin react-query.
- [x] **T-45**: `test_tracks.py` (8 casos) + 403 en `test_edge_cases.py`.

## FASE 8: Biometría Real, Sueño, HRV y Rendimiento (P1) [HU-18..HU-26]

- [~] **T-46**: Columnas de sueño/HRV/BB en `daily_biometrics` + `daily_stats` (sin tablas separadas por diseño).
- [x] **T-47**: Ingesta: fases deep/light/REM/awake, eficiencia, bedtime/wakeup, `hrv_status`, curva BB intradía + wake. Sin rmssd ni readiness v2.
- [~] **T-48**: Hecho: `/metrics/daily` (con fases/curva), `/metrics/trends`, `/metrics/stats`. Sin `/sleep/summary` dedicado (cubierto) ni `/load?by_sport`.
- [x] **T-49**: Zonas FC agregadas, resumen por deporte/periodo con comparativa, PRs simples (ritmo/velocidad/distancia) detectados en sync.
- [x] **T-50**: `GET /performance/summary|zones|prs`. Sin `PUT /settings/zones` (zonas las da Garmin).
- [x] **T-51**: Cubierto en `test_features2.py` (zonas, PRs, summary).
- [~] **T-52**: Hecho: TrendsPage (8 métricas con pasos, 30/90d, media 7d, CSV), fases y curva BB en dashboard, avisos. Sin componentes separados ni React Query/localStorage.
- [x] **T-53**: `PerformancePage` (resumen vs previo, zonas, PRs + predicciones Garmin).

## FASE 9: Gimnasio UI Completa (P2) [HU-27..HU-29]

- [x] **T-54**: Factor TSS por foco (Legs 0.03, Push/Pull 0.02, Full 0.025, Core 0.015; default 0.02 retrocompatible).
- [x] **T-55**: `intensity` en suggest + aviso calendario inamovible + `exercises/prs` + `history?exercise=`.
- [~] **T-56**: Hecho: steppers, sugerencia editable inline, rest-timer con aviso sonoro, historial. Sin tachar series ni modal separado (inline elegido).
- [~] **T-57**: Cubierto en suites (TSS Push=60, log suma actividad como TSS). Sin test dedicado de "evita pierna con fútbol" ni ATL-día-siguiente.

## FASE 10: Calendario, Planificación y Avisos (P3) [HU-30..HU-32]

- [x] **T-58**: `calendar_events` (recurrencia semanal simple `weekday`) + expansión en lectura.
- [x] **T-59**: `GET /calendar` (eventos+actividades+readiness) + CRUD + `upcoming_immovable()` consumido por suggest y avisos.
- [x] **T-60**: `CalendarPage` mes (colores, readiness, recurrentes, borrar) + formulario.
- [x] **T-61**: `GET /alerts` (hrv_drop, tsb_risk, no_sync, reauth, low_sleep, rhr_high, match_soon, no_hr) + banner en dashboard.

## FASE 11: Datos, Privacidad, PWA y Pulido [HU-33..HU-35]

- [~] **T-62**: Hecho: status veraz, `dist`, `/healthz`, healthcheck en compose. Sin `tracks_pending/garmin_reachable` ni quitar `version:'3.8'`.
- [~] **T-63**: Hecho: export GPX actividad y rutas, CSV tendencias, `DELETE /auth/account` (filas+tokens+tracks+rutas). Sin TCX.
- [~] **T-64**: Hecho: `manifest.webmanifest` + theme-color + icono SVG. Sin service worker ni Lighthouse 80.
- [x] **T-65**: Test privacidad en `test_edge_cases.py` (track ajeno 404, leaderboard sin coords/crudo) + `visibility` por defecto + README.
- [x] **T-66**: README/SPEC/PLAN/TASKS revisados con estado real (2026-09-10, dos pasadas).

---

## FASE 12: Auditoría 2026-09-10 — Deuda crítica + fuentes Garmin sin explotar [HU-36..HU-42]
- [~] **T-67**: Hecho: `daily_stats` (pasos/calorías/intensidad) + `training_snapshot` (VO2max/estado/predicciones) en sync con backfill (100 primera vez). Pendiente: peso, SpO2, dispositivos, material, zonas importadas, planificados Garmin.
- [~] **T-68**: Hecho: `GET /metrics/stats`, `GET /metrics/training-status`. Pendiente: peso, devices, goals, gear.
- [~] **T-69**: Hecho: pasos en Tendencias + tarjeta Movimiento + "Garmin dice" + predicciones en Rendimiento. Pendiente: peso, devices, objetivos.
- [~] **T-70**: Deuda D1-D13. Aplicado: D1, D2 (scheduler persiste), D3, D4, D5, D6, D7, D8, D9 parcial, D10, D11, D13 parcial. Pendiente: D12 (FK/cascadas/índices), resto D9, D13 (validación arranque).
- [~] **T-71**: Hecho: logout con blacklist en memoria + validación email. Pendiente: TTL 7d+refresh, PRIVATE_MODE.
- [~] **T-72**: Hecho: sync/detalle/privacidad/backfill cubiertos en `test_garmin_mocked_e2e/edge/features2`. Pendiente: CTL-backfill numérico, e2e Docker/CI.

---

## FASE 13: Confianza passwordless + amigos fácil + push al reloj (implementado 2026-09-10) [HU-43..HU-47]

- [x] **T-73**: Passwordless: `GarminCredential.needs_reauth`, columna password en desuso (siempre NULL), `GarminService.link_with_password/complete_mfa_link` (tokens solo), endpoints `PUT /auth/garmin-credentials` (un solo uso) + `POST /auth/garmin-mfa`, sync/scheduler solo-tokens (`use_env_fallback=False`), `needs_reauth` auto en fallos 401, unlink borra tokens de disco, migración SQLite+Postgres.
- [x] **T-74**: Invitaciones: modelo `FriendInvite` (código 6 chars, 7 días, un uso), `POST /friends/invite` + `POST /friends/accept-invite` (amistad directa), UI en SocialPage + tests e2e.
- [x] **T-75**: Push entreno experimental: `POST /strength/push-to-garmin` con `dry_run=true` por defecto (devuelve JSON + no-mapeados), mapeo ES→enum Garmin, test dry_run en verde.
- [x] **T-76**: Frontend: GarminLink en 2 pasos (contraseña un solo uso + código 2FA + aviso re-auth + nota de privacidad), rebuild verificado (`application/javascript` OK).
- [x] **T-77**: Ingesta ampliada parcial hecha (T-67): daily_stats + training_snapshot + backfill.
- [x] **T-78**: Planificador de rutas + export GPX hechos (T-81); subida de courses imposible por librería (documentado).

---

## FASE 14: Detalle por actividad + mapas + rutas + gym editable (implementado 2026-09-10) [HU-12..HU-17, HU-27/28]

- [x] **T-79**: Tracks sin dependencias: `TrackService` (polyline→simplify Douglas-Peucker, desnivel, bbox, streams), columnas nuevas en `activities` + migración SQLite/Postgres, `GET /activities/{id}` (lazy enrich + caché), `GET /{id}/track`, `POST /{id}/refresh`. Verificado contra Garmin real (774 pts, vueltas, zonas FC, meteo).
- [x] **T-80**: Frontend detalle: mapa Leaflet oscuro + perfil de elevación sincronizado con hover, tabla de vueltas con ritmo, barras de zonas FC, tarjeta meteo (ºC convertidos), resumen (desnivel, calorías, velocidad).
- [x] **T-81**: Planificador de rutas: clic-añade-puntos, trazado por carretera OSRM (bici/pie) con fallback recto, guardar/listar/ver/borrar (`routes` CRUD), export GPX, guardar track de actividad como ruta.
- [x] **T-82**: Gym: sugerencias editables (nombre/series/reps/RIR inline, añadir/quitar, regenerar), selector de intensidad (auto/suave/intenso) cableado al backend, vista previa para reloj.
- [x] **T-83**: Tests `test_tracks.py` (8 casos) + `test_routes_crud` + `test_leaderboard_many_friends_parallel` e2e en verde; `tsc` + build + verificación en vivo.
- [x] **T-84 (QA 2026-09-10, 4 iteraciones)**: `test_garmin_mocked_e2e.py` (sync/detalle/caché/re-auth/MFA/validaciones) + `test_edge_cases.py` (basura de Garmin, vacíos, 404 JSON, privacidad); fixes: PK global, reps≤300, límites, email, export por axios, badge GPS, ver-GPX en visor de ruta, reset MFA.

---

## FASE 16: Incidencias reales de uso (2026-09-10 noche)

- [x] **T-92**: Migración reparadora: `needs_reauth` se había creado `VARCHAR` y `'0'` como texto siempre es verdad → aviso imposible de quitar. Reconstrucción a BOOLEAN preservando valores + aviso en log.
- [x] **T-93**: Flujo re-vincular en UI (botón grande, email precargado, formulario 2FA con caducidad explicada, cancelar) + etiqueta de contraseña aclarada.
- [x] **T-94**: Mapas sin clave (adiós Carto con key): OSM + Topo + satélite con selector; pantalla completa; evitar autopistas/peajes (OSRM `exclude`); nota sobre caminos y OSM.
- [x] **T-95**: Fix alineación streams con huecos GPS (IndexError real) + test; sync auto-enriquece 5 GPS recientes + PRs globales (zonas y marcas ya no salen vacías).

---

## FASE 15: Todo lo restante pedido (implementado 2026-09-10)

- [x] **T-85**: `sync_service.run_user_sync()` compartido + scheduler que persiste + backfill ×100 + `daily_stats` + `training_snapshot` + PRs.
- [x] **T-86**: Filtros servidor + paginación (`X-Total-Count`), `/streams`, `/splits`, `/export` GPX, privacy zones con recorte, import GPX.
- [x] **T-87**: Rendimiento (`/performance/summary|zones|prs`), calendario + avisos, TSS por foco, PRs por ejercicio, `history?exercise`, logout+blacklist, GDPR, email validado.
- [x] **T-88**: Frontend: Tendencias (8 métricas+CSV), Rendimiento (+predicciones Garmin), Calendario (+avisos), streams en detalle, fecha+paginación, timer, fases/curva/steps/"Garmin dice", import GPX + zonas en Rutas, PWA manifest.
- [x] **T-89**: Mapas sin clave (OSM/Topo/satélite) + planner (arrastrar, deshacer, invertir, ida-vuelta, bucle óptimo, lista editable) + ruta de colores + perfil robusto + sensores en resumen.
- [x] **T-90**: Asistente (sin "IA"): bancos por foco con rotación diaria, desplegables por tipo, leyenda RIR/TSS/RPE/tonelaje, más equivalencias Garmin.
- [x] **T-91**: `test_features2.py` (sueño/stats/snapshot, streams/splits/export/crop, calendario/avisos/rendimiento, filtros/import, logout/GDPR, backfill) en verde; full suite + build + smoke en vivo.
