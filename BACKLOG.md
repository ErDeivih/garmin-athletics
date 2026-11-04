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
(escala de 4 px, AA calculado: 52 pares, 2 temas) y app con login real, navegación generada desde el
registro de pantallas, Hoy, Gimnasio y Ajustes, más seis secciones de bandera (Actividades,
Calendario, Tendencias, Rendimiento, Rutas, Social). Pruebas: 19 flujos en verde (Vitest + Testing
Library), contrato verificado contra el backend real sobre una copia de la BD (102 comprobaciones,
incluye crear plantilla y sesión y validar sus series), humo en navegador real con 5 capturas y cero
errores de consola, y `tsc --noEmit` + build limpios. La revisión adversarial posterior a la primera
entrega encontró y se corrigieron dos bloqueantes: un 401 de Garmin ya no cierra la sesión de la app,
y la caché se vacía al cambiar de usuario; además la disposición ya no se pinta en Tendencias/Social
cuando puede venir de valores por defecto del backend (T-21). Quedan en backlog T-21 a T-25.

---

### T-03 · Panel del día ("Hoy")
**Nivel 2** · **Estado**: `hecha` (2026-11-04) · **Origen**: `ESPECIFICACION.md` familia A + `INVESTIGACION.md` §5

La pantalla que se abre al entrar. Readiness con su semáforo y **sus tres componentes**
(sueño/HRV/TSB), sueño, HRV, Body Battery, FC en reposo, estrés, carga ATL/CTL/TSB, avisos de
`/alerts` y banner de estado de sync. Todo el backend ya existe y está verificado (§4.2).

**Criterio de aceptación**: con la BD actual (datos parados) muestra estados vacíos honestos, sin
inventar; con datos sembrados muestra el panel completo; los números coinciden con la respuesta
cruda de la API; sin errores de consola.

**Resultado (2026-11-04).** Además del panel ya montado en T-02, ahora incluye **gráfica de carga de
30 días** (`/metrics/load`: ATL y CTL con leyenda y cifras) y **curva de Body Battery** del día
(`/metrics/daily.body_battery.curve`), dibujadas en SVG sin añadir librería. Si la serie de carga
falla, se avisa en su tarjeta y el resto del panel sigue; si no hay biometría, no se pinta ninguna
gráfica. Verificado con un usuario con datos en una **copia** de la BD: disposición 76, carga
ATL/CTL/TSB coherente con la respuesta cruda y Body Battery de 30 a 79. Cuatro flujos de prueba
(vacío, datos, fallo de carga, error de red) y capturas móvil/escritorio sin errores de consola.

---

### T-04 · Ejecutar la sesión (el logger)
**Nivel 2** · **Estado**: `hecha` (2026-11-04) · **Origen**: `ESPECIFICACION.md` §3 + `INVESTIGACION.md` §2.7

El corazón del encargo. Plantilla del día, **última marca de cada ejercicio precargada**, marcar
serie hecha con corrección de peso/reps en el momento, descanso por ejercicio con hora de fin
absoluta (`DECISIONES.md` D-03), estado que sobrevive a recargar (D-02), terminar y ver resumen.

**Criterio de aceptación**: una serie se registra en ≤2 toques; se puede corregir una serie ya
marcada sin tocar las demás; recargar la página no pierde la sesión; el descanso sigue contando
tras apagar la pantalla; al terminar, la sesión aparece en el historial y suma en la carga.

**Resultado (2026-11-04).** Pantalla `Entrenar` abierta desde la plantilla de Gimnasio: precarga la
última marca de cada ejercicio, tabla `Serie · Peso · Reps · RPE · Hecha`, check de 44 px que marca
y arranca el descanso (barra con hora de fin absoluta, recalculada al volver a la pestaña), edición
de una serie ya marcada sin tocar las demás, borrador en `localStorage` por usuario y plantilla que
sobrevive a recargar, y `POST /strength/sessions` al terminar con resumen de tonelaje, series, TSS y
reparto muscular. Backend: columna `rpe` por serie (migración aditiva) y contrato actualizado.
Pruebas: 3 flujos (persistencia, corrección + envío con Bearer, sin plantilla) y el humo real crea
una sesión contra la copia del backend. Queda para T-13 la sesión libre, T-17 guardar como plantilla
y T-14 el resumen comparativo con la sesión anterior.

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

