# BACKLOG.md — Garmin Athletics

**Rama**: `master` · **Última revisión**: 2026-11-04

Reglas (de `PROTOCOLO-AUTONOMIA.md`): nunca menos de **5 tareas listas**; cada sesión se coge la
de **más valor**; una tarea bloqueada no para la sesión; el backlog se rellena de la investigación
de la competencia, los huecos de la especificación y la deuda técnica.

Valor = cuánto acerca la misión ("panel de disposición + editor de entrenamientos de gimnasio más
fácil que el de Garmin") dividido por lo que cuesta.

---

## Listas — orden por valor

### T-01 · Backend del gimnasio: catálogo de ejercicios, plantillas y sesiones con series
**Nivel 2** · **Estado**: `hecha` (ver ESTADO-AGENTE.md) · **Origen**: `INVESTIGACION.md` §4.5 y §5

Es la fundación de todo el bloque del gimnasio y el motivo por el que el frontend nuevo no puede
empezar por el editor: hoy el backend **no tiene** catálogo, ni plantillas, ni series individuales
(huecos H1-H4). Sin esto, "marcar una serie y corregir su peso" no se puede guardar.

**Decisión de diseño**: `DECISIONES.md` D-01 y D-04.

**Criterio de aceptación**

- [x] Tablas nuevas `exercises`, `workout_templates`, `template_exercises`, `workout_sessions`,
      `session_sets`, creadas por `create_all` sin romper el arranque sobre la BD existente.
- [x] `GET/POST /strength/exercises` (búsqueda por texto, filtro por grupo muscular y material) y
      `GET /strength/exercises/{id}`; catálogo sembrado en español con ≥35 ejercicios.
- [x] CRUD de plantillas: `GET/POST /strength/templates`, `GET/PUT/DELETE /strength/templates/{id}`.
- [x] Sesiones: `POST /strength/sessions` (terminar sesión con series individuales),
      `GET /strength/sessions/{id}`, `GET /strength/sessions` (historial paginado).
- [x] `GET /strength/exercises/{id}/history`: últimas marcas, mejor serie y evolución.
- [x] `POST /strength/log` sigue funcionando igual (compatibilidad con las pruebas actuales).
- [x] Al terminar una sesión se crea también la `Activity` de tipo `strength`, para que la fatiga
      siga sumando (como hace hoy `/strength/log`).
- [x] Pruebas nuevas en `tests/` en verde y las 7 existentes también.

**Resultado (2026-11-04).** 17 endpoints nuevos en `backend/app/api/v1/gym.py`, 5 tablas en
`backend/app/db/models.py`, semilla de 52 ejercicios en `backend/app/services/gym_seed.py`.
`tests/test_gym_v2.py` cubre catálogo, filtros, CRUD, plantillas, sesiones, corrección, borrado,
últimas marcas, PRs y compatibilidad. Suite completa 8/8 en verde.
Verificado sobre copia de la BD real con `tests/verify_migration_real_db.py`.

---

### T-02 · Frontend nuevo: esqueleto, navegación y capa de API tipada
**Nivel 1** · **Estado**: `hecha` (2026-11-04) · **Origen**: `ESPECIFICACION.md` (frontend rehecho)

Proyecto `frontend-nuevo/` con Vite + React 19 + TypeScript + Tailwind v4 + React Query. Layout,
navegación, tema oscuro, cliente HTTP con Bearer obligatorio y `src/api/types.ts` con los tipos de
`INVESTIGACION.md` §4.4 (nada de `any` en datos de salud, `DECISIONES.md` D-06).

**Criterio de aceptación**: arranca con `npm run dev`; login real contra el backend; navegación
entre secciones; `tsc --noEmit` limpio; `frontend/` y `frontend_mvp/` intactos.

**Resultado (2026-11-04).** Sistema de diseño en `designs/garmin-athletics-design-system/`
(escala de 4 px, AA calculado: 52 pares, 2 temas) y app con login real, navegación por registro,
Hoy, Gimnasio y Ajustes, más seis secciones de bandera (Actividades, Calendario, Tendencias,
Rendimiento, Rutas, Social). Pruebas: 11 flujos en verde (Vitest + Testing Library), contrato
verificado contra el backend real sobre una copia de la BD (61 comprobaciones), humo en navegador
real con 5 capturas y cero errores de consola, y `tsc --noEmit` + build limpios.

---

### T-03 · Panel del día ("Hoy")
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` familia A + `INVESTIGACION.md` §5

La pantalla que se abre al entrar. Readiness con su semáforo y **sus tres componentes**
(sueño/HRV/TSB), sueño, HRV, Body Battery, FC en reposo, estrés, carga ATL/CTL/TSB, avisos de
`/alerts` y banner de estado de sync. Todo el backend ya existe y está verificado (§4.2).

**Criterio de aceptación**: con la BD actual (datos parados) muestra estados vacíos honestos, sin
inventar; con datos sembrados muestra el panel completo; los números coinciden con la respuesta
cruda de la API; sin errores de consola.

---

### T-04 · Ejecutar la sesión (el logger)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` §3 + `INVESTIGACION.md` §2.7

El corazón del encargo. Plantilla del día, **última marca de cada ejercicio precargada**, marcar
serie hecha con corrección de peso/reps en el momento, descanso por ejercicio con hora de fin
absoluta (`DECISIONES.md` D-03), estado que sobrevive a recargar (D-02), terminar y ver resumen.

**Criterio de aceptación**: una serie se registra en ≤2 toques; se puede corregir una serie ya
marcada sin tocar las demás; recargar la página no pierde la sesión; el descanso sigue contando
tras apagar la pantalla; al terminar, la sesión aparece en el historial y suma en la carga.

---

### T-05 · Editor de plantilla de entrenamiento
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` §2

Nombre + día de la semana, añadir ejercicios buscando en el catálogo, series/reps/peso/descanso/
notas por ejercicio, reordenar, duplicar serie, guardar/descartar con aviso al salir.

**Criterio de aceptación**: crear una rutina de 5 ejercicios en menos de un minuto; reordenar
funciona con teclado y con ratón; salir sin guardar avisa; la plantilla se puede usar en T-04.

---

### T-06 · Catálogo de ejercicios (pantalla)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` §1

Lista con búsqueda, filtro por grupo muscular y material; ficha del ejercicio con notas técnicas;
crear ejercicio propio; estados vacío/carga/error.

**Criterio de aceptación**: buscar "press" filtra en vivo; los filtros se combinan; el ejercicio
creado aparece al instante en el editor de plantilla.

---

### T-07 · Historial por ejercicio
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` §4

Últimas sesiones de un ejercicio con peso y repeticiones, marca personal y evolución.

**Criterio de aceptación**: gráfico de progresión de las últimas N sesiones; PR visible; enlace
desde la sesión y desde la ficha del ejercicio.

---

### T-08 · Historial de sesiones y detalle de sesión
**Nivel 2** · **Estado**: `pendiente` · **Origen**: hueco de la especificación

Lista de sesiones con tonelaje, TSS y duración real; detalle con todas las series; corregir una
sesión guardada (usa `PUT`/`DELETE` de T-01).

**Criterio de aceptación**: una sesión guardada se puede abrir, corregir y borrar.

---

### T-09 · "Hoy" con la plantilla del día
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §5

Si el día de la semana coincide con una plantilla, el panel "Hoy" muestra **"Entrenar: Empuje A"**
con un botón que arranca T-04 ya cargado. Es lo que convierte dos pantallas en un flujo.

**Criterio de aceptación**: un toque desde "Hoy" abre la sesión con la plantilla cargada.

---

### T-10 · Estados transversales y accesibilidad
**Nivel 1** · **Estado**: `pendiente` · **Origen**: `ESPECIFICACION.md` ("estados obligatorios")

Vacío, cargando, error y sin permiso en todas las pantallas; foco visible; contraste AA; botones
de ≥44 px; funciona a una mano y con guantes (objetivos grandes). Auditoría con teclado.

**Criterio de aceptación**: ninguna pantalla enseña una lista vacía sin explicar por qué.

---

### T-11 · Pruebas de contrato entre frontend y backend
**Nivel 1** · **Estado**: `pendiente` · **Origen**: deuda técnica (`DECISIONES.md` D-06)

Un test que recorra los endpoints que consume el frontend y compruebe que la forma de la respuesta
sigue coincidiendo con `src/api/types.ts`. Evita el fallo silencioso de `undefined` en un campo de salud.

**Criterio de aceptación**: el test falla si se renombra un campo del backend.

---

### T-12 · `response_model` en los endpoints que consume el frontend nuevo
**Nivel 1** · **Estado**: `pendiente` · **Origen**: deuda técnica

46 de 58 rutas no declaran `response_model`. Añadirlo endpoint a endpoint según se consumen, para
que el OpenAPI deje de estar vacío y T-11 se pueda generar.

**Criterio de aceptación**: los endpoints del panel y del gimnasio aparecen con esquema en `/openapi.json`.

---

**Ampliación del 2026-11-04 — T-13 a T-20.** Nacen de `INVESTIGACION.md` §8 y de la decisión D-09. La
mayoría de las pantallas nuevas vive detrás de `VITE_FEATURE_EXTENDED` (D-08); lo que cae dentro de
pantallas visibles (T-13, T-14, T-17, T-19) y en Ajustes (T-20) se ve desde el primer día.

### T-13 · Entrenar sin plantilla (sesión libre)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 1)

Empezar una sesión vacía y añadir ejercicios sobre la marcha, sin crear una rutina antes. Cubre los
días sin plan y evita el flujo rígido del builder de Garmin (F3). Va **dentro de Entrenar**, que es
visible: no depende de la bandera.

**Criterio de aceptación**: desde "Entrenar" se abre una sesión sin plantilla; los ejercicios que se
añaden se marcan y corrigen igual que los de una plantilla; al terminar, la sesión aparece en el
historial y suma en la carga.

---

### T-14 · Resumen al terminar la sesión
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 2)

Cierra el bucle de T-04: tonelaje, series por grupo muscular, PRs y comparación con la última
sesión del mismo día o rutina. Es la pregunta que Garmin no responde (F7). Va dentro de Entrenar,
visible.

**Criterio de aceptación**: al terminar, el resumen muestra tonelaje total, series por grupo
muscular y PRs de la sesión; si hay una sesión anterior comparable, muestra la diferencia; cuando no
hay datos suficientes, lo dice en vez de enseñar un cero o un número inventado.

---

### T-15 · Progreso de fuerza
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 3)

Pantalla nueva **Progreso**, **detrás de la bandera** (D-08): volumen semanal, series por grupo
muscular, frecuencia y racha, y detección de músculos desatendidos. Convierte el historial en
decisiones.

**Criterio de aceptación**: muestra el volumen semanal y las series por grupo muscular de las
sesiones de fuerza; señala los grupos que no han recibido series en el periodo; con poco historial,
enseña un estado vacío honesto que explica qué falta.

---

### T-16 · Marcas personales (PRs)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 4)

Pestaña **Marcas**, **detrás de la bandera**: lista de récords por ejercicio con fecha y mejor
serie. El aviso de PR al terminar una sesión se muestra en el resumen de T-14, que sí es visible.

**Criterio de aceptación**: la pestaña lista los récords por ejercicio con fecha y mejor serie; el
aviso de PR solo aparece cuando la sesión supera la marca anterior; cada marca enlaza a la sesión
donde se consiguió.

---

### T-17 · Guardar sesión como plantilla
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 5)

Desde el detalle de una sesión del **Historial** (visible), "guardar como rutina". La rutina nace
del entreno real, no de un builder vacío.

**Criterio de aceptación**: desde el detalle de una sesión se guarda como plantilla con nombre; la
plantilla aparece en Rutinas con los ejercicios, series, repeticiones y pesos de esa sesión; se
puede arrancar una sesión nueva desde ella.

---

### T-18 · Calendario semanal de entrenamiento
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 6)

Pantalla **Calendario**, **detrás de la bandera**: asignar plantillas a días de la semana y verlas
junto a la disposición (readiness). El plan deja de estar enterrado en "Más" (F9). El backend de
`/calendar` ya devuelve eventos y readiness por día (§4.4); el vínculo plantilla → día es lo que hay
que resolver al implementarla.

**Criterio de aceptación**: se asigna una plantilla a un día de la semana y se ve en el calendario;
cada día muestra sus eventos y la readiness que devuelve el backend; desde el calendario se arranca
la sesión de ese día.

---

### T-19 · Calculadora de discos y calentamiento
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 7) — adopta la
que estaba como E-03

Herramienta **dentro de la sesión** (visible): qué discos poner por lado para un peso y qué series
de aproximación hacer. El cálculo mental es fricción real en el gimnasio.

**Criterio de aceptación**: dado un peso total y el material disponible, muestra los discos por
lado; para un peso que no se puede montar exactamente, lo dice y propone la combinación más cercana;
las series de aproximación usan el peso de trabajo real y se pueden empezar sin salir de la sesión.

---

### T-20 · Preferencias: unidades, descanso y avisos
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION.md` §8 (adopción 8)

En **Ajustes** (visible): kg/lb, duración de descanso por defecto y aviso de descanso. Se usa a una
mano y en un gimnasio; la app se adapta al atleta.

**Criterio de aceptación**: cambiar kg/lb cambia lo que se muestra en todas las pantallas y no
altera el dato guardado; el descanso por defecto se aplica al empezar una serie; el aviso de
descanso se puede activar o desactivar y la preferencia sobrevive a recargar.

---

## Esperando decisión (Nivel 3) — no bloquean la sesión

| # | Pregunta exacta | Por qué es Nivel 3 |
|---|---|---|
| E-01 | **¿El frontend nuevo mantiene las 8 pestañas (Panel, Actividades, Rutas, Gimnasio, Tendencias, Rendimiento, Calendario, Social) o se recorta?** | Es alcance de producto y la `ESPECIFICACION.md` lo deja explícitamente para David. Mientras no se responda, T-02 construye la navegación con **Hoy + Gimnasio + Ajustes** y deja las demás detrás de una bandera. |
| E-02 | ¿Se adoptan **supersets** (dos ejercicios por bloque)? | Añade alcance: cambia el modelo de sesión. Propuesto en `INVESTIGACION.md` §5. |
| E-03 | ¿Se añade **calculadora de discos** y de calentamiento? | **adoptada como T-19 (2026-11-04); ya no espera decisión.** Entra como Nivel 2 dentro de la ampliación (`INVESTIGACION.md` §8, `DECISIONES.md` D-09). |
| E-04 | ¿**PWA offline** con service worker? | Añade una capa de caché y versiones; no se puede validar bien sin despliegue. |
| E-05 | ¿Se envía de verdad la rutina al **reloj Garmin** (`push-to-garmin` con `dry_run=false`)? | Nunca se ha validado con un reloj real; puede rechazar el entreno. |
| E-06 | ¿**RPE/RIR por serie**? | La especificación no lo pide; Hevy/Strong lo tienen. |
| E-07 | ¿**1RM estimado** y progresión calculada? | Extra sobre "marca personal y evolución". |
| E-08 | ¿Peso corporal, medidas, SpO2, nutrición? | Fuera del alcance declarado de esta tanda (`ESPECIFICACION.md` "fuera de alcance"). |
| E-09 | **¿El frontend nuevo sustituye al viejo en producción o convive con él?** | Es despliegue y producto: decide qué se sirve y cuándo se apaga el viejo. **No bloquea**: el frontend nuevo vive en su carpeta y el viejo se sigue sirviendo hasta que David decida. |

---

## Deuda técnica y mantenimiento

| # | Tarea | Nivel |
|---|---|---|
| M-01 | `strength/history` filtra en memoria sobre 200 filas y devuelve el JSON inline: paginar en SQL. | 1 |
| M-02 | `POST /strength/log` crea una `Activity` con hora 18:00 y 45 min fijos: la duración real se pierde (lo arregla T-01 con sesiones). | 1 |
| M-03 | Hay 2 tablas de ejercicios en potencia (`GARMIN_EXERCISE_MAP` y `EXERCISE_POOLS`) que deberían salir del catálogo nuevo. | 1 |
| M-04 | Las 7 pruebas actuales son scripts con `print`, no `pytest` con aserciones: migrar a `pytest`. | 1 |
| M-05 | La autenticación es opcional en 40 endpoints: un frontend que olvide el Bearer ve datos vacíos en vez de un 401. | 1 |
| M-06 | El scheduler no persiste los trabajos (T-38 del `TASKS.md` viejo). | 1 |
| M-07 | Actualizar `README.md` cuando exista el frontend nuevo (hoy describe el viejo). | 1 |

---

## Hechas

| # | Tarea | Fecha | Resultado |
|---|---|---|---|
| — | Investigación de competencia + inventario del backend | 2026-11-04 | `INVESTIGACION.md` (competencia + 58 endpoints + 10 huecos + propuesta) |
| T-01 | Backend del gimnasio (catálogo, plantillas, sesiones con series) | 2026-11-04 | 17 endpoints, 5 tablas, 52 ejercicios, pruebas 8/8 en verde |
| T-02 | Frontend nuevo: sistema de diseño, login, navegación y API tipada | 2026-11-04 | `frontend-nuevo/` + `designs/…`; 11 flujos, 61 comprobaciones de contrato y humo en navegador |
