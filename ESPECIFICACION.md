# Especificación — Garmin Athletics

Estado: **borrador para revisar**. Ninguna pantalla se implementa sin estar decidida aquí.

## Objetivo de esta tanda

Que crear y ejecutar un entrenamiento de gimnasio sea **más fácil que en la app de Garmin**: elegir ejercicios, poner series, repeticiones y peso, y hacer la sesión sin perder nada.

Todo lo demás (rutas, social, calendario, tendencias) **no se toca** en esta tanda.

## Familia y recetas

Familias **A (panel de datos)** y **G (editor)** de `F:\Inforepositorios\indice\RECETAS-UI.md`.

De la familia A ya está casi todo hecho (ocho pestañas). Lo que falta es la G: el editor de entrenamientos y su ejecución.

## Pantallas de esta tanda

### 1. Catálogo de ejercicios
- [ ] Lista con búsqueda, filtro por grupo muscular y por material
- [ ] Ficha del ejercicio: nombre, grupo, material, notas técnicas
- [ ] Estado vacío: «todavía no hay ejercicios» con botón para crear
- [ ] Estado de carga y de error

### 2. Editor de plantilla de entrenamiento
- [ ] Nombre de la plantilla y día de la semana
- [ ] Añadir ejercicios desde el catálogo, buscando
- [ ] Por ejercicio: series, repeticiones, peso, descanso, notas
- [ ] Reordenar ejercicios
- [ ] Duplicar una serie con un clic
- [ ] Guardar / descartar cambios, con aviso si se sale sin guardar

### 3. Ejecutar la sesión
- [ ] La plantilla del día, con la última marca de cada ejercicio a la vista
- [ ] Marcar serie hecha, con corrección de peso y repeticiones en el momento
- [ ] Temporizador de descanso que **sigue contando con la pantalla apagada**
- [ ] Estado de la sesión que **sobrevive a recargar la página**
- [ ] Terminar la sesión y ver el resumen

### 4. Historial por ejercicio
- [ ] Últimas sesiones con peso y repeticiones
- [ ] Marca personal y evolución

## Estados obligatorios en todas

- [ ] Vacío · [ ] Cargando · [ ] Error · [ ] Sin permiso

## Decisiones que hay que tomar antes de implementar

| Decisión | Por qué importa | Estado |
|---|---|---|
| ¿Qué campos tiene un ejercicio? | define el catálogo y la base de datos | **pendiente** |
| ¿Qué pasa si se cambia la plantilla a mitad de sesión? | es el caso que rompe la experiencia | **pendiente** |
| ¿La sesión corre en el servidor o en el navegador? | decide si el temporizador sobrevive a cerrar la pestaña | **pendiente** |
| ¿Qué frontend sigue vivo, `frontend` o `frontend_mvp`? | **decidido el 2026-11-04: se rehace el frontend.** No invertir en ninguno de los dos; el nuevo se escribe desde cero contra el backend actual | **decidido** |
| ¿El catálogo de ejercicios es propio o se importa de algún sitio? | de esto depende el estado vacío | **pendiente** |

## Fuera de alcance (a propósito)

Rutas, social, calendario, tendencias, rendimiento y la ingesta de Garmin **no se modifican**. Si un agente propone tocarlos, se rechaza.

## Riesgos

- **`garminconnect` y la cuenta de Garmin**: si Garmin cambia, la ingesta se rompe. El `.env` y los tokens **nunca** entran en git (ya están en `.gitignore`).
- **Datos de salud personales**: la base de datos no se sube. Un `.db` en el repositorio sería una fuga.
- **2FA**: la primera sincronización es manual.

## Puertas antes de dar una pantalla por buena

1. Pruebas del proyecto en verde.
2. `ai-design-check` (cuando esté instalado) o la lista de diez de las recetas.
3. `unslop` para corregir, no para aprobar.
4. Revisión de ojos frescos: un subagente sin historial con este fichero y una captura.

## Decisión del 2026-11-04: se rehace el frontend

David no tiene claro qué hay vivo hoy en el frontend y **va a rehacerlo**. Consecuencias para el trabajo:

- **No tocar** `frontend/` ni `frontend_mvp/`: se quedan como referencia de qué hacía la app.
- El frontend nuevo se escribe desde cero **contra el backend actual**, que sí funciona (ingesta, motor ATL/CTL/TSB y API).
- Antes de escribir la primera pantalla hay que **inventariar la API**: qué endpoints existen y qué devuelven. Eso es lo único que el frontend nuevo necesita del viejo.
- El diseño del frontend nuevo se decide con `RECETAS-UI.md`, familia **A (panel de datos)** para las ocho pestañas y **G (editor)** para el entrenamiento de gimnasio.

