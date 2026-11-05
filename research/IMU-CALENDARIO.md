# IMU y calendario

**Detección automática de repeticiones en el reloj (Forerunner 255 / Connect IQ) y programación/auto-carga de entrenamientos**

- Fecha: 2026-11-05
- Autor: agente de investigación (delegado por el Lead)
- Alcance: investigación documental y de SDK. **No se ha tocado código de producción.** Único fichero creado: este.
- Regla de lectura: cada afirmación lleva fuente enlazada o va marcada como **[PROPUESTA]**. Nada de cifras inventadas.
- Etiquetas de evidencia:
  - **[V]** verificado con una fuente pública o primaria enlazada.
  - **[V-L]** verificado en este equipo (SDK 8.3.0 instalado / código del repo), con la ruta indicada.
  - **[P]** propuesta de este informe, no verificada.

---

## 0. Cómo se ha investigado y qué se ha podido verificar

1. **Documentación primaria del reloj**: manual del propietario del **Forerunner 255** (el reloj de David) para actividad de fuerza, calendario de entrenamiento, workouts y envío al dispositivo [S1][S2][S3][S4].
2. **SDK de Connect IQ instalado en este equipo** (`C:\Users\David\AppData\Roaming\Garmin\ConnectIQ\Sdks\connectiq-sdk-win-8.3.0-2025-09-22-5813687a0`): documentación local de `Toybox.Sensor`, `Toybox.PersistedContent.Workout`, `Toybox.Activity.WorkoutStepInfo`, y ausencia de un módulo de creación/agendado de workouts [S5][S6][S8][S9]. El PoC del repo [README del PoC](../watch/connectiq-poc/README.md) ya compiló para `fr255` (API 5.2) usando acelerómetro a 25 Hz.
3. **Literatura**: arXiv, DOI/Crossref y Semantic Scholar para los papers; una revisión sistemática reciente (Sports Medicine, 2025) para contextualizar el estado del arte [S21]–[S26][S29].
4. **Patentes**: Google Patents (una patente de conteo por IMU verificada a fondo) [S27].
5. **Competencia**: documentación oficial de Garmin, TrainingPeaks, Runna, COROS, Hevy, Strong, Fitbod y WHOOP [S11]–[S20].
6. **Repo**: modelos y endpoints reales del backend para que el esquema propuesto encaje (`backend/app/db/models.py`, `backend/app/api/v1/gym.py`, `calendar.py`) [V-L].

**Límite grande y explícito**: no se ha probado nada en un reloj físico. Todo lo que dependa del sensor real (frecuencia máxima efectiva, batería, jitter, disponibilidad de giroscopio en el fr255) queda en la lista de **NO verificado** (§11). La investigación previa del proyecto ya dejó constancia de que el fr255 compila a API 5.2 y de que la app **no se ha instalado en el reloj** ([INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md), §3.1).

---

## 1. Resumen ejecutivo

1. **Garmin ya hace conteo de repeticiones en el fr255, con límites escritos en su propio manual**: el reloj cuenta reps, muestra el contador **a partir de 4 repeticiones**, **solo cuenta un movimiento por serie**, cuenta cada rep **cuando el brazo que lleva el reloj vuelve a la posición inicial** y avisa de que **los ejercicios de piernas pueden no contarse**; además existe la **detección automática de series** [S1]. No publica algoritmo ni precisión [S1][S10].
2. **La muñeca es un sensor pobre para piernas y movimientos unilaterales, y la literatura lo confirma**: la revisión sistemática de 2025 concluye que un único IMU en la muñeca da muy buena precisión **para clasificar** ejercicios, incluso de tren inferior, pero advierte de que pocos productos comerciales están validados científicamente [S29]. Clasificar un ejercicio no es contar sus repeticiones: el conteo depende de que el gesto del brazo sea rítmico y repetible [S1].
3. **El mejor conteo publicado con un solo acelerómetro de muñeca es asistido, no perfecto**: uLift reporta **error medio de conteo 0,61 reps** en 15 ejercicios y 35 participantes, sin entrenamiento previo, usando autocorrelación + filtrado de picos + plantillas DTW [S24]. MiLift reporta **1,12 reps de error medio** sobre ~9,65 reps por serie [S25]. Soro et al. aciertan **±1 rep en el 91 % de las series** (73,5 % exactas) con CNN [S21]. Ningún paper promete 100 % en cualquier ejercicio.
4. **A 25 Hz hay señal suficiente para contar picos de un gesto rítmico, no para imitar a los papers**: los estudios usan 92 Hz (Lim & Lee, IMU en la oreja) [S22], ventanas de 2,56 s con redes (King et al., muñeca) [S23] y, en la revisión, muestreos de 10–512 Hz con los mejores modelos entre 100 y 128 Hz [S29]. A 25 Hz hay una muestra cada 40 ms; una rep de 2 s son ~50 muestras: sobra para detectar máximos, no para features finas de velocidad. **[P]** El reloj debe contar picos; el móvil/backend debe refinar y evaluar.
5. **Connect IQ impone dos caminos excluyentes y hay que elegir uno por función**: (a) **workout nativo de Garmin**, con su pantalla, animaciones y conteo propio, que se carga desde Garmin Connect [S2][S3][S4]; o (b) **watch-app propia**, que puede leer el acelerómetro (25 Hz) y contar con nuestro algoritmo, pero **no puede crear ni agendar workouts nativos** (la API solo permite listar/leer/borrar/abrir workouts persistidos: `getId`, `getName`, `remove`, `toIntent`) [S8]. Además, **el acelerómetro no se puede usar desde un data field**: `registerSensorDataListener` provoca crash en data fields [S5]; por tanto **no se puede superponer nuestro conteo a un workout nativo**.
6. **El patrón por ejercicio es la pieza que falta en el mercado y la que hace viable el conteo**: los papers que generalizan lo hacen con **5 repeticiones de registro** para un ejercicio nuevo (few-shot) [S22] o con **adaptación instantánea a plantillas** sin entrenamiento (uLift) [S24]; una patente de Moov describe el mismo enfoque con **pose base + puntos extremos + trayectoria objetivo** [S27]. **[P]** Proponemos un esquema JSON versionado por ejercicio (eje, duración de rep, picos, fases, pose inicial/final, lado, umbrales y confianza) guardado en la base de datos y editable desde la app, más una **calibración guiada de 10–15 s** que captura 4–5 reps y deriva esos parámetros.
7. **Calendario y auto-carga: el patrón que funciona en la competencia es “plan en la app → calendario → sync al reloj → ‘entreno de hoy’ en el reloj”**. Garmin lo hace con su calendario de Garmin Connect y el *glance* de Garmin Coach [S2]; TrainingPeaks empuja workouts estructurados **15 días** por delante al calendario de Garmin Connect [S19]; Runna sincroniza **las dos semanas completas siguientes cada lunes** y se arranca desde *Training Calendar → Today's workout* [S20]; COROS sincroniza **las dos semanas siguientes** y permite duplicar semanas en el plan [S14]. Hevy, Strong y Fitbod no tienen integración nativa con Garmin: son apps de Apple Watch o requieren un puente de terceros [S15]–[S18].
8. **Para nuestro producto, el orden correcto es**: (1) calendario y auto-carga por la vía nativa (workout de fuerza en Garmin Connect, ya existe builder en el backend); (2) perfil de movimiento por ejercicio + calibración; (3) conteo asistido en watch-app propia como POC medido; (4) solo si el POC cumple ±1 rep en ≥90 % de series de 3 ejercicios, llevarlo a producto. El conteo perfecto no es promesa vendible [S29][S21][S24].

---

## 2. Tabla de fuentes

