# SPEC.md - Especificación Funcional y Casos de Uso

## 1. Visión General del Producto
Plataforma personal de análisis fisiológico, control de carga de entrenamiento y planificación de fuerza con Inteligencia Artificial. La aplicación se sincroniza en segundo plano con Garmin Connect para extraer métricas de descanso, respuesta cardíaca y entrenamientos de resistencia/fútbol, y calcula el estado óptimo del atleta para recomendar rutinas de gimnasio y ajustar entrenamientos.

Visión extendida (Fases 7-11): convertirse en el **sistema propio completo** del atleta — sustituto privado de Garmin Connect/Strava — con mapas de rutas para correr/bicicleta, análisis profundo de sueño y HRV, análisis de rendimiento (VO2max, umbrales, zonas, PRs), calendario de eventos inamovibles, UIs móviles dedicadas y exportación de datos.

---

## 2. Historias de Usuario

### Módulo 1: Ingesta Automática de Garmin
- **HU-01**: Como usuario, quiero que la aplicación descargue cada mañana a las 07:00 mis datos de sueño, HRV, pulsaciones en reposo y Body Battery sin tener que abrir Garmin ni autenticarme manualmente.
- **HU-02**: Como usuario, quiero que tras finalizar un entrenamiento grabado en el reloj (carrera, bici, natación o partido de fútbol), la app detecte la nueva actividad en <15 minutos y compute su carga de entrenamiento (Training Effect / EPOC).

### Módulo 2: Motor de Lyfta Multidisciplinar (ATL / CTL / TSB)
- **HU-03**: Como atleta, quiero ver una gráfica unificada de fatiga (ATL), condición física (CTL) y frescura/disposición (TSB) que combine automáticamente mi carrera, ciclismo, natación, fútbol y las pesas del gimnasio.
- **HU-04**: Como jugador de fútbol, quiero registrar partidos o entrenamientos sin GPS o sin reloj asignándoles un esfuerzo percibido (RPE de 1 a 10) y duración para que se calcule su lyfta TRIMP/Foster y no distorsione mi fatiga semanal.

### Módulo 3: Asistente Adaptativo de Fuerza (Gimnasio)
- **HU-05**: Como usuario en el gimnasio, quiero presionar "Sugerir Rutina de Hoy" y recibir una rutina personalizada (empuje, tracción, pierna o torso) donde el volumen e intensidad de las piernas se ajusten automáticamente si jugué al fútbol ayer o si mi VFC/HRV indica recuperación incompleta.
- **HU-06**: Como usuario, quiero poder modificar los pesos/repeticiones reales levantados durante la sesión de gimnasio y guardarla con un solo clic.

### Módulo 4: Calendario y Panel de Disposición (Readiness)
- **HU-07**: Como usuario, quiero un indicador visual diario (Verde/Amarillo/Rojo) con el nivel de "Readiness" para saber si hoy puedo hacer series de alta intensidad o debo hacer descanso activo/rodaje suave.
- **HU-08**: Como usuario, quiero fijar días semanales inamovibles (ej. Partidos de fútbol los martes a las 20:00 y domingos a las 11:00) para que la planificación de fuerza y carrera se adapte alrededor de esos eventos.

### Módulo 5: Multiusuario y Social (Fase 6)
- **HU-09**: Como atleta, quiero crear una cuenta propia (email + usuario + contraseña) para que mis datos estén separados de los demás usuarios de la plataforma.
- **HU-10**: Como atleta, quiero enviar/aceptar solicitudes de amistad por nombre de usuario para formar un grupo privado con mis amigos.
- **HU-11**: Como miembro de un grupo, quiero ver un leaderboard comparativo (TSS semanal, CTL/TSB y Readiness) entre mis amigos aceptados, tipo Strava pero gratuito, compartiendo solo métricas agregadas y nunca datos crudos (sueño, HRV detallados).

---

