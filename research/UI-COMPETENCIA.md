# UI de la competencia — investigación visual móvil

Fecha: 2026-11-04. Autor: ui-research (task-2). Alcance: **solo lo visual** de la UI móvil; la
investigación funcional ya está en `INVESTIGACION.md` §2 y no se repite. App objetivo: **Garmin
Athletics**, móvil primero, sobre `designs/garmin-athletics-design-system/` (oscurro primero,
Barlow / Barlow Condensed, escala 4 px, AA).

---

## 1. Método

**Herramienta.** `playwright-core` 1.64.1 (ya instalado en `frontend-nuevo`, sin `npm install`) +
Chrome headless en `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`. Contexto:
**viewport 390×844, deviceScaleFactor 2**, UA de Chrome Android 14 móvil, locale `en-US`. Scripts
temporales en `research/` (ya borrados).

**Fuente.** Galería pública del **listado de Google Play** y su visor a pantalla completa: al pulsar
una miniatura el propio listing abre la captura a 312 px de ancho (natural 540–647 px), legible; el
visor y la barra de la tienda salen en la captura porque es una captura de página, no del asset.

**Descartado.** *App Store en web móvil*: miniaturas de 144×312 CSS px y **sin visor**; ilegible
para hablar de tipografía y densidad (sus galerías se enlazan en §5). *Páginas de marketing*
(`hevyapp.com`, `strong.app`, `fitbod.me`, `strava.com`): sirven la UI como vídeo o mockup, no como
captura. *Centros de ayuda* (`support.garmin.com`, `support.strava.com`, `support.google.com`): SPA
sin capturas estáticas en el HTML público. Sin login, sin cuentas premium, sin descargar assets.

**Honestidad de etiqueta.** Las capturas de Google Play son **arte oficial del listing**: un panel
promocional (color + titular) con una pantalla real de la app dentro; se indica cuál es cada cosa.
Las de Apple son **capturas reales de la app** publicadas por el soporte de Apple, sin panel
promocional: las más limpias del lote.

---

## 2. Por app

### 2.1 Garmin Connect — la que hay que batir

**Capturas:** `garmin-connect-01/02/03.png`. La galería pública **no muestra el builder de
entrenamientos ni el registro de fuerza** (ver §6).

- **Home (01).** Header con avatar a la izquierda, campana, título centrado «Home», refrescar y
  anillo de progreso en miniatura a la derecha. «Today's Activity»: icono circular naranja, `6.22 mi`
  grande, `55:15 · 8:53 /mi` y miniatura de mapa. «In Focus»: Sleep Score con `90` héroe,
  «Excellent / Quality», «8h 12m / Duration» y barras multicolor con eje horario. Puntos de
  paginación y «At a Glance · See All».
- **Detalle (02, 03).** «Body Battery»: back + título + «HELP», *pills* de rango (`1d / 7d / 4w /
  1y`) siempre en el mismo sitio, donut con `71`, «Good day» + una frase, `+51 Charged / −29
  Drained` y «Daily Timeline». «Garmin Coach»: tarjeta naranja con `TIME / PACE / AVG HR` y lista
  de sesiones con icono de estado.
- **Color y tipografía.** Fondo casi negro, tarjetas gris muy oscuro, blanco, azul Garmin de acento
  y naranja/ámbar para actividad. Una sola sans; números grandes pero **no condensados ni
  tabulares**.
- **Densidad y gestos.** 2–3 tarjetas por pantalla, mucho aire, scroll largo; ningún gesto visible.
- **Bien:** un número manda en cada tarjeta; gráficos con eje temporal real; cabecera de detalle
  idéntica en todas las pantallas; pills de periodo.
- **Mal:** el registro de fuerza no aparece ni en su propio marketing; 13 tarjetas fijas; el color
  decora gráficos (magenta/azul) sin significado; nada de la home lleva a «entrenar».

### 2.2 Strava — el feed como producto

**Capturas:** `strava-01/02.png` (arte: degradado naranja/negro + titular).

- **Registro (01).** Mapa grande, «Choose a Sport» con **fila de pills circulares** icono+etiqueta,
  «Foot Sports» con lista (`Run`, `Trail Run`) y acción de inicio grande. Oscuro, naranja Strava
  como único acento, iconos lineales grandes.
- **Actividad (02).** «Your Story»: back + título + cerrar; **tres métricas en fila** (`Distance
  14.7 mi`, `Elevation 512 ft`, `Time 1h 30m`) con icono, medalla naranja, foto a ancho completo y
  barra inferior con «Save Session».
