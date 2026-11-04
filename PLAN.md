# PLAN.md - Diseño Técnico y Arquitectura de la Solución

## 1. Arquitectura de Componentes

```
+-----------------------------------------------------------------------+
|                                GARMIN CONNECT                         |
|  sleep · hrv · heartRates · bodyBattery · activities · details ·      |
|  splits · hr-zones · weather · polyline · workouts                    |
+-----------------------------------------------------------------------+
                                     | (garminconnect 0.3.x Python API)
                                     v
+-----------------------------------------------------------------------+
|                          FASTAPI BACKEND SYSTEM                       |
|                                                                       |
|  [Ingestion Service] ---> [Fatigue Engine] ---> [Readiness Calculator]|
|          |                        |                       |           |
|  [Session Storage]      [Banister Model]         [LLM Gym Advisor]    |
|   (tokens por usuario,              |              (+ rutinas a reloj)|
|    passwordless)          [Track Service] ✅                          |
|                            (polyline→JSON, splits,                    |
|                             zonas, meteo, desnivel)                   |
|  [Sleep Analysis] ❌  [Performance] ❌  [Calendar] ❌  [Scheduler] 🟡   |
|  (pendiente T-47)     (pendiente T-49) (pendiente T-58) (programa pero|
|                                                         no persiste) |
+-----------------------------------------------------------------------+
             |                                           |
             v                                           v
+-----------------------+                   +---------------------------+
| SQLITE dev / PG prod  |                   | FRONTEND (VITE+REACT 19)  |
|  - daily_biometrics   |                   |  - Dashboard real ✅      |
|  - activities (+track)| <=== REST API ===>|  - Activities + Detail ✅ |
|  - routes ✅          |    JWT Bearer     |    (Leaflet mapa + perfil)|
|  - friend_invites ✅  |                   |  - Routes planner ✅      |
|  - strength_logs      |                   |  - Gym (suggest+log) ✅   |
|  - fatigue_metrics    |                   |  - Social + invites ✅    |
|  - users/friendships/ |                   |                           |
|    garmin_credentials |                   |  State: axios + hooks     |
|  + disco data/tracks/ |                   |  Maps: Leaflet + Carto    |
|    data/routes/ (.json)|                   |  Charts: Recharts         |
+-----------------------+                   +---------------------------+
```

**Decisiones de arquitectura (revisado 2026-09-10):**
1. **Tracks fuera de la BD relacional (implementado).** El track vive en disco `data/tracks/{user_id}/{activity_id}.json` (puntos simplificados + streams + vueltas). En BD solo metadatos + `track_path` + bbox + resumen. No se usa GPX: el `geoPolylineDTO` de Garmin es más barato y suficiente.
2. **Enriquecido lazy (implementado).** El sync guarda lo básico; al abrir el detalle se descargan polyline/vueltas/zonas/meteo con try/except por fuente y se cachean. Así un fallo de Garmin nunca rompe el sync.
3. **Cálculos bajo demanda + precalculados.** Banister/Readiness se precalculan en sync (tablas `fatigue_metrics` + `daily_biometrics.readiness_score`). El scheduler aún NO persiste (T-38 abierto).
4. **Compatibilidad legacy.** Endpoints con token filtran `user_id == me OR user_id IS NULL`.
5. **Deuda que sigue abierta:** scheduler sin persistencia (PLAN §5.5), backfill 90d, N+1 leaderboard, FK/cascadas, `GET /metrics/readiness` sin versionar, `POST /sync/garmin` sin `include_tracks` (innecesario con lazy).

---

## 2. Esquema de Base de Datos (PostgreSQL / Supabase, compatible SQLite dev)

> Tipos: en Postgres usar `JSONB/TIMESTAMPTZ/UUID`; en SQLite dev el `init_db()` los mapea a `JSON/DATETIME/STRING(36)`. Las migraciones son idempotentes `ALTER TABLE ADD COLUMN IF NOT EXISTS` (ver `db/session.py::_run_sqlite_migrations`).

### Tablas existentes (se amplían, no se rompen)