Queda pendiente una pregunta que solo David puede responder: **si el frontend nuevo mantiene las ocho pestañas o se recorta**. Un panel con ocho secciones y un editor es mucho para una primera versión.

## Decisión de David (2026-11-04): las pestañas

- El frontend nuevo **no** arranca con las 8 pestañas: empieza con **Hoy, Gimnasio y Ajustes**, y el resto detrás de una bandera.
- **La bandera no es excusa para no hacerlas.** Hay que **investigar qué tienen otras apps** y **añadir las pantallas y funcionalidades que merezcan la pena**, con la misma calidad. El agente decide cuáles entran, con la investigación delante (ya está en INVESTIGACION.md).
- Criterio para que una pestaña entre: resuelve una pregunta que el usuario se hace de verdad. Si no, no entra.
- David quiere **más**, no menos: si la competencia tiene algo que aquí falta y aporta, se propone y se añade.

## Ampliación de la tanda (2026-11-04): pantallas que entran

David ha decidido que el frontend nuevo arranca con **Hoy, Gimnasio y Ajustes** y deja el resto detrás de una bandera. **La bandera no es excusa para no hacerlas**: esta sección fija qué pantallas y funciones entran en la tanda, con la investigación de `INVESTIGACION.md` §2 y §8 delante. Las ocho adopciones de §8 entran como tareas en `BACKLOG.md` (T-13 a T-20).

### Visibles desde el primer día

| Pantalla | Qué resuelve |
|---|---|
| **Hoy** | Si hoy toca entrenar o descansar y cómo está el cuerpo: readiness con sus tres componentes, sueño, HRV, Body Battery, FC en reposo, estrés, carga y avisos de la app. |
| **Gimnasio** | Hacer el entrenamiento entero sin salir de la sección: **Entrenar** (sesión en curso y sesión libre), **Rutinas** (lista y editor de plantilla), **Catálogo** (búsqueda y ficha), **Historial** (sesiones y detalle) y la **calculadora de discos** como herramienta dentro de la sesión. |
| **Ajustes** | Vincular Garmin con 2FA, estado de sync, preferencias de unidades y descanso, interruptor de la bandera y borrar cuenta. |

### Detrás de la bandera `VITE_FEATURE_EXTENDED`

| Pantalla | Qué resuelve |
|---|---|
| **Actividades** | Qué actividad fue y con qué detalle (mapa, streams, parciales). |
| **Calendario** | Qué toca cada día de la semana y cómo encaja con las plantillas. |
| **Tendencias** | Cómo evoluciona una métrica en el tiempo. |
| **Rendimiento** | En qué deporte se mejora y dónde se pierde el tiempo (zonas, PRs). |
| **Rutas** | Planificar una salida y exportarla. |
| **Social** | Cómo va el grupo (leaderboard, amigos, invitaciones). |
| **Marcas** | Qué récords personales hay por ejercicio y cuándo se consiguieron. |
| **Progreso** | Cuánto volumen se mueve, qué músculos se atienden y cuáles no, y la racha. |

**Nota sobre la lista de "Fuera de alcance".** La sección `Fuera de alcance (a propósito)` de más arriba sigue valiendo: **la ingesta de Garmin y el backend de rutas, social, calendario, tendencias y rendimiento no se modifican** en esta tanda. Lo que cambia es el **frontend**: esas pantallas pasan a tener tarea en el backlog y se encienden con la bandera cuando se implementen. Si alguna necesita un ajuste de backend, se hace como tarea propia, reversible y anotada en `DECISIONES.md`.

### Reglas de la ampliación

1. **La bandera no es excusa para no hacerlas.** Una pantalla de bandera no es un prototipo a medias: se implementa con la misma calidad que una visible.
2. **Criterio de entrada.** Solo entra lo que **resuelve una pregunta que el usuario se hace de verdad**. Lo que no cumple el criterio se queda fuera y se justifica en `INVESTIGACION.md` §8.2.
3. **Misma calidad y los cuatro estados.** Vacío, cargando, error y sin permiso en todas, visibles y de bandera, igual que exige esta especificación.
4. **Sin decisiones adelantadas.** Lo que sigue siendo Nivel 3 (supersets, offline, envío al reloj, RPE por serie y 1RM) no se implementa ni se da por decidido.

## Decision de coordinacion (2026-11-04, tarde)

