# frontend-nuevo — Lyfta

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
`localStorage` y **todas** las peticiones llevan `Authorization: Bearer`. Un 401 de la sesión limpia
el token, vacía la caché de React Query y vuelve a la entrada explicando que ha caducado; un 401 de
la vinculación con Garmin **no** cierra la sesión: es una contraseña incorrecta y se enseña en el
formulario. La caché se vacía también en cada logout y en cada login, para que las métricas de una
cuenta no se pinten en otra.

La API se resuelve con rutas relativas `/api/v1`: en desarrollo las manda el proxy de Vite
(`VITE_API_PROXY_TARGET`, por defecto 8000) y en producción las debe resolver el reverso que sirva
el frontend. `VITE_API_URL` solo hace falta si la API vive en otro origen. Servir
`frontend-nuevo/dist` desde el backend, CORS de preview/LAN y el camino de producción son la
tarea T-23 del backlog.

## Qué hay implementado

| Área | Estado |
|---|---|
| Sistema de diseño | `../designs/lyfta-design-system/` — tokens, README, componentes y contraste AA calculado. La app consume `src/styles/tokens.generated.css`. |
| Autenticación | Login, restauración de sesión contra `/auth/me`, cierre de sesión, 401 global. |
| Navegación | Registro de secciones: **Hoy · Gimnasio · Ajustes** visibles; el resto tras `VITE_FEATURE_EXTENDED` con interruptor en Ajustes. Barra lateral en escritorio, pestañas abajo en móvil. |
| Hoy | Disposición con explicación breve, sueño, HRV, Body Battery, FC en reposo, estrés, frescura y avisos. **Gráfica de carga de 30 días** y **curva de Body Battery** del día, en SVG propio. **Sin datos no inventa nada**: estado vacío que explica qué falta. |
| Gimnasio | Plantilla del día, plantillas reales, últimas sesiones y **Enviar al reloj**: prepara el workout, enseña bloques y duración, exige confirmación y avisa si algo no se puede enviar. |
| **Entrenar (T-04/T-29)** | Plantilla cargada con la **última marca precargada**, tabla `Serie · Peso · Reps · Esfuerzo · Hecha`, check de 44 px que marca y arranca el descanso (hora de fin absoluta), corrección de una serie ya marcada, borrador que **sobrevive a recargar**, **dibujo inicio/fin** del ejercicio y resumen de peso movido/series/reparto muscular al terminar. |
| **Catálogo (T-28 parcial)** | Lista de ejercicios con búsqueda y filtro muscular, su **par de dibujos inicio/fin** por patrón y un aviso honesto cuando no hay patrón visual. La creación/edición de ejercicios sigue siendo T-06/T-05. |
| **Actividades** | Lista con distancia, FC y desnivel; detalle con resumen, zonas de FC, recorrido GPS en SVG, series de FC/ritmo/altitud/velocidad y parciales por kilómetro. Sin TSS ni textos internos. |
| **Calendario** | Programar una plantilla en varios días de la semana (se repite), ver los entrenos semanales, previsualizar el workout, enviarlo/programarlo y **cargar el de hoy en el reloj**. Distingue **Plan** de **Hecho**. |
| Tendencias | Línea de métrica, carga ATL/CTL, barras semanales, monotonía, calendario de calor, fases de sueño apiladas, dispersión peso×reps, volumen por grupo muscular, empuje/tirón, top de ejercicios y comparativa con el periodo anterior; periodos 7/30/90/año. |
| Ajustes | Estado de Garmin, sync manual, vinculación con contraseña de un solo uso y 2FA, tema oscuro/claro, bandera de secciones, cuenta, cierre de sesión y **borrado de cuenta** con confirmación literal (borra también el gimnasio). |
| Secciones de bandera | Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social, con datos reales de la API; vacío, lyfta y error en todas. El estado de "sin permiso" por pantalla es T-25. |
| Todavía no | Sesión libre (T-13), guardar sesión como plantilla (T-17), editor de plantilla (T-05), creación/edición de ejercicios (T-06), historial por ejercicio (T-07/T-08), subnavegación de Gimnasio (T-24), ampliaciones T-18/T-19/T-20 y prueba real en el fr255 (Nivel 3). Están en `../BACKLOG.md`. |

## Pruebas y puertas

```powershell
npm run check        # tokens generados + contraste AA + typecheck + pruebas de flujo
npm test             # Vitest + Testing Library: login, navegación, Hoy, Ajustes, Tendencias, sesión, Actividad y Calendario
npm run build        # tsc --noEmit + build de producción
```

Además, contra un backend real sobre una **copia** de la base de datos:

```powershell
# en otra terminal, con DATABASE_URL apuntando a la copia
node scripts/verify-api.mjs http://127.0.0.1:8010   # 132 comprobaciones del contrato
node scripts/smoke-browser.mjs                      # navegador real (Chrome/Edge) + capturas
```

- `scripts/verify-api.mjs` comprueba que las formas de la API siguen coincidiendo con
  `src/api/types.ts`. Crea un ejercicio, una plantilla y una sesión en la copia, valida sus items y
  los borra; falla si se renombra o desaparece un campo (T-11 del backlog).
- `scripts/smoke-browser.mjs` recorre el flujo completo con un Chrome instalado y deja las capturas
  en `screenshots/`. No usa Playwright descargado: usa el navegador del sistema.
- `scripts/check-contrast.mjs` calcula el contraste WCAG AA de los pares declarados en el sistema de
  diseño. Falla por debajo de 4.5:1 (3:1 en bordes y foco).
- `scripts/check-scale.mjs` falla si una pantalla usa padding, margen o gap fuera de la escala
  4/8/12/16/24/32/48.
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
