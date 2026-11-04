# ⚡ Garmin Athletics - Tu Garmin Connect privado

Plataforma personal de ingesta de Garmin Connect (sueño, HRV, Body Battery, FC en reposo, actividades con GPS), modelo fisiológico Banister (ATL/CTL/TSB + Readiness), mapas y planificador de rutas, gimnasio con IA, entrenos hacia el reloj y comparativas privadas con amigos.

## 🚀 Inicio Rápido

### 1. Requisitos
- Python 3.11+ y Node 18+.
- Cuenta en Garmin Connect (la del reloj/app).

### 2. Backend
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # y rellena GARMIN_EMAIL, GARMIN_PASSWORD, SECRET_KEY
.\venv\Scripts\python.exe backend\test_garmin_sync.py   # 1ª vez: pide 2FA y guarda tokens
.\venv\Scripts\python.exe backend\main.py
```

### 3. Frontend
```powershell
cd frontend; npm install; npm run build   # dist/ lo sirve el backend
```
Abre **`http://localhost:8000`** (usa incógnito tras actualizar, por la caché del bundle).

## 🖥️ Qué incluye la web

| Pestaña | Contenido |
|---|---|
| **Panel** | Readiness con anillo, Forma/Fatiga/Frescura, semana (sesiones/TSS/km/tiempo), widgets reales de Sueño (fases)/HRV/Body Battery (curva)/FC + Movimiento hoy (pasos), "Garmin dice" (VO2max, estado, predicciones), avisos, gráfica Banister 30d, últimas sesiones, conexión Garmin |
| **Actividades** | Lista filtrable (deporte, fechas, texto) + paginación; detalle por sesión: mapa multicapa (calles/senderos/satélite) con ruta de colores (velocidad/pulso/altitud), perfil de elevación, gráficas FC/ritmo, vueltas, zonas FC, meteo, desnivel, calorías, cadencia/potencia, export GPX, "Guardar como ruta" |
| **Rutas** | Planificador: clics + arrastre de puntos, capas, deshacer/invertir/ida-vuelta/bucle óptimo, lista editable, guardar, importar GPX, exportar GPX, zonas de privacidad |
| **Gimnasio** | Asistente editable (foco + intensidad, desplegables por tipo, leyenda, regenerar), registro táctil, temporizador de descanso, vista previa para reloj, historial con tonelaje y PRs |
| **Tendencias** | 8 métricas (sueño, HRV, FC, batería, readiness, estrés, pasos) 30/90d + media 7d + CSV |
| **Rendimiento** | Resumen por deporte vs periodo previo, zonas FC, marcas personales + predicciones Garmin |
| **Calendario** | Mes con eventos (recurrentes inamovibles), actividades y readiness + avisos de entrenamiento |
| **Social** | Leaderboard solo-agregados, solicitudes + invitaciones por código de 6 letras |

## 🔒 Privacidad (importante)

- Tu contraseña de Garmin se usa **una sola vez** para abrir sesión y **no se guarda en ningún sitio** (verificado con test: columna siempre NULL). Solo quedan tokens revocables por usuario.
- Los tracks GPS solo los ve su dueño. El leaderboard comparte únicamente TSS/CTL/TSB/Readiness.
- Sesión caducada → aviso "re-vincula". Desvincular borra fila + tokens de disco.

```http
PUT    /api/v1/auth/garmin-credentials   { garmin_email, garmin_password }  # un solo uso
POST   /api/v1/auth/garmin-mfa           { garmin_email, garmin_password, ticket, code }
GET    /api/v1/auth/garmin-status        # { linked, needs_reauth, last_sync_at }
DELETE /api/v1/auth/garmin-credentials
POST   /api/v1/sync/garmin               # sync manual (el scheduler automático aún no persiste: T-38)
GET    /api/v1/sync/status
```

## 🧪 Pruebas

```powershell
.\venv\Scripts\python.exe tests\test_fatigue_engine.py
.\venv\Scripts\python.exe tests\test_security.py
.\venv\Scripts\python.exe tests\test_social_e2e.py   # incluye invites, push dry_run, rutas CRUD
.\venv\Scripts\python.exe tests\test_tracks.py
cd frontend; npx tsc --noEmit
```

## 📑 Especificaciones (fuente de verdad, revisadas 2026-09-10)

- [`CONSTITUTION.md`](CONSTITUTION.md): principios y stack real.
- [`SPEC.md`](SPEC.md): historias de usuario + **§2b estado real por HU** (✅/🟡/❌).
- [`PLAN.md`](PLAN.md): arquitectura y endpoints con lo implementado vs pendiente marcado.
- [`TASKS.md`](TASKS.md): Fases 1-14 (pendientes honestos: scheduler con persistencia, ingesta ampliada, calendario, rendimiento, PWA, GDPR).
