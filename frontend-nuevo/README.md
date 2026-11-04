# frontend-nuevo — Garmin Athletics

Frontend nuevo, escrito desde cero contra el backend actual (`/api/v1`). Sustituye a `frontend/` y
`frontend_mvp/`, que quedan como referencia y **no se tocan**.

Stack: **Vite + React 19 + TypeScript + Tailwind v4 + React Query + React Router**. Sin secretos ni
variables sensibles: la única configuración es la URL de la API y la bandera de secciones.

## Arrancar

```powershell
# 1. API (desde la raíz del proyecto)
.\venv\Scripts\python.exe backend\main.py

# 2. Frontend
cd frontend-nuevo
copy .env.example .env        # opcional: VITE_API_URL y VITE_FEATURE_EXTENDED
npm install
npm run dev                   # http://127.0.0.1:5173
```

El login es real contra `/api/v1/auth/login`. El token (opaco, 30 días, sin refresh) vive en
`localStorage` y **todas** las peticiones llevan `Authorization: Bearer`; un 401 limpia la sesión.

## Qué hay implementado (T-02)

| Área | Estado |
|---|---|
| Sistema de diseño | `../designs/garmin-athletics-design-system/` — tokens, README, componentes y contraste AA calculado. La app consume `src/styles/tokens.generated.css`. |
| Autenticación | Login, restauración de sesión contra `/auth/me`, cierre de sesión, 401 global. |
| Navegación | Registro de secciones: **Hoy · Gimnasio · Ajustes** visibles; el resto tras `VITE_FEATURE_EXTENDED` con interruptor en Ajustes. Barra lateral en escritorio, pestañas abajo en móvil. |
| Hoy | Readiness con sus tres componentes, sueño, HRV, Body Battery, FC en reposo, estrés, carga TSB/ATL/CTL, avisos y estado de sync. **Sin datos no inventa nada**: estado vacío que explica qué falta. |
| Gimnasio | Plantilla del día, plantillas reales, últimas sesiones con tonelaje/TSS/duración. |
| Ajustes | Estado de Garmin, sync manual, vinculación con contraseña de un solo uso y 2FA, tema oscuro/claro, bandera de secciones, cuenta y cierre de sesión. |
| Secciones de bandera | Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social, con datos reales de la API y sus cuatro estados. |
| Todavía no | Entrenar (T-04), editor de plantilla (T-05), catálogo (T-06), historial por ejercicio (T-07/T-08) y las ampliaciones T-13 a T-20. Están en `../BACKLOG.md`. |

## Pruebas y puertas

```powershell
npm run check        # tokens generados + contraste AA + typecheck + pruebas de flujo
npm test             # Vitest + Testing Library: login, navegación, bandera, Hoy, Ajustes
npm run build        # tsc --noEmit + build de producción
```

Además, contra un backend real sobre una **copia** de la base de datos:

```powershell
# en otra terminal, con DATABASE_URL apuntando a la copia
node scripts/verify-api.mjs http://127.0.0.1:8010   # 61 comprobaciones del contrato
node scripts/smoke-browser.mjs                      # navegador real (Chrome/Edge) + capturas
```

- `scripts/verify-api.mjs` comprueba que las formas de la API siguen coincidiendo con
  `src/api/types.ts`. Falla si se renombra o desaparece un campo (T-11 del backlog).
- `scripts/smoke-browser.mjs` recorre el flujo completo con un Chrome instalado y deja las capturas
  en `screenshots/`. No usa Playwright descargado: usa el navegador del sistema.
- `scripts/check-contrast.mjs` calcula el contraste WCAG AA de los pares declarados en el sistema de
  diseño. Falla por debajo de 4.5:1 (3:1 en bordes y foco).
- `scripts/sync-tokens.mjs` genera los CSS desde `tokens.json`. `--check` falla si están desfasados.

## Decisiones y contrato

- `../DECISIONES.md`: D-01…D-09 (modelo del gimnasio, sesión en el navegador, descanso por marca de
  tiempo, sistema de diseño, banderas, ampliación).
- `../INVESTIGACION.md` §4: inventario del backend; §8: qué pantallas de la competencia entran.
- `../ESPECIFICACION.md`: pantallas de la tanda y reglas de la ampliación.

## Estructura

```
src/
  api/          client.ts (Bearer, errores, 401) · types.ts (contrato) · queries.ts (React Query)
  auth/         AuthContext: sesión, login, logout, restauración
  components/   ui.tsx (Button, Badge, StatCard, Field, estados) · AppShell
  config/       navigation.ts (registro de secciones) · features.ts (bandera)
  lib/          format.ts (fechas, números) · useMediaQuery.ts
  pages/        LoginPage · TodayPage · GymPage · SettingsPage · extended/*
  styles/       app.css · tokens.generated.css (no editar a mano)
  test/         setup, fakeApi, fixtures y las pruebas de flujo
```