#### `auth_tokens` (sin cambios)
```sql
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL UNIQUE,
    token_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `daily_biometrics` (+ fases y versiones)
```sql
CREATE TABLE daily_biometrics (
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    sleep_seconds INT,
    sleep_score INT,
    time_in_bed_seconds INT,          -- NUEVO Fase 8 (para eficiencia)
    sleep_efficiency FLOAT,           -- NUEVO 0-100
    bedtime_local TIMESTAMPTZ,        -- NUEVO
    wakeup_local TIMESTAMPTZ,         -- NUEVO
    hrv_weekly_avg FLOAT,
    hrv_overnight_avg FLOAT,
    resting_hr INT,
    resting_hr_7d_avg FLOAT,          -- NUEVO (alerta RHR elevado)
    body_battery_max INT,
    body_battery_min INT,
    body_battery_wake INT,            -- NUEVO (valor al despertar)
    stress_avg INT,
    readiness_score INT,
    readiness_version INT DEFAULT 1,  -- NUEVO (1=legacy, 2=+RHR/BB)
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);
CREATE INDEX idx_bio_user_date ON daily_biometrics(user_id, date DESC);
```

#### `activities` (+ GPS / rendimiento / visibilidad)
```sql
CREATE TABLE activities (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(36),
    source VARCHAR(20) NOT NULL DEFAULT 'garmin', -- 'garmin','manual'
    activity_type VARCHAR(50) NOT NULL,  -- 'running','cycling','swimming','soccer','strength','walking','hiking','unknown'
    activity_name VARCHAR(150),
    start_time TIMESTAMPTZ NOT NULL,
    duration_seconds INT NOT NULL,
    moving_seconds INT,                  -- NUEVO (vs pausas)
    distance_meters FLOAT DEFAULT 0,
    elevation_gain_m FLOAT,              -- NUEVO Fase 7
    elevation_loss_m FLOAT,              -- NUEVO
    avg_hr INT, max_hr INT,
    avg_cadence INT,                     -- NUEVO (spm o rpm)
    avg_power INT,                       -- NUEVO (W, null sin potenciómetro)
    normalized_power INT,                -- NUEVO
    avg_pace_sec_km FLOAT,               -- NUEVO (run/swim)
    avg_speed_kmh FLOAT,                 -- NUEVO (bike)
    calories FLOAT,
    rpe INT,
    training_load_tss FLOAT NOT NULL DEFAULT 0,
    garmin_epoc FLOAT,
    garmin_training_effect FLOAT,        -- NUEVO (aeróbico 0-5)
    garmin_training_effect_label VARCHAR(30),
    vo2max_estimate FLOAT,               -- NUEVO (copia del valor Garmin si viene)
    has_track BOOLEAN DEFAULT FALSE,     -- NUEVO
    track_path TEXT,                     -- NUEVO 'data/tracks/{user}/{id}.geojson'
    bbox_min_lat FLOAT, bbox_min_lon FLOAT, -- NUEVO (para encuadrar mapa sin leer fichero)
    bbox_max_lat FLOAT, bbox_max_lon FLOAT,
    visibility VARCHAR(20) DEFAULT 'private', -- 'private'|'friends' (nunca 'public' en MVP)
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_act_user_start ON activities(user_id, start_time DESC);
CREATE INDEX idx_act_user_type ON activities(user_id, activity_type);
```

### Tablas Fase 7 — diseño original vs implementado (2026-09-10)

> Decisión implementada: **no** se crearon `activity_tracks` ni `activity_streams` como tablas. El resumen vive en columnas de `activities` (existentes en `models.py` + migración idempotente) y el detalle en el JSON de disco. Motivo: una tabla por actividad complicaba sin aportar (un track = un fichero). El DDL original se conserva abajo como referencia histórica.

Columnas reales en `activities`: `elevation_gain_m/loss_m, avg_cadence, avg_power, avg_speed_kmh, calories, has_track, track_path (.json), bbox_*×4, hr_zones JSON, weather JSON, detail_fetched_at, visibility`. Tabla `routes` real: `id, user_id, name, sport, distance_meters, gain_m, point_count, file_path, use_count, created_at` (sin `source_activity_id`).
Formato `data/tracks/{user}/{id}.json`: `{points:{lat,lon,ele,t,speed,hr}, laps:[...], point_count, simplified_count, distance_m, gain_m, loss_m, bbox}`.

#### `activity_tracks` (DISEÑO NO IMPLEMENTADO — referencia)
```sql
CREATE TABLE activity_tracks (
    activity_id VARCHAR(100) PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    point_count INT NOT NULL,            -- nº puntos originales
    simplified_count INT NOT NULL,       -- tras Douglas-Peucker
    distance_meters FLOAT,
    gain_m FLOAT, loss_m FLOAT,
    min_alt FLOAT, max_alt FLOAT,
    start_lat FLOAT, start_lon FLOAT,
    end_lat FLOAT, end_lon FLOAT,
    privacy_cropped BOOLEAN DEFAULT FALSE, -- true si se recortó zona privada
    file_path TEXT NOT NULL,             -- duplicado de activities.track_path por join rápido
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
#### `activity_streams` (DISEÑO NO IMPLEMENTADO — los streams van en el JSON de disco)

```sql
CREATE TABLE activity_streams (
    activity_id VARCHAR(100) PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    sample_count INT NOT NULL,
    -- arrays paralelos (mismo índice = mismo instante). En SQLite se guardan como JSON TEXT.
    seconds INT[],            -- segundos desde inicio
    distance_m FLOAT[],
    altitude_m FLOAT[],
    hr INT[],
    cadence INT[],
    power INT[],
    speed_ms FLOAT[],
    lat FLOAT[],              -- solo si se quiere dibujar sin leer fichero (opcional, null si >2000)
    lon FLOAT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Nota: si el driver no soporta arrays (SQLite), usar JSONB con {"seconds":[...],...}.
```

#### `routes` (IMPLEMENTADA — ver `models.py`; sin `source_activity_id` ni índice dedicado)
```sql
CREATE TABLE routes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sport VARCHAR(20) NOT NULL, -- 'running'|'cycling'|'hiking'
    source_activity_id VARCHAR(100) NULL REFERENCES activities(id) ON DELETE SET NULL,
    distance_meters FLOAT, gain_m FLOAT,
    file_path TEXT NOT NULL,
    use_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_routes_user ON routes(user_id);
```

#### `privacy_zones` (DISEÑADA, NO IMPLEMENTADA — HU-17 pendiente)
```sql
CREATE TABLE privacy_zones (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    label VARCHAR(100) NOT NULL, -- 'Casa','Trabajo'
    center_lat FLOAT NOT NULL, center_lon FLOAT NOT NULL,
    radius_m INT NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tablas Fase 8/10 (DISEÑADAS, NO IMPLEMENTADAS — T-46, T-58 pendientes)

#### `sleep_phases` (detalle por noche, de `get_sleep_data().sleepLevels`)
```sql
CREATE TABLE sleep_phases (
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL, -- noche asignada al día que despierta
    deep_seconds INT, light_seconds INT, rem_seconds INT, awake_seconds INT,
    bedtime_local TIMESTAMPTZ, wakeup_local TIMESTAMPTZ,
    score_overall INT, score_quality INT, score_recovery INT,
    raw_data JSONB,
    PRIMARY KEY (user_id, date)
);
```

#### `hrv_samples` (serie diaria + baseline; v2: intradía si Garmin lo da)
```sql
CREATE TABLE hrv_samples (
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    overnight_avg FLOAT, weekly_avg FLOAT,
    rmssd FLOAT NULL, status VARCHAR(20), -- 'low'|'normal'|'high'
    raw_data JSONB,
    PRIMARY KEY (user_id, date)
);
```

#### `performance_metrics` (agregado diario/por actividad para no recalcular)
```sql
CREATE TABLE performance_metrics (
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    sport VARCHAR(20) NOT NULL, -- 'running'|'cycling'|'swimming'|'all'
    sessions INT DEFAULT 0, seconds INT DEFAULT 0, distance_m FLOAT DEFAULT 0,
    gain_m FLOAT DEFAULT 0, tss FLOAT DEFAULT 0,
    time_z1_s INT DEFAULT 0, time_z2_s INT DEFAULT 0, time_z3_s INT DEFAULT 0,
    time_z4_s INT DEFAULT 0, time_z5_s INT DEFAULT 0,
    best_pace_sec_km FLOAT NULL, best_power INT NULL,
    PRIMARY KEY (user_id, date, sport)
);
```

#### `personal_records`
```sql
CREATE TABLE personal_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    sport VARCHAR(20) NOT NULL,
    distance_label VARCHAR(20) NOT NULL, -- '1K','5K','10K','HM','MAR','20minFTP','5minPower'
    value_seconds INT NULL, value_watts INT NULL, value_pace_sec_km FLOAT NULL,
    activity_id VARCHAR(100) NULL REFERENCES activities(id) ON DELETE SET NULL,
    achieved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, sport, distance_label)
);
```

### Tablas Fase 10 — ver nota anterior (NO IMPLEMENTADAS)

#### `calendar_events`
```sql
CREATE TABLE calendar_events (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    event_type VARCHAR(30) NOT NULL, -- 'soccer','planned_workout','race','rest','strength'
    start_local TIMESTAMPTZ NOT NULL,
    duration_min INT NOT NULL DEFAULT 60,
    rrule VARCHAR(100) NULL, -- 'WEEKLY:TU' / 'WEEKLY:SU' (subset iCal RRULE, solo WEEKLY 1x/semana en v1)
    is_immovable BOOLEAN DEFAULT FALSE, -- true = el GymAdvisor lo respeta
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cal_user_start ON calendar_events(user_id, start_local);
```

### Tablas existentes (sin cambio de forma, solo índice)
`strength_logs`, `fatigue_metrics (user_id, date PK)`, `users`, `friendships`, `garmin_credentials` — ver `db/models.py`.

---

## 3. Especificación de Endpoints API (FastAPI, prefijo `/api/v1`)

Convenciones: `Authorization: Bearer <token>` (modo legacy sin token solo para datos `user_id IS NULL`). Errores: `401` sin token en rutas `require_current_user`, `403` track ajeno sin permiso, `404` actividad/track inexistente, `429` Garmin rate-limit con `Retry-After`.

### Ingesta y sincronización
- `POST /sync/garmin?target_date=` ✅ async nativo. Descarga biometría + actividades (sin tracks: enrich lazy). Resp real: `{status, message, biometrics, activities_inserted, readiness, fatigue_today}`.
- `GET /sync/status` ✅ implementado. Resp real: `{linked, garmin_email, needs_reauth, last_sync_at, activities_7d, tss_7d, scheduler_running}` (sin `tracks_pending` ni `garmin_reachable`).
- `GET /metrics/daily?target_date=` ✅ implementado (sin fases de sueño ni `body_battery.wake`).
- `GET /metrics/trends?metric=...&days=` ✅ (métricas: sleep_score|sleep_hours|hrv|resting_hr|body_battery|readiness|stress; sin media móvil ni export).
- `GET /metrics/readiness` ✅ existe pero sin `readiness_version` (pendiente).
- `GET /metrics/load` ✅ existe pero sin `tss` por día ni `?by_sport` (pendiente).

### Actividades + tracks (implementado 2026-09-10, difiere del diseño en lo indicado)
- `GET /activities/?limit=` ✅ lista con `distance_m, avg_hr, max_hr, gain_m, has_track` (sin filtros `sport/from/to/q`, sin `offset`, sin `X-Total-Count`).
- `POST /activities/manual` ✅ (sin `visibility` ni `calendar_event_id`).
- `GET /activities/{id}` ✅ detalle + vueltas + zonas + meteo + bbox + min/max alt (sin `splits_url/track_url/streams_url`).
- `GET /activities/{id}/track` ✅ `{points:{lat,lon,ele,t,speed,hr}, distance_m, gain/loss, bbox}` (NO GeoJSON, sin `simplify/crop_privacy`, sin ETag; `?max_points=` sí).
- `POST /activities/{id}/refresh` ✅ (no estaban `streams`, `splits` ni `export` como endpoints separados).
- Rutas ✅: `GET/POST /routes/`, `GET /routes/{id}`, `GET /routes/{id}/export` (GPX), `DELETE`, `POST /routes/from-activity/{id}` (sin upload GPX multipart, sin `save-as-route` con ese nombre).
- `privacy-zones` ❌ (sin CRUD, sin recorte).
- Permisos tracks: solo propietario (+legacy). Compartir con amigos (`visibility='friends'`) pendiente.

### Sueño / HRV / rendimiento (❌ pendiente T-46..T-53, nada implementado)
- `GET /sleep/summary`, `GET /performance/*`, `PUT /settings/zones` — no existen.

### Gimnasio (✅ implementado + extras; pendiente calendario y PRs)
- `GET /strength/suggest?focus=&intensity=` ✅ (`auto|suave|intenso`; sin `?date`, sin contexto calendario, sin `contraindicated`).
- `POST /strength/log`, `GET /strength/history` ✅ (sin filtro `?exercise`, sin PRs).
- `GET /strength/exercises/prs` ❌.
- `POST /strength/push-to-garmin` ✅ experimental con `dry_run` (no estaba en el diseño original).

### Calendario (❌ pendiente T-58..T-61, nada implementado)

### Social (sin cambios salvo privacidad GPS)
- `GET /social/leaderboard`, `GET /social/friends/{id}/summary` — existentes. **Prohibido** añadir coordenadas, mapas o distancias por sesión individual; solo agregados. Si se quiere "retar" en una ruta, se comparte `route_id` (trazado genérico), nunca el track con timestamps.

---

## 4. Algoritmo del Motor Adaptativo de Fuerza (LLM Prompt Pipeline)

### Estructura del Prompt Inyectado al Modelo:
```json
{
  "user_context": {
    "date": "2026-08-20",
    "readiness_score": 62,
    "hrv_status": "Ligeramente bajo (48 ms vs 55 ms media)",
    "sleep_score": 70,
    "body_battery_wake": 58,
    "fatigue_balance_tsb": -12.4,
    "recent_events": [
      {"date": "2026-08-19", "type": "soccer", "duration_min": 90, "rpe": 8}
    ],
    "upcoming_events": [
      {"date": "2026-08-22", "type": "soccer", "planned": true}
    ]
  },
  "instruction": "Genera una rutina de fuerza adaptada para hoy. Dado que ayer hubo partido de fútbol intenso y el HRV muestra fatiga moderada, EVITA sentadillas pesadas o volumen alto de pierna. Prioriza tren superior (Empuje/Tracción) e incluye solo 1 ejercicio de prevención de isquiotibiales/glúteos sin carga pesada. Devuelve la respuesta EXCLUSIVAMENTE en JSON estructurado."
}
```

### Evolución Fase 10 (calendario inamovible)
Al prompt se añade `upcoming_immovable_48h: true/false + tipo`. Regla dura (también aplicada en fallback local sin LLM): si hay partido inamovible en ±48h → `target_focus` se fuerza a tren superior y `contraindicated` incluye `squat_heavy, deadlift_heavy, sprint_leg`. El frontend muestra el motivo ("Partido martes 20:00 → piernas en descarga").

---

## 5. Servicios Backend Nuevos / Modificados (detalle de implementación)

### 5.1 `GarminService` (implementado: `get_activity_full()` con try/except por fuente; pendiente sueño/HRV/BB intradía, training status, peso, planificados — T-67)
- Backoff: el de la propia librería (retry 3×). `GET /sync/status` NO expone `garmin_reachable` (pendiente).

### 5.2 `TrackService` (IMPLEMENTADO `services/track_service.py`, sin dependencias nuevas)
Responsabilidades reales: `extract_streams()` (polyline + metricDescriptors), `douglas_peucker()`, `gain_loss()` (umbral 2 m), `build_track()`, `save/load_track()` (.json), `normalize_laps/hr_zones/weather()`.
- Sin `gpxpy`/`shapely`/`tenacity`/`python-multipart`: no hicieron falta (stdlib + haversine propio). NO añadir a `requirements.txt`.
- Límite: simplifica a ≤2000 puntos; sin límite de tamaño (tracks reales ~50-150 KB).
- Formato fichero: `{points:{lat,lon,ele,t,speed,hr}, laps:[...], point_count, simplified_count, distance_m, gain_m, loss_m, bbox}`.
- NO implementado: `parse_gpx_to_geojson`, `smooth_altitude` (Savitzky), `compute_splits` por km (se usan las vueltas de Garmin), `apply_privacy_zones`, `downsample_streams` separado.

### 5.3 `SleepAnalysisService` + `PerformanceEngine` (NUEVOS)
- Sleep: eficiencia, medias 7/30d, flag `low_sleep (<6h)` y `hrv_drop (>15%)` para avisos Fase 10.
- Performance: zonas FC/potencia, `summary` por deporte/periodo, detección de PRs al insertar actividad (compara `personal_records` y actualiza si mejora), desacople simple por splits.

### 5.4 `CalendarService` (NUEVO)
Expande `rrule WEEKLY:XX` a ocurrencias; `get_day_context(date)` devuelve `{has_match_48h_before, has_immovable_48h_after}` para el `GymAdvisor` y avisos.

### 5.5 Scheduler (corregir + ampliar `scheduler/scheduler.py`)
- **Fix P0:** el job actual solo loguea. Debe reutilizar la misma función `run_user_sync(user_id, include_tracks)` que `POST /sync/garmin` (extraer a `services/sync_service.py` compartido) y persistir biometría+actividades+fatiga.
- Jobs: `morning_sync 07:00` (biometría + tracks noche), `evening_sync 18-22 */15` (actividades + tracks, `track_limit=5` para no saturar), `nightly_rollup 23:30` (recalcula `performance_metrics` + PRs + `readiness_version` del día).
- Concurrencia: un `Semaphore(2)` para no disparar rate-limit con muchos usuarios; jitter aleatorio 0-60s por usuario.

---

## 6. Frontend (Vite + React + TS — implementado salvo lo marcado ❌)

### 6.1 Mapa (implementado en `src/components/ActivityDetail.tsx`, no en ficheros separados)
- `leaflet + react-leaflet` ✅, tiles Carto oscuro. Polyline del JSON propio, inicio/fin, `fitBounds(bbox)`.
- Perfil de elevación Recharts con hover→marcador en mapa ✅ (al revés —clic en mapa→perfil— no).
- Detalle con tabs Resumen(no existe "Gráficas" de streams) | Vueltas | Zonas; sin export de actividad.
- Lista con filtros por deporte + buscador ✅ (sin fechas ni paginación).
- Navegación: tabs `Panel | Actividades | Rutas | Gimnasio | Social` ✅ (sin Calendario ni Rendimiento).

### 6.2 Dashboard real ✅ (`src/pages/Dashboard.tsx`)
- Cards cableadas a `/metrics/daily` + sparklines de `/metrics/trends`. Sin React Query (axios + hooks) ni caché localStorage.
- Pendiente: `SleepPanel`, `HrvPanel`, `BatteryChart`, `TrendsPage`, export CSV.

### 6.3 Gym ✅ (`src/pages/Gym.tsx`) + Rutas ✅ (`src/pages/Routes.tsx`)
- Logger con steppers, sugerencia editable inline, historial. Sin rest-timer.
- Planner OSRM + CRUD + export GPX. Calendario ❌.

### 6.4 Deps frontend reales
`leaflet, react-leaflet, @types/leaflet` ✅ instalados; `@tanstack/react-query` ❌ no instalado (pendiente); CSS leaflet en `main.tsx` ✅. Tailwind v4 (`@import "tailwindcss"` + `@theme`).

---

## 7. Almacenamiento de ficheros y Docker
- Volumen `./data:/app/data` ✅ en `docker-compose.yml`. `TRACKS_DIR` en `config.py` (raíz `data/` local, `/app/data` en Docker).
- `requirements.txt`: sin cambios necesarios (sin gpxpy/shapely/tenacity/multipart). `Dockerfile` sin `libgeos` (innecesario).
- Pendiente: `ENV TRACKS_DIR` explícito en Dockerfile, healthcheck en compose (quitar `version:'3.8'` obsoleto).

## 8. Migraciones, índices y seguridad (estado real)
- Migración idempotente al arrancar ✅ (`init_db()` + `_run_sqlite_migrations`): crea tablas y añade columnas nuevas en SQLite y Postgres.
- Índices: solo los implícitos (`index=True` en `user_id` de activities, emails/usernames) + PKs. Sin compuestos ni FK/cascadas (T-12/D12 abierto).
- Seguridad real: tracks solo propietario (+legacy); social sin coords verificado; `privacy_zones` y borrado GDPR pendientes (`DELETE /auth/account` no existe).

## 9. Matriz de trazabilidad (estado 2026-09-10)
| HU | Endpoint real | Tabla real | UI real |
|----|----------|-------|----|
|12-15 mapas | `GET /activities/{id}, /track, /refresh` | `activities` + JSON disco | `Activities + ActivityDetail` ✅ |
|16 rutas | `GET/POST /routes/, GET+export+DELETE /routes/{id}, POST /routes/from-activity/{id}` | `routes` | `Routes` planner ✅ (sin importar GPX) |
|17 privacidad | — | (columna `visibility` sin uso) | ❌ |
|18-22 sueño/HRV | `GET /metrics/daily, /trends` | `daily_biometrics` | Dashboard ✅ (sin fases/intradía/TrendsPage) |
|23-26 rendimiento | — | — | ❌ |
|27-29 gym | `/strength/suggest|log|history|push-to-garmin` | `strength_logs` | `Gym` ✅ (sin rest-timer ni PRs) |
|30-32 calendario | — | — | ❌ |
|33 export/priv | `GET /routes/{id}/export` | — | 🟡 (solo rutas) |
|43-45 passwordless/invites | `/auth/garmin-credentials|garmin-mfa|garmin-status`, `/friends/invite|accept-invite` | `garmin_credentials, friend_invites` | ✅ |

---

## 10. Ingesta ampliada — qué llamar de `garminconnect` y dónde guardarlo (auditoría 2026-09-10)

> Métodos en uso (2026-09-10): `get_sleep_data, get_hrv_data, get_user_summary, get_activities` (base) + `get_activity_details/splits/hr_in_timezones/power_in_timezones/weather` (lazy enrich). Resto pendiente en T-67. Orden de ingesta futura en `run_user_sync()` (nuevo `services/sync_service.py` compartido sync manual + scheduler):

```
1. biometría base (ya): get_sleep_data → sleep_phases+daily_biometrics
                        get_hrv_data → hrv_samples
                        get_user_summary → RHR/BB/estrés
2. diario movimiento (NUEVO T-67): get_stats + get_steps_data + get_floors +
                        get_calories_daily + get_intensity_minutes_data → daily_stats
3. cardíaco/estrés (NUEVO): get_heart_rates (serie día) + get_rhr_day +
                        get_stress_data/get_all_day_stress + get_body_battery (curva) +
                        get_respiration_data + get_spo2_data → daily_stats/hrv_samples
4. estado Garmin (NUEVO): get_training_status + get_training_readiness +
                        get_morning_training_readiness + get_race_predictions +
                        get_lactate_threshold + get_cycling_ftp + get_endurance_score +
                        get_hill_score → training_status_snapshot (JSON en daily_biometrics.raw_data)
5. zonas (1x/semana): get_heart_rate_zones + get_power_zones_for_sport → users.settings
6. peso (NUEVO): get_weigh_ins + get_body_composition → weight_logs
7. actividades lista: get_activities_by_date(90d backfill 1ª vez, si no limit=20) →
                        activities (con dedup por (id,user_id))
8. detalle+track por actividad con GPS (NUEVO, con try/except aislado c/u):
   get_activity_details + get_activity_splits/typed_splits + hr/power_in_timezones +
   get_activity_weather + download_activity(GPX) → TrackService → tracks+streams
9. planificados (NUEVO): get_scheduled_workouts → calendar_events (source='garmin')
```

### Tablas extra auditoría (añadir a §2)
```sql
CREATE TABLE daily_stats ( -- movimiento diario no-fisiológico
    user_id VARCHAR(36) NOT NULL, date DATE NOT NULL,
    steps INT, floors INT, distance_m FLOAT, calories INT,
    intensity_minutes INT, avg_stress INT, min_spo2 FLOAT, avg_respiration FLOAT,
    weight_kg FLOAT NULL, body_fat_pct FLOAT NULL,
    raw_data JSONB, PRIMARY KEY (user_id, date));
CREATE TABLE weight_logs (
    id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL, weight_kg FLOAT NOT NULL,
    body_fat_pct FLOAT NULL, muscle_kg FLOAT NULL, source VARCHAR(20) DEFAULT 'garmin');
CREATE TABLE device_info (
    user_id VARCHAR(36) NOT NULL, device_id VARCHAR(100) NOT NULL,
    name VARCHAR(150), is_primary BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ, raw_data JSONB, PRIMARY KEY (user_id, device_id));
```

### Endpoints extra auditoría
- `GET /stats/daily?from&to` (pasos/pisos/calorías/intensidad), `GET /training-status` (snapshot Garmin + nuestro TSB lado a lado), `GET /weight/trend?days=90`, `GET /devices`, `GET /goals` (objetivos semanales configurables en `users.settings`), `GET /gear` (km por material desde `get_gear_stats`).

### Vinculación passwordless (implementado 2026-09-10, HU-43/44)
- `PUT /auth/garmin-credentials {garmin_email, garmin_password}` → login de UN solo uso (`Garmin(..., return_on_mfa=True)`); guarda fila (email + `needs_reauth=false`, password NULL) y tokens en `garmin_tokens_{user_id}/`. Si hay 2FA responde `{status:"need_mfa", ticket}`.
- `POST /auth/garmin-mfa {garmin_email, garmin_password, ticket, code}` → `resume_login` + volcado best-effort + verificación por restore limpio. La contraseña se blanquea en el scope y jamás se persiste.
- `GET /auth/garmin-status` incluye `needs_reauth`; `DELETE` borra fila + `shutil.rmtree(token_dir)`.
- `GarminService(..., use_env_fallback=False)` en sync/scheduler: imposible mezclar cuentas; el scheduler marca `needs_reauth` ante 401.
- Límite honesto: la contraseña viaja por HTTPS al servidor una vez (el navegador no puede loguearse en Garmin por CORS/Cloudflare); queda documentado en la UI.

### Amigos por invitación (implementado, HU-45)
- Tabla `friend_invites(code PK 6 chars, inviter_id, expires_at 7d, used_by_id/used_at)`.
- `POST /friends/invite` → `{code, expires_at}`; `POST /friends/accept-invite {code}` → amistad `accepted` directa + marca uso. Códigos de un uso, mayúsculas, sin caracteres confusos.

### Push de entrenos al reloj (experimental, HU-46)
- `POST /strength/push-to-garmin {routine_name, exercises[], dry_run=true}` → `build_garmin_strength_workout()` (mapeo ES→enum en `GARMIN_EXERCISE_MAP`, pasos por serie con peso/reps) → `upload_strength_workout`. `dry_run` devuelve JSON + `unmapped_exercises` sin tocar la cuenta. `push_workout_to_device` como paso siguiente tras validar el JSON en vivo.

## 11. Deuda crítica — fix exacto por fichero (no funcional sin esto)
| # | Fichero:línea | Fallo | Fix (1 línea de intención) |
|---|---|---|---|
|D1|`backend/app/api/v1/sync.py:55`|sync bloquea loop|`async def` + extraer `services/sync_service.py::run_user_sync()`|
|D2|`backend/app/scheduler/scheduler.py:37`|no persiste|llamar a `run_user_sync()` + job `nightly_rollup`|
|D3|`backend/main.py:54-68`|sirve `frontend/` fuente|servir `frontend/dist` + SPA fallback + `/healthz`|
|D4|`frontend/src/services/api.ts` vs `auth.ts`|doble axios|eliminar `api.ts`, `VITE_API_URL` + interceptor único|
|D5|`backend/app/api/v1/strength.py:109,134`|`dict()` + date en DateTime|`model_dump()` + `datetime.combine`|
|D6|`metrics.py:70`, `strength.py:74`|date vs timestamptz|normalizar a `datetime` inicio/fin de día|
|D7|`strength.py:70`|date.resolution hack|`timedelta(days=2)`|
|D8|`main.py:26`|CORS * + credentials|orígenes explícitos|
|D9|`Dockerfile` + falta `.dockerignore`|fuga venv/db/tokens|`.dockerignore` + `COPY backend/ frontend/dist` selectivo|
|D10|`sync.py` dedup vs PK solo-`id`|dedup global (IDs Garmin únicos entre cuentas)|
|D11|`social.py` leaderboard N+1|`asyncio.gather` con sesión propia por atleta|
|D12|`models.py`|sin FK/cascade|FK + ondelete CASCADE + índices §8|
|D13|raíz|sin `.env`|validación arranque + `python backend/test_garmin_sync.py` como check|