**Ampliación del 2026-11-04 — T-13 a T-20.** Nacen de `INVESTIGACION.md` §8 y de la decisión D-09.
David ha confirmado que **entra todo lo que sea Nivel 1/2** de esta ampliación. La
mayoría de las pantallas nuevas vive detrás de `VITE_FEATURE_EXTENDED` (D-08); lo que cae dentro de
pantallas visibles (T-13, T-14, T-17, T-19) y en Ajustes (T-20) no necesita bandera.

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

### T-21 · Readiness honesto cuando falta biometría (backend + UI)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: revisión adversarial de T-02 (2026-11-04)

`calculate_readiness_score` rellena sueño=70 y HRV=75 cuando faltan datos, así que
`/metrics/trends?metric=readiness` y `/social/leaderboard` publican un 73/AMARILLO que parece medido.
Hoy y Tendencias ya no lo pintan, pero el backend sigue devolviéndolo.

**Criterio de aceptación**: readiness es `null` (o `biometrics_available:false`) cuando no hay sueño
ni HRV; Tendencias excluye esa métrica y Social no muestra badges de readiness sin dato; prueba con
la BD parada y con la sembrada. Reversible: es un cambio de respuesta, no de esquema.

---

### T-22 · Borrado de cuenta completo (backend + Ajustes)
**Nivel 2** · **Estado**: `hecha` (2026-11-04) · **Origen**: revisión adversarial de T-02; **autorizada por David**

La especificación pone "borrar cuenta" en Ajustes. `DELETE /auth/account` existía, pero **no borraba**
las cinco tablas del gimnasio (`workout_templates`, `template_exercises`, `workout_sessions`,
`session_sets`, `exercises` propias): dejaba sesiones, series y ejercicios en la base después de
prometer un borrado. David autorizó el flujo con confirmación literal `BORRAR MI CUENTA`.

**Criterio de aceptación**: el endpoint borra también el gimnasio (respetando el orden de claves);
Ajustes pide la frase exacta, dice qué se borra (salud, actividades, sesiones y series, plantillas,
ejercicios propios) y vuelve a la entrada; una prueba cuenta filas antes y después en una copia de
la BD.

**Resultado (2026-11-04).** Backend: borra series → sesiones → ejercicios de plantilla → plantillas
→ ejercicios propios → actividades y el resto, en `social_auth.delete_account`.
`tests/test_account_deletion.py` crea dos cuentas con gimnasio, borra una y comprueba en SQLite que
no quedan filas ni huérfanas y que la otra sigue intacta. Ajustes: zona de peligro con explicación,
frase literal y botón deshabilitado hasta que coincide; al borrar limpia token y caché y vuelve a la
entrada (prueba de flujo).

---

### T-23 · Camino de producción y móvil real del frontend nuevo
**Nivel 2** · **Estado**: `pendiente` · **Origen**: revisión adversarial de T-02 (2026-11-04)

El backend sirve `frontend/dist` (el viejo), no `frontend-nuevo/dist`; CORS solo admite 8000 y 5173,
así que `vite preview` (4173) y un móvil en la LAN fallan. El cliente ya usa rutas relativas `/api/v1`
y el proxy de desarrollo, pero falta el camino real.

**Criterio de aceptación**: `frontend-nuevo/dist` se sirve desde el backend (o un reverso documentado);
CORS configurable por entorno; probado en `vite preview` y desde un móvil en la LAN; README con la
URL correcta. No cambia datos.

---

### T-24 · Subnavegación de Gimnasio (Entrenar · Rutinas · Catálogo · Historial)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: revisión adversarial de T-02 (2026-11-04)

La especificación da cinco pantallas a Gimnasio, pero hoy es una sola página. El registro de
navegación genera las rutas de primer nivel; falta el árbol anidado de Gimnasio y que añadir una
pantalla no obligue a tocar el layout.

**Criterio de aceptación**: `/gimnasio/entrenar`, `/gimnasio/rutinas`, `/gimnasio/catalogo` y
`/gimnasio/historial` existen con su subnavegación y sus estados; las entradas viven en el registro;
las pruebas de flujo entran por cada una. Depende de T-04, T-05, T-06 y T-08.

---

### T-25 · Estado "sin permiso" y errores de red en todas las pantallas
**Nivel 2** · **Estado**: `pendiente` · **Origen**: revisión adversarial de T-02 (2026-11-04)

Las pantallas cubren vacío, carga y error; no hay estado de "sin permiso" (403) y un fallo de red se
enseña con el texto del navegador. El cliente ya normaliza los timeout y los fallos de conexión a
español, pero falta el 403 y probarlo en cada sección.

**Criterio de aceptación**: un 403 pinta "sin permiso" con qué credencial falta; los errores de red
dicen qué hacer; pruebas de los cuatro estados en Hoy, Gimnasio, Ajustes y una sección de bandera.