### Módulo 6: Mapas y Actividades con GPS (Fase 7 — P0, crítico correr/bici)
- **HU-12**: Como corredor, quiero abrir cualquier actividad con GPS y ver su **mapa interactivo** (ruta sobre OpenStreetMap, inicio/fin marcados, zoom/pan) tanto en escritorio como en móvil.
- **HU-13**: Como ciclista, quiero ver el **perfil de elevación** sincronizado con el mapa (hover en la gráfica mueve el marcador del mapa y viceversa), con desnivel +/-, altitud máx/mín y pendiente media.
- **HU-14**: Como atleta, quiero ver **splits por km** (ritmo, FC media, desnivel) y **streams** de la actividad (serie temporal de FC, ritmo/velocidad, cadencia, potencia si existe, altitud) en gráficas interactivas.
- **HU-15**: Como usuario, quiero una **lista de actividades** filtrable por deporte (run/bike/swim/soccer/strength), rango de fechas y texto, con paginación, y una **vista detalle** por actividad (resumen + mapa + splits + streams + TSS/EPOC).
- **HU-16**: Como usuario, quiero **planificar rutas**: guardar una actividad como ruta, importar un GPX propio, y ver mis rutas frecuentes (para repetir salidas de correr/bici) con distancia y desnivel estimados.
- **HU-17**: Como usuario preocupado por la privacidad, quiero definir **zonas de privacidad** (radio alrededor de casa/trabajo) para que el inicio/fin de mis rutas se recorte automáticamente en los mapas compartidos o exportados.

### Módulo 7: Dashboard Real de Biometría, Sueño y HRV (Fase 8 — P1)
- **HU-18**: Como usuario, quiero que los widgets de **Sueño, HRV, Body Battery y FC reposo muestren datos reales** (no "--"), con valor de hoy + delta vs media 7 días y sparkline de 30 días.
- **HU-19**: Como usuario, quiero un **análisis de sueño profundo**: horas totales, score, fases (ligero/profundo/REM/vigilia) en barra apilada, hora de acostarse/despertarse, eficiencia, y tendencia de 30 días + correlación con Readiness.
- **HU-20**: Como atleta, quiero una **tendencia de HRV**: HRV nocturno vs media semanal, estado (bajo/normal/alto), RMSSD si disponible, y alerta cuando caiga >15% bajo la media.
- **HU-21**: Como usuario, quiero ver mi **Body Battery intradía** (curva de carga/descarga) y mi **estrés medio** con picos, para entender qué días me drenan más.
- **HU-22**: Como usuario, quiero una vista de **tendencias 30/90 días**: sueño, RHR, HRV, peso (si se sincroniza), TSS semanal, con medias móviles y exportación CSV.

### Módulo 8: Rendimiento y Estadísticas por Deporte (Fase 8 — P1, extra planificado)
- **HU-23**: Como corredor, quiero ver mi **evolución de ritmo vs FC** (desacople aeróbico), **cadencia media**, **VO2max estimado Garmin**, y mis **mejores marcas (PRs)** por distancia (1K/5K/10K/media/maratón) detectadas automáticamente.
- **HU-24**: Como ciclista, quiero ver **potencia media/normalizada (si hay potenciómetro)**, **FTP estimado**, **zonas de potencia/FC** con tiempo en cada zona por actividad y mes.
- **HU-25**: Como nadador, quiero ver **ritmo por 100m, SWOLF, distancia por estilo** cuando Garmin lo provea.
- **HU-26**: Como atleta, quiero un **resumen semanal/mensual por deporte**: nº sesiones, horas, km, desnivel, TSS, mejor esfuerzo, comparativa con semana anterior.

### Módulo 9: Gimnasio — UI Completa (Fase 9 — P2)
- **HU-27**: Como usuario en el gimnasio con el móvil a una mano, quiero un **logger touch-friendly**: seleccionar rutina sugerida, tachar series, ajustar peso/reps con stepper +/-, temporizador de descanso, y guardar con un toque.
- **HU-28**: Como usuario, quiero un **modal "Sugerir con IA"**: elijo foco (Push/Pull/Legs/Full), veo la rutina explicada (por qué este volumen hoy según Readiness/fútbol), la edito y la guardo como sesión.
- **HU-29**: Como usuario, quiero un **historial de fuerza** con tonelaje, TSS, PRs por ejercicio (ej. mejor Press Banca 4x80kg) y gráfica de progresión por ejercicio.