- **T-22 (borrado de cuenta)**: autorizado. Texto de confirmación: el usuario
  escribe literalmente `BORRAR MI CUENTA` y se le dice qué se borra (salud,
  sesiones, gimnasio) y qué no (nada, se borra todo lo suyo). Debe cubrir las 5
  tablas del gimnasio.
- **Siguiente por valor**: T-03 (panel Hoy con gráficas de carga) y T-04
  (registrador de sesión con descanso y series).

### Estado de estas decisiones (2026-11-04, noche)

- **T-22 hecha**: el borrado cubre las cinco tablas del gimnasio, la confirmación literal y la
  limpieza de sesión y caché. Probado con dos cuentas en una copia de la BD.
- **T-03 hecha**: panel Hoy completo con la gráfica de carga de 30 días y la curva de Body Battery,
  con estados vacío/carga/error y una prueba para el fallo aislado de la serie de carga.
- **T-13 a T-20**: confirmadas como alcance; todas son Nivel 1/2 y siguen en el backlog.
- **T-21**: pendiente de una tanda de backend (readiness nulo cuando falta biometría).
- **T-04/T-29 hechas**: `Entrenar` con última marca, series corregibles, descanso por hora de fin,
  RPE por serie, borrador que sobrevive a recargar y resumen. La sesión libre (T-13) y guardar como
  plantilla (T-17) quedan como tareas propias.
- **T-26 hecha y T-27 hecha**: agregados de gimnasio/carga y Tendencias con línea, barras, calor,
  dispersión, fases de sueño, monotonía, volumen muscular y comparativa; periodos 7/30/90/año.
- **Reloj**: compatibilidad verificada de la PoC Connect IQ en fr255 (el de David), fr255m, fr265,
  fr965, fenix7, venu3, fr245, fenix6 y venu2; `minSdkVersion 3.3`; fr235 fuera. El envío real sigue
  pendiente de la prueba en su reloj (Nivel 3).

## Ampliación completa del producto (2026-11-04)

`ALCANCE-COMPLETO.md` cambia el producto: **no es un panel de lectura, es una app completa de
entrenamiento** que crea, lleva al reloj, ejecuta y analiza. La investigación previa está en
`INVESTIGACION-AMPLIACION.md` (gráficas y métricas con datos, UI móvil de la competencia con
capturas, y viabilidad real del reloj con fuentes).

### Lo que entra

1. **Datos y gráficas**: línea, barras, área, dispersión, calor/calendario y distribución sobre los
   datos ya ingeridos; **métricas derivadas** (ATL/CTL/TSB, monotonía, tensión, volumen por grupo
   muscular, progresión, 1RM estimado, empuje/tirón, tiempo bajo tensión) con periodos comparables
   (7/30/90/mes/año) y estados vacíos honestos.
2. **Crear entrenamientos**: gimnasio con series, reps, peso, descanso y **RPE**; supersets, drop
   sets y tempo; ejercicios con **dibujo inicio/fin**; correr, bici y natación por objetivos, zonas
   e intervalos; plantillas reutilizables.
3. **Registrar**: según entrenamiento o libre; dos toques por serie; descanso; resumen; guardar como
   plantilla; corrección posterior con recálculo.
4. **El reloj**: llevar ejercicios, pesos y reps al reloj; ejecutar y recuperar lo registrado;
   registrar la mano del reloj. **Connect IQ verificado en este equipo** (SDK 8.3.0 compila para
   fr965), y **API de workouts no oficial** para el camino nativo. Nada se promete sin probarlo en
   el reloj de David.
5. **UI/UX**: móvil primero (se usa en el gimnasio), escritorio para crear y analizar, sobre el
   sistema de diseño existente. Investigación visual con capturas en `research/UI-COMPETENCIA.md`.

### Orden de valor

**T-26/T-27** (datos y gráficas) → **T-29** (registro, ya era T-04) → **T-28** (creación con
dibujos) → **T-31/T-30** (reloj: subir y recuperar) → **T-32** (watch-app) → **T-33** (POC de
detección por movimiento). **T-34** (UI móvil-first) se aplica en cada pantalla que se toque, no como
un rediseño final. El detalle y los criterios de aceptación están en `BACKLOG.md`.

### Reglas que no cambian

- Sin GitHub Actions, sin secretos en git, sin tocar `frontend/` ni `frontend_mvp/`.
- Toda métrica se **mide** o no se muestra; una estimación se etiqueta como estimación.
- Toda promesa sobre el reloj lleva **fuente o prueba**; lo no verificado se dice.
- Las pruebas son de flujo, no de detalle.