| ID | Fuente | Tipo | Uso en este informe |
|---|---|---|---|
| S1 | [Forerunner 255 — Recording a Strength Training Activity](https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-46A33D74-8E94-45BC-983F-693474BBC8C9-6063.html) | Manual oficial | Conteo de reps nativo, ≥4 reps, un movimiento por serie, brazo vuelve al inicio, piernas, detección automática de series, elegir muñeca |
| S2 | [Forerunner 255 — About the Training Calendar](https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-189D7345-93D0-4344-B770-6C8B5E3DD4E8-5926.html) | Manual oficial | Calendario = extensión del de Garmin Connect; glance; “Today’s Workout”; planes y Garmin Coach |
| S3 | [Forerunner 255 — Creating a Custom Workout on Garmin Connect](https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-D6C274C9-161F-44F9-AA86-99C43471D5E8-9414.html) | Manual oficial | Crear workout en Garmin Connect y enviarlo al reloj |
| S4 | [Forerunner 255 — Following a Workout From Garmin Connect](https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-E59F74A8-9774-4027-93D3-5A5AEED52978-908.html) | Manual oficial | Flujo Training → Workouts → Send to Device |
| S5 | [Connect IQ API — Toybox.Sensor](https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor.html) | Documentación SDK | `registerSensorDataListener`, `:period` máx. 4 s, `:sampleRate` Hz, accel/giro/mag, un solo listener, crash en data field, `getMaxSampleRateForSensorType` |
| S6 | [Connect IQ API — Toybox.Sensor.AccelerometerData](https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor/AccelerometerData.html) | Documentación SDK | Datos en milli-G, x/y/z, pitch/roll/power, `timestamp` desde API 5.1.1 |
| S7 | [Garmin Forums — 6.3.0 SDK higher rate support](https://forums.garmin.com/developer/connect-iq/i/bug-reports/6-3-0-sdk-higher-rate-support-for-accelerometer-magnetometer-and-gyroscope) | Foro oficial | El SDK 6.3.0 anunció hasta 100/50 Hz; un usuario reportó que un Fenix 7 seguía a 25 Hz (el hilo apunta a un límite del simulador) |
| S8 | [Connect IQ API — Toybox.PersistedContent.Workout](https://developer.garmin.com/connect-iq/api-docs/Toybox/PersistedContent/Workout.html) | Documentación SDK | Workout persistido: solo `getId`, `getName`, `remove`, `toIntent`; `getWorkouts()` lista; **no crea ni agenda** |
| S9 | [Connect IQ API — Toybox.Activity.WorkoutStepInfo](https://developer.garmin.com/connect-iq/api-docs/Toybox/Activity/WorkoutStepInfo.html) | Documentación SDK | Lectura del step actual/siguiente en contexto de actividad |
| S10 | [Garmin Support — How Does the Rep Counting Feature Work?](https://support.garmin.com/en-US/?faq=xEPSpxE3j27gpEsiq8K9o8&productID=886725&tab=topics) | FAQ oficial | Existencia de la función (el cuerpo de la página no se pudo extraer por bloqueo anti-bot; las cifras se toman del manual S1) |
| S11 | [WHOOP — Strength Trainer](https://www.whoop.com/us/en/thelocker/introducing-strength-trainer-a-new-way-to-quantify-the-impact-of-your-strength-training/) | Web oficial | Acelerómetro + giroscopio de muñeca; “motion tracking / rep detection”; entrada manual de peso/reps |
| S12 | [WHOOP — The Science of Muscular Load](https://www.whoop.com/us/en/thelocker/the-research-and-development-behind-strength-trainer/) | Web oficial | Validación: ~250 reps por ejercicio, 20 participantes, >10.000 reps, correlación 97 % test-retest |
| S13 | [COROS — Strength Mode](https://support.coros.com/hc/en-us/articles/360043959812-Strength-Mode) | Soporte oficial | Reloj cuenta reps; se editan reps/peso tras la serie; workouts con animaciones y auto-advance |
| S14 | [COROS — Creating and Using Training Plans](https://support.coros.com/hc/en-us/articles/360048955151-Creating-and-Using-Training-Plans) | Soporte oficial | Plan por semanas/días, duplicar semanas, sync de las 2 semanas siguientes, prompt al entrar en el modo |
| S15 | [Hevy — App Store](https://apps.apple.com/es/app/hevy-gym-tracker-workout-log/id1458862350?l=en-GB) | Ficha oficial | App de Apple Watch: rutinas, series, FC, temporizadores; calendario en el móvil; sin Garmin |
| S16 | [hevy2garmin (PyPI)](https://pypi.org/project/hevy2garmin/0.12.0/) | Proyecto de terceros | “Hevy … doesn't sync to Garmin”: evidencia de que no hay sync nativo |
| S17 | [Strong — About Strong for Apple Watch](https://help.strongapp.io/article/222-strong-for-apple-watch) | Soporte oficial | App de Apple Watch, una serie/temporizador a la vez, editar peso/reps; sin Garmin |
| S18 | [Fitbod — Apple Watch](https://help.fitbod.me/hc/en-us/articles/360006499194-Apple-Watch) | Soporte oficial | Apple Watch registra series y ajusta reps/peso; el iPhone hace falta para empezar/guardar; lista de integraciones sin Garmin |
| S19 | [TrainingPeaks — Structured Workout sync](https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export) | Soporte oficial | Sync de workouts estructurados 15 días por delante al calendario de Garmin Connect |
| S20 | [Runna — Using Your Garmin Watch With Runna](https://support.runna.com/en/articles/6169639-using-your-garmin-watch-with-runna) | Soporte oficial | Runna → Garmin Connect → reloj; 2 semanas cada lunes; arranque desde Training Calendar; solo running |
| S21 | [Soro et al., 2019, Sensors 19(3):714](https://doi.org/10.3390/s19030714) | Paper | CNN sobre muñeca, 10 ejercicios CrossFit; ±1 rep en 91 % de series; 99,96 % clasificación |
| S22 | [Lim & Lee, 2024, arXiv:2410.00407](https://arxiv.org/abs/2410.00407) | Paper | IMU oreja 92 Hz, few-shot siamés, 28 ejercicios, 86,8 % ≥10 reps correctas, registro de 5 reps |
| S23 | [King et al., 2025, arXiv:2512.11854](https://arxiv.org/abs/2512.11854) | Paper | Muñeca 6 ejes, ResNet segmenta reps, F1 0,83, ventana 2,56 s, 631 reps, 13 participantes |
| S24 | [uLift, 2024, IEEE Access](https://doi.org/10.1109/ACCESS.2024.3363437) | Paper | Un solo acelerómetro de muñeca; autocorrelación ponderada + filtrado de picos + DTW; error 0,61 reps; 93,09 % detección; adaptación instantánea |
| S25 | [MiLift, 2018, IEEE TMC](https://doi.org/10.1109/TMC.2017.2775641) | Paper | Smartwatch, segmentación automática, 22 usuarios, error 1,12 reps, >90 % precisión/recall |
| S26 | [RecoFit, 2014, CHI](https://doi.org/10.1145/2556288.2557116) | Paper | Referencia temprana de “encontrar, reconocer y contar” con sensor de muñeca (abstract no disponible) |
| S27 | [Patente US10350454B1 — Automated circuit training (Moov)](https://patents.google.com/patent/US10350454/en) | Patente | Puntos extremos, pose base, trayectoria objetivo, conteo de reps y holds estáticos |
| S28 | [Patente US11511156B2 — Training system and methods](https://patents.google.com/patent/US11511156B2/en) | Patente | Patente adyacente de sistema de entrenamiento; **no usada para afirmaciones concretas** |
| S29 | [Brennan et al., 2025, Sports Med — revisión sistemática](https://pmc.ncbi.nlm.nih.gov/articles/PMC12513948/) | Revisión | 44 estudios; IMU lo más preciso; muñeca única muy buena; 10–512 Hz; alto riesgo de sesgo; pocos productos validados |

Fuentes internas del repo: [PoC Connect IQ](../watch/connectiq-poc/README.md), [INVESTIGACION-AMPLIACION.md §3](../INVESTIGACION-AMPLIACION.md), [backend/app/db/models.py](../backend/app/db/models.py), [backend/app/api/v1/gym.py](../backend/app/api/v1/gym.py), [backend/app/api/v1/calendar.py](../backend/app/api/v1/calendar.py).

---

## 3. Estado del arte: cómo se detectan repeticiones hoy

### 3.1 Garmin (función nativa del reloj)

Lo que el manual del **Forerunner 255** dice literalmente [S1]:

- El dispositivo **cuenta las repeticiones**; el contador **aparece cuando se completan al menos 4 repeticiones**.
- **Solo puede contar repeticiones de un solo movimiento por serie**; para cambiar de movimiento hay que terminar la serie y empezar otra.
- **Cada rep se cuenta cuando el brazo que lleva el reloj vuelve a la posición inicial**.
- **“Leg exercises may not be counted”** (los ejercicios de piernas pueden no contarse).
- La primera vez hay que **elegir en qué muñeca está el reloj**.
- Existe **detección automática de series** (“Turn on automatic set detection to start and stop your sets”), y el reloj muestra un temporizador de descanso tras la serie; después se pueden **editar reps y añadir el peso**.

**Lo que no se sabe**: Garmin no publica el algoritmo, ni la señal exacta (aunque el manual implique acelerómetro del reloj), ni tasas de acierto. La FAQ oficial existe [S10], pero no da cifras. Cualquier afirmación tipo “Garmin acierta el 95 %” sería inventada.

### 3.2 Apps comerciales

| Producto | ¿Cuenta reps? | Cómo / con qué | Límites declarados | Fuente |
|---|---|---|---|---|
| **Garmin nativo** | Sí, en el reloj | Sensor del reloj; algoritmo propietario | ≥4 reps, un movimiento por serie, piernas puede que no, brazo vuelve al inicio | [S1] |
| **WHOOP Strength Trainer** | Usa movimiento de muñeca para carga muscular; su FAQ habla de “motion tracking and rep detection” | Acelerómetro + giroscopio; perfiles de movimiento por ejercicio; validado con >10.000 reps | Exige muñeca (no ropa WHOOP); el usuario introduce peso/reps en la app; no publica precisión de conteo | [S11][S12] |
| **COROS Strength Mode** | El reloj “begins tracking your reps” tras elegir grupo muscular; después se editan reps/peso | Sensor del reloj | El usuario corrige reps/peso al terminar la serie; workouts con animaciones y auto-advance | [S13] |
| **Hevy** | No automático en el reloj: se registran series | App de Apple Watch; rutinas sincronizadas; FC y temporizadores | Sin Garmin; sin conteo automático documentado | [S15][S16] |
| **Strong** | No automático: se edita peso/reps | App de Apple Watch, una serie/temporizador a la vez | Sin Garmin documentado | [S17] |
| **Fitbod** | No: se ajustan reps/peso por serie | App de Apple Watch; el iPhone inicia y guarda | **Garmin no aparece en la lista de integraciones publicada** (Apple Health, Apple Watch, WearOS, Fitbit, Strava) | [S18] |

Conclusión honesta: **nadie publica una precisión de conteo verificable**, y varias apps ni siquiera cuentan: registran. La revisión sistemática lo dice con claridad: pocos productos comerciales están validados y hay que ser cauto con sus afirmaciones [S29].

### 3.3 Literatura (lo que sí está medido)

| Trabajo | Sensor / colocación | Método | Resultado reportado | Comentario para nosotros |
|---|---|---|---|---|
| **uLift** (2024) [S24] | **Un solo acelerómetro de muñeca** | Autocorrelación ponderada para detectar estado de workout; **filtrado de picos** para contar; **DTW** para clasificar y evaluar forma; sin entrenamiento | **Error medio 0,61 reps**; 93,09 % detección de workout; 90,06 % clasificación; 15 ejercicios, 35 participantes | Lo más cercano a lo que podemos hacer a 25 Hz: picos + plantilla, no CNN |
| **MiLift** (2018) [S25] | Smartwatch | Segmentación automática; detección ligera de reps | 22 usuarios; >90 % precisión/recall en detección de sesión y tipo; **error medio 1,12 reps** (media 9,65); batería hasta 8,25× | La segmentación de series es tan importante como el conteo |
| **Soro et al.** (2019) [S21] | Muñeca + CNN 1D | Clasificación y conteo con la misma red | **±1 rep en el 91 % de las series** (73,5 % exactas, 17,3 % con 1 error); 99,96 % clasificación en 10 ejercicios CrossFit | El “91 %” hay que leerlo como ±1, no como exacto |
| **Lim & Lee** (2024) [S22] | IMU en la **oreja**, 92 Hz (acc/giro/mag) | Few-shot siamés (triplet loss); ventanas deslizantes | **86,8 %** de probabilidad de contar correctamente **≥10 reps** en 28 ejercicios; **registro de 5 reps** para un ejercicio nuevo | El “registro de 5 reps” es el antecedente directo de nuestra calibración |
| **King et al.** (2025) [S23] | **Muñeca**, 6 ejes | ResNet segmenta reps; LSTM/clasificador para RiR | Segmentación **F1 0,83**; 631 reps, 13 participantes, preacher curl al fallo; ventana 2,56 s; inferencia 1,6 Hz; 112 ms RPi5 / 23,5 ms iPhone 16 | Demuestra que en muñeca se puede segmentar, pero con red y no a 25 Hz |
| **RecoFit** (2014) [S26] | Sensor de muñeca | “Find, recognize, and count” | Abstract no disponible públicamente | Referencia histórica; no usar cifras |
| **Revisión sistemática** (2025) [S29] | 44 estudios | Varios | IMU es la tecnología más precisa; **muñeca única muy buena incluso en tren inferior**; muestreo 10–512 Hz, mejores 100–128 Hz; **alto riesgo de sesgo**; pocos productos validados | Clasificar ≠ contar; los estudios no validan nuestros ejercicios |

Lectura crítica: las cifras **no son comparables** entre papers (distintos ejercicios, sensores, definiciones de “acierto”, participantes y protocolos). Lo que sí es consistente: **un solo sensor de muñeca da error de ~0,6–1,2 reps por serie en ejercicios de brazo bien elegidos**, y falla cuando el brazo no describe el gesto (piernas) [S1][S29].

### 3.4 Patentes

- **US10350454B1 (Moov Inc, “Automated circuit training”)** [S27]: describe el conteo mediante **“extreme points”** en los datos de movimiento, una **pose base** (“baseline pose”) para contar retornos, y comparación de la **trayectoria del movimiento con una trayectoria objetivo**. El sensor puede ir en **muñeca, tobillo o brazo**; usa acelerómetro + giroscopio (+ magnetómetro opcional). Cubre también **holds estáticos** y circuitos. Esto es, en esencia, el esquema “patrón por ejercicio” que proponemos: pose inicial/final, puntos extremos y trayectoria de referencia.
- **US11511156B2** [S28]: patente adyacente de sistema de entrenamiento que menciona el conteo de repeticiones. Se enlaza como paisaje, **no se usa para afirmaciones concretas**.
- Riesgo legal: no es asesoría jurídica. La patente de Moov figura como “Expired - Fee Related” en Google Patents [S27], pero **no se ha hecho una libertad de operación**. Antes de comercializar un conteo basado en “trayectoria objetivo + puntos extremos”, revisar con un profesional.

---

## 4. Señales disponibles en Connect IQ a 25 Hz (verificado en el SDK 8.3.0)

### 4.1 Lo que da la API

| Capacidad | Detalle verificado | Fuente |
|---|---|---|
| Acelerómetro | `Sensor.registerSensorDataListener(callback, {:period, :accelerometer=>{:enabled, :sampleRate, :includeTimestamps, :includePower, :includePitch, :includeRoll}})`. `:sampleRate` en **Hz**. | [S5] |
| Giroscopio | Mismo registro, `:gyroscope=>{:enabled, :sampleRate, :includeTimestamps}` | [S5] |
| Magnetómetro | Mismo registro, `:magnetometer=>{...}` | [S5] |
| Ventana por callback | `:period` en segundos; **máximo 4 s** | [S5] |
| Unidad de accel | **milli-G** (1000 mG = 1 G) | [S6] |
| Ejes | `x`, `y`, `z` como arrays de números; `power` (norma) y `pitch`/`roll` opcionales | [S6] |
| Timestamps | `timestamp` en ms **desde API 5.1.1** (el fr255 está en API 5.2, pero el PoC decidió no usarlo para no perder compatibilidad) | [S6], [PoC](../watch/connectiq-poc/README.md) |
| Rate máximo | `Sensor.getMaxSampleRateForSensorType(:accelerometer|:gyroscope|:magnetometer)` desde API 3.4.5; **depende del dispositivo** | [S5] |
| Límite práctico por modelo | El SDK 6.3.0 anunció hasta 100 Hz en accel/50 Hz en giro/mag; un usuario reportó que un Fenix 7 seguía **capado a 25 Hz**, y el hilo apunta a que el límite era del simulador, no del reloj | [S7] |
| Un solo listener | “Only one data request is allowed to be registered at a time”; registrar otro **sustituye** el anterior | [S5] |
| **Data field** | `registerSensorDataListener` **provoca crash si se llama desde un data field** | [S5] |
| Workouts persistidos | `PersistedContent.getWorkouts()` los lista; `Workout` solo expone `getId`, `getName`, `remove`, `toIntent` | [S8] |
| Workout actual | `Activity.WorkoutStepInfo` + `getCurrentWorkoutStep()`/`getNextWorkoutStep()` para leer el step en actividad | [S9] |

**[V-L] En este equipo**: el PoC `watch/connectiq-poc` ya compila con `Sensor.AccelerometerData` a 25 Hz para `fr255` (API 5.2) y 8 perfiles más; **no se ha ejecutado en reloj real** ([README del PoC](../watch/connectiq-poc/README.md), [INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md) §3.1).

### 4.2 Lo que NO da la API (y cambia el diseño)

1. **No hay API para saber en qué muñeca está el reloj.** No aparece en la documentación del SDK 8.3.0; Garmin lo pregunta en la actividad nativa [S1]. Nuestra app debe preguntarlo una vez y guardarlo (`watch_hand`), como ya previó la investigación del proyecto.
2. **No hay API para crear ni agendar workouts nativos desde una app Connect IQ.** `PersistedContent.Workout` es de solo lectura/gestión limitada [S8]; no hay `saveWorkout`/`scheduleWorkout` en el SDK instalado. El calendario se llena desde Garmin Connect [S2][S3].
3. **No se puede usar el acelerómetro desde un data field** [S5]. Por tanto **no existe el híbrido “workout nativo de Garmin + nuestro conteo por IMU en un data field”**.
4. **No hay un módulo de entrenamiento estructurado ejecutable por una watch-app**: la app puede leer `WorkoutStepInfo` si corre en contexto de actividad, pero no puede crear el workout que Garmin ejecuta [S8][S9].

### 4.3 Consecuencia: dos caminos excluyentes

| Camino | Quién ejecuta la sesión | Pantalla | Conteo de reps | Cuándo usarlo |
|---|---|---|---|---|
| **A. Workout nativo de Garmin** | App nativa de fuerza del reloj | Nativa, con animaciones si existen | **El de Garmin** (≥4 reps, un movimiento por serie, piernas puede fallar) [S1] | Ahora. Es el camino que ya tiene backend (`garmin_workout.py`, push a Garmin Connect) |
| **B. Watch-app propia** | Nuestra app Connect IQ | Propia (dibujos inicio/fin, peso, reps, serie) | **El nuestro**: acelerómetro 25 Hz + perfil por ejercicio | Cuando queramos conteo propio y control total |
| ~~C. Nativo + data field con IMU~~ | — | — | **Imposible**: el data field no puede registrar el sensor [S5] | — |

### 4.4 Qué permite la señal a 25 Hz (análisis propio, [P])

- **Resolución temporal**: 40 ms por muestra. Una rep de 2,4 s son 60 muestras; de 1,2 s, 30 muestras. Suficiente para localizar un máximo con error de ±1 muestra (±40 ms).
- **Contenido frecuencial**: una rep típica de gimnasio está entre ~0,2 y ~1,2 Hz (0,8–5 s por rep); a 25 Hz hay entre 20 y 125 muestras por ciclo. Un pico por fase (concéntrica/excéntrica) se resuelve bien; la forma fina de la curva y las diferencias de tempo por debajo de ~100 ms no.
- **Ruido y gravedad**: a 25 Hz el vector de gravedad domina la señal; hay que **quitar la gravedad** (EMA/paso bajo) y trabajar con la componente en el eje principal o con la magnitud.
- **Giroscopio**: útil para desambiguar orientación (p. ej., curl vs. press), pero **no se ha verificado que el fr255 exponga giroscopio a Connect IQ**; hay que consultarlo en runtime con `getMaxSampleRateForSensorType(:gyroscope)` [S5] y degradar a solo acelerómetro si devuelve 0/null.
- **Batería**: no medida. El PoC no se ha ejecutado en reloj; cualquier cifra de consumo sería inventada.

---

## 5. Algoritmos viables (y cuáles caben en el reloj)

### 5.1 Familias y evidencia

| Familia | Cómo funciona | Evidencia | Coste en Monkey C | ¿Cabe a 25 Hz? |
|---|---|---|---|---|
| **Umbral + picos con prominencia** | Suavizar, quitar gravedad, detectar máximos/mínimos con prominencia mínima y distancia mínima; contar ciclos | uLift “filtering out unwanted peaks” [S24]; patente Moov “extreme points” [S27]; MiLift “lightweight repetition detection” [S25] | Bajo: arrays de 25–50 muestras, comparaciones | **Sí**, es la opción del reloj |
| **Autocorrelación** | Estimar el periodo dominante de la señal; contar ciclos por periodicidad | uLift usa “weighted sum of autocorrelation” para detectar el estado de workout [S24]; la revisión recoge máximo de autocorrelación y picos prominentes/débiles como features (Crema et al.) [S29] | Medio: O(n²) sobre ventana de ~2 s (50–100 muestras) | Sí, pero mejor en el móvil |
| **Plantilla + DTW** | Comparar la forma de cada rep con una plantilla del ejercicio; contar las que se alinean | uLift: plantilla representativa y DTW para clasificar [S24] | Alto en reloj; bajo en móvil/backend | **No en reloj**; sí en móvil/backend |
| **Few-shot / CNN / ResNet** | Modelo entrenado que detecta frames “peak/no peak” o segmenta reps | Lim & Lee (siamesa, 5 reps de registro) [S22]; King (ResNet, F1 0,83) [S23]; Soro (CNN, ±1 en 91 %) [S21] | Inviable en Monkey C (memoria 512 KB, sin runtime NN) | No en reloj; móvil/backend |
| **HMM/CRF para segmentar series y ejercicios** | Modelo de estados para separar series/ejercicios | MiLift (segmentación automática) [S25]; revisión [S29] | Alto | No en reloj |
| **Detección de series por reposo** | Umbral de varianza/energía durante N segundos | Garmin tiene detección automática de series [S1]; MiLift segmenta automáticamente [S25] | Bajo | **Sí** |

### 5.2 Pipeline propuesto [P]

Nota: es una propuesta de ingeniería, no un resultado medido. Se apoya en las familias anteriores.

1. **Captura**: acelerómetro a 25 Hz, ventanas de 1 s (`:period => 1`), 3 ejes. Se guarda `watch_hand` (izquierda/derecha) una vez.
2. **Preproceso** (en el reloj, por ventana):
   - Estimar gravedad con EMA: `g_t = α·g_{t-1} + (1-α)·a_t`, con `α ≈ 0,95` (constante de tiempo ~0,8 s a 25 Hz).
   - Señal lineal: `l_t = a_t − g_t`.
   - Señal de trabajo: `s_t = l_t · u` (proyección sobre el eje principal `u` del perfil) o `s_t = |l_t|` si el perfil no fija eje.
   - Suavizado opcional de 3–5 muestras (media móvil) para quitar ruido de alta frecuencia.
3. **Detección de rep**:
   - Buscar máximos locales de `s_t` con **prominencia ≥ `prominence_mg`** y **distancia mínima entre picos ≥ `min_peak_distance_s`**.
   - Si `peaks_per_rep = 2`, contar un ciclo cada dos picos alternos (concéntrica + excéntrica); si `= 1`, un pico = una rep.
   - Descartar el pico si el intervalo con el anterior cae fuera de `[min_duration_s, max_duration_s]` (evita dobles conteos y temblores).
4. **Conteo y confianza**:
   - Rep válida cuando se detecta el patrón completo (pico + retorno a la pose base, si el perfil la define) [S27].
   - Confianza = proporción de intervalos dentro de ±30 % del periodo esperado; si < umbral, marcar la serie como “revisar”.
5. **Segmentación de serie**:
   - Reposo si la desviación típica de `s_t` en 1 s < `rest_std_mg` durante ≥ `end_rest_s`.
   - Serie empieza tras `start_after_reps` reps; termina tras el reposo; mínimo `min_reps`.
6. **Salida del reloj**: no enviar la señal cruda en producción; enviar un resumen por serie (`exercise_id`, `reps`, `confidence`, `t_start`, `t_end`, `intervalos`) y, si se quiere depurar, una ventana cruda de 10–15 s solo en calibración.
7. **Refinado en backend/móvil**: replay con la señal guardada, comparación con la plantilla, marcado de series dudosas y actualización de métricas del perfil.

### 5.3 Por qué no ML en el reloj

- Memoria de `watchApp` en fr255: **524.288 B** y `.prg` del PoC de ~94 KB ([INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md) §3.1); no hay runtime de redes neuronales en Monkey C.
- Los modelos que mejor funcionan (ResNet, CNN, siamesa) se evaluaron en **Raspberry Pi 5 (112 ms) e iPhone 16 (23,5 ms)** [S23], no en un reloj.
- Conclusión: **el reloj cuenta picos; el móvil/backend hace el modelo caro**. Esto también reduce batería y mantiene la app dentro de presupuesto.

---

## 6. Precisión y límites

### 6.1 Cifras reportadas (no comparables entre sí)

| Sistema | Métrica | Valor | Fuente |
|---|---|---|---|
| uLift (1 acc muñeca) | Error medio de conteo | **0,61 reps** | [S24] |
| uLift | Detección de workout / clasificación | 93,09 % / 90,06 % | [S24] |
| MiLift (smartwatch) | Error medio de conteo | **1,12 reps** (media 9,65) | [S25] |
| MiLift | Precisión/recall sesión y tipo | >90 % | [S25] |
| Soro et al. (muñeca, CNN) | Series con ±1 rep | **91 %** (73,5 % exactas, 17,3 % con 1 error) | [S21] |
| Lim & Lee (oreja, few-shot) | Series con ≥10 reps correctas | **86,8 %** | [S22] |
| King et al. (muñeca, ResNet) | F1 de segmentación de reps | **0,83** | [S23] |
| Garmin nativo | Precisión publicada | **No publicada** | [S1][S10] |
| WHOOP | Precisión de conteo publicada | **No publicada**; sí 97 % de correlación test-retest de carga muscular | [S11][S12] |

### 6.2 Límites por causa

1. **Muñeca**: el conteo depende del gesto del brazo. Garmin lo dice: “cada rep se cuenta cuando el brazo que lleva el reloj vuelve a la posición inicial” y “los ejercicios de piernas pueden no contarse” [S1]. En la literatura, la muñeca única clasifica bien incluso piernas [S29], pero **clasificar no es contar**; el conteo de piernas con muñeca es el caso débil.
2. **Ejercicio**: los papers que generalizan lo hacen con registro/calibración por ejercicio (5 reps en Lim & Lee [S22]; plantilla en uLift [S24]). **No existe un detector universal fiable** con un solo sensor de muñeca; el propio Lim & Lee necesita 5 reps para un ejercicio nuevo [S22].
3. **Tempo**: las reps lentas (tempo 4-0-2, isométricos) alargan el ciclo y rompen umbrales fijos; las reps rápidas/parciales acortan. King et al. usan ventanas de 2,56 s y observan que las reps “suelen durar menos de 2,56 s” [S23]; eso **no cubre** tempos lentos, y hay que parametrizar `min/max_duration_s` por ejercicio **[P]**.
4. **Unilateral**: el reloj solo ve un lado. En curl con mancuerna, el brazo sin reloj no se cuenta; en sentadilla búlgara o zancada, el lado del reloj puede no reflejar el otro. Hay que guardar `watch_hand` y el `side` del ejercicio (unilateral/bilateral) **[P]**, y para unilateral contar solo el lado del reloj o pedir al usuario que cambie el reloj de muñeca (decisión de producto).
5. **Fatiga y fallo**: al fallar, el rango y el tempo cambian; los papers de RiR lo tratan como problema aparte (F1 0,82) [S23]. Nuestro conteo debe degradar a “revisar” en series al fallo, no inventar.
6. **Isométricos**: no hay repetición; Garmin y la patente Moov tratan los holds de forma distinta al conteo dinámico [S1][S27]. Nuestro esquema debe marcar `is_timed` (ya existe en `Exercise` [V-L]) y no intentar contar reps.
7. **Ruido de la vida real**: hablar, ajustarse la ropa, beber, cambiar discos. El reposo y la pose base son la defensa [S27]; sin ellos el contador se dispara.
8. **Sesgo de la literatura**: la revisión concluye **alto riesgo de sesgo** en 44 estudios y muestras pequeñas; muchas validaciones son sobre el propio dataset [S29]. No se puede extrapolar una cifra de paper a “nuestro producto acierta el 90 %”.

### 6.3 Qué se puede prometer hoy (y qué no)

| Promesa | Estado |
|---|---|
| “El reloj cuenta repeticiones de brazos en ejercicios rítmicos y con calibración” | **Posible con matices**: hay que hacer el POC (aún no medido); no prometer precisión hasta medirla |
| “Cuenta piernas, isométricos, dominadas o cualquier ejercicio” | **No**; Garmin ya avisa de piernas [S1] y la literatura no lo sostiene con una muñeca |
| “Cuenta mientras el workout nativo de Garmin está en marcha, con nuestro algoritmo” | **No**; el data field no puede registrar el sensor [S5] |
| “El conteo se corrige con un toque y se guarda la confianza” | **Sí**, es diseño nuestro **[P]** |
| “Precisión del X %” sin medir | **Prohibido** por la doctrina del proyecto |

---

## 7. Esquema de datos propuesto para el patrón por ejercicio

### 7.1 Principios

1. **Un perfil por ejercicio y versión**, no un modelo global: el patrón es del ejercicio (curl vs. press) y del usuario (rango, tempo, lado).
2. **Versionado y reversible**: `draft → active → retired`; nunca se sobrescribe un perfil activo sin conservar el anterior (migración reversible, Nivel 2).
3. **Todo lo que el detector necesita está en el JSON**: el reloj no debe llevar lógica específica de ejercicios; recibe el perfil por HTTP y aplica.
4. **Lo verificado se separa de lo propuesto**: los campos con base en paper/patente van marcados en el diccionario; los umbrales concretos son propuestas a validar.
5. **El perfil no promete**: si `auto_count = false` o `unsupported_reason != null`, la app muestra “conteo manual” sin drama.

### 7.2 Tablas (encajan con el backend actual)

El backend usa SQLAlchemy con `JSON` y SQLite por defecto (`DATABASE_URL = "sqlite+aiosqlite:///./garmin_athletics.db"`), con PostgreSQL posible en producción ([backend/app/db/session.py](../backend/app/db/session.py), [config.py](../backend/app/core/config.py)) [V-L]. En PostgreSQL se puede usar `JSONB`; en SQLite, `JSON` (TEXT). La tabla `exercises` ya existe con `is_unilateral`, `is_timed`, `garmin_enum` ([models.py](../backend/app/db/models.py)) [V-L].

```sql
-- Perfil de movimiento por ejercicio (nuevo)
CREATE TABLE exercise_motion_profiles (
    id             VARCHAR(36) PRIMARY KEY,
    exercise_id    VARCHAR(36) NOT NULL REFERENCES exercises(id),
    user_id        VARCHAR(36),                 -- NULL = perfil por defecto del catálogo
    version        INTEGER NOT NULL,
    status         VARCHAR(10) NOT NULL CHECK (status IN ('draft','active','retired')),
    profile        JSON NOT NULL,               -- JSONB en PostgreSQL
    calibration    JSON,                        -- métricas y referencia a la grabación
    created_at     TIMESTAMP NOT NULL,
    updated_at     TIMESTAMP NOT NULL,
    UNIQUE (exercise_id, user_id, version)
);
CREATE INDEX ix_motion_profiles_exercise_status
    ON exercise_motion_profiles (exercise_id, status);

-- Grabaciones de calibración (opcional; datos crudos para replay)
CREATE TABLE motion_calibrations (
    id             VARCHAR(36) PRIMARY KEY,
    profile_id     VARCHAR(36) NOT NULL REFERENCES exercise_motion_profiles(id),
    user_id        VARCHAR(36) NOT NULL,
    captured_at    TIMESTAMP NOT NULL,
    duration_ms    INTEGER NOT NULL,
    sample_rate_hz INTEGER NOT NULL,
    reps_labeled   INTEGER,
    samples        JSON NOT NULL,               -- [{t_ms, x, y, z}, ...] o binario comprimido
    metrics        JSON,                        -- periodo, cv, snr, eje, prominencia
    accepted       BOOLEAN NOT NULL DEFAULT 0
);
```

**Por qué una tabla aparte y no una columna en `exercises`**: el catálogo es global y compartido; el perfil puede ser del usuario, versionarse y recalibrarse sin tocar el ejercicio. Además el editor de la app puede trabajar con `draft` sin afectar al perfil activo.

### 7.3 JSON del perfil (ejemplo: curl de bíceps con mancuerna)

```json
{
  "schema_version": 1,
  "exercise_id": "8f14e45f-ceea-467a-9a3b-0c1d2e3f4a5b",
  "status": "active",
  "sensor": {
    "source": "watch_accelerometer",
    "sample_rate_hz": 25,
    "units": "milli_g",
    "axes": ["x", "y", "z"],
    "max_window_s": 2.0
  },
  "signal": {
    "mode": "axis_projected",
    "gravity_removal": "ema_lowpass",
    "ema_alpha": 0.95,
    "smooth_samples": 3,
    "normalize": false
  },
  "axis": {
    "mode": "calibrated",
    "vector_watch_frame": [0.08, -0.99, 0.11],
    "side": "watch_arm",
    "sign": 1
  },
  "rep": {
    "peaks_per_rep": 2,
    "peak_polarity": "positive",
    "expected_duration_s": 2.4,
    "min_duration_s": 1.2,
    "max_duration_s": 6.0,
    "min_peak_distance_s": 0.7,
    "prominence_mg": 180,
    "hysteresis_mg": 60,
    "baseline_pose": {
      "accel_mg": [12, -985, 170],
      "tolerance_mg": 150
    },
    "turnaround_pose": {
      "accel_mg": [420, -610, 180],
      "tolerance_mg": 250
    },
    "phases": [
      { "name": "concentric", "order": 1, "duration_ratio": 0.45 },
      { "name": "eccentric",  "order": 2, "duration_ratio": 0.55 }
    ]
  },
  "set": {
    "min_reps": 3,
    "start_after_reps": 2,
    "end_rest_s": 8.0,
    "rest_std_mg": 35,
    "auto_set_detection": true
  },
  "side": {
    "mode": "unilateral",
    "counts": "watch_arm_only",
    "mirror_when_left": true
  },
  "confidence": {
    "min_interval_ratio": 0.65,
    "max_interval_ratio": 1.5,
    "min_reps_before_review": 2
  },
  "calibration": {
    "source": "guided_15s",
    "reps_labeled": 5,
    "detected_on_calibration": 5,
    "interval_cv": 0.08,
    "template_ref": "motion_calibrations/6b1c…"
  },
  "provenance": {
    "created_by": "user",
    "created_at": "2026-11-05T18:10:00+01:00",
    "notes": "Mancuerna 12 kg, tempo natural"
  }
}
```

### 7.4 Diccionario de campos

| Campo | Tipo | Obligatorio | Evidencia / origen |
|---|---|---|---|
| `schema_version` | int | Sí | **[P]** control de migraciones |
| `sensor.source` | string | Sí | **[P]**; valores posibles `watch_accelerometer`, `watch_accel_gyro` |
| `sensor.sample_rate_hz` | int | Sí | **[V]** la API pide Hz [S5]; 25 es el valor del PoC [PoC] |
| `sensor.max_window_s` | float | Sí | **[V]** `:period` máximo 4 s [S5]; 2 s es margen **[P]** |
| `signal.mode` | enum | Sí | **[P]** `axis_projected` \| `magnitude` |
| `signal.gravity_removal` | enum | Sí | **[P]** `ema_lowpass` \| `none` |
| `signal.ema_alpha` / `smooth_samples` | float/int | No | **[P]** parámetros de filtro |
| `axis.mode` | enum | Sí | **[P]** `fixed` \| `calibrated` \| `gravity_projected` |
| `axis.vector_watch_frame` | [3] float | Si `calibrated` | **[P]** eje dominante en el sistema del reloj |
| `axis.side` | enum | Sí | **[V]** la muñeca del reloj se pregunta una vez [S1]; **[P]** cómo usarla |
| `rep.peaks_per_rep` | 1\|2 | Sí | **[P]**; la patente Moov usa “extreme points” [S27]; uLift filtra picos [S24] |
| `rep.peak_polarity` | enum | Sí | **[P]** concéntrica arriba/abajo |
| `rep.expected_duration_s` | float | Sí | **[P]** semilla; papers: reps “suelen durar menos de 2,56 s” en un curl al fallo [S23] |
| `rep.min_duration_s` / `max_duration_s` | float | Sí | **[P]** rango configurable para tempo lento/rápido |
| `rep.min_peak_distance_s` | float | Sí | **[P]** anti-doble conteo |
| `rep.prominence_mg` / `hysteresis_mg` | int | Sí | **[P]** umbral en mG (unidad verificada [S6]) |
| `rep.baseline_pose` / `turnaround_pose` | objeto | No | **[V]** la patente Moov usa pose base y retorno [S27]; **[P]** el formato |
| `rep.phases` | array | No | **[P]** fases concéntrica/excéntrica y proporción |
| `set.*` | objeto | Sí | **[V]** existe detección automática de series en Garmin [S1] y en MiLift [S25]; **[P]** umbrales |
| `side.mode` | enum | Sí | **[P]** `unilateral` \| `bilateral` \| `alternating` |
| `side.counts` | enum | Si unilateral | **[P]** `watch_arm_only` \| `both_arms` |
| `side.mirror_when_left` | bool | No | **[P]** espejar el eje si el reloj va en la izquierda |
| `confidence.*` | objeto | Sí | **[P]** criterio de “revisar” |
| `calibration.*` | objeto | No | **[P]**; se llena con el flujo de §8 |
| `provenance.*` | objeto | Sí | **[P]** auditoría |

### 7.5 Ejemplos de estados del perfil

**Sentadilla (no soportada por el reloj de muñeca)** — perfil explícito, sin promesa:

```json
{
  "schema_version": 1,
  "exercise_id": "…",
  "status": "active",
  "auto_count": false,
  "unsupported_reason": "El manual del FR255 avisa de que los ejercicios de piernas pueden no contarse; el brazo no describe el gesto.",
  "sensor": { "sample_rate_hz": 25 },
  "calibration": null
}
```

**Plancha (isométrico)** — no se cuentan reps; se mide tiempo:

```json
{
  "schema_version": 1,
  "exercise_id": "…",
  "status": "active",
  "auto_count": false,
  "timed": true,
  "unsupported_reason": "Isométrico: no hay repetición; se registra duración.",
  "sensor": { "sample_rate_hz": 25 },
  "calibration": null
}
```

### 7.6 Reglas de validación (backend)

- `sample_rate_hz` ∈ {25, 50, 100} y ≤ `getMaxSampleRateForSensorType` reportado por el dispositivo (el reloj lo envía al registrar) [S5].
- `rep.min_duration_s < rep.expected_duration_s < rep.max_duration_s`; y `min_peak_distance_s ≤ min_duration_s`.
- `prominence_mg` entre 20 y 800; `rest_std_mg` entre 10 y 200.
- `peaks_per_rep` ∈ {1, 2}; `peak_polarity` ∈ {positive, negative}.
- `side.mode` coherente con `Exercise.is_unilateral` [V-L].
- Si `Exercise.is_timed = true`, el perfil debe ser `timed = true` y `auto_count = false` [V-L].
- Perfil `active` único por (`exercise_id`, `user_id`): al activar uno nuevo, el anterior pasa a `retired` en la misma transacción.

### 7.7 API y UI (propuesta concreta)

**API** (bajo `/api/v1/strength`, que ya existe [V-L]):

- `GET /exercises/{id}/motion-profile` → perfil activo (o `null`).
- `PUT /exercises/{id}/motion-profile` → crea `draft` o nueva versión; valida JSON; no activa.
- `POST /exercises/{id}/motion-profile/{version}/activate` → activa y retira el anterior.
- `GET /exercises/{id}/motion-profiles` → historial de versiones.
- `POST /exercises/{id}/calibrations` → sube la grabación de calibración (JSON con muestras), calcula métricas y devuelve una propuesta de perfil.
- `POST /calibrations/{id}/confirm` → acepta la propuesta y crea el perfil `active`.
- Reutiliza autenticación y permisos existentes; no introduce endpoint público nuevo fuera del prefijo actual.

**UI** (React, editor de ejercicio ya existente [V-L]):

- Pestaña **“Detección”** en la ficha del ejercicio: activar/desactivar conteo, ver estado (`sin perfil`, `borrador`, `activo`, `revisar`), botón **“Calibrar 15 s”**.
- Formulario avanzado (colapsado por defecto): eje (automático/manual), duración esperada, rango, prominencia, picos por rep, pose inicial/final, lado.
- Botón **“Probar con una grabación”**: sube un CSV/JSON de 10 s y muestra reps detectadas + gráfica de la señal con los picos marcados.
- Los textos no explican el algoritmo (doctrina §8 del proyecto [DOCTRINA-CALIDAD.md](../DOCTRINA-CALIDAD.md)): “¿Cuenta las reps de este ejercicio?” y el estado, nada de “autocorrelación”.

---

## 8. Flujo de calibración guiada de 10–15 s

Antecedentes verificados que justifican el flujo: Lim & Lee **registran 5 repeticiones** para un ejercicio nuevo [S22]; uLift se adapta **sin entrenamiento** con una plantilla [S24]; Garmin **pregunta la muñeca** la primera vez [S1]; la patente Moov usa **pose base + puntos extremos** [S27]; WHOOP valida con ~250 reps por ejercicio y >10.000 reps totales, lo que da idea del coste de un perfil serio [S12]. Nuestro flujo de 10–15 s es **[P]**.

### 8.1 Guion temporal

| Fase | Tiempo | Qué hace el usuario | Qué hace el sistema |
|---|---|---|---|
| 0. Preparación | 0–3 s | Se coloca en la posición inicial, quieto | Captura la **pose base** (media de accel en 2 s) y estima el ruido de reposo |
| 1. Repeticiones guiadas | 3–13 s | Hace **4–5 reps** a tempo natural (el reloj vibra al empezar) | Graba 25 Hz × 10 s × 3 ejes; detecta picos y propone periodo/prominencia/eje |
| 2. Reposo | 13–15 s | Se queda quieto | Mide varianza de reposo (`rest_std_mg`) |
| 3. Confirmación | — | Ve “5 reps detectadas, 2,3 s/rep” y confirma o corrige | Crea el perfil `active` v1 con `calibration` y `interval_cv` |
| 4. Replay | — | (Opcional) “Probar” con otra serie | Re-ejecuta el detector sobre la grabación y muestra aciertos/fallos |

**Volumen de datos [P]**: 15 s × 25 Hz × 3 ejes = 1.125 valores; en JSON ~10–15 KB. Cabe en una petición HTTP del reloj/móvil; no requiere streaming.

### 8.2 Cálculo en backend (propuesta)

1. **Quitar gravedad** (EMA) y obtener `l_t`.
2. **Eje dominante**: el eje de mayor varianza de `l_t` (o PCA de 3 ejes); se guarda como `axis.vector_watch_frame`.
3. **Periodo**: mediana de los intervalos entre picos prominentes; si hay pocos picos, autocorrelación sobre la señal (uLift usa autocorrelación para el estado de workout [S24]).
4. **Umbrales**: `prominence_mg = max(80, 0,35 × prominencia mediana)`; `min_duration_s = 0,6 × periodo`; `max_duration_s = 1,6 × periodo`; `min_peak_distance_s = 0,55 × periodo`; `rest_std_mg = 1,5 × ruido de reposo`.
5. **Pose base/final**: media del vector de accel en la fase 0 y en el valle entre reps.
6. **Validación**: el detector propuesto debe encontrar **5/5 reps** en la propia grabación; si no, se pide repetir la calibración. `interval_cv` > 0,25 → aviso de tempo irregular.
7. **Lado**: si `watch_hand = left`, `side.mirror_when_left = true`; si el ejercicio es unilateral, `counts = watch_arm_only`.

### 8.3 Criterios de aceptación y modos de fallo

| Criterio | Umbral | Si falla |
|---|---|---|
| Detección en la calibración | 5/5 reps | Repetir calibración; no activar perfil |
| Coeficiente de variación del periodo | ≤ 0,25 | Avisar “tempo irregular”; permitir perfil `draft` |
| Señal/ruido (prominencia / ruido) | ≥ 3 | Pedir más rango de movimiento o cambiar de ejercicio a manual |
| Replay de una segunda serie | error ≤ 1 rep | Marcar “revisar” y no prometer |
| Perfil activo aplicado por el reloj | < 1 s desde HTTP | Cachear el perfil en `Application.Storage` [PoC] |
| Sin conexión | perfil cacheado + conteo local | No bloquear la sesión |

### 8.4 Cuándo recalibrar [P]

- Dos series consecutivas con error ≥ 2 reps o confianza baja.
- Cambio de mano del reloj, de material (mancuerna → barra) o de rango de movimiento.
- Cada N sesiones (p. ej., 10) como mantenimiento; el perfil guarda `calibration` para comparar.

---

## 9. Calendario y auto-carga en la competencia

### 9.1 Tabla comparativa

| Producto | Programar días concretos | Repetir semanas | Auto-carga en el reloj | Qué hace el usuario en el reloj | Fuente |
|---|---|---|---|---|---|
| **Garmin Connect + FR255** | Sí: workouts y planes en el calendario de Garmin Connect; se envían al dispositivo | Sí: planes por semanas (Garmin Coach / Training Plans); el calendario se reemplaza al reenviar | Sí: el calendario del reloj es **extensión** del de Garmin Connect; los workouts programados aparecen en el *glance*; al sincronizar se reciben | Elige día en el calendario, ve/ejecuta el workout, **Do Workout**, **Start**; en fuerza ve pasos, animaciones si existen, temporizador, cuenta reps, edita reps/peso | [S2][S3][S4] |
| **TrainingPeaks** | Sí: workouts estructurados en su calendario | Planes del entrenador | **15 días por delante** al calendario de Garmin Connect; el reloj los recibe al sincronizar | Ejecuta el workout estructurado como nativo de Garmin | [S19] |
| **Runna** | Sí: plan de running por días | **Las 2 semanas completas siguientes cada lunes** | Runna → Garmin Connect → reloj; completados/saltados se quitan del calendario de Garmin | **Run → Workouts → Scheduled** o **Training → Training Calendar → Today's workout**; el reloj guía los pasos | [S20] |
| **COROS** | Sí: plan por semanas y días; arrastrar y soltar | Sí: **duplicar semanas completas** | **Las 2 semanas siguientes** al reloj; un solo plan sincronizado a la vez; al entrar en el modo de actividad pregunta si seguir el entreno del día | Ve el entreno del día, animaciones, **auto-advance**, edita reps/peso después de la serie | [S13][S14] |
| **Hevy** | Calendario en el móvil; rutinas | Rutinas en la app | **No nativo en Garmin**: app de Apple Watch; para Garmin hay puentes de terceros (hevy2garmin) | En Apple Watch: ver rutina, registrar series, FC, temporizadores | [S15][S16] |
| **Strong** | Rutinas en la app | Rutinas | **No Garmin documentado**; Apple Watch | En Apple Watch: una serie/temporizador, editar peso/reps | [S17] |
| **Fitbod** | Planificación en la app | Planificación en la app (no verificado el detalle del generador) | **No Garmin** en la lista de integraciones publicada; Apple Watch | Apple Watch registra series y ajusta reps/peso; el iPhone inicia y guarda | [S18] |
| **WHOOP** | Planes en la app | Rutinas/programas | **No hay pantalla en el reloj**: la sesión se lleva en la app y la muñeca aporta movimiento | N/A (el usuario introduce peso/reps en la app) | [S11][S12] |

Lo que comparten los que funcionan: **un calendario en la app**, **una ventana de sincronización explícita** (15 días en TrainingPeaks; 2 semanas en Runna y COROS) y **una entrada clara en el reloj** (“Today’s workout” / “Scheduled”). Garmin añade que **el workout programado se queda en el reloj aunque se salte** y que reenviar desde Garmin Connect **sobrescribe** el calendario [S2]; son dos comportamientos que nuestra app debe decidir explícitamente.

### 9.2 Qué hay ya en este repo (para no inventar)

- `WorkoutTemplate` tiene `weekday` (0=lunes…6=domingo), `focus`, `notes`; **no tiene fecha** ([models.py](../backend/app/db/models.py)) [V-L]. Es una plantilla semanal, no un calendario.
- `calendar.py` ya expone `GET /calendar/` (eventos + actividades + readiness) y CRUD de eventos ([calendar.py](../backend/app/api/v1/calendar.py)) [V-L].
- `garmin_workout.py` y `POST /strength/push-to-garmin` ya construyen un workout de fuerza con la librería tipada (`StrengthWorkout`, `RepeatGroupDTO`, peso en gramos, catálogo de 1.527 ejercicios) y hay `schedule_workout` en la librería no oficial ([INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md) §3.3–3.4) [V-L]. **Solo se ha probado en `dry_run`; el envío real no se ha hecho**.
- No hay tabla de “sesión planificada por fecha” ni estado de push. Ese es el hueco principal del calendario.

### 9.3 Modelo de calendario propuesto [P]

```sql
CREATE TABLE schedule_rules (
    id             VARCHAR(36) PRIMARY KEY,
    user_id        VARCHAR(36) NOT NULL,
    template_id    VARCHAR(36) NOT NULL REFERENCES workout_templates(id),
    start_date     DATE NOT NULL,
    weeks          INTEGER NOT NULL DEFAULT 8,
    days_of_week   JSON NOT NULL,     -- [0,2,4] = lunes, miércoles, viernes
    active         BOOLEAN NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL
);

CREATE TABLE scheduled_workouts (
    id                 VARCHAR(36) PRIMARY KEY,
    user_id            VARCHAR(36) NOT NULL,
    date               DATE NOT NULL,
    template_id        VARCHAR(36),
    title              VARCHAR(150) NOT NULL,
    status             VARCHAR(12) NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned','completed','skipped','failed')),
    garmin_workout_id  VARCHAR(64),
    garmin_schedule_id VARCHAR(64),
    push_state         JSON,          -- último intento, error, timestamp
    created_at         TIMESTAMP NOT NULL,
    updated_at         TIMESTAMP NOT NULL,
    UNIQUE (user_id, date, template_id)
);
CREATE INDEX ix_scheduled_user_date ON scheduled_workouts (user_id, date);
```

- **Materialización**: se generan las sesiones de **las 2 semanas siguientes** (igual que Runna y COROS [S20][S14]) y se re-materializa al editar la regla. TrainingPeaks usa 15 días [S19]; 14 es coherente con el resto.

### 9.4 Flujo de auto-carga y qué ve el usuario en el reloj

**Camino A (recomendado, nativo)**:

1. La app crea el plan semanal (regla + días) y materializa `scheduled_workouts`.
2. A las 18:00 del día anterior (o al abrir la app), el backend construye el workout de fuerza y lo **sube a Garmin Connect** con `garmin_workout.py`; lo **agenda** con `schedule_workout` (librería no oficial) y guarda `garmin_workout_id`/`garmin_schedule_id`.
3. El reloj sincroniza con Garmin Connect y el workout aparece en el **calendario/glance** [S2]; el usuario lo abre y pulsa **Do Workout → Start**.
4. En el reloj ve: nombre del workout, pasos, animación si Garmin la tiene, temporizador de serie, contador de reps nativo (≥4, un movimiento por serie) y edición de reps/peso [S1][S3].
5. Al guardar, Garmin sube la actividad; el backend la importa (`get_activity_exercise_sets`) y reconcilia con la sesión planificada (evitar duplicados por `activity_id` y ventana temporal).

**Camino B (watch-app propia)**:

1. La app recibe el plan del día al abrir (HTTP por el móvil) y lo cachea en `Application.Storage` para funcionar sin cobertura.
2. Muestra ejercicio, series, reps/peso objetivo, dibujo inicio/fin; el usuario pulsa Start.
3. Cuenta con el perfil de movimiento (calibrado) y muestra “12 reps (revisar)” + botón de corrección; temporizador de descanso.
4. Al terminar, manda el resumen de series al backend (`POST /strength/sessions`) con cola offline.
5. Graba `ActivityRecording` para que Garmin tenga la actividad.

**Decisión de producto [P]**: empezar por A (nativo) para “tener el entreno en el reloj” y por B solo para el POC de conteo; no mezclar ambos en la misma sesión (imposible por S5).

---

## 10. Propuesta de tareas Nivel 1/2 con criterios de aceptación

Numeración nueva para no chocar con el backlog actual; se puede mapear a `BACKLOG.md` al aprobar. Niveles según `PROTOCOLO-AUTONOMIA.md`: Nivel 1 = se hace y se cuenta; Nivel 2 = se hace, se documenta en `DECISIONES.md` y se avisa.

### 10.1 Tareas

| ID | Tarea | Nivel | Criterios de aceptación | Depende de |
|---|---|---|---|---|
| **IMU-1** | Validación y parser del JSON de perfil en backend (sin migración): esquema, reglas de §7.6, errores tipificados | 1 | Tests de contrato: perfil válido 200; 10 casos inválidos → 422 con campo; no toca endpoints existentes | — |
| **IMU-2** | Endpoints `GET/PUT /exercises/{id}/motion-profile` + versionado `draft/active/retired` | 2 | Crear borrador, activar, retirar anterior en una transacción; test de “un solo activo”; reversible | IMU-1 |
| **IMU-3** | Editor “Detección” en la ficha del ejercicio (React): estado, formulario avanzado, probar con grabación | 2 | Crear/editar/borrar perfil desde la UI; ver estado; subir un JSON de 10 s y ver reps detectadas; sin cambiar el flujo actual de sesión | IMU-2 |
| **IMU-4** | Script offline de calibración (`research/` o `backend/scripts/`): quitar gravedad, eje, periodo, prominencia, propuesta de perfil | 1 | Con datos sintéticos (5 reps de 2,4 s) devuelve periodo ±5 % y 5/5 reps; con una grabación real etiquetada, error ≤1 rep | — |
| **IMU-5** | Watch-app: pantalla de calibración 15 s (25 Hz), resumen por HTTP, cache de perfil en `Application.Storage` | 2 | Compila para `fr255`; en simulador captura 15 s y manda JSON; sin conexión no rompe; **no se instala en el reloj** (eso es Nivel 3) | IMU-2 |
| **IMU-6** | Detector de picos en Monkey C con perfil (ventana 1 s, prominencia, distancia, confianza) + segmentación de serie | 2 | En simulador, con señal sintética de 10 reps, cuenta 10/10; con ruido, marca “revisar” en vez de contar de más | IMU-5 |
| **IMU-7** | Backend de replay/refinado: recibe series del reloj, re-ejecuta el detector sobre la señal (si se sube) y marca dudas | 2 | Serie sintética con error de 1 rep y ruido comparable al de uLift [S24] se acepta como “revisar”, no como válida; serie corrupta se marca `review`; no duplica sesiones | IMU-2 |
| **CAL-1** | Tablas `schedule_rules` + `scheduled_workouts` con migración idempotente (SQLite) y CRUD `/calendar/schedule` | 2 | Crear regla lunes/miércoles/viernes 8 semanas → 24 sesiones; editar regla re-materializa; borrar no borra historial; tests | — |
| **CAL-2** | Auto-push diario: construir workout del día y encolarlo a Garmin Connect (reutiliza `garmin_workout.py`), con estado `push_state` | 2 | `dry_run` genera JSON válido para 3 plantillas; reintento con backoff; si falla, la sesión queda `planned` y la UI lo dice; **sin cuenta real** | CAL-1 |
| **CAL-3** | Pantalla “Hoy” en la app: entreno del día, estado del push, botón “empezar” y “ver en el reloj” | 1 | Muestra el entreno de hoy o estado vacío honesto; no promete que está en el reloj si el push falló | CAL-1 |
| **IMU-8** | Protocolo de medición del POC (ver §10.3) y plantilla de etiquetado | 1 | 3 ejercicios × 5 series etiquetadas; CSV/JSON reproducible; informe con error por serie | IMU-4 |

### 10.2 Nivel 3 (no se hace sin David)

- **Instalar la watch-app en el fr255 real** y medir batería/jitter (requiere el reloj y el flujo de desarrollador).
- **Enviar un workout real a la cuenta de Garmin de David** y comprobar que aparece en el calendario/reloj (requiere cuenta y permiso).
- **Publicar la app en Connect IQ Store** (cuenta de desarrollador, revisión).
- **Cambiar el alcance**: prometer conteo automático en la UI, añadir pantallas nuevas, o tocar el modelo de datos de forma destructiva.
- **Cualquier afirmación de precisión** antes de cerrar el POC.

### 10.3 Protocolo del POC (criterio de “sirve o se descarta”)

Propuesta [P], alineada con el criterio R5 ya escrito en el proyecto ([INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md) §3.8):

1. **Ejercicios**: 3 de brazo con gesto rítmico (curl de bíceps con mancuerna, press de hombro con mancuerna, elevación lateral).
2. **Sesiones**: 5 series por ejercicio, 8–12 reps, tempo natural; una sesión por ejercicio; etiquetar con vídeo o contador manual.
3. **Medición**: error por serie (reps detectadas − reales), % de series con |error| ≤ 1, % de series detectadas (no perdidas), falsos positivos en reposo.
4. **Criterio de aceptación**: **≥90 % de series con error ≤1 rep** y **≥90 % de series detectadas**; si no, el conteo se queda como “marcar serie manual” y se documenta.
5. **Análisis**: script de IMU-4 sobre los datos grabados; sin reloj real se puede hacer con el simulador y con datos de un IMU de móvil solo como referencia, nunca como validación del reloj.

---

## 11. Lo NO verificado

Lista explícita para que nadie la convierta en promesa:

1. **Nada se ha probado en un reloj físico**: ni el fr255 ni ningún otro. Frecuencia real, jitter de callbacks, consumo de batería y comportamiento con pantalla apagada: **desconocidos**.
2. **¿El fr255 expone giroscopio y magnetómetro a Connect IQ?** No verificado; hay que consultar `getMaxSampleRateForSensorType(:gyroscope)` en el dispositivo [S5]. El manual de fuerza sugiere acelerómetro, pero no lo confirma.
3. **¿El fr255 admite 50/100 Hz?** El foro dice que el aumento a 100/50 Hz depende del modelo; el reporte de un Fenix 7 a 25 Hz apuntaba al simulador [S7]. No se ha probado en fr255.
4. **Algoritmo interno de Garmin**: no publicado; no se sabe si usa picos, autocorrelación o ML, ni su precisión real [S1][S10].
5. **Contenido de la FAQ de Garmin sobre conteo**: la página existe [S10], pero su cuerpo no se pudo extraer (bloqueo anti-bot); no se usa para cifras.
6. **Workouts nativos de fuerza en el calendario**: el manual describe el flujo general [S2][S3], pero no se ha comprobado que un workout de fuerza con nuestros ejercicios aparezca como “Today’s workout” y con animaciones en el fr255.
7. **API de scheduling**: `schedule_workout` es de la librería no oficial `garminconnect`; no hay API pública documentada y puede cambiar o bloquear [INVESTIGACION-AMPLIACION.md](../INVESTIGACION-AMPLIACION.md) §3.4.
8. **WHOOP**: se ha verificado que usa accel+giro y “rep detection” en su FAQ, y que valida con >10.000 reps; **no** se ha verificado que el conteo de reps sea automático sin intervención ni su precisión [S11][S12].
9. **Hevy, Strong, Fitbod**: la ausencia de integración con Garmin se deduce de sus páginas oficiales y de la existencia de puentes de terceros [S15]–[S18][S16]; no hay una nota oficial que diga “no soportamos Garmin”.
10. **TrainingPeaks + fuerza**: el sync de 15 días está verificado para workouts estructurados [S19]; **no** se ha verificado que los workouts de fuerza de TrainingPeaks viajen a Garmin.
11. **Duraciones de repetición reales de David**: no medidas. Los rangos del perfil son semillas [P].
12. **Umbrales y precisión de nuestro detector**: no medidos; todo §5–§8 es propuesta hasta el POC.
13. **¿Se puede leer el workout nativo y sus pasos desde una watch-app?** `WorkoutStepInfo` está pensado para contexto de actividad [S9]; no se ha probado desde nuestra app. `PersistedContent` solo lista/abre/borra [S8].
14. **Ejecución en segundo plano de una watch-app** (pantalla apagada, durante una sesión larga): no verificado.
15. **Estado legal de las patentes**: Google Patents avisa de que el estado no es una conclusión legal [S27]; no hay libertad de operación estudiada.
16. **Compatibilidad de `JSON` de SQLite con PostgreSQL** en este proyecto: el modelo usa `JSON` [V-L]; para Postgres conviene `JSONB`, pero no se ha probado la migración.

---

## 12. Referencias (agrupadas)

**Garmin / Connect IQ**

- Manual FR255, fuerza: https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-46A33D74-8E94-45BC-983F-693474BBC8C9-6063.html
- Manual FR255, calendario: https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-189D7345-93D0-4344-B770-6C8B5E3DD4E8-5926.html
- Manual FR255, crear workout: https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-D6C274C9-161F-44F9-AA86-99C43471D5E8-9414.html
- Manual FR255, seguir workout de Garmin Connect: https://www8.garmin.com/manuals-apac/webhelp/forerunner255series/EN-SG/GUID-E59F74A8-9774-4027-93D3-5A5AEED52978-908.html
- Sensor API: https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor.html
- AccelerometerData: https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor/AccelerometerData.html
- PersistedContent.Workout: https://developer.garmin.com/connect-iq/api-docs/Toybox/PersistedContent/Workout.html
- Activity.WorkoutStepInfo: https://developer.garmin.com/connect-iq/api-docs/Toybox/Activity/WorkoutStepInfo.html
- Foro tasas 6.3.0: https://forums.garmin.com/developer/connect-iq/i/bug-reports/6-3-0-sdk-higher-rate-support-for-accelerometer-magnetometer-and-gyroscope
- FAQ conteo: https://support.garmin.com/en-US/?faq=xEPSpxE3j27gpEsiq8K9o8&productID=886725&tab=topics

**Papers**

- Soro et al., Sensors 2019: https://doi.org/10.3390/s19030714
- Lim & Lee, arXiv 2024: https://arxiv.org/abs/2410.00407
- King et al., arXiv 2025: https://arxiv.org/abs/2512.11854
- uLift, IEEE Access 2024: https://doi.org/10.1109/ACCESS.2024.3363437
- MiLift, IEEE TMC 2018: https://doi.org/10.1109/TMC.2017.2775641
- RecoFit, CHI 2014: https://doi.org/10.1145/2556288.2557116
- Revisión sistemática, Sports Med 2025: https://pmc.ncbi.nlm.nih.gov/articles/PMC12513948/

**Patentes**

- US10350454B1 (Moov): https://patents.google.com/patent/US10350454/en
- US11511156B2 (Shavit): https://patents.google.com/patent/US11511156B2/en

**Competencia**

- WHOOP Strength Trainer: https://www.whoop.com/us/en/thelocker/introducing-strength-trainer-a-new-way-to-quantify-the-impact-of-your-strength-training/
- WHOOP I+D: https://www.whoop.com/us/en/thelocker/the-research-and-development-behind-strength-trainer/
- COROS Strength Mode: https://support.coros.com/hc/en-us/articles/360043959812-Strength-Mode
- COROS Training Plans: https://support.coros.com/hc/en-us/articles/360048955151-Creating-and-Using-Training-Plans
- Hevy App Store: https://apps.apple.com/es/app/hevy-gym-tracker-workout-log/id1458862350?l=en-GB
- hevy2garmin: https://pypi.org/project/hevy2garmin/0.12.0/
- Strong Apple Watch: https://help.strongapp.io/article/222-strong-for-apple-watch
- Fitbod Apple Watch: https://help.fitbod.me/hc/en-us/articles/360006499194-Apple-Watch
- TrainingPeaks sync: https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export
- Runna Garmin: https://support.runna.com/en/articles/6169639-using-your-garmin-watch-with-runna