### Módulo 10: Calendario, Planificación y Avisos (Fase 10 — P3)
- **HU-30**: Como usuario, quiero un **calendario semanal/mensual** que combine actividades reales + eventos planificados (partidos fijos, sesiones planificadas) con colores por deporte e indicador Readiness por día.
- **HU-31**: Como jugador de fútbol, quiero crear **eventos recurrentes inamovibles** (ej. martes 20:00, domingo 11:00) para que el `GymAdvisor` los tenga en cuenta (no programar pierna pesada 48h antes/después).
- **HU-32**: Como usuario, quiero **avisos**: "ayer partido intenso + HRV bajo → hoy tren superior suave", "TSB < -20 tres días → riesgo sobreentreno", "sin sincronizar 24h".

### Módulo 11: Datos, Exportación y Privacidad (Fase 11 — extra planificado)
- **HU-33**: Como dueño de mis datos, quiero **exportar** cualquier actividad a GPX/TCX, y mi histórico a CSV, y **borrar** mi cuenta y todos mis datos (GDPR) con un clic.
- **HU-34**: Como usuario, quiero que mis **tracks GPS nunca se compartan** en el leaderboard social (solo agregados) salvo que yo marque una actividad como pública para amigos.
- **HU-35**: Como usuario, quiero que la app funcione como **PWA instalable** y que el dashboard cargue <500ms con datos cacheados aunque Garmin falle.

### Módulo 12: Confianza y Privacidad de Credenciales (implementado 2026-09-10)
- **HU-43**: Como amigo invitado a la app, quiero vincular mi Garmin **sin que mi contraseña quede guardada en el servidor de nadie**: se usa una sola vez para abrir sesión y se descarta; solo quedan tokens revocables. Ni el dueño del servidor puede verla.
- **HU-44**: Como usuario cuya sesión caduca, quiero un aviso claro ("re-vincula") en vez de syncs que fallan en silencio, y desvincular borrando también los tokens de disco.
- **HU-45**: Como usuario, quiero invitar amigos con un **código corto por WhatsApp** (no buscar nombres exactos) con amistad directa al aceptarlo.

### Módulo 13: Entrenos hacia el Reloj (Fase 9b — experimental)
- **HU-46**: Como usuario, quiero **enviar una rutina de fuerza al reloj Garmin** (`upload_strength_workout`) con mapeo de ejercicios ES→Garmin, viendo antes el JSON exacto (`dry_run`) y qué ejercicios no tienen equivalencia.
- **HU-47**: Como corredor/ciclista, quiero **dibujar una ruta sobre el mapa, guardarla y exportarla a GPX**. Nota honesta: la librería no soporta subida de *courses* a Garmin, así que la importación al reloj es manual (Connect web → Enviar al dispositivo) hasta que la API lo permita. Los *workouts* estructurados (series) sí se suben por API.

---

## 2b. Estado de implementación por HU (2026-09-10, verificado contra código)

✅ hecho · 🟡 parcial · ❌ pendiente