- **Bien:** registrar = una pantalla (mapa + deporte + start); la fila de 3 métricas es el patrón
  más escaneable del lote; la foto como contenido principal.
- **Mal:** **no hay UI de series/peso** (coherente con §2.2: la fuerza llega de terceros); el naranja
  compite con el mapa; el arte del listing usa mayúsculas condensadas que no son de la app.

### 2.3 Hevy — el referente de velocidad

**Capturas:** `hevy-01/02/03.png` (arte: panel blanco con titular en mayúsculas).

- **Registro (01).** Tema **claro**. Barra superior `12:30`, título «Log Workout» y **«FINISH» como
  texto a la derecha** (no botón relleno). Metadatos: `1h 15min · 6 800 kg · 18 sets`. Tarjeta de
  ejercicio: nombre + icono, **frase de sugerencia** («Feeling strong today! Next session increase
  the weights…»), «Rest Timer 1m 30s». Cabecera `SET | PREVIOUS | +KG | REPS | ✓` y filas con badge
  cuadrado (`W` calentamiento, `1`, `2`, `3`), `40kg × 40`, input `+`, reps `8` y **checkbox verde
  de 44 px**; serie activa con fondo más claro y borde; «+ Add Set» al pie.
- **Análisis (02).** Ilustración del movimiento, «Squat (Barbell)», «Heaviest Weight» + badge `PR`,
  línea con puntos y **pestañas de métrica** (Heaviest Weight / One Rep Max / Best Volume / # of
  Reps).
- **Empezar (03).** «Workout» con «Quick Start», «+ Start Empty Workout» y «Routines» con buscador;
  tarjeta de rutina con lista truncada y botón `Start Routine`.
- **Bien:** la tabla de series **es** el producto; precarga de «previous»; check grande y de alto
  contraste; fila activa inequívoca; sugerencia contextual en una línea; títulos pequeños, datos
  mandan.
- **Mal:** dos «empezar» (Quick Start vs Start Routine) compiten en la misma pantalla; el descanso
  es un dato más, no el objeto dominante.

### 2.4 Strong — la hoja de cálculo

**Capturas:** `strong-01/02/03.png` (arte: panel oscuro con titular).

- **Registro oscuro (01).** Cabecera «Strong 5/3/1 – Workout A» + **«FINISH» fijo arriba a la
  derecha**; reloj `52:00`; nombre de ejercicio con «…»; nota en una línea; tabla `SET | KG | REPS |
  ✓` con calentamiento gris `W 20 45`, series completadas con **check azul** y **fila activa
  resaltada** con `82.5`; «+ Add Set».
- **Registro claro (02).** Toggles `TARGET REP RANGE` / `WARM-UP SETS`; **stepper grande de peso
  abajo** (`82.5 kg` + `Done`) y rest timer con barra roja `1:30` pegado al borde inferior.
- **Detalle (03).** Back + nombre + «…»; tabs `ABOUT | HISTORY | CHARTS | RECORDS`; ilustración del
  movimiento; **callout amarillo** de consejo; metadatos con chevron (Body part, Category,
  Preferences, Rest Timer Settings).
- **Bien:** la tabla literal; unidad siempre visible; edición en la celda con stepper grande; FINISH
  siempre en el mismo sitio; micro-etiquetas en mayúsculas.
- **Mal:** cabecera de tabla en gris que roza el límite AA; el timer tapa la tabla; sin color
  semántico más allá del check; dos temas a medias entre capturas.

### 2.5 Fitbod — la sesión generada

**Capturas:** `fitbod-01/02/03.png` (arte: panel oscuro con titular).

- **Plan (01).** «My Plan» con pill `Push Day` + `Swap`; `7 Exercises · 5 Muscles`; `45m` y `Large
  Gym`; lista con **miniatura cuadrada + nombre + `3 Sets × 12 Reps × 30 lbs`** y chevron.
- **Mapa muscular (02).** Muñeco anatómico con grupos en rojo sobre negro; debajo `3 DAYS SINCE
  YOUR LAST WORKOUT` y `5 FRESH MUSCLE GROUPS`.
- **Registro (03).** «Back Squat» con ilustración, `Rest Timer On`, `History`, `Replace`; filas
  `Set 1…4` con checkbox, **peso y reps en dos columnas grandes** y «+ Add Set».
- **Bien:** **el mapa muscular como firma visual** (responde «qué me falta» sin leer); miniaturas
  por ejercicio; steppers grandes.
- **Mal:** el plan ocupa la home entera (no hay «empezar rápido»); contraste bajo en metadatos;
  tarjetas apiladas con bordes tenues que se confunden; el usuario no diseña, solo acepta.

