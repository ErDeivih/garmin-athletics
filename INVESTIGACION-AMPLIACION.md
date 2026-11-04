# INVESTIGACION-AMPLIACION.md — app completa de entrenamiento

**Fecha**: 2026-11-04 · **Rama**: `master` · **Alcance**: `ALCANCE-COMPLETO.md`

Este documento responde a las tres preguntas que David puso antes de seguir: **qué gráficas y
métricas merecen la pena y con qué datos salen**, **cómo es la UI móvil de la competencia** y **qué
se puede hacer de verdad con el reloj**. Nada de lo que aparece aquí se ha copiado de una web sin
citarla. Lo que no se ha podido verificar se dice: **no se promete**.

Método:

1. **Backend leído y ejecutado** (endpoints, modelos y respuestas reales de `INVESTIGACION.md` §4).
2. **SDK de Connect IQ inspeccionado y usado** en este equipo: versión, perfiles de dispositivo,
   permisos, APIs y **dos compilaciones reales** para el Forerunner 965.
3. **Librería `garminconnect` instalada** (versión 0.3.11) inspeccionada: qué puede subir, qué
   puede leer de vuelta y qué endpoints usa. Es un cliente **no oficial**.
4. **Literatura científica** sobre conteo de repeticiones con IMU, citada al final.
5. **UI móvil de la competencia**: capturas y análisis en `research/UI-COMPETENCIA.md`, resumido
   aquí en §2.

**La regla de honestidad**: cada métrica se calcula con datos medidos y una fórmula escrita; si falta
el dato, se enseña un vacío que explica qué falta. Ninguna gráfica rellena huecos con ceros ni
interpola.

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta corta |
|---|---|
| ¿Se pueden hacer todas las gráficas del alcance? | **Casi todas con los datos que ya hay.** Faltan tres agregados de gimnasio y dos campos (tempo y RPE por serie). Se proponen endpoints nuevos, no un rediseño. |
| ¿Se pueden calcular las métricas derivadas? | ATL/CTL/TSB ya existen; monotonía, tensión, volumen por músculo, progresión y 1RM se pueden calcular. Empuje/tirón necesita clasificar el ejercicio; tiempo bajo tensión necesita tempo. |
| ¿Se puede llevar el entrenamiento al reloj? | **Sí, por dos caminos reales**: (a) subir el entrenamiento a Garmin Connect con la API **no oficial** que ya usa el backend (hoy solo en `dry_run`), y (b) una app Connect IQ propia. El camino (a) es el que pone ejercicios, series, pesos y reps en el reloj nativo. |
| ¿Se puede recibir de vuelta lo que se hace en el reloj? | **Sí**, la API no oficial tiene `get_activity_exercise_sets`: devuelve las series de una actividad de fuerza de Garmin. Falta probarlo con la cuenta real de David. |
| ¿Se puede detectar la repetición por movimiento? | **Sí, con matices**: hay papers con 83–87 % de acierto en condiciones controladas y sensores concretos; no es fiable "para cualquier ejercicio" sin modelo y calibración. Se propone un POC medido, no una promesa. |
| ¿Se puede saber en qué mano está el reloj? | **No por API**: el SDK 8.3.0 no expone la muñeca. Se pregunta una vez y se guarda (ajuste del atleta). |
| ¿Qué es lo primero? | Métricas y gráficas (§1), luego el registro de sesión, la creación y por último el reloj. |

---

## 1. Datos y gráficas

### 1.1 Qué datos hay ya (verificado contra la API)

| Dato | Endpoint / campo | Granularidad | Estado |
|---|---|---|---|
| Readiness | `/metrics/daily` → `readiness{score,status,components}` | día | **real**, pero el backend rellena valores por defecto si falta biometría (T-21) |
| Sueño | `daily.sleep{score,hours,deep_seconds,light_seconds,rem_seconds,awake_seconds,efficiency,bedtime,wakeup}` | noche | real; campos nulos si Garmin no los trae |
| HRV | `daily.hrv{overnight,weekly_avg,status,avg_7d}` | noche | real |
| FC en reposo | `daily.resting_hr`, `resting_hr_7d` | día | real |
| Body Battery | `daily.body_battery{max,min,wake,curve:[[ts_ms,valor]]}` | día, curva | real |
| Estrés | `daily.stress_avg` | día | real |
| Carga | `/metrics/load?days` → `series[{date,atl,ctl,tsb,tss}]` | día | real (Banister) |
| Tendencias | `/metrics/trends?metric&days` (7 métricas) | día | real; ventana máx. 90 días |
| Movimiento | `/metrics/stats?days` → pasos, calorías, distancia, intensidad, pisos | día | real |
| Estado Garmin | `/metrics/training-status` → VO2max, estado, predicciones | snapshot | real pero **depende de la última sincronización** |
| Avisos | `/alerts/` | día | real |
| Actividades | `/activities/` + detalle + `/streams` + `/splits` | actividad | real; `streams` puede tardar si descarga de Garmin |
| Rendimiento | `/performance/summary`, `/zones`, `/prs` | periodo | real (running/zonas; PRs de Garmin) |
| Gimnasio | `/strength/sessions` + detalle con series (`weight_kg`, `reps`, `rir`, `set_type`, `rest_seconds`, `completed_at`) | serie | real desde T-01 |
| Plantillas | `/strength/templates` con `sets/reps/weight/rest` | ejercicio | real |
| Historial por ejercicio | `/strength/exercises/{id}/history` → `series[{date,max_weight_kg,best_reps,tonnage_kg}]` | sesión | real |
| Última marca | `/strength/last-marks?exercise_ids=` | serie | real |
| Catálogo | `/strength/exercises` (52 semilla + propios), con `muscle_group`, `equipment` | ejercicio | real |
| Calendario | `/calendar/?from&to` (≤120 días) → eventos, actividades, readiness | día | real |