| HU | Estado | Realidad |
|----|--------|----------|
|01|✅|Sync manual + scheduler que persiste vía `run_user_sync()` (07:00 y tardes); backfill ×100 la primera vez|
|02|🟡|Detección manual vía "Sincronizar" (sin webhook Garmin: <15 min solo si coincide con el tramo 18-22h)|
|03|✅|Gráfica ATL/CTL/TSB 30d multidisciplinar|
|04|✅|Registro manual fútbol/RPE + Foster|
|05|✅|Sugerencia adaptativa (fútbol 48h + readiness) + intensidad manual|
|06|✅|Logger con pesos/reps, un clic|
|07|✅|Semáforo + anillo 0-100|
|08|❌|Sin calendario (T-58..T-60)|
|09|✅|Cuentas separadas por `user_id`|
|10|✅|Solicitudes + invitaciones por código|
|11|✅|Leaderboard solo agregados|
|12|✅|Mapa Leaflet por actividad|
|13|✅|Perfil sincronizado + desnivel/min/max (pendiente media no)|
|14|✅|Vueltas + zonas + gráficas de streams (FC, ritmo, altitud)|
|15|✅|Lista + filtros servidor (deporte/fechas/texto) + paginación + detalle|
|16|✅|Planificador + guardar + importar GPX + export GPX + guardar-desde-actividad|
|17|✅|Zonas CRUD + recorte inicio/fin en mapa y exports (+UI en Rutas)|
|18|✅|Widgets reales + deltas + sparklines + pasos|
|19|✅|Fases deep/REM/light/awake, eficiencia, horas cama/levantarse|
|20|✅|HRV + estado Garmin + media + alerta caída (rhr_high/hrv_drop)|
|21|✅|Curva intradía + wake + estrés|
|22|✅|Tendencias 8 métricas 30/90 + media 7d + CSV|
|23|🟡|VO2max + predicciones Garmin + cadencia visible; sin desacople ni PRs auto de distancias estándar (PRs simples sí)|
|24|🟡|Zonas FC por periodo; sin potencia/FTP (sin sensor en cuenta)|
|25|❌|Sin natación avanzada (SWOLF/estilos)|
|26|✅|Resumen por deporte + comparativa + mejor esfuerzo|
|27|✅|Logger touch + steppers + timer con aviso; sin tachar series|
|28|✅|Asistente editable inline + intensidad + regenerar + leyenda + desplegables por foco|
|29|✅|Historial + tonelaje + PRs por ejercicio + filtro por ejercicio|
|30|✅|Calendario mes (eventos+actividades+readiness) + recurrentes semanales|
|31|✅|Recurrentes inamovibles → aviso en Asistente (±48h)|
|32|✅|8 reglas en `/alerts` + banner en dashboard|
|33|✅|Export GPX actividad y rutas, CSV tendencias, borrado GDPR (sin TCX)|
|34|✅|Tracks solo propietario (+legacy); social sin coords|
|35|🟡|Manifest + theme-color + icono (sin service worker)|
|36|🟡|Pasos/calorías/intensidad en sync + Tendencias + tarjeta Movimiento; resto no|
|37|✅|VO2max + estado + balance + predicciones ("Garmin dice"). Nota honesta: la sugerencia diaria de entreno no la expone Garmin por API de forma fiable|
|38-42|❌|Sin peso, SpO2, nutrición, dispositivos, objetivos|
|43-45|✅|Passwordless + re-auth + invitaciones|
|46|🟡|Push con dry_run (envío real sin validar en vivo)|
|47|✅|Planificador + export (subida courses imposible por librería)|

---

## 3. Especificación de Métricas Matemáticas

### A. Lyfta de Entrenamiento (Training Load / TSS)
- **Deportes Garmin (Bici, Carrera, Natación)**:
  $$TSS = \frac{t \times NGP \times IF}{FTP \times 3600} \times 100$$
  *(En ausencia de potenciómetro, se usará el EPOC / Training Effect oficial extraído de Garmin o TRIMP basado en FC).*

- **Fútbol y Sesiones de Campo (Método Foster)**:
  $$\text{Lyfta (Foster)} = \text{Duración (minutos)} \times \text{RPE (1-10)} \times 1.5$$

- **Gimnasio (Lyfta Neuromuscular)**:
  $$\text{Tonelaje Total} = \sum (\text{Series} \times \text{Repeticiones} \times \text{Peso en kg})$$
  $$\text{Lyfta Estimada (TSS Equivalent)} = \text{Tonelaje} \times \text{Factor de Grupo Muscular (0.015 - 0.03)}$$
  *(Implementación actual: factor fijo 0.02 en `FatigueEngine.calculate_strength_tss`. Evolución Fase 9: factor por foco — Legs 0.03, Push/Pull 0.02, Full 0.025, Core 0.015.)*

### B. Modelo Banister (Impulse-Response)
- **ATL (Acute Training Load / Fatiga)**: Media móvil exponencial ponderada de 7 días.
- **CTL (Chronic Training Load / Forma)**: Media móvil exponencial ponderada de 42 días.
- **TSB (Training Stress Balance / Frescura)**:
  $$TSB = CTL_{ayer} - ATL_{ayer}$$