### 2.6 Apple Fitness — el mejor panel del día

**Capturas:** `apple-fitness-01/02/03.png`, de la **guía oficial de soporte de Apple** (capturas
reales de la app, sin panel promocional).

- **Resumen (01).** «Summary» grande; **anillos** Move/Exercise/Stand con cifras; dos tarjetas
  medianas (Step Count `2,210`, Step Distance `2.77mi`) con icono y «Today»; tarjeta Fitness+ a
  ancho completo; tab bar de 3 iconos con **verde brillante sobre negro**.
- **Entrenar (02).** Lista de tipos de entrenamiento (Outdoor Walk, Rowing, Functional Strength
  Training) en tarjetas oscuras con icono y **botón play verde**.
- **Compartir (03).** Anillos sociales y amigos con porcentaje y anillos mini.
- **Bien:** un héroe (anillos) + tarjetas de una idea; **acento único y semántico**; explicación en
  lugar de ceros; separación día/tendencia; radios grandes. Su hoja de meta («Change Move Goal», una
  frase de explicación y `800` con `+/−`) es el mejor ejemplo de estado explicativo del lote.
- **Mal:** **no existe registro de fuerza** (ni series ni peso): ahí no hay patrón que copiar.

### 2.7 Fitbit / Google Health — el panel más legible

**Capturas:** `fitbit-01.png` (el listing abre con **vídeo**, por eso solo una pantalla).

- **Today (01).** Anillo grande `58%` con tres tiles compactos (`8,532 steps`, `Readiness 89`,
  `7h 54m Sleep`); tarjeta de **micro-coaching** en una frase; sesión del día (`Trail Run · 0.2 mi ·
  23:46 · 435 cal`); «Your day so far» con anillos; tab bar de 4 (`Today · Fitness · Sleep ·
  Health`). Negro, tarjetas redondeadas, azul/verde/ámbar semánticos.
- **Bien:** readiness + 3 tiles = el panel se lee en 3 segundos; micro-coaching contextual; color
  con significado.
- **Mal:** cero estructura de fuerza; pestañas que cambian cada pocos años; IA impuesta en el texto.

---

## 3. Tabla comparativa de patrones visuales

| Patrón visual | Garmin Connect | Strava | Hevy | Strong | Fitbod | Apple Fitness | Fitbit |
|---|---|---|---|---|---|---|---|
| Tema por defecto | Oscuro | Oscuro | **Claro** | Oscuro/Claro | Oscuro | Oscuro | Oscuro |
| Acento | Azul + naranja | Naranja | Azul/verde | Azul | Rojo | **Verde semántico** | Azul/verde/ámbar |
| Números | Grandes, sans | Grandes | Medianos, tabla | **Tabulares en tabla** | Grandes | Grandes, SF | Grandes |
| Tipografía | 1 familia | 1 familia | 1 familia | 1 familia | 1 familia | 1 familia | 1 familia |
| Tarjetas | 2–3 por pantalla | Mapa a pantalla | 1 tarjeta = 1 ejercicio | Tabla | Lista + miniaturas | 3–4 | 1 héroe + 3 tiles |
| Registro de serie | No visible | No existe | **Tabla 5 columnas + check** | **Tabla 4 columnas + check** | Filas set/peso/reps | No existe | No existe |
| Precarga anterior | No | No | **Sí (`previous`)** | Sí | Sugiere | n/a | n/a |
| Descanso | En el reloj | No | Timer en tarjeta | **Barra inferior** | Toggle + timer | No | No |
| Navegación | 5 pestañas + «Más» | 1 pantalla registro | Tab bar + quick start | Tab bar + FINISH | Tab bar | 3 pestañas | 4 pestañas |
| Estado vacío | Cero | — | Frase guía | — | — | **Explica el requisito** | Coaching |
| Densidad | Baja | Baja | **Alta** | **Alta** | Media | Media | Media |

Lectura: **oscuro es la norma** (5 de 7); nadie usa más de una familia; los dos que ganan en el
gimnasio (Hevy, Strong) son los de **mayor densidad** y los únicos con **tabla de series**; Apple y
Fitbit ganan en panel del día, no en registro.

---

## 4. Qué adoptamos para Carga

Todas las decisiones usan tokens existentes (`project/tokens.json`); ninguna inventa valores.

1. **Oscuro primero.** `bg #0A0E13` en todas las pantallas, `surface #111823` para tarjetas. Norma
   del mercado (5 de 7) y ya es nuestro tema primario.
2. **Una cifra héroe por pantalla** en Barlow Condensed 700 48/48 tabular: readiness en *Hoy*,
   tonelaje en la sesión. Garmin, Fitbit y Apple demuestran que un número grande basta; el resto va
   en `heading` 18/24.
