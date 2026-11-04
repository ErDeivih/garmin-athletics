# CONSTITUTION.md - Leyes y Convenciones de Arquitectura

## 1. Misión del Proyecto
Construir una plataforma personal de alto rendimiento, 100% automatizada en la ingesta de métricas biométricas de Garmin, para la planificación y gestión de carga de entrenamiento multidisciplinar (carrera, ciclismo, natación, fútbol y gimnasio/fuerza) con recomendaciones adaptativas impulsadas por Inteligencia Artificial.

---

## 2. Principios Inquebrantables (Leyes del Proyecto)
1. **Automatización Pasiva Primero**: El usuario **nunca** debe introducir manualmente datos que Garmin ya registre (sueño, VFC/HRV, pulsaciones en reposo, Body Battery, GPX, zonas de frecuencia cardíaca). La ingesta debe ejecutarse en segundo plano mediante tareas desatendidas.
2. **Cero Sesión Interactiva Excesiva**: La autenticación de Garmin usará persistencia de sesión en disco/base de datos (tokens OAuth2/cookies de `garminconnect`). La renovación de credenciales solo se solicitará si los tokens expiran y fallan los reintentos.
3. **Métrica Unificada de Carga (Resistencia + Fútbol + Fuerza)**: Ninguna disciplina queda aislada. La fatiga global se calcula mediante el modelo Impulse-Response (Banister / Coggan):
   - **ATL** (Acute Training Load - Fatiga 7 días).
   - **CTL** (Chronic Training Load - Forma Física 42 días).
   - **TSB** (Training Stress Balance - Frescura/Disposición = CTL - ATL).
4. **Respeto a la Fatiga Neuromuscular**: La IA de generación de rutinas de fuerza **siempre** consulta primero el contexto biométrico (VFC/HRV, sueño) y la fatiga acumulada del fútbol/carrera para evitar lesiones o sobreentrenamiento en piernas antes de partidos o tras sesiones intensas.
5. **Privacidad y Cero Dependencias de Terceros Innecesarias**: Todos los datos biométricos se almacenan en una base de datos propia (Supabase/PostgreSQL). No se reenvían datos a Strava ni plataformas de terceros sin consentimiento explícito.
6. **GPS Privado por Defecto**: Los tracks GPS son datos sensibles. Viven en disco privado (`.json` por actividad), jamás en endpoints sociales, con `visibility='private'` por defecto. Zonas de privacidad con recorte (pendiente HU-17) y borrado GDPR completo (pendiente HU-33). El leaderboard solo comparte agregados (TSS/CTL/TSB/Readiness).
7. **Dato Real Antes que Dato Bonito**: Prohibido inventar huecos (`null` donde no hay dato, nunca interpolado silencioso) y toda fórmula documentada junto a su implementación (`SPEC §3` = código real).
8. **Mapas y Rendimiento Sin API Keys de Pago**: Tiles OSM/Carto gratuitos, GPX propio exportable, cálculos de desnivel/zonas/PRs en local. El dashboard debe cargar <500ms con caché (React Query + localStorage) aunque Garmin caiga.

---

## 3. Stack Tecnológico Aprobado

### Backend (Motor de Datos y Servicios)
- **Lenguaje**: Python 3.11+ (prod local: 3.12)
- **Framework API**: FastAPI (asíncrono, OpenAPI nativo — prohibido `asyncio.run()` dentro de endpoints)
- **Ingesta Garmin**: Librería `garminconnect>=0.3.11` (sesión persistente en directorios `garmin_tokens[_user]`, passwordless)
- **Planificador de Tareas**: `APScheduler` (programa 07:00 + tardes; persistencia pendiente T-38)
- **ORM / Cliente DB**: SQLAlchemy v2 (async)
- **Motor Matemático / Data**: stdlib (`math`, `statistics` si hace falta). Sin `numpy/pandas` (no instalados, no necesarios).

### Frontend (Interfaz de Usuario)
- **Framework UI**: Vite + React 19 + TypeScript
- **Estilos y Componentes**: Tailwind CSS v4 (`@import "tailwindcss"` + `@theme`) + Lucide Icons
- **Visualización de Datos**: Recharts
- **Mapas**: Leaflet + react-leaflet con tiles Carto oscuro (sin API key)
- **Gestión de Estado/Peticiones**: axios + hooks (React Query pendiente)

### Base de Datos y Almacenamiento
- **Motor DB**: SQLite en dev (`garmin_athletics.db`), PostgreSQL en prod
- **Estructura**: relacional + migraciones idempotentes al arrancar (`init_db()`), sin FK/cascadas todavía
- **Ficheros GPS**: disco `data/tracks/{user_id}/{activity_id}.json` y `data/routes/...` (volumen Docker); en BD solo metadatos + bbox + resumen

### Integración LLM (Motor Adaptativo de Fuerza)
- **Modelos Integrados**: DeepSeek V4 Flash / Claude 3.5 Sonnet / OpenAI API
- **Patrón de Prompts**: Context-First Injector (Datos biométricos -> Reglas -> Generación JSON de rutina)

---

## 4. Estructura Estándar del Repositorio
```
garmin/
├── CONSTITUTION.md          # Este documento
├── SPEC.md                  # Especificación funcional y de negocio
├── PLAN.md                  # Diseño técnico y esquema de BD
├── TASKS.md                 # Tareas ejecutables priorizadas
├── backend/
│   ├── app/
│   │   ├── api/v1/          # sync, metrics, activities, strength, routes,
│   │   │                    # social_auth, friends, social
│   │   ├── core/            # config (TRACKS_DIR), security
│   │   ├── db/              # models, session (migraciones idempotentes)
│   │   ├── services/        # garmin_service, fatigue_engine, gym_advisor,
│   │   │                    # track_service
│   │   └── scheduler/       # scheduler (programado; persistencia pendiente)
│   └── main.py              # FastAPI + sirve frontend/dist + /healthz
├── frontend/
│   ├── src/
│   │   ├── components/      # ActivityDetail, AuthPanel, GarminLink,
│   │   │                    # SocialPage, ui/{Card,primitives}
│   │   ├── pages/           # Dashboard, Activities, Routes, Gym
│   │   └── services/        # auth (axios + Bearer + VITE_API_URL)
├── data/tracks/ data/routes/  # JSON GPS privados (volumen Docker, no en git)
├── tests/                   # test_fatigue_engine/security/social_e2e/tracks
└── docker-compose.yml       # postgres + backend (+ volumen ./data)
```