### C. Readiness (0-100, Verde ≥75 / Amarillo ≥50 / Rojo <50)
$$Readiness = 0.35 \times Sleep + 0.40 \times HRV + 0.25 \times TSB_{norm}$$
- Sleep: `sleep_score` Garmin (fallback 70).
- HRV: `min(100, max(30, overnight/weekly_avg*100))` (fallback 75).
- TSB_norm: `clamp(75 + TSB*1.25, 20, 100)` con TSB en [-40, +20].
- Evolución Fase 8: ponderar RHR elevado (-10 si RHR > media+5) y Body Battery al despertar (<40 resta 5). Mantener retrocompatibilidad de la fórmula y versionarla (`readiness_version=1→2`).

### D. Métricas implementadas (código manda; Fases 7-8)
- **Desnivel**: suma de diffs positivos/negativos con umbral de ruido 2 m (`TrackService.gain_loss`).
- **Ritmo medio**: `duración / distancia`; **NP/IF** solo si hay potencia (pendiente).
- **Zonas FC**: 5 zonas por %FCmax (configurable por usuario, default 220-edad o FCmax Garmin). Tiempo en zona desde streams de FC a 1s.
- **Desacople aeróbico (run)**: `(Pw:Hr primera mitad vs segunda mitad)` — v1 simplificado: ritmo/FC por split.
- **PRs**: mejor tiempo por distancia estándar detectado en splits de 100m/1K o en `distance_meters` de actividades cortas; tabla `personal_records`.
- **Eficiencia de sueño**: `tiempo_dormido / tiempo_en_cama`.

---

## 4. Requisitos No Funcionales
1. **Resiliencia de Conexión**: Si Garmin responde con `RateLimitError` o error 401, el backend debe aplicar exponencial backoff y notificar al usuario solo si se requiere re-login.
2. **Latencia**: El dashboard principal debe cargar en menos de 500 ms usando datos precalculados en la base de datos local.
3. **Responsive Mobile First**: La interfaz del gimnasio para registrar pesas debe ser 100% utilizable en un smartphone con una sola mano.
4. **Mapas (nuevo)**: El visor de mapa debe usar tiles gratuitos (OSM/Carto) sin API key, funcionar offline con última ruta cacheada, y no superar 2 MB de GeoJSON por actividad (simplificación Douglas-Peucker si hace falta).
5. **Privacidad GPS (nuevo)**: Los tracks crudos jamás se exponen en endpoints sociales; solo el propietario o amigo con actividad marcada `visibility='friends'` puede ver el mapa. Zonas de privacidad recortan los primeros/últimos 200m por defecto.
6. **Credenciales Garmin (ley 2026-09-10)**: PROHIBIDO persistir contraseñas de Garmin (ni cifradas). Flujo: `PUT /auth/garmin-credentials` (un solo uso) → tokens en `token_dir` por usuario → `POST /auth/garmin-mfa` si hay 2FA. `DELETE` borra fila + tokens. Estado `needs_reauth` visible en `GET /auth/garmin-status`.
7. **Almacenamiento (nuevo)**: Tracks en disco `data/tracks/{user_id}/{activity_id}.json` + columna `track_path`; simplificación a ≤2000 puntos para mapa/gráfica.
8. **PWA y caché (nuevo, pendiente)**: El frontend debe cachear últimas 24h de métricas en `localStorage` + React Query `staleTime 5min` para cumplir los 500ms.

---

## 5. Criterios de Aceptación por Fase (nuevo, vinculante)

### Fase 7 (Mapas y actividades) — implementado 2026-09-10 (ver TASKS T-79..T-83)
- [x] `GET /activities/{id}` con enriquecido lazy (polyline, vueltas, zonas FC, meteo) y `GET /activities/{id}/track` con puntos simplificados (≤2000). Sin descarga GPX: se usa `geoPolylineDTO` (más barato y suficiente).
- [x] La vista detalle muestra mapa + perfil de elevación sincronizados, vueltas y zonas.
- [x] `GET /social/leaderboard` sigue sin exponer ni una coordenada (test 2026-09-10: único "lat" es "calcuLATe").
- [x] Test `test_tracks.py` verifica simplificación, desnivel, zonas, meteo y cocción del track.
- [ ] Pendiente de Fase 7: `GET /privacy-zones` (HU-17), importación de GPX propio (HU-16 parcial), filtros por fecha + paginación en lista (HU-15 parcial), gráficas de streams FC/ritmo (HU-14 parcial).