**El límite hoy no son los datos, son los agregados**: el gimnasio guarda series individuales pero no
hay un endpoint que las agrupe por músculo, semana o ejercicio. Eso se resuelve con SQL en el
servidor (§1.5), no trayendo todo al cliente.

### 1.2 Catálogo de gráficas que merecen la pena

La pregunta manda: cada gráfica resuelve una pregunta que el atleta se hace. Si no, no entra.

| # | Gráfica | Tipo | Pregunta que responde | Datos | Pantalla |
|---|---|---|---|---|---|
| 1 | Readiness + 3 componentes | héroe + barras apiladas | ¿Puedo apretar hoy? | `daily.readiness` | Hoy |
| 2 | Fases de sueño por noche | barras apiladas / área | ¿Duermo suficiente y de calidad? | `sleep.*_seconds` | Hoy / Tendencias |
| 3 | HRV con banda de 7 días | línea + banda | ¿Mi HRV está fuera de mi media? | `hrv`, `avg_7d` | Horas / Tendencias |
| 4 | Body Battery del día | área | ¿Cómo he llegado de energía a la tarde? | `body_battery.curve` | Hoy |
| 5 | Carga ATL/CTL + TSB | línea + área | ¿Estoy acumulando fatiga o forma? | `/metrics/load` | Hoy / Tendencias |
| 6 | TSS diario y semanal | barras | ¿Cuánto he cargado esta semana? | `load.series[].tss` | Tendencias |
| 7 | Monotonía y tensión | línea + barras | ¿El entreno es demasiado monótono? | TSS diario (cálculo) | Tendencias |
| 8 | Calendario de actividad | calor (día × carga) | ¿Soy constante? ¿Qué días entreno? | `load` + actividades | Tendencias / Calendario |
| 9 | Zonas de FC | barras apiladas / donut | ¿Entreno en la zona que quiero? | `/performance/zones` | Rendimiento |
| 10 | Volumen por grupo muscular | barras horizontales | ¿Qué músculos he descuidado? | series + catálogo (nuevo agregado) | Progreso |
| 11 | Series por semana y frecuencia | barras + línea | ¿Cuánto y cuántos días? | sesiones (nuevo agregado) | Progreso |
| 12 | Progresión de fuerza por ejercicio | línea + puntos PR | ¿Estoy progresando? | `/strength/exercises/{id}/history` | Historial |
| 13 | 1RM estimado | línea (solo series 1-12) | ¿Cuál es mi techo estimado? | series (Epley) | Historial |
| 14 | Empuje/tirón | barras por semana | ¿Estoy equilibrado? | series + patrón de movimiento (nuevo) | Progreso |
| 15 | Tiempo bajo tensión | barras | ¿Cuánto tiempo trabaja el músculo? | series + tempo (nuevo campo) | Progreso |
| 16 | Ritmo vs FC (carrera) | dispersión | ¿A qué pulso corro cada ritmo? | `/activities/{id}/streams` | Actividad |
| 17 | Zonas + parciales de una salida | línea + barras | ¿Dónde se me fue la carrera? | `streams`, `splits` | Actividad |
| 18 | Pasos / calorías / intensidad | líneas y barras | ¿Me muevo fuera del gimnasio? | `/metrics/stats` | Tendencias |
| 19 | Readiness vs carga | dispersión | ¿Cómo responde mi cuerpo a la carga? | `daily` + `load` | Tendencias (avanzado) |
| 20 | Comparativa periodo actual vs anterior | barras dobles | ¿Mejor o peor que el mes pasado? | `/performance/summary`, agregados | Todas |

Descartadas de momento: mapa de calor corporal por músculo (necesita dibujo anatómico propio y
mapeo fino; se puede hacer más adelante con los SVG de §3), y composición corporal (el backend no
ingiere peso ni grasa; sería otra fuente de datos).

### 1.3 Métricas derivadas: fórmula, dato y qué falta

| Métrica | Fórmula / definición | Dato necesario | ¿Disponible? | Nota de honestidad |
|---|---|---|---|---|
| ATL / CTL / TSB | media exponencial de TSS (ya implementada) | TSS diario | **sí** (`/metrics/load`) | Es la base de todo lo demás |
| Monotonía | media(TSS 7 d) / desviación típica(TSS 7 d) | TSS diario | **sí** (calcular en servidor o cliente con la serie) | Si la desviación es 0, no se muestra (indefinido) |
| Tensión (strain) | TSS semanal × monotonía | TSS diario | **sí** | Mostrar con la semana cerrada, no a mitad |
| Volumen por grupo muscular | Σ(peso × reps) por `muscle_group` del ejercicio | series + catálogo | **falta agregado** (T-26) | Atribuir solo al músculo principal; los secundarios no se duplican |
| Series por grupo / frecuencia | COUNT(series) y días distintos por semana | sesiones + catálogo | **falta agregado** | Distinguir series de trabajo de calentamiento |
| Progresión de fuerza | máx. peso, mejor reps, tonelaje por sesión | historial por ejercicio | **sí** (`/strength/exercises/{id}/history`) | No mezclar ejercicios distintos aunque compartan nombre |
| 1RM estimado (Epley) | peso × (1 + reps/30), solo reps 1-12 | serie individual | **sí** (calcular) | Es una **estimación**, se etiqueta como tal; no se muestra con reps >12 ni en series al fallo sin aviso |
| 1RM de Garmin | `get_one_rep_max` (API no oficial) | cuenta Garmin | **no ingerido** (versión instalada 0.3.11 no lo trae) | Alternativa: calcular el nuestro y comparar cuando se pueda |
| Empuje/tirón | Σ volumen empuje / Σ volumen tirón | series + patrón de movimiento | **falta el patrón** | El catálogo actual solo tiene grupo muscular; proponer columna `movement_pattern` (push/pull/legs/core) y semilla |
| Tiempo bajo tensión | Σ reps × (excéntrica + pausa + concéntrica) | tempo por serie/ejercicio | **falta tempo** | Sin tempo no se inventa: se muestra vacío "necesita tempo" hasta que el editor lo capture |
| RPE de sesión (carga) | RPE × duración (Foster) | RPE de la sesión | parcial: `Activity.rpe` existe en actividades; las series de gimnasio solo tienen `rir` | Proponer `rpe` por serie además de `rir` en T-04 |
| ACWR | ATL / CTL | carga | **sí** (`training-status.acwr`) | Mostrar como referencia, nunca como diagnóstico |
| Sueño de 7 días | media móvil de score/horas | biometría | **sí** (`sleep.avg_7d`) | Ya está |
| Zonas de FC | tiempo por zona | actividades | **sí** | Ya está |