3. **La tabla de series es el componente central** (no una tarjeta más): `SERIE · ANTERIOR · KG ·
   REPS · ✓`, cabecera `caption` 12 px en mayúsculas, cifras tabulares, fila activa con
   `accent-soft` + borde `accent`. De Hevy y Strong, los dos que ganan por velocidad.
4. **Última marca precargada** en `ink-faint` dentro de `ANTERIOR`, unidad en `caption`. Es el fallo
   F2 de Garmin y la ventaja real de Hevy/Strong.
5. **Check de 44×44 px por serie** que completa y arranca el descanso en el mismo toque («2-tap
   logging»), con `success` como único color positivo.
6. **FINISH / Guardar siempre arriba a la derecha** del header; la acción primaria del pulgar
   (Añadir serie / Empezar) abajo, 48 px de alto.
7. **El descanso es una barra fija sobre la tabla, no un modal**: `hero` con el tiempo, anillo
   `radius-full`, borde superior, y nunca tapa la fila activa (el error de Strong 02). En escritorio,
   barra lateral.
8. **Densidad de gimnasio**: 4 filas de serie visibles a 400 px, gutter 16 (`space-4`), sin scroll
   horizontal, `space-3` entre filas y objetivos nunca por debajo de 44 px.
9. **Color con significado**: `accent` para marca/navegación/foco; `success`, `warn`, `danger` solo
   con palabra al lado (readiness VERDE/AMARILLO/ROJO). Fuera el color libre de Garmin y el rojo de
   Fitbod; dentro la disciplina de Apple.
10. **Estados vacíos que explican el requisito**, no un cero: «sin dato», «faltan 3 sesiones para la
    tendencia», con origen y frescura («sincronizado hace 2 min»). Patrón Apple/Fitbit.
11. **Navegación plana de 3 pestañas** (`Hoy · Gimnasio · Ajustes`), icono lucide 24 px + etiqueta
    `caption`; lo que no copiamos es justo lo de Garmin/Fitbit (5 pestañas con «Más» de cajón).
12. **Tarjeta = una idea** (`StatCard`): etiqueta `caption`, cifra, unidad, delta y una frase,
    padding 16, radio 10, hairline `line` solo como separador. Sin tablas dentro de tarjetas en el
    panel del día.

**Lo que no adoptamos:** arte promocional dentro de la app (Garmin/Strava), feed social como
pantalla principal (Hevy), el plan generado que sustituye al editor (Fitbod), el muro de suscripción
(Strong/Fitbod), la IA impuesta (Fitbit) y el cero como estado vacío (Garmin).

---

## 5. Capturas

Todas: **390×844 CSS px, DSF 2** (PNG 780×1688), Chrome headless, 2026-11-04. Ruta base
`research/capturas/`.