### Fase 8 (Biometría + rendimiento)
- [ ] Widgets del dashboard muestran valores reales y `GET /metrics/daily` devuelve el día pedido con fases de sueño.
- [ ] `GET /metrics/trends?metric=hrv&days=30` devuelve serie sin huecos inventados (null donde no hay dato).
- [ ] `GET /performance/summary?sport=running&days=30` y `GET /performance/prs` funcionan con datos sincronizados reales.
- [ ] Tests `test_sleep_analysis.py`, `test_performance.py` en verde.

### Fase 9 (Gym UI)
- [ ] Flujo completo móvil: sugerir → editar → guardar → ver en historial y en ATL del día siguiente.
- [ ] Factor TSS por foco aplicado y versionado.

### Fase 10 (Calendario)
- [ ] Crear recurrente martes/domingo; el `suggest` evita pierna pesada 48h alrededor; el calendario pinta Readiness+eventos.

### Fase 11 (Datos y pulido)
- [ ] Export GPX/CSV funciona; borrado GDPR elimina tracks + filas; Lighthouse PWA ≥80; `GET /sync/status` existe y es veraz.

---

## 6. Auditoría 2026-09-10 — Deuda crítica, fallos probables y fuentes Garmin sin explotar

### 6.1 Bugs auditados (estado a 2026-09-10)
Corregidos: n.º 1 (sync `async def`, sin `asyncio.run`), 3 (sirve `frontend/dist` + `/healthz` + SPA fallback), 5 (dedup global por ID Garmin único), 6 (`model_dump` + `datetime.combine`), 7 (date→datetime), 8 (`timedelta(days=2)`), 9 (CORS explícito), 10 (`api.ts` re-exporta, `VITE_API_URL`), 11 (baseURL por env + export GPX por axios), 13 (leaderboard en paralelo con sesión propia), 15 (`.dockerignore` + volumen `./data`; queda: `version:'3.8'` obsoleto, sin healthcheck, `COPY` sin afinar).
Abiertos: n.º 2 (scheduler no persiste — HU-01 automático roto hasta T-38), 4 (`.env` sin validación de arranque), 12 (sin backfill 90d — CTL a cero 6 semanas en cuentas nuevas), 14 (sin FK/cascadas/índices).