**Nota sobre 1RM**: la fórmula de Epley es una convención; no es una medición. Se muestra como
"estimado", solo con series de ≤12 repeticiones y con la fórmula a la vista en la ficha. Para
"marca personal" se usa el peso real levantado, no la estimación.

### 1.4 Periodos, comparaciones y estados vacíos

- Periodos: **7 / 30 / 90 días, mes natural y año** cuando el endpoint lo permita. Hoy
  `trends` limita a 90 días, `load` a 180, `stats` a 180 y `calendar` a 120: para "año" hace falta
  ampliar esos límites o agregar por semana/mes en servidor (T-26).
- Comparación: periodo actual vs anterior con la misma duración y el mismo deporte; el backend ya
  devuelve `current`/`previous` en `/performance/summary`.
- Ventana incompleta: la semana actual se marca como "en curso" y no se compara con una semana
  cerrada sin avisar.
- **Estados**: vacío (explica qué falta y qué hacer), cargando (silueta), error (mensaje en español y
  reintento), sin permiso (403). Una serie con menos de 2 puntos no dibuja línea: se muestra el
  número y "faltan datos para la tendencia".
- Los datos actuales están **parados desde 2026-09-19** (`INVESTIGACION.md` §4.3): las pantallas
  deben verse bien con ese vacío; las capturas de esta investigación usan una copia con datos.

### 1.5 Lo que hay que construir en el backend (propuesta)

| # | Hueco | Propuesta | Nivel | Reversible |
|---|---|---|---|---|
| P1 | No hay agregados de gimnasio | `GET /strength/stats?from&to&group_by=muscle` (o `week` / `exercise`) con volumen, series, frecuencia y progresión; SQL con joins, paginado | 2 | sí, endpoint nuevo |
| P2 | El ejercicio no dice si es empuje o tirón | columna `movement_pattern` nullable + semilla para los 52 + edición en ejercicios propios | 2 | sí, migración aditiva |
| P3 | No hay tempo ni RPE por serie | `tempo` (p. ej. `"3-1-2-0"`) y `rpe` nullable en `template_exercises` y `session_sets`; el editor de T-04/T-05 los captura | 2 | sí, columnas nuevas |
| P4 | Tendencias y carga limitadas a 90/180 días | ampliar a 365 días o agregación semanal/mensual en el mismo endpoint | 1 | sí |
| P5 | Readiness inventado sin biometría | T-21: `readiness: null` + `biometrics_available` y la UI deja de pintarlo | 2 | sí |
| P6 | Series de fuerza de Garmin no se ingieren | job/sync que llame a `get_activity_exercise_sets` y guarde las series enlazadas a la actividad | 2 | sí, con deduplicación por `activity_id` |
| P7 | `streams` puede descargar de Garmin en cada apertura | cachear el detalle/track al sincronizar y devolver `cached: true/false` | 1 | sí |
| P8 | Índices que faltan | `session_sets(exercise_id)`, `workout_sessions(user_id, started_at)`, `daily_biometrics(user_id,date)`, `activities(user_id,start_time)` | 1 | sí |

### 1.6 Gráficas fuera del alcance actual

- Peso corporal, composición, SpO2, nutrición: el backend no los ingiere. Si entran, primero se
  ingieren **de verdad** y luego se pintan; no se dibuja una serie de un dato que no existe.
- Mapa muscular anatómico: necesita assets propios (dibujos) y mapeo ejercicio → músculo; llega con
  T-28 (dibujos de ejercicio) y el agregado P1.

---

## 2. UI móvil de la competencia

Investigación visual completa en **`research/UI-COMPETENCIA.md`** (275 líneas, 18 capturas). Aquí va
lo que cambia nuestras decisiones.

**Método.** `playwright-core` 1.64.1 (ya instalado) + Chrome headless, viewport **390×844 DSF 2**,
UA de Chrome Android, sin instalar nada ni usar cuentas. Fuente: galería pública del **listado de
Google Play** y su visor (captura de página: el arte promocional y la pantalla real conviven en el
mismo PNG, y se etiqueta cuál es cada cosa); **Apple Fitness** desde la guía oficial de soporte de
Apple (capturas reales de la app, sin arte). *App Store web* se descartó: miniaturas de 144 px sin
visor. No se inventó ninguna pantalla: lo que no se pudo capturar se dice en §6 del informe.

### 2.1 Lo que enseña cada app (solo visual)