---

## Ampliación completa (2026-11-04) — de panel a app de entrenamiento

`ALCANCE-COMPLETO.md` amplía el producto: no es un panel de lectura, es una app completa que crea,
lleva al reloj, ejecuta y analiza entrenamientos. La investigación está en
`INVESTIGACION-AMPLIACION.md`. Orden de valor: **datos y gráficas → registro → creación → reloj →
detección por movimiento**.

### T-26 · Motor de métricas derivadas (backend)
**Nivel 2** · **Estado**: `hecha` (2026-11-04) · **Origen**: `INVESTIGACION-AMPLIACION.md` §1.3 y §1.5

Endpoints de agregación que hoy no existen: volumen y series por grupo muscular y por semana,
progresión por ejercicio, 1RM estimado (Epley), monotonía/tensión (Foster) y empuje/tirón con el
mapeo documentado. Periodos largos (hasta 365 días) e índices de las consultas.

**Criterio de aceptación**: con una copia con datos, los totales cuadran con la suma de las series
guardadas; una sesión de prueba aparece en su grupo y semana; sin datos devuelve series vacías y
totales a cero, no inventa; pruebas de contrato y de flujo.

**Resultado (2026-11-04).** `GET /strength/stats` (totales, por músculo, por semana, por ejercicio,
empuje/tirón, 1RM estimado) y `GET /metrics/load-summary` (semanas, monotonía/tensión Foster, ACWR).
Los calentamientos no cuentan como volumen; el 1RM es Epley y se etiqueta; el reparto empuje/tirón se
estima por grupo principal y dice cuánto queda sin clasificar. Índices aditivos al arrancar.
`tests/test_metrics_stats.py`: 2 sesiones con 5 series, totales exactos (2.455 kg), volumen por
músculo, e1RM 101,3 kg, ventanas vacías, aislamiento entre usuarios, 401 sin token y monotonía solo en
semanas cerradas. 10/10 scripts de backend en verde y 119 comprobaciones de contrato.

---

### T-27 · Catálogo de gráficas y ampliación de Tendencias/Hoy
**Nivel 2** · **Estado**: `en curso` · **Origen**: `INVESTIGACION-AMPLIACION.md` §1.2

Línea, barras, área, dispersión, calor/calendario y distribución sobre los datos reales, con
selector 7/30/90/mes/año, comparativa con el periodo anterior, y estado vacío honesto por gráfica.
La gráfica sin datos no se pinta; se explica qué falta.

**Criterio de aceptación**: cada gráfica declara su fuente y su unidad; los números coinciden con la
respuesta cruda; con la BD parada se ve el vacío, no una línea plana inventada; pruebas de flujo de
los estados y capturas móvil/escritorio.

**Resultado parcial (2026-11-04).** Tendencias ya tiene: línea de métrica con selector y periodo
7/30/90, gráfica de carga ATL/CTL, barras de TSS semanal, línea de monotonía, calendario de calor,
barras de volumen por grupo muscular, reparto empuje/tirón y top de ejercicios con 1RM estimado.
Todas con estados vacío/carga/error y 3 pruebas de flujo (22 en la suite). **Pendiente**: dispersión
(ritmo vs FC), fases de sueño en serie (falta agregado por noche), comparativa superpuesta de
periodos y capturas nuevas de Tendencias.

### T-28 · Ejercicios con dibujo (inicio y fin del movimiento)
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ALCANCE-COMPLETO.md` §2

Dos posiciones del movimiento por ejercicio, dibujadas como assets propios y servidas por el
catálogo; mapeo al catálogo de Garmin (categoría + ejercicio) para el envío al reloj.

**Criterio de aceptación**: cada ejercicio del catálogo tiene su par de dibujos o un aviso honesto de
que no lo tiene; el editor y la sesión los muestran; el mapeo Garmin cubre lo que se envía y avisa de
lo que no.

### T-29 · Registro de sesión (T-04) con RPE y corrección
**Nivel 2** · **Estado**: `hecha` (2026-11-04) · **Origen**: `ALCANCE-COMPLETO.md` §3 (ya era T-04)

Cubre lo que T-04 ya pedía y añade RPE por serie además de RIR, tempo cuando exista y el resumen con
las métricas derivadas de T-26.

**Criterio de aceptación**: el de T-04, más: el RPE se guarda por serie y se ve en el historial; el
tempo ausente se muestra como "sin tempo", no como cero.

**Resultado (2026-11-04).** RPE por serie de 1 a 10 (opcional) en modelo, entrada, salida y UI; el
resumen muestra tonelaje, series, TSS y volumen por grupo muscular. El RPE se ve en el resumen y en
el detalle de sesión. **Tempo no existe aún** en el modelo (P3 de `INVESTIGACION-AMPLIACION.md`): no
se pinta una fila de tempo vacía hasta que el editor lo capture.

### T-30 · Importar las series de fuerza de Garmin
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION-AMPLIACION.md` §3.3-3.4

Al sincronizar una actividad de fuerza, leer `get_activity_exercise_sets` y guardar las series
reales, enlazadas a la actividad y a la sesión propia; deduplicar por actividad para no contar dos
veces.

**Criterio de aceptación**: una actividad de fuerza de Garmin aparece con sus series (ejercicio,
peso, reps); dos sincronizaciones no duplican; una serie corregida en Garmin se refleja tras el
siguiente sync. **Requiere probar con la cuenta real de David (Nivel 3).**

### T-31 · Envío real de entrenamientos al reloj
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION-AMPLIACION.md` §3.3

Corregir el builder actual con los modelos tipados de `garminconnect` (sportType 5, repeat groups,
unidades de peso, descansos, catálogo de 1.527 ejercicios) y probar **un** entrenamiento real en el
reloj de David antes de activar el envío en la app.

**Criterio de aceptación**: el JSON coincide con la estructura de la librería; el entreno aparece en
el reloj con ejercicios, series, pesos, reps y descansos; no duplica el entreno al reenviar.
**Nivel 3 en la prueba real**: cuenta y reloj de David.

### T-32 · Watch-app Connect IQ: sesión, marcar serie y cola offline
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION-AMPLIACION.md` §3.4

Watch-app que muestra la sesión del día (ejercicio, dibujo, peso, reps, descanso), marca series con
los botones, las manda por HTTP al backend y guarda una cola si no hay conexión. Guarda la mano del
reloj. Verificado que el SDK 8.3.0 compila estas APIs para el fr965.

**Criterio de aceptación**: instalada en el reloj; marca una serie y llega al backend; sin cobertura
la guarda y la envía al recuperar; no se pierde la sesión al bloquear la pantalla.

### T-33 · POC de conteo de repeticiones por IMU
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `INVESTIGACION-AMPLIACION.md` §3.6

Protocolo medido: grabar acelerómetro a 25-50 Hz, etiquetar series reales y comparar detección de
picos contra la etiqueta en 3 ejercicios. Solo pasa a producto si el error es aceptable; si no, se
queda el marcado manual.

**Criterio de aceptación**: informe con error por serie y por ejercicio, confusión y condiciones;
decisión escrita de seguir o descartar. **No se promete un conteo automático general.**

### T-34 · Rediseño móvil-first sobre el sistema de diseño
**Nivel 2** · **Estado**: `pendiente` · **Origen**: `ALCANCE-COMPLETO.md` §5 + `research/UI-COMPETENCIA.md`

Aplicar los patrones de la investigación visual a las pantallas que se toquen: navegación, registro,
tarjetas, jerarquía, densidad y gestos. Móvil primero; escritorio para crear y analizar. Sobre los
tokens existentes, sin inventar un segundo sistema.

**Criterio de aceptación**: cada pantalla revisada cumple los cuatro estados, 44 px, AA y una mano;
la captura móvil es la referencia y el escritorio no es un móvil estirado.

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
| T-02 | Frontend nuevo: sistema de diseño, login, navegación y API tipada | 2026-11-04 | `frontend-nuevo/` + `designs/…`; 19 flujos, 102 comprobaciones de contrato y humo en navegador |
| T-03 | Panel Hoy completo: carga de 30 días y curva de Body Battery | 2026-11-04 | Gráficas SVG propias; pruebas de vacío/datos/fallo de carga/red y capturas con datos de una copia |
| T-04/T-29 | Registro de sesión: última marca, marcado, corrección, descanso, RPE y resumen | 2026-11-04 | `Entrenar` con borrador persistente y 3 flujos; humo real con sesión terminada contra la copia |
| T-22 | Borrado de cuenta completo (gimnasio incluido) y confirmación en Ajustes | 2026-11-04 | `tests/test_account_deletion.py` + flujo con frase literal y capturas |
| T-26 | Métricas derivadas y agregados de gimnasio/carga | 2026-11-04 | `/strength/stats` y `/metrics/load-summary`; `tests/test_metrics_stats.py`, 119 comprobaciones de contrato |