Detalle original de cada punto (conservado para trazabilidad):
1. **`backend/app/api/v1/sync.py:55` — `def` + `asyncio.run()` dentro de FastAPI async.** Con 2 syncs concurrentes o scheduler corriendo a la vez, `asyncio.run()` lanza `RuntimeError: asyncio.run() cannot be called from a running event loop` o deadlockea el loop. Fix: `async def sync_garmin_data` + `await` directo (T-37).
2. **Scheduler no persiste (`scheduler.py:37-42`).** Solo hace `get_daily_biometrics()` y `logger.info`. El dashboard nunca se actualiza solo; el usuario cree que la ingesta funciona pero la BD queda vacía. Fix: reutilizar `run_user_sync()` (T-38).
3. **`main.py:54-68` sirve el frontend equivocado.** Monta `frontend/` y devuelve `frontend/index.html` (fuente Vite sin compilar) en vez de `frontend/dist/index.html` + `/assets`. En prod/Docker la raíz sale en blanco. Fix: servir `frontend/dist` con `StaticFiles` + fallback SPA (T-62).
4. **No existe `.env` (solo `.env.example`).** Primer arranque usa `SECRET_KEY=dev-secret-change-me` + Garmin vacío → sync 500 confuso. Falta validación de arranque que avise.
5. **Dedup de actividades ignora `user_id` (`sync.py:106-110`).** `where(Activity.id == garmin_id)` sin usuario. Hoy no colisiona (IDs Garmin globales), pero impide re-sincronizar el mismo Garmin ID en 2 cuentas de prueba y rompe el backfill. Fix: `where(id==x, user_id==u)`.
6. **`strength.py:109,134` — `item.dict()` (deprecado Pydantic v2) + `start_time=workout_date` (date en columna DateTime).** En SQLite cuela; en Postgres `TIMESTAMPTZ` revienta. Fix: `model_dump()` + `datetime.combine(workout_date, time(18,0))`.
7. **Comparaciones fecha vs DateTime (`metrics.py:70`, `strength.py:74`).** `start_time >= date` funciona en SQLite, en Postgres da `operator does not exist: timestamptz >= date`. Fix: convertir a `datetime` inicio del día.
8. **`strength.py:70` — `today - date.resolution * 2`.** Funciona por accidente (`resolution=1 día`). Ilegible y frágil. Fix: `timedelta(days=2)`.
9. **CORS imposible (`main.py:26-32`).** `allow_origins=["*"]` + `allow_credentials=True` lo rechazan los navegadores. Fix: lista explícita `http://localhost:5173,http://localhost:8000` o `allow_credentials=False`.
10. **Doble cliente Axios (`services/api.ts` sin interceptor + `services/auth.ts` con).** `api.ts` muerto confunde; si alguien lo importa, las llamadas van sin Bearer → 401 fantasma. Fix: eliminar `api.ts`, unificar en `auth.ts` con `baseURL` por env `VITE_API_URL`.
11. **`baseURL` hardcodeado `localhost:8000`.** En Docker/móvil/PWA falla. Fix: `import.meta.env.VITE_API_URL ?? ''` + proxy Vite.
12. **Falta paginación real en primera sync.** `get_activities(limit=20)` solo trae 20 recientes; un usuario nuevo pierde años de historial y el CTL42d sale a cero durante 6 semanas. Fix: backfill `limit=200` + `get_activities_by_date` 90d la primera vez (flag `backfilled_at` en `GarminCredential`).
13. **Leaderboard N+1 (`social.py:86`).** 1 query de amigos + 3 queries por atleta en serie. Con 10 amigos = 31 queries. Fix: agregación SQL única (`GROUP BY user_id`) o `asyncio.gather`.
14. **Sin FK/índices/cascadas.** `models.py` no declara `ForeignKey` ni `relationship`; borrar cuenta (GDPR) deja huérfanos tracks+filas. Añadir FK + `ondelete=CASCADE` + índices del PLAN §8.
15. **Dockerfile copia `venv/`, `*.db`, `node_modules/`, `garmin_tokens/`.** Contexto gigante + fuga de secretos. Falta `.dockerignore`. Además `version: '3.8'` obsoleto y sin `healthcheck` ni volumen `./data`.

### 6.2 Seguridad y privacidad (revisado 2026-09-10)
- **Passwordless (implementado, sustituye al cifrado HMAC-CTR)**: ya no se guarda ninguna contraseña de Garmin, luego no hay nada que rotar ni perder al cambiar `SECRET_KEY`. La columna `garmin_password_encrypted` queda en desuso (siempre NULL).
- Token de app 30 días sin refresh ni blacklist: robo de `localStorage` = 30 días de acceso. Añadir `POST /auth/logout` (blacklist en memoria/BD) + TTL 7d + `refresh_token` en Fase 11 (T-71, abierto).
- Enumeración de usuarios: `register` 409 vs `login` 401 permite saber qué emails existen. Aceptado para app privada; documentado (abierto, riesgo bajo).
- `GET /metrics/*` en modo sin token devuelve datos legacy `user_id IS NULL` a cualquiera. Riesgo bajo hoy (sin filas legacy reales); pendiente `PRIVATE_MODE=true` (T-71, abierto).