| App | Patrón que destaca | Lo que no copiamos |
|---|---|---|
| **Garmin Connect** | Un número manda por tarjeta; cabecera de detalle idéntica siempre; *pills* de periodo (`1d/7d/4w/1y`) en el mismo sitio; gráficos con eje temporal real | 13 tarjetas fijas; azul/naranja decorando gráficos sin significado; la home no lleva a entrenar; el builder/registro de fuerza no está ni en su marketing público |
| **Strava** | Registrar = una pantalla (mapa + deporte + start); **fila de 3 métricas** muy escaneable; acción principal grande y única | No hay UI de series/peso; el mapa y el naranja compiten por la atención |
| **Hevy** | **La tabla de series es el producto**: `SERIE · ANTERIOR · KG · REPS · ✓`; anterior precargada; check de 44 px que completa y arranca descanso; fila activa inequívoca; sugerencia contextual en una línea | Tema claro por defecto (aquí el gimnasio oscuro gana); dos «empezar» compiten en la misma pantalla |
| **Strong** | Tabla literal con cifras tabulares; **stepper grande** de peso; FINISH siempre arriba a la derecha; timer pegado al borde inferior | Header de tabla con contraste justo; el timer tapa la tabla; dos temas a medias |
| **Fitbod** | **Mapa muscular** como firma visual («qué me falta» sin leer); miniaturas por ejercicio; set/peso/reps en columnas grandes | El plan generado sustituye al editor; contraste bajo; el usuario no diseña |
| **Apple Fitness** | Un héroe (anillos) + tarjetas de una idea; **acento único y semántico**; estados vacíos que explican el requisito; separación día/tendencia | No existe registro de fuerza: ahí no hay patrón que copiar |
| **Fitbit / Google Health** | Readiness + 3 *tiles* = panel leído en 3 segundos; micro-coaching en una frase; color con significado | Cero estructura de fuerza; pestañas que cambian cada pocos años; IA impuesta |

Lectura transversal: **oscuro es la norma (5 de 7)**; nadie usa más de una familia tipográfica; los
dos que ganan en el gimnasio (**Hevy, Strong**) son los de **mayor densidad** y los únicos con
**tabla de series**; Apple/Fitbit ganan en el panel del día, no en el registro.

### 2.2 Decisiones de UI que adoptamos (todas con tokens existentes)

1. **Oscuro primero** (`bg`, `surface`); una **cifra héroe** por pantalla en Barlow Condensed 48/48
   tabular (readiness en Hoy, tonelaje en la sesión).
2. **La tabla de series es el componente central**, no una tarjeta: `SERIE · ANTERIOR · KG · REPS ·
   ✓`, cabecera `caption` 12 px en mayúsculas, cifras tabulares, fila activa `accent-soft` + borde
   `accent`.
3. **Última marca precargada** en `ink-faint` dentro de `ANTERIOR`, unidad en `caption` (el fallo F2
   de Garmin y la ventaja de Hevy/Strong).
4. **Check de 44×44 px** que completa la serie y arranca el descanso en el mismo toque.
5. **FINISH/Guardar siempre arriba a la derecha**; la acción del pulgar (añadir serie/empezar) abajo,
   48 px.
6. **El descanso es una barra fija** sobre la tabla con el tiempo en `hero` y anillo `radius-full`;
   nunca tapa la fila activa (error de Strong).
7. **Densidad de gimnasio**: 4 filas visibles a 400 px, gutter `space-4`, `space-3` entre filas, sin
   scroll horizontal y objetivos ≥44 px.
8. **Color con significado**: `accent` solo marca/navegación/foco; `success/warn/danger` siempre con
   palabra (VERDE/AMARILLO/ROJO); fuera el color libre de Garmin y el rojo de Fitbod.
9. **Estados vacíos que explican el requisito** y la frescura («faltan 3 sesiones», «sincronizado
   hace 2 min»), nunca un cero.
10. **Navegación plana de 3 pestañas** (Hoy · Gimnasio · Ajustes) con icono lucide 24 + etiqueta
    `caption`; sin «Más» de cajón.
11. **Tarjeta = una idea** (`StatCard`: etiqueta, cifra, unidad, delta, frase); sin tablas dentro de
    tarjetas en el panel del día.
12. **Móvil primero de verdad**: 390–400 px es la referencia de cada pantalla; el escritorio añade
    columnas y barra lateral, no estira el móvil.

### 2.3 Capturas (18 PNG reales, 390×844 DSF 2)

Ruta base `research/capturas/`. Todas las URLs y el tipo (arte del listing vs captura real) están en
`research/UI-COMPETENCIA.md` §5.

| App | Archivos | Fuente |
|---|---|---|
| Garmin Connect | `garmin-connect-01/02/03.png` | Google Play (arte + pantalla real) |
| Strava | `strava-01/02.png` | Google Play |
| Hevy | `hevy-01/02/03.png` | Google Play |
| Strong | `strong-01/02/03.png` | Google Play |
| Fitbod | `fitbod-01/02/03.png` | Google Play |
| Apple Fitness | `apple-fitness-01/02/03.png` | Guía oficial de soporte de Apple (captura real) |
| Fitbit / Google Health | `fitbit-01.png` | Google Play (el listing abre con vídeo) |

**Nota de uso**: son capturas de páginas públicas para **investigación interna** de diseño; no se
redistribuyen como assets del producto ni se copian símbolos ajenos.

### 2.4 Lo que no se pudo capturar (y no se inventa)

1. **Garmin Connect builder/registro de fuerza**: no está en galerías ni soporte estático y requiere
   login. Las capturas cubren el panel del día, no el flujo de fuerza.
2. **Strava no tiene UI pública de series** (coherente con que la fuerza llegue de terceros).
3. **Fitbit**: solo una pantalla porque el listing abre con vídeo.
4. **App Store web** descartada (miniaturas 144 px sin visor); sus galerías quedan enlazadas en el
   informe.

---

## 3. El reloj: qué se puede hacer de verdad

### 3.1 Verificado en este equipo (no es documentación copiada: se ha compilado)