| Archivo | Qué se ve | Fuente (URL de origen) | Tipo |
|---|---|---|---|
| `garmin-connect-01.png` | Home: Today's Activity, Sleep Score, At a Glance | [Play · Garmin Connect](https://play.google.com/store/apps/details?id=com.garmin.android.apps.connectmobile&hl=en&gl=US) | Arte del listing + pantalla real |
| `garmin-connect-02.png` | Body Battery: pills de rango, donut 71, timeline | [Fuente oficial](https://play.google.com/store/apps/details?id=com.garmin.android.apps.connectmobile&hl=en&gl=US) | Arte + pantalla real |
| `garmin-connect-03.png` | Garmin Coach: sesiones y tarjeta de actividad | [Fuente oficial](https://play.google.com/store/apps/details?id=com.garmin.android.apps.connectmobile&hl=en&gl=US) | Arte + pantalla real |
| `strava-01.png` | Registro: mapa, selector de deporte, Foot Sports | [Play · Strava](https://play.google.com/store/apps/details?id=com.strava&hl=en&gl=US) | Arte + pantalla real |
| `strava-02.png` | Actividad: 3 métricas en fila, medalla, foto | [Fuente oficial](https://play.google.com/store/apps/details?id=com.strava&hl=en&gl=US) | Arte + pantalla real |
| `hevy-01.png` | Registro: tabla de series con check y Rest Timer | [Play · Hevy](https://play.google.com/store/apps/details?id=com.hevy&hl=en&gl=US) | Arte + pantalla real |
| `hevy-02.png` | Análisis: Heaviest Weight, PR, pestañas de métrica | [Fuente oficial](https://play.google.com/store/apps/details?id=com.hevy&hl=en&gl=US) | Arte + pantalla real |
| `hevy-03.png` | Workout: Quick Start, rutinas, Start Routine | [Fuente oficial](https://play.google.com/store/apps/details?id=com.hevy&hl=en&gl=US) | Arte + pantalla real |
| `strong-01.png` | Registro oscuro: tabla, fila activa azul, FINISH | [Play · Strong](https://play.google.com/store/apps/details?id=io.strongapp.strong&hl=en&gl=US) | Arte + pantalla real |
| `strong-02.png` | Registro claro: stepper de peso, rest timer abajo | [Fuente oficial](https://play.google.com/store/apps/details?id=io.strongapp.strong&hl=en&gl=US) | Arte + pantalla real |
| `strong-03.png` | Detalle de ejercicio: tabs, callout, metadatos | [Fuente oficial](https://play.google.com/store/apps/details?id=io.strongapp.strong&hl=en&gl=US) | Arte + pantalla real |
| `fitbod-01.png` | My Plan: ejercicios con sets×reps×peso | [Play · Fitbod](https://play.google.com/store/apps/details?id=com.fitbod.fitbod&hl=en&gl=US) | Arte + pantalla real |
| `fitbod-02.png` | Mapa muscular y grupos frescos | [Fuente oficial](https://play.google.com/store/apps/details?id=com.fitbod.fitbod&hl=en&gl=US) | Arte + pantalla real |
| `fitbod-03.png` | Registro: set/peso/reps, Rest Timer On, Replace | [Fuente oficial](https://play.google.com/store/apps/details?id=com.fitbod.fitbod&hl=en&gl=US) | Arte + pantalla real |
| `apple-fitness-01.png` | Summary: anillos, tarjetas, tab bar verde | [Apple Support · Fitness en iPhone](https://support.apple.com/guide/iphone/get-started-with-fitness-ipha5dddb411/ios) | Captura real de la app |
| `apple-fitness-02.png` | Entrenar: tipos de entreno con play verde | [Fuente oficial](https://support.apple.com/guide/iphone/get-started-with-fitness-ipha5dddb411/ios) | Captura real de la app |
| `apple-fitness-03.png` | Sharing: anillos sociales y amigos | [Fuente oficial](https://support.apple.com/guide/iphone/get-started-with-fitness-ipha5dddb411/ios) | Captura real de la app |
| `fitbit-01.png` | Today (Google Health): readiness, tiles, coaching | [Play · Fitbit](https://play.google.com/store/apps/details?id=com.fitbit.FitbitMobile&hl=en&gl=US) | Arte + pantalla real |

**Nota de uso.** Son capturas de **páginas públicas** de los fabricantes y de las tiendas, hechas
para **investigación interna** de diseño. No se redistribuyen como assets del producto, no se
recortan para usarlas en la app y no se copia ningún símbolo ni logotipo ajeno (coherente con la
regla de iconografía del sistema de diseño).

**Galerías oficiales de referencia** (resto de pantallas sin capturar):
[Garmin Connect](https://apps.apple.com/us/app/garmin-connect/id583446403) ·
[Strava](https://apps.apple.com/us/app/strava-run-bike-walk/id426826309) ·
[Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350) ·
[Strong](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) ·
[Fitbod](https://apps.apple.com/us/app/fitbod-workout-gym-planner/id1041517543) ·
[Fitbit](https://apps.apple.com/us/app/fitbit-health-fitness/id462638897)

---

## 6. Limitaciones (lo que NO se pudo capturar)

1. **Garmin Connect — builder y registro de fuerza.** No están en la galería pública de ninguna
   tienda ni en soporte estático; requieren la app con login. Las 3 capturas cubren el panel del día
   y detalles, **no** el flujo de fuerza. No se describe esa pantalla a partir de capturas: lo
   funcional está en `INVESTIGACION.md` §2.1 y aquí no se inventa lo visual.
2. **Strava — registro de fuerza con series.** No existe pantalla pública; solo aparece cuando un
   partner envía los datos (§2.2). Las 2 capturas son de cardio y de resumen de actividad.
3. **Fitbit — una sola pantalla.** El listing abre con **vídeo** y solo deja una captura fija
   accesible; las pestañas Fitness/Sleep/Health no se pudieron capturar.
4. **App Store descartada** como fuente (miniaturas de 144 px, sin visor en web); sus galerías se
   enlazan arriba. La precisión es limitada porque el arte promocional puede alterar el encuadre: las
   afirmaciones se limitan a lo que se ve en la captura.
5. **Nada de cuentas, precios ni funciones premium**: el informe es visual; precios y límites están
   en `INVESTIGACION.md` §2.8 y no se repiten.