### 6.3 Fuentes Garmin (estado a 2026-09-10: ✅ usado, 🟡 parcial, ❌ pendiente)
| Fuente (método `garminconnect`) | Estado hoy | Qué perdemos | Acción spec |
|---|---|---|---|
| `get_stats`, `get_stats_and_body`, `get_steps_data`, `get_daily_steps`, `get_weekly_steps`, `get_floors` | ❌ no se llama | pasos, distancia diaria, plantas, calorías → contexto TSS y tendencias | HU-36, T-67 |
| `get_heart_rates`, `get_rhr_day`, `get_rhr_daily` | ❌ solo `user_summary.restingHeartRate` puntual | serie RHR para alerta + readiness v2 | HU-20, T-47 |
| `get_heart_rate_zones`, `get_power_zones`, `get_power_zones_for_sport` | ❌ zonas manuales | zonas reales del usuario, tiempo en zona veraz | HU-24, T-50 |
| `get_body_battery`, `get_body_battery_events` | ❌ solo max/min | curva intradía + eventos de drenaje | HU-21, T-47 |
| `get_stress_data`, `get_all_day_stress`, `get_weekly_stress` | ❌ solo `averageStressLevel` | picos de estrés, correlación con BB | HU-21, T-67 |
| `get_sleep_daily` (+`get_sleep_data`) | ⚠️ parcial | score por tramos, deuda de sueño | HU-19, T-47 |
| `get_training_status`, `get_training_readiness`, `get_morning_training_readiness` | ❌ | readiness oficial Garmin para fusionar/comparar con el nuestro | HU-37, T-67 |
| `get_race_predictions`, `get_lactate_threshold`, `get_cycling_ftp`, `get_functional_threshold_power_range`, `get_endurance_score`, `get_hill_score` | ❌ | FTP/LT/predicciones/VO2 sin estimar a mano | HU-23/24, T-67 |
| `get_personal_record`, `get_max_metrics` | ❌ (PRs manuales) | PRs oficiales Garmin | HU-23, T-49 |
| `get_activity_details`, `get_activity_splits`, `get_activity_hr_in_timezones`, `get_activity_weather` | ✅ lazy enrich + caché (detalle/track) | — | T-79 hecho |
| `get_activity_typed_splits`, `get_activity_split_summaries`, `get_activity_power_in_timezones`, `get_activity_gear`, `get_activity_exercise_sets` | 🟡 power se pide (sin UI), resto no | cadencia/potencia por tramos, material | T-77 |
| `download_activity` (GPX/TCX/FIT) | 🟡 funciona pero sin usar: el polyline basta | GPX original para export fiel | HU-33 parcial |
| `get_weigh_ins`, `get_body_composition` | ❌ | peso/grasa → tendencias + contexto readiness | HU-38, T-67 |
| `get_spo2_data`, `get_respiration_data` | ❌ | SpO2, respiración nocturna (apnea) | HU-39, T-67 |
| `get_calories_daily`, `get_hydration_data`, `get_nutrition_*` | ❌ | calorías/hidratación | HU-40, T-68 |
| `get_intensity_minutes_data`, `get_weekly_intensity_minutes` | ❌ | minutos de intensidad OMS | HU-36, T-67 |
| `get_devices`, `get_primary_training_device`, `get_device_settings` | ❌ | qué reloj sincroniza, debug | HU-41, T-68 |
| `get_workouts`, `get_scheduled_workouts` | ❌ | entrenos planificados Garmin → calendario | HU-31, T-68 |
| `get_goals`, `get_gear`, `get_gear_stats` | ❌ | objetivos + km por zapatilla/bici | HU-42, T-68 |

### 6.4 Funcionalidades extra que faltaban y se añaden (más allá de P0-P3)
- **HU-36**: Panel "Movimiento diario": pasos, pisos, minutos de intensidad, calorías (de `get_stats/steps/intensity/calories`). Vista 30d + objetivo configurable.
- **HU-37**: Fusión Readiness propio vs Garmin: mostrar `nuestro score + training_readiness + morning_readiness + training_status` lado a lado, con explicación cuando discrepen.
- **HU-38**: Peso y composición corporal: importar `weigh_ins`, gráfica de peso + %grasa, correlación con RHR/HRV.
- **HU-39**: SpO2 y respiración nocturna: media + mínimos, flag si SpO2 <90% repetido.
- **HU-40**: Hidratación/nutrición (opcional manual + auto Garmin): solo si el usuario lo usa; no bloquear si vacío.
- **HU-41**: Gestión de dispositivos: lista de relojes, principal, última sync por dispositivo, aviso "tu Forerunner no sincroniza desde hace X".
- **HU-42**: Objetivos y material: objetivos semanales (km/horas/TSS) con barra de progreso + km por zapatilla/bici con alerta de recambio (500/800km).