- **SDK instalado**: `C:\Users\David\AppData\Roaming\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-8.3.0-2025-09-22-5813687a0`
  (la ruta que dio David no existe exactamente: el gestor añade fecha y hash al nombre; el puntero
  `current-sdk.cfg` apunta a esta). Compilador **8.3.0**.
- **Perfiles de dispositivo instalados**: **161**. Incluye `fr255` (el reloj de David), `fr255m`,
  `fr255s`, `fr255sm`, `fr265`, `fr965`, `fr955`, `fenix7`, `venu3`, `fr245`, `fenix6`, etc.
- **fr255** (`Devices/fr255/compiler.json`): API level **5.2**, memoria de `watchApp`
  **524.288 B** (la más pequeña de los objetivos), pantalla redonda 260×260 MIP.
- **Clave de desarrollador**: generada en local (RSA 4096 → PKCS#8 DER con OpenSSL). No se commitea.
- **Proyecto de prueba versionado en `watch/connectiq-poc/`** (fuente, manifest con 21 productos,
  icono propio y `build-matrix.ps1`). Ejercita acelerómetro, grabación de fuerza, HTTP y
  almacenamiento. **No usa `AccelerometerData.timestamp`** (API 5.1.1) para no perder
  compatibilidad: el conteo de repeticiones usará índice de muestra y periodo.
- **Matriz de compilación real** (SDK 8.3.0, `minSdkVersion="3.3.0"`):

| Perfil | API level | Compila | `.prg` |
|---|---|---:|---:|
| **fr255** | 5.2 | **SÍ** | 94.492 B |
| fr255m | 5.2 | SÍ | 94.492 B |
| fr265 | 5.2 | SÍ | 100.572 B |
| fr965 | 5.2 | SÍ | 103.292 B |
| fenix7 | 5.2 | SÍ | 94.812 B |
| venu3 | 5.2 | SÍ | 104.092 B |
| fr245 | 3.3 | SÍ | 94.652 B |
| fenix6 | 3.4 | SÍ | 94.652 B |
| venu2 | 5.0 | SÍ | 104.092 B |

- **Mínimo común de las APIs usadas**: `Sensor.AccelerometerData` desde **2.3.0**; `Communications`
  y `ActivityRecording` desde 1.0. La compilación se prueba desde **API 3.3** (fr245), que es el
  mínimo realista en los perfiles instalados; `minSdkVersion` queda en **3.3.0**. **fr235** (API 1.4)
  queda fuera: no tiene `AccelerometerData` ni llega al mínimo.
- **Tamaño**: el `.prg` de fr255 (94.492 B) entra en su presupuesto de 524.288 B con margen.
- Comando: `watch/connectiq-poc/build-matrix.ps1 -KeyPath <clave.der>`; resultados completos en
  `watch/connectiq-poc/README.md`.
- **No se ha instalado en un reloj real**. Todo lo que sigue distingue "verificado en el SDK" de
  "pendiente de probar en el reloj de David" — y el camino principal (A) **no necesita instalar**
  esta app.

### 3.2 APIs del SDK que importan (confirmadas)

| Capacidad | API | Permiso | Límites que importan |
|---|---|---|---|
| Acelerómetro | `Sensor.registerSensorDataListener` con `:accelerometer=>{:enabled=>true, :sampleRate=>N, :includeTimestamps=>true}` | `Sensor` | `period` máx. **4 s** por callback; `sampleRate` en Hz dependiente del dispositivo (`getMaxSampleRateForSensorType(:accelerometer)`); datos en **milli-G** (`x,y,z`) y `timestamp` en ms |
| Giroscopio / magnetómetro | misma llamada | `Sensor` | también disponibles; más consumo |
| Grabar actividad | `ActivityRecording.createSession(...)`, `addLap`, `save`, `discard` | `Fit` | una sola sesión a la vez; deporte `SPORT_TRAINING` es el que existe (no hay `SPORT_STRENGTH_TRAINING`); subtipo `SUB_SPORT_STRENGTH_TRAINING` sí |
| HTTP a nuestro backend | `Communications.makeWebRequest` (GET/POST/PUT/DELETE, JSON) | `Communications` | el reloj lo hace **a través del móvil emparejado** (BLE) o WiFi en dispositivos que lo soportan; HTTPS obligatorio (`SECURE_CONNECTION_REQUIRED`); errores tipificados (`-104` sin BLE, `-300` timeout, `-101` cola llena…); una petición a la vez en la práctica |
| Guardar estado | `Application.Storage` | — | persistente; sirve para la cola offline y la mano del reloj |
| Ajustes de la app | menú propio con `Application.Storage` o `Properties` | — | para una app instalada por sideload, los ajustes se hacen dentro de la app; los ajustes en Garmin Connect requieren publicación |
| Dibujos | recursos bitmap/SVG propios | — | la app puede dibujar el ejercicio (inicio/fin) si los empaquetamos |

**Lo que no hay**: no aparece ninguna API para saber **en qué muñeca** está el reloj (búsqueda de
`wrist`/`isWristLeft` en `api.debug.xml` 8.3.0 sin resultados). Se pregunta una vez en la app/backend
y se guarda `watch_hand` (izquierda/derecha). La mano se usa para orientar las señales del
acelerómetro, no para leerla del sistema.

**Lo que tampoco hay**: `ActivityRecording` no expone pasos de ejercicio con nombre/peso/reps. Una
watch-app puede grabar una actividad y sus vueltas, pero **no puede escribir por sí sola el modelo de
"series con ejercicio, peso y reps" en la actividad de Garmin**. Para eso está el camino de §3.4.

### 3.3 El camino que ya existe en el backend (y sus fallos)

`POST /strength/push-to-garmin` ya construye un workout de fuerza y llama a
`upload_strength_workout` de `garminconnect`. Hoy solo se ha probado en `dry_run` (sin tocar la
cuenta). Comparando el JSON que construye el backend con el que construye la propia librería
tipada (`garminconnect.workout.StrengthWorkout`), hay **diferencias que hay que corregir antes de
enviar nada de verdad**:

| Punto | Backend actual | Librería tipada 0.3.11 | Riesgo |
|---|---|---|---|
| `sportTypeId` | **4** | **5** (`strength_training`) | Garmin puede rechazar o clasificar mal |
| Estructura de series | un step `interval` por serie, **sin descanso** | `RepeatGroupDTO` con steps de ejercicio + descanso | No se ve la serie como bloque; se pierde el descanso |
| Peso | `weightValue: 80.0`, `unitId: 1` (kg) | `weightValue: 80000.0`, `unitId: 8` (factor 1000) | Unidad incorrecta: 80 kg puede acabar como 80 g o rechazado |
| Catálogo | mapa manual de **35** nombres | catálogo de **1.527** ejercicios (`garminconnect.exercises`) | Ejercicios no mapeados caen en genérico |
| Metadatos | sin `estimatedDurationInSecs`, sin `displayOrder` | los incluye | Menos compatible entre dispositivos |

**Decisión propuesta (Nivel 2)**: reescribir el builder usando los modelos tipados de la librería y
probar **un** entrenamiento en la cuenta de David con su permiso y su reloj. Antes de eso, el envío
real sigue apagado y la UI lo dice. No se promete hasta verlo en el reloj.

**Corregido el 2026-11-04 (T-31, ver `BACKLOG.md` y D-16).** El backend ya no fabrica el JSON a
mano: usa `garminconnect.workout.StrengthWorkout` + `create_strength_set`, con sportType 5, un
`RepeatGroupDTO` por ejercicio (serie + descanso), peso en gramos y el catálogo de 1.527 ejercicios.
Los 11 enums con nombre distinto tienen alias explícito; los ejercicios sin mapear **no se envían** y
el dry-run los lista. El contrato verifica 132 comprobaciones, incluida la estructura tipada. Sigue
pendiente la prueba real en el fr255.

### 3.4 Los dos caminos reales para "tener la sesión en el reloj"

**Camino A — entrenamiento nativo de Garmin (recomendado para empezar).**

1. Creamos la sesión en nuestra app.
2. El backend la sube como **workout de fuerza** a Garmin Connect (`upload_strength_workout`) y la
   empuja al dispositivo (`push_workout_to_device`) o la agenda (`schedule_workout`).
3. David abre el entreno en el reloj: ve ejercicios, orden, series, reps, peso y descansos. El reloj
   nativo ejecuta la sesión y registra la actividad.
4. Garmin sincroniza la actividad a Garmin Connect; el backend la importa en el próximo sync y llama
   a `get_activity_exercise_sets` para recuperar **las series reales** (ejercicio, peso, reps), y las
   enlaza a la sesión propia. `set_activity_exercise_sets` permite corregirlas después en Garmin.

Ventajas: es el flujo nativo del reloj, con sus animaciones y su pantalla; no hay que instalar una
app; funciona aunque David no lleve el móvil durante la serie. Límites: la API es **no oficial**
(puede cambiar o bloquear), requiere cuenta vinculada y tokens; hay que validar el formato con un
reloj real; la edición/borrado en Garmin y en nuestra app debe reconciliarse (deduplicar por
`activity_id` y por ventana temporal).

**Camino B — watch-app propia Connect IQ (cuando el nativo no llegue).**

Una app sideload/tienda que:
- recibe del backend (vía HTTP del móvil) la sesión del día: ejercicios, peso, reps, descanso;
- muestra cada ejercicio, el dibujo inicio/fin y el peso/reps objetivo;
- permite **marcar serie hecha** (botón) y ajustar peso/reps con los botones del reloj;
- manda cada marca al backend (`POST /sessions/{id}/sets`) y guarda una **cola offline** si no hay
  conexión;
- graba la actividad (`ActivityRecording`) para que Garmin también tenga el entreno;
- guarda la **mano** del reloj y la usa al interpretar el acelerómetro.

Ventajas: control total de la pantalla y del flujo. Costes: desarrollo Monkey C, instalación
(sideload con clave de desarrollador o revisión de la tienda), tamaño/memoria, batería por el
acelerómetro, y que el móvil esté cerca para HTTP. La app **no** puede escribir el modelo de series
en la actividad nativa: eso lo cubre el camino A o nuestro backend.

**Cómo se instala en el reloj real**: `monkeydo` es solo para el simulador. Para el reloj hay que
publicar (aunque sea beta privada) o instalar el `.prg` con el flujo de desarrollador del
dispositivo. Ese paso hay que hacerlo con David y su reloj; no se puede prometer desde aquí.

### 3.5 Qué se puede prometer hoy (y qué no)

| Promesa | Estado |
|---|---|
| Sincronizar entrenamientos al reloj con ejercicios, series, reps y peso | **Posible por API no oficial**; falta corregir el builder y **validar en el reloj de David** |
| Ver en el reloj el dibujo de cada ejercicio | Posible en **nuestra watch-app**; en el nativo depende de que Garmin tenga animación para ese ejercicio |
| Recibir de vuelta lo registrado en el reloj | **Posible**: `get_activity_exercise_sets`; falta probarlo con la cuenta real |
| Detectar la repetición por movimiento | **POC posible**; fiabilidad limitada y medida; ver §3.6 |
| Saber la mano del reloj automáticamente | **No**; se pregunta una vez |
| Enviar el entreno por `.fit`/`.tcx` | **No es el camino**: ver §3.7 |

### 3.6 Detección de repeticiones por IMU: qué dice la literatura

No es una idea improvisada; es un problema estudiado, con resultados que **dependen del sensor, la
colocación, el ejercicio y el modelo**. Los números que se pueden citar:

| Fuente | Sensor / colocación | Ejercicios | Resultado |
|---|---|---|---|
| Lim & Lee, 2024 ([arXiv:2410.00407](https://arxiv.org/abs/2410.00407)) | IMU en la oreja, 92 Hz (acc/giro/mag), 11 participantes | 28 ejercicios de fuerza y peso corporal | **86,8 %** de probabilidad de contar correctamente **≥10 repeticiones** en una serie; para un ejercicio nuevo hay que **registrar 5 reps** de calibración; el modelo trabaja con ventanas deslizantes |
| King et al., 2025 ([arXiv:2512.11854](https://arxiv.org/abs/2512.11854)) | IMU en la **muñeca**, 6 ejes, 13 participantes | preacher curl al fallo, 631 reps | segmentación de repeticiones **F1 = 0,83**; clasificación de proximidad al fallo (RiR ≤ 2) **F1 = 0,82**; inferencia 1,6 Hz; 112 ms en Raspberry Pi 5 y 23,5 ms en iPhone 16 |
| Soro et al., 2019 ([Sensors 19(3):714](https://doi.org/10.3390/s19030714)) | IMU en la muñeca + CNN 1D | 10 ejercicios de gimnasio | 73,5 % de las series contadas con **0 errores**; 17,3 % con 1 error (resumen en Lim & Lee §2.1) |

Conclusión honesta:

- **Un conteo automático perfecto no existe** en el estado del arte, y menos con un solo sensor de
  muñeca para cualquier ejercicio. Garmin ya lo intenta y falla en piernas y series cortas
  (`INVESTIGACION.md` §3.1, F1).
- **Sí es viable un conteo asistido**: detección de picos por serie con calibración por ejercicio,
  corrección con un toque y registro de la confianza. Para 3-4 ejercicios medidos se puede evaluar.
- Lo correcto es un **POC con protocolo**: grabar con la watch-app acelerómetro a 25–50 Hz, etiquetar
  series reales, comparar detección de picos contra la etiqueta y medir error por serie y por
  ejercicio. Solo si el error es aceptable (p. ej. ±1 repetición en ≥90 % de series de 3 ejercicios)
  se lleva a la app; si no, se queda como "marcar serie" manual.
- El modelo de ML del paper de la muñeca se puede evaluar en el móvil/edge, no en Monkey C: la
  watch-app enviaría la señal al móvil/backend o solo contaría picos simples. No se promete ML en el
  reloj.

### 3.7 `.fit`, `.tcx` y GPX: qué son y para qué sirven

- **GPX**: pista GPS. El backend ya exporta actividades en GPX; sirve para rutas, **no** para
  entrenamientos de fuerza.
- **FIT**: formato de Garmin para actividades y también para workouts. La vía pública de Garmin
  Connect es **subir actividades** (FIT/TCX/GPX) manualmente; no hay una vía oficial pública para
  importar un **workout planificado** de fuerza por fichero. La vía real para planificar es el
  servicio de workouts (API no oficial) o la app propia.
- **TCX**: actividades/cursos; tampoco es el formato de un entrenamiento de fuerza con series.
- Por tanto: **no se propone** "exportar `.fit`" como forma de mandar la sesión al reloj. Se propone
  el camino A (workout service) y, si hiciera falta, la watch-app.

### 3.8 Plan del reloj por fases

| Fase | Entregable | Criterio de aceptación | Nivel |
|---|---|---|---|
| R1 | Corregir el builder de workout con los modelos tipados y comparar JSON con el `dry_run` | El JSON coincide con la estructura de la librería (sportType 5, repeat groups, unidades, descansos); prueba de contrato | 2 |
| R2 | Enviar **un** entreno real a la cuenta de David y verlo en el reloj | David confirma que aparece y se ejecuta; se documenta la captura | **3** (cuenta real) |
| R3 | Importar las series de la actividad de fuerza (`get_activity_exercise_sets`) y reconciliar | Las series del reloj aparecen en la sesión propia, sin duplicar | 2 |
| R4 | Watch-app Connect IQ (sesión, marcar serie, HTTP, offline, mano) | Instalada en el reloj; marca una serie y llega al backend; sobrevive sin cobertura | 2-3 |
| R5 | POC de conteo de repeticiones (3 ejercicios, protocolo medido) | Error ±1 rep en ≥90 % de series de 3 ejercicios o se descarta | 2 (POC), 3 para llevarlo a producción |

---

## 4. Propuesta de tareas (orden de valor)

| # | Tarea | Origen | Nivel |
|---|---|---|---|
| T-26 | Motor de métricas derivadas en backend: monotonía/tensión, volumen y series por músculo, empuje/tirón, 1RM estimado, TUT (cuando haya tempo), periodos largos; índices | §1.3, §1.5 | 2 |
| T-27 | Catálogo de gráficas y rediseño de Tendencias/Hoy: línea, barras, área, dispersión, calor/calendario, distribución, comparativa de periodos, estados vacíos honestos | §1.2 | 2 |
| T-28 | Ejercicios con dibujo (inicio/fin) y mapeo al catálogo Garmin (categoría + ejercicio) | ALCANCE §2 | 2 |
| T-29 | Registro de sesión (T-04) con series, descanso, RPE, corrección y resumen | ALCANCE §3 | 2 |
| T-30 | Importar series de fuerza de Garmin y reconciliar con la sesión propia | §3.3/§3.4 | 2 |
| T-31 | Envío real de entrenamientos al reloj (builder tipado + validación con David) | §3.3/§3.4 | 2 + prueba Nivel 3 |
| T-32 | Watch-app Connect IQ: ver sesión, marcar serie, HTTP, cola offline y mano | §3.4 | 2-3 |
| T-33 | POC de conteo de repeticiones por IMU con protocolo y métricas | §3.6 | 2/3 |
| T-34 | Rediseño móvil-first según `research/UI-COMPETENCIA.md` | §2 | 2 |

Orden: **T-26/T-27** (datos y gráficas) → **T-29** (registro, ya es T-04) → **T-28** (creación con
dibujos) → **T-31/T-30** (reloj, primero subir y recuperar) → **T-32** (watch-app) → **T-33** (POC).
T-34 se aplica de forma transversal en cada pantalla que se toque, no como un rediseño final.

---

## 5. Fuentes

**Connect IQ y reloj**

- SDK local: `C:\Users\David\AppData\Roaming\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-8.3.0-2025-09-22-5813687a0`
  (versión 8.3.0; `current-sdk.cfg`).
- Perfil de dispositivo `fr965/compiler.json` y `fr965.api.debug.xml` (memoria, API level 5.2,
  `SUB_SPORT_STRENGTH_TRAINING`, `AccelerometerData`, `createSession`, `makeWebRequest`).
- [Toybox.Sensor.AccelerometerData](https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor/AccelerometerData.html)
  (milli-G, `timestamp`, `sampleRate`).
- [Toybox.Communications](https://developer.garmin.com/connect-iq/api-docs/Toybox/Communications.html)
  (permiso `Communications`, puente por el móvil, errores, HTTPS obligatorio).
- Foro de Garmin sobre `makeWebRequest` y fallos de conexión:
  [hilo 384044](https://forums.garmin.com/developer/connect-iq/f/discussion/384044/makewebrequest---prerequisits/).
- Garmin: [cómo subir actividades manualmente](https://support.garmin.com/en-US/?faq=Ht3ZP52Kju075uKvqTqu99)
  (FIT/TCX/GPX son actividades, no workouts planificados).

**API no oficial de Garmin Connect (usada por el backend)**

- [python-garminconnect](https://github.com/cyberjunky/python-garminconnect), versión instalada
  **0.3.11**: `upload_strength_workout`, `push_workout_to_device`, `get_activity_exercise_sets`,
  `set_activity_exercise_sets`, catálogo de ejercicios y modelos `StrengthWorkout`.
- El propio README advierte: es un cliente **no oficial**, no empareja con el móvil ni con el reloj;
  puede cambiar sin aviso. Los métodos de escritura modifican la cuenta.

**Detección por IMU**

- Lim, Y.; Lee, S. *Intelligent Repetition Counting for Unseen Exercises: A Few-Shot Learning
  Approach with Sensor Signals*. [arXiv:2410.00407](https://arxiv.org/abs/2410.00407) (2024).
- King, G.; Azeem, M.; Noblitt, S.; Zand, R.; Valafar, H. *Rep Smarter, Not Harder: AI Hypertrophy
  Coaching with Wearable Sensors and Edge Neural Networks*.
  [arXiv:2512.11854](https://arxiv.org/abs/2512.11854) (2025).
- Soro, A.; Brunner, G.; Tanner, S.; Wattenhofer, R. *Recognition and Repetition Counting for
  Complex Physical Exercises with Deep Learning*. Sensors 2019, 19(3), 714.
  [doi:10.3390/s19030714](https://doi.org/10.3390/s19030714).

**Métricas**

- Foster, C. et al. *Monitoring training in athletes with reference to overtraining syndrome*.
  Med Sci Sports Exerc. 1998;30(7):1164-8.
  [PubMed 9662690](https://pubmed.ncbi.nlm.nih.gov/9662690/) (monotonía y tensión).
- LeSuer, D. A. et al. *The accuracy of prediction equations for estimating 1-RM performance in the
  bench press, squat, and deadlift*. J Strength Cond Res. 1997.
  [JSCR](https://journals.lww.com/nsca-jscr/abstract/1997/11000/the_accuracy_of_prediction_equations_for.1.aspx)
  (comparación de Epley/Brzycki; el 1RM es una estimación, no una medición).

**Competencia (UI y funciones)**

- Las fuentes funcionales están en `INVESTIGACION.md` §2. Las visuales, con capturas, en
  `research/UI-COMPETENCIA.md`.

---

## 6. Lo que NO se ha verificado (y por tanto no se promete)

1. Enviar un workout real a la cuenta de Garmin: el builder actual tiene diferencias con la librería
   tipada y **solo se ha probado `dry_run`**.
2. Que el reloj nativo muestre el peso/reps del workout subido: no se ha visto en un reloj real.
3. Que `get_activity_exercise_sets` devuelva las series del entreno de David: el método existe en la
   librería instalada, pero no se ha llamado contra la cuenta real.
4. Instalar una watch-app en el reloj de David: solo se ha compilado; `monkeydo` es para el
   simulador.
5. La precisión del conteo de repeticiones con el sensor de su reloj: los papers usan otros sensores
   y protocolos; el POC medirá el suyo.
6. La mano del reloj: no hay API; se pregunta.
7. Las capturas de UI de la competencia: ver la nota de método de `research/UI-COMPETENCIA.md`; son
   capturas de páginas públicas para investigación interna, no assets del producto.
## 4 · Relojes objetivo (dato de David, 2026-11-04)

- **El reloj de David es un Forerunner 255.** Es el objetivo de la prueba real.
- **Requisito de compatibilidad**: la app debe funcionar en el **mayor número de modelos posible**, no solo en el suyo.
  - Usar el **mínimo común de API** que cubra los modelos objetivo; nada de APIs exclusivas de un modelo.
  - Comprobar la compilación en varios perfiles del SDK (fr255, fr265, fr965, fenix7, venu3 y los que haya).
  - Documentar en una tabla: perfil, compila sí/no, API level.
- La **mano del reloj** no la expone ninguna API: se pregunta una vez y se guarda.