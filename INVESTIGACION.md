# INVESTIGACION.md — Carga

**Fecha**: 2026-11-04 · **Rama**: `master` · **Nivel de autonomía**: 1 y 2 (ver `DECISIONES.md`)

Qué hay en este documento:

1. Qué se ha mirado y cómo.
2. Qué hace la competencia (panel del día y entrenamiento de fuerza).
3. Qué le falta a Garmin y qué se puede copiar con criterio.
4. **Inventario del backend**: los 58 endpoints que existen hoy y qué devuelve cada uno.
5. Qué le falta al backend para soportar el frontend nuevo.
6. Propuesta: pantallas y funcionalidades ordenadas por valor.
7. Qué se propone ejecutar y con qué nivel de autonomía.
8. La ampliación del 2026-11-04: pantallas y funciones que entran, mapa de pestañas y lo que se queda fuera.

---

## 1. Qué se ha mirado y cómo

**Método**, en este orden:

1. **Código del backend leído entero** (`backend/app/api/v1/*.py`, `db/models.py`, `services/*.py`,
   `main.py`). El contrato real no está en la documentación: casi ningún endpoint declara
   `response_model`, así que la forma de la respuesta está en el `return` del handler.
2. **Inventario del contrato generado desde el propio OpenAPI** de FastAPI (58 rutas).
3. **Contrato verificado ejecutando la API de verdad** contra una **copia** de la base de datos
   (ver §4.2). No se ha tocado la base original ni se ha llamado a Garmin.
4. **Base de datos inspeccionada en solo-lectura**: 13 tablas, qué está poblado y qué no (§4.3).
5. **Especificaciones y estado previos** leídos: `ESPECIFICACION.md`, `CONSTITUTION.md`, `SPEC.md`
   (§2b, estado por HU), `TASKS.md`, `README.md`, `PLAN.md`.
6. **Frontend viejo revisado solo como referencia** (`frontend/src`, 8 pestañas). No se toca.
7. **Competencia**: investigación web sobre Garmin Connect, Strava, Hevy, Strong, Fitbod,
   Apple Fitness y Fitbit. Fuentes en §2.9.

Lo que **no** se ha podido verificar y por tanto no se afirma: métricas de uso de las apps
(no son públicas), precios exactos a fecha de hoy (cambian), y el comportamiento del envío real
de rutinas al reloj Garmin (`push-to-garmin` solo se ha probado en `dry_run`; ver §7.3).

---

## 2. Qué hace la competencia

### 2.1 Garmin Connect — la que hay que batir

**Pantallas.** Cinco áreas en la barra inferior: **Home/Mi día**, **Retos**, **Calendario**,
**Noticias** (feed social) y **Más**. "Más" es el cajón de sastre real: Salud (sueño, VFC/HRV,
Body Battery, pasos, FC en reposo, estrés), Informes, Actividades, Entrenamiento y planificación,
Dispositivos, Insignias.

**Panel del día.** Tarjetas de actividad reciente, pasos, calorías, floors, minutos de intensidad,
FC, estrés, Body Battery, sueño, respiración, hidratación y VFC (según dispositivo). La actividad
terminada "salta" arriba. Se puede reordenar con "Edit my Day", pero es una **lista fija de 13
elementos**: no se crean tarjetas propias, no se mezclan métricas, y no se puede cambiar el
comportamiento de la tarjeta de actividad reciente.
([blog Garmin](https://www.garmin.com/en-US/blog/fitness/unlocking-the-potential-of-garmin-connect/),
[hilo "Edit my Day"](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/334287/garmin-connect-my-day-display-issues-since-may-25th-2023))

**Cómo se crea una rutina.** App y web: *Más → Entrenamiento y planificación → Entrenamientos →
Crear entrenamiento → Fuerza*. El builder está **al revés**: primero creas bloques de
trabajo/recuperación con "Add Round" y después asignas ejercicio, peso y objetivo al bloque. Para
que un 4×5 de peso muerto quede bien hay que: crear ronda, tocar tarjeta de trabajo, elegir
ejercicio/peso/reps, volver, convertir la recuperación en descanso de 3:00, cambiar el desplegable
de rondas a 4, activar "Skip Last Recovery", añadir un paso de descanso entre ejercicios, guardar
y **enviar al dispositivo a mano**. Límites duros: 50 pasos por entreno, reps ≤ 99, peso ≤ 999,9 lb,
25 entrenamientos en el reloj, edición solo en Connect y borrado independiente entre app y reloj.
Estimación: 30-50 interacciones por ejercicio. **Para variar el peso o las reps por serie hay que
salir del bloque repetido y crear otro bloque.** Es exactamente lo contrario de lo que pide el
cuerpo en el gimnasio (subir/bajar carga entre series).
([Soporte Garmin](https://support.garmin.com/en-US/?faq=wZ52AaLbLG2GC1Lxu2l4k7),
[Lifehacker](https://au.lifehacker.com/fitness/112292/feature/how-to-do-strength-workouts-on-a-garmin-watch))

**Cómo se registra una serie.** En el reloj: *Strength → entrenamiento o Free → Do Workout*. El
reloj cuenta repeticiones desde 4 y **solo de un movimiento por serie**; las piernas normalmente no
las cuenta y con menos de 5 reps muestra "—" (Garmin recomienda 8-10 reps para que funcione). Al
cerrar la serie se abre la edición: reps, icono de editar para el peso (selector numérico) y
"Done". Corregir un 82,5 kg son 8-15 interacciones; **no se puede cambiar de ejercicio a mitad de
serie**. "Auto Set" es opcional.
([manual FR965](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-AU/GUID-CF2D7922-A1AC-4510-9480-E7CE8119EAF2.html))

**Edición posterior.** *Más → Actividades → Todas → actividad → lápiz → Editar*. Funciona, pero con
historial de fallos documentados: en iOS no guardaba reps ni peso
([foro 430276](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/430276/strength-section-bugs-and-annoyance)),
el desplegable de edición masiva quedaba tapado
([435363](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/435363/can-t-edit-multiple-exercises-in-strength-activities)),
y en multisport la edición entraba en bucle
([434866](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/434866/edit-workout-not-working)).

**Lo que Garmin hace bien (no hay que perderlo).** Integración reloj-app sin fricción, el mejor
temporizador de descanso de su clase, detección automática de series opcional, animaciones de
ejercicio, mapa muscular y las métricas Firstbeat (Training Effect/Status, carga) que meten la
fuerza dentro del entrenamiento total. Y el dato duro que más se repite en foros: **el peso de la
sesión anterior no aparece en el reloj**; Garmin respondió que "no está disponible"
([hilo 441181](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/441181/how-do-you-track-progressive-overload-in-connect-weights-reps-don-t-carry-forward-between-strength-sessions)).

### 2.2 Strava — el registro de fuerza ya no es manual, pero sigue sin ser suyo

Strava soporta Weight Training, Workout, HIIT y CrossFit **con series, repeticiones, peso, volumen,
mapa muscular y workout log editable**, pero solo si un partner (Garmin, Hevy, Fitbod, WHOOP, COROS)
le manda datos a nivel de ejercicio. La entrada manual sigue siendo tiempo/distancia; la importación
por foto, texto o voz existe solo en móvil y no en web. En octubre de 2026 añadió grabación nativa
con workouts guiados para suscriptores. Su home **no es un panel biométrico**: es un feed social con
dos modos de orden y favoritos fijados.
([Strava: fuerza](https://support.strava.com/en-us/articles/15401547-strength-training),
[orden del feed](https://support.strava.com/en-us/articles/15402105-how-does-strava-order-my-activity-feed),
[nota de prensa 2026](https://press.strava.com/articles/strava-continues-to-evolve-strength-experience-with-new-coach-designed-strength-series-via-native-recording))

Lo que Strava enseña: **sin datos por serie, la fuerza no se puede mostrar** (por eso dependía de
terceros), y **editar después de entrenar debe recalcular todo** (volumen, series, mapa) cosa que
Garmin no hace bien.

### 2.3 Hevy — el referente de velocidad para registrar

Tracker social sin anuncios. Gratis: 4 rutinas, 7 ejercicios propios, 3 meses de historial; Pro
2,99 $/mes (23,99 $/año, 74,99 $ lifetime). iOS, Android, Apple Watch, Wear OS y web. 400+ ejercicios
con animación e instrucciones; custom ejercicios; notas por ejercicio.

- **Crear rutina**: *Workout → New Routine → nombre → + Add exercise* (buscar/filtrar por material y
  músculo, añadir varios) → por ejercicio añadir series, editar peso/reps, fijar **rep range** y
  **descanso por ejercicio (5 s a 5 min)** → reordenar → Save. Tope de 150 series por rutina.
- **Registrar serie**: los campos vienen **precargados con la última sesión**; ajustas y tocas el
  check (lo llaman "2-tap logging"); arranca el temporizador del ejercicio con aviso al llegar a 0.
  **Live Activity** en iOS y Android deja marcar la serie y ver el timer sin desbloquear el móvil.
  Aviso de PR en vivo. Corregir = tocar la serie ya completada.
- **Debilidades**: muros del free muy visibles, topes (150 series), no integra con Garmin.

### 2.4 Strong — el más simple, y el que más rápido se queda corto

Logger minimalista tipo hoja de cálculo. Gratis con entrenos ilimitados pero **solo 3 plantillas**;
PRO 4,99 $/mes o 29,99 $/año para plantillas ilimitadas, gráficos, calculadora de discos y de
calentamiento. iOS, Android, Apple Watch (sin web). 200+ ejercicios con vídeo según su ayuda
(congelada en 2021-2022).

- **Crear rutina**: *+ Template → añadir ejercicios → Add Set → drag & drop para reordenar → swipe
  para borrar una serie → Save*. Una plantilla **no tiene series completables ni timer**: es un
  punto de partida.
- **Registrar serie**: escribes peso/reps, tocas el checkbox y **arranca el rest timer solo (2:00
  por defecto, configurable por ejercicio y distinto para calentamiento)**; al tocarlo se abre a
  pantalla completa con botón Skip. Desmarcar para corregir o swipe para borrar la serie.
- **Debilidades**: el muro de 3 plantillas es el más agresivo para quien sigue un programa fijo; sin
  web; producto poco actualizado frente a Hevy.

### 2.5 Fitbod — genera la sesión, no la diseñas

Sin capa gratuita permanente (7 días de prueba; 15,99 $/mes o 95,99 $/año). No tiene flujo de
"crear rutina": se configura el *My Plan* (objetivo, nivel, material, split, duración) y **la app
genera la sesión del día**, que puedes editar sustituyendo ejercicios. 1.600 ejercicios según su
help center ("1000+" en la App Store: las propias cifras no cuadran).

- **Registrar serie**: propone peso y reps, corriges, marcas y corre el descanso; admite RIR. En el
  reloj: series, ajustes, timer con avisos hápticos y de audio, FC en vivo, máximo 9 series.
- **Debilidades**: precio, sugerencias de peso con incrementos que no tienes, falta de estructura
  multi-semana, y **su Watch no soporta Always On: al atenuarse la pantalla el timer se pausa y
  puede no avisar**. Depende del iPhone para empezar o guardar.

### 2.6 Apple Fitness — el mejor panel del día y el peor registrador de fuerza

Tres apps repartidas: **Salud** almacena y da permisos (HealthKit), **Fitness** presenta el resumen,
**Entrenamiento** captura en vivo. "Resumen" es el panel del día: anillos Move/Exercise/Stand,
tarjetas de pasos, distancia, tendencias, sesiones y premios, todo **reordenable y eliminable**;
metas diarias y pausa de anillos hasta 90 días; tendencias que comparan 90 días con 365 y
**micro-coaching** ("camina un cuarto de milla más al día"); Training Load 7 días vs 28.

- **Fuerza**: registra FC, calorías, duración y esfuerzo percibido, pero **no series, ni
  repeticiones, ni peso, ni nombre de ejercicio**. No hay modelo de datos de serie ni detección
  automática de series. Lo resuelven apps de terceros (Hevy, Strong, Fitbod, SmartGym), y si corren
  a la vez con el reloj, Salud muestra **dos entrenamientos duplicados**.
- **Lo que hace excepcionalmente bien**: un número héroe (anillos) + tarjetas escaneables, color
  semántico estable, permisos granulares, widgets, estados vacíos honestos ("faltan 180 días para
  tendencias") y separación clara entre "día" y "tendencia".

### 2.7 Fitbit / Google Health — el panel del día más legible y el producto más inestable

**Corrección de premisa**: las pestañas Today/Discover/Community/You ya no existen. Cronología:
hasta 2023 Today/Discover/Community; rediseño de septiembre 2023 a Today/Coach/You; desde el **19 de
mayo de 2026** la app es Google Health con **Today/Fitness/Sleep/Health**. El panel *Today* tiene
arriba "focus metrics" (anillos y barras, personalizables) y debajo un feed de tarjetas.

- **Fuerza**: el registro manual documentado solo admite **tipo, inicio/fin, distancia y calorías**:
  no hay campos de series, reps ni peso. La detección automática cubre caminar, correr, bici,
  deportes, elíptica, aeróbic y natación, pero **fuerza no está en la lista**. Consecuencia: la
  fuerza queda como duración + FC, sin estructura.
- **Bien**: Today muy legible, Sleep Score, Readiness, Morning Brief, cardio load y color
  consistente. **Mal**: muro de pago creciente, IA impuesta, pérdida de datos y funciones y
  pestañas que cambian cada tres años (rompe la memoria muscular).
([Google Health Help](https://support.google.com/googlehealth/answer/17068213?hl=en),
[registro manual](https://support.google.com/googlehealth/answer/14236402?hl=en),
[Wikipedia Fitbit](https://en.wikipedia.org/wiki/Fitbit))

### 2.8 Tabla comparativa

| | Garmin Connect | Strava | Hevy | Strong | Fitbod | Apple Fitness | Fitbit |
|---|---|---|---|---|---|---|---|
| **Panel del día** | Sí, tarjetas fijas | No (feed social) | No | No | Sí (plan) | Sí, reordenable | Sí, muy legible |
| **Crear rutina** | Builder por bloques, al revés | No (importa) | Sí, completa | Sí, básica | Genera, no diseña | No | No |
| **Series individuales** | Solo en el reloj, rígido | Solo si llegan del partner | Sí | Sí | Sí | **No** | **No** |
| **Precarga última marca** | **No** (confirmado por Garmin) | No | **Sí** | Sí | Sí (sugiere) | No | No |
| **Descanso por ejercicio** | Sí, su punto fuerte | No | Sí, 5 s-5 min | Sí, 2:00 | Sí | No | No |
| **Timer con pantalla apagada** | Sí (reloj) | No | Live Activity | No verificado | Watch se pausa | No | No |
| **Corregir después** | Con fallos documentados | Sí, recalcula | Sí | Sí | Sí | n/a | Parcial |
| **Catálogo** | Sin propios, duplicados | Heredado | 400+ | 200+ | 1.600 | n/a | n/a |
| **Precio** | Gratis (hardware) | Suscripción | 2,99 $/mes | 4,99 $/mes | 15,99 $/mes | Gratis | 9,99 $/mes |

### 2.9 Patrones que copiamos, y de quién

| Patrón | De dónde | Por qué |
|---|---|---|
| Una métrica héroe + 3-4 secundarias, reordenables | Apple, Fitbit | El panel se escanea en 3 segundos |
| Tarjeta = una idea: título, número grande, delta, sparkline | Apple, Fitbit | Nada de tablas en la vista de hoy |
| Color semántico estable; el color nunca decora | Apple, Fitbit | Verde/ámbar/rojo con significado fijo |
| Estado vacío que explica el requisito, no un cero | Apple | "faltan 3 sesiones para la tendencia" |
| Origen y frescura del dato ("sync hace 2 min") | Fitbit | Sin esto no te fías del panel |
| Precarga de la última sesión, editable en el sitio | Hevy, Strong | Cero memoria, cero scroll |
| Registrar serie en 2 toques: el check guarda y arranca el descanso | Hevy, Strong | El gesto más repetido de la app |
| Descanso por ejercicio que arranca solo | Hevy, Strong | Es *el* motivo por el que se usa la app |
| Swipe para borrar serie, arrastrar para reordenar | Strong | Dos gestos en vez de menús |
| "Guardar como plantilla" desde un entreno del historial | Strong, Hevy | La rutina nace del entreno real |
| Confirmar al descartar cambios | Strava | Evita perder una sesión entera |
| Recalcular todo al editar | Strava | Si corriges una serie, el volumen y el TSS cambian |
| Elegir el orden del feed | Strava | Personalización barata y muy valorada |

**Y lo que NO copiamos**: el builder por bloques de Garmin (al revés), el muro de suscripción de
Strong/Fitbod, el feed social de Hevy como pestaña principal (aquí el social es secundario, y ya
existe en el backend), la IA impuesta de Fitbit y las pestañas que cambian cada tres años.


---

## 3. Qué le falta a Garmin y qué copiar con criterio

### 3.1 Lo que Garmin hace mal, por tema

| # | Tema | El fallo concreto | Fuente |
|---|---|---|---|
| F1 | **Introducción de datos** | El conteo de repeticiones no es fiable: no cuenta piernas y con <5 reps muestra "—". Lifehacker directamente lo desactiva. | manual FR965, Lifehacker |
| F2 | **Progresión** | **No muestra el peso de la sesión anterior en el reloj.** Garmin respondió que "no está disponible". Es el fallo que más duele: sin eso no hay sobrecarga progresiva. | foro Garmin 441181 |
| F3 | **Plantillas** | Builder "al revés" (bloques antes que ejercicios) y **no se puede variar peso/reps por serie** sin salir del bloque repetido. | Lifehacker, LiftTrack |
| F4 | **Límites duros** | 50 pasos por entreno, 25 entrenos en el reloj, edición solo en Connect, envío al reloj manual. | Soporte Garmin |
| F5 | **Edición posterior** | Ediciones de reps/peso que no guardan en iOS; desplegable de edición masiva tapado; bucle al editar fuerza en multisport. | foros 430276, 435363, 434866 |
| F6 | **Catálogo** | Sin ejercicios propios, con duplicados y traducciones mezcladas; falta material básico (nordic curl). | foro 430276 |
| F7 | **Historial** | El informe de fuerza agrega volumen y **reinicia la selección** al cambiar el rango; no responde "¿cuánto levanté el martes?". | foro 191647 |
| F8 | **Panel del día** | 13 tarjetas fijas: no se crean tarjetas propias ni se mezclan métricas. | foro 334287, blog Garmin |
| F9 | **Navegación** | Todo vive enterrado en "Más": Salud, Informes, Actividades, Entrenamiento… | blog Garmin, soporte |
| F10 | **Continuidad** | A mitad de serie no se puede cambiar de ejercicio; cerrar la serie abre un formulario que corta el ritmo. | manual FR965 |

### 3.2 Lo que Garmin hace bien y **no** hay que perder

1. **El mejor temporizador de descanso de su clase** (razón principal por la que se usa la función).
2. **Detección automática de series** opcional, que quita trabajo.
3. **Integración reloj-app** sin fricción.
4. **Contexto fisiológico** (Training Effect/Status, carga) que mete la fuerza en el entrenamiento total
   — aquí ya lo tenemos con Banister/Readiness, mejor porque es multidisciplinar.
5. **Mapa muscular** y animaciones de ejercicio.

### 3.3 Traducción a este proyecto

| Fallo de Garmin | Nuestra respuesta | Estado |
|---|---|---|
| F2 sin peso anterior | Precarga de la última marca por ejercicio (endpoint `/strength/marks`) | **hecho en el backend** (T-01), falta la UI |
| F3 no variar por serie | Series individuales (`session_sets`): cada serie con su peso y sus reps | **hecho en el backend** (T-01) |
| F5 edición que no guarda | `PUT /strength/sessions/{id}` recalcula tonelaje y TSS | **hecho en el backend** (T-01) |
| F6 catálogo pobre | Catálogo propio de 52 ejercicios + ejercicios custom | **hecho en el backend** (T-01) |
| F1 conteo de reps | No prometemos contar reps: pedimos peso y reps, que es lo que se puede medir | decisión de diseño |
| F7 historial | Historial por ejercicio con PR y serie cronológica | **hecho en el backend** (T-01), falta la UI |
| F8 panel rígido | Panel del día con tarjetas elegibles (siguiendo a Apple) | pendiente (T-03) |
| F9 menús profundos | Navegación plana: Hoy · Entrenar · Gimnasio · Ajustes | pendiente (T-02) |
| F4/F10 límites y ritmo | Sesión de navegador, 2 toques por serie, sin pasos numerados | pendiente (T-04) |


---

## 4. Inventario del backend (lo que el frontend nuevo necesita)

### 4.1 Resumen

- **12 routers** bajo `/api/v1` + `/healthz` + `/` (sirve el `frontend/dist` viejo).
- **58 rutas** en total (51 con `/api/v1`).
- **13 tablas** en un solo `models.py`.
- **Casi ningún `response_model`**: el contrato es el diccionario que devuelve el handler.
  El frontend nuevo debe tiparlo a mano (ver §5.4).
- **Autenticación opcional en casi todo**: los endpoints que usan `get_current_user` devuelven
  `None` sin token y entonces leen las filas **legacy sin dueño** (`user_id IS NULL`).
  El frontend nuevo **debe mandar siempre `Authorization: Bearer`** o verá datos vacíos o de otro.
  Solo `calendar`, `performance`, `alerts`, `sync`, `friends`, `social` y `routes` exigen token
  (`require_current_user` → 401).

### 4.2 Verificación real (no deducida del código)

Ejecutado el 2026-11-04 con `httpx.ASGITransport` contra el propio `app`, sobre una **copia**
de `garmin_athletics.db` en un directorio temporal, con token válido del usuario existente.
Resultado: **23 de 23 GET probados devuelven 200** y la forma documentada abajo.

```
GET /healthz                                    -> keys=status
GET /api/v1/auth/me                             -> keys=created_at,display_name,email,id,username
GET /api/v1/auth/garmin-status                  -> keys=garmin_email,last_sync_at,linked,needs_reauth
GET /api/v1/sync/status                         -> keys=activities_7d,garmin_email,last_sync_at,linked,needs_reauth,scheduler_running,tss_7d
GET /api/v1/metrics/readiness                   -> keys=biometrics_available,date,readiness
GET /api/v1/metrics/daily                       -> keys=atl,biometrics_available,body_battery,ctl,date,hrv,readiness,resting_hr,resting_hr_7d,sleep,stress_avg,tsb
GET /api/v1/metrics/load?days=30                -> keys=end_date,series,start_date,total_days
GET /api/v1/metrics/trends?metric=hrv&days=30   -> keys=days,metric,series
GET /api/v1/metrics/stats?days=30               -> keys=days,series
GET /api/v1/metrics/training-status             -> keys=acute,acwr,available,balance_label,chronic,date,device,race,status_feedback,status_label,vo2max
GET /api/v1/alerts/                             -> keys=alerts,count,date
GET /api/v1/activities/?limit=5                 -> list[5] (13 campos por actividad)
GET /api/v1/strength/history?limit=5            -> list[0]   (la tabla está vacía)
GET /api/v1/strength/exercises/prs              -> list[0]
GET /api/v1/strength/suggest?focus=Push         -> 200 (motor local de respaldo, sin LLM_API_KEY)
GET /api/v1/performance/summary?sport=running   -> keys=best_effort,current,days,previous,sport
GET /api/v1/performance/zones?sport=all         -> keys=days,sport,total_secs,zones
GET /api/v1/performance/prs                     -> list[3] (sport,label,value,unit,display,activity_id,achieved_at)
GET /api/v1/calendar/?from&to                   -> keys=days,from,to
GET /api/v1/friends/                            -> keys=friends,incoming_requests,outgoing_requests
GET /api/v1/social/leaderboard                  -> keys=note,order_by,period_days,ranking
GET /api/v1/routes/                             -> list[0]
GET /api/v1/privacy-zones/                      -> list[0]
```

### 4.3 Estado de los datos hoy

Solo-lectura sobre `garmin_athletics.db`:

| Tabla | Filas | Nota |
|---|---:|---|
| `users` | 1 | cuenta existente |
| `garmin_credentials` | 1 | vinculada |
| `activities` | 26 | `lap_swimming` 9, `running` 8, `cycling` 5, `soccer` 4 · **ninguna de fuerza** |
| `daily_biometrics` | 9 | rango 2026-09-10 → 2026-09-19 (**parado**) |
| `daily_stats` | 9 | ídem |
| `fatigue_metrics` | 9 | ídem |
| `personal_records` | 3 | running |
| **`strength_logs`** | **0** | **nunca se ha registrado una sesión de fuerza** |
| `calendar_events`, `routes`, `privacy_zones`, `friendships`, `friend_invites` | 0 | sin uso |

Consecuencia para el frontend nuevo: **todo el panel del día va a arrancar con datos viejos
y el gimnasio con estados vacíos reales**. Los estados vacíos no son un caso raro: son el caso
normal de esta base de datos, y hay que diseñarlos con el mismo cariño que el estado lleno.

### 4.4 Catálogo de endpoints

Convención: `?` = parámetro opcional. `→` = forma de la respuesta.

#### Autenticación y cuenta (`/auth`)

| Método | Ruta | Devuelve |
|---|---|---|
| POST | `/auth/register` | `{access_token, token_type:"bearer", user_id, username}` (201) · 409 si email/usuario repetido |
| POST | `/auth/login` | `{access_token, token_type, user_id, username}` · 401 credenciales, 403 desactivada |
| GET | `/auth/me` | `{id,email,username,display_name,created_at}` |
| POST | `/auth/logout` | `{status:"logged_out"}` (revoca el bearer en memoria) |
| DELETE | `/auth/account` | `{status:"deleted"}` — borra filas + tokens + tracks + rutas (GDPR) |
| PUT | `/auth/garmin-credentials` | `{status:"saved", garmin_email}` o `{status:"need_mfa", ticket, message}` |
| POST | `/auth/garmin-mfa` | completa el 2FA con el `ticket` del paso anterior |
| GET | `/auth/garmin-status` | `{linked, garmin_email, needs_reauth, last_sync_at}` |
| DELETE | `/auth/garmin-credentials` | desvincula y borra tokens de disco |

Notas que importan al frontend nuevo:

- El token es **opaco**, no JWT: `payload_b64.firma_hmac`, TTL 30 días. **No hay refresh**.
  Al caducar: 401 → hay que volver a `/auth/login`. No hay endpoint de "renovar".
- La contraseña de Garmin **no se guarda** (`garmin_password_encrypted` siempre `NULL`).
- `delete_account` es irreversible y borra la BD entera del usuario: pantalla de confirmación fuerte.

#### Sincronización Garmin (`/sync`)

| Método | Ruta | Devuelve |
|---|---|---|
| POST | `/sync/garmin?target_date` | `{status:"success", message, ...}` + resumen de `run_user_sync` · 500 con detalle si falla |
| GET | `/sync/status` | `{linked, garmin_email, needs_reauth, last_sync_at, activities_7d, tss_7d, scheduler_running}` |

`sync/status` es el endpoint del **banner de estado**: vinculado / última sync / hace falta re-vincular.
Si el sync falla por autenticación, el backend marca `needs_reauth=true` solo.

#### Métricas y fatiga (`/metrics`) — el motor del panel del día

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/metrics/readiness?target_date` | `{date, readiness:{score 0-100, status: VERDE/AMARILLO/ROJO, message, components:{sleep_contribution, hrv_contribution, tsb_contribution}}, biometrics_available}` |
| GET | `/metrics/daily?target_date` | El payload grande del panel: `{date, biometrics_available, sleep:{score, seconds, hours, avg_7d, deep_seconds, light_seconds, rem_seconds, awake_seconds, time_in_bed_seconds, efficiency, bedtime, wakeup}, hrv:{overnight, weekly_avg, status, avg_7d}, resting_hr, resting_hr_7d, body_battery:{max,min,wake,curve:[[ts_ms,valor],...]}, stress_avg, tsb, atl, ctl, readiness}` |
| GET | `/metrics/load?days=30` (7-180) | `{start_date, end_date, total_days, series:[{date, atl, ctl, tsb, tss}]}` |
| GET | `/metrics/trends?metric&days` | `{metric, days, series:[{date, value}]}` · `metric` ∈ `sleep_score, sleep_hours, hrv, resting_hr, body_battery, readiness, stress` |
| GET | `/metrics/stats?days` | `{days, series:[{date, steps, step_goal, calories_total, calories_active, distance_m, intensity_minutes, floors_m}]}` |
| GET | `/metrics/training-status` | `{available, date, vo2max, device, status_feedback, status_label, balance_label, acute, chronic, acwr, race:{p5k,p10k,hm,mar}}` o `{available:false, note}` |

`/metrics/daily` **basta por sí solo para el 80 % de la pantalla "Hoy"**. Es el endpoint más
valioso que existe hoy. Devuelve `null` en los campos sin dato (dato real antes que dato bonito).

#### Avisos (`/alerts`)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/alerts/` | `{date, count, alerts:[{type, severity: info/warn/high, message}]}` |

8 reglas implementadas: `hrv_drop`, `tsb_risk`, `no_sync`, `reauth`, `low_sleep`, `rhr_high`,
`match_soon`, `no_hr`. Requiere token.

#### Actividades (`/activities`)

| Método | Ruta | Devuelve |
|---|---|---|
| POST | `/activities/manual` | `{status, activity_id, calculated_tss, activity:{name,type,duration_min,tss}}` |
| GET | `/activities/?limit&offset&sport&from&to&q` | lista de `{id, source, type, name, start_time, duration_min, distance_m, avg_hr, max_hr, gain_m, has_track, tss, rpe}` + cabecera `X-Total-Count` |
| GET | `/activities/{id}` | detalle: lo de la lista + `avg_cadence, avg_power, avg_speed_kmh, calories, loss_m, min_alt, max_alt, bbox, hr_zones, weather, laps` |
| GET | `/activities/{id}/track?max_points&crop` | `{activity_id, point_count, distance_m, gain_m, loss_m, bbox, privacy_cropped, points:{lat,lon,ele,...}}` |
| GET | `/activities/{id}/streams?max_points` | series temporales para gráficas |
| GET | `/activities/{id}/splits` | parciales por km |
| GET | `/activities/{id}/export` | fichero GPX |
| POST | `/activities/{id}/refresh` | fuerza re-descarga del detalle desde Garmin |

Aviso: `detail`, `track`, `streams` y `splits` **pueden llamar a Garmin** si el detalle no está
cacheado (primera apertura). Lento y dependiente de que los tokens estén vivos. El frontend nuevo
necesita estado de carga distinto al de "no tiene track".

#### Fuerza (`/strength`) — **el corazón del encargo**

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/strength/suggest?focus&intensity` | `GymRoutineResponse`: `{routine_name, target_focus, readiness_context, exercises:[{name, sets, reps, target_rir, notes}], estimated_duration_min, estimated_tss, calendar_warning}` |
| POST | `/strength/log` | `{status, log_id, total_tonnage_kg, computed_tss}` · esquema `{workout_date, routine_name, target_focus, exercises:[{name, sets:int, reps:int, weight_kg, rir?}], ai_generated, notes}` |
| GET | `/strength/history?limit&exercise` | lista con `{id, date, routine_name, target_focus, total_tonnage_kg, computed_tss, exercises_count, exercises}` |
| GET | `/strength/exercises/prs` | `[{name, max_weight_kg, best_volume_kg, date}]` |
| POST | `/strength/push-to-garmin` | `{status:"dry_run", unmapped_exercises, workout_json, note}` o `{status:"sent", garmin_response}` · experimental |

**Efectos secundarios que el frontend debe conocer:**

- `POST /strength/log` **crea dos filas**: el `strength_log` y una `Activity` de tipo `strength`
  con hora fija **18:00** y duración fija **2700 s (45 min)**. La duración real de la sesión se pierde.
- El TSS de fuerza se estima como `tonelaje × factor_por_foco` (lega 0.03, push/pull 0.02…).

#### Calendario (`/calendar`)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/calendar/?from&to` (≤120 días) | `{from, to, days:[{date, events:[{id,title,event_type,start,duration_min,weekday,is_immovable,notes}], activities:[{id,name,type,start,duration_min,tss}], readiness:{score,status}\|null}]}` |
| POST | `/calendar/events` | `{status:"created", id}` |
| PUT | `/calendar/events/{id}` | `{status:"updated", id}` |
| DELETE | `/calendar/events/{id}` | `{status:"removed"}` |

`event_type` ∈ `soccer, planned_workout, race, rest, strength`. `weekday` 0-6 lo hace recurrente.
`is_immovable` hace que el asistente de gimnasio respete ±48 h.

#### Rendimiento (`/performance`)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/performance/summary?sport&days` | `{sport, days, current:{sessions,hours,km,tss,gain_m,avg_hr}, previous:{...}, best_effort:{value, activity_id}}` |
| GET | `/performance/zones?sport&days` | `{sport, days, total_secs, zones:[{zone 1-5, secs, pct}]}` |
| GET | `/performance/prs?sport` | `[{sport, label, value, unit, display, activity_id, achieved_at}]` |

#### Rutas planificadas (`/routes`)

Listar, crear (lat/lon/ele + sport), obtener, exportar GPX, borrar, guardar desde actividad, e
importar GPX (multipart). Todas exigen token. Forma: `{id, name, sport, distance_m, gain_m, points, created_at}`.

#### Zonas de privacidad (`/privacy-zones`)

`GET/POST/DELETE` con `{label, center_lat, center_lon, radius_m}`. Se aplican al track al vuelo
(recorte inicio/fin), no lo borran.

#### Amigos (`/friends`)

`POST /friends/requests` (por `username`), `POST /friends/requests/{id}/respond`, `GET /friends/`
→ `{friends, incoming_requests, outgoing_requests}`, `DELETE /friends/{user_id}`,
`POST /friends/invite` → código de 6 letras (caduca 7 días), `POST /friends/accept-invite`.

#### Social (`/social`)

`GET /social/leaderboard?days&order_by` → `{period_days, order_by, ranking:[{athlete:{id,username,display_name}, weekly_tss, activity_count, ctl, tsb, readiness_score, readiness_status}], note}`.
`GET /social/friends/{user_id}/summary`. Solo se comparten agregados, nunca datos crudos.

### 4.5 Lo que el backend **no** tiene (y el frontend nuevo pide)

Esto es el hallazgo principal del inventario. La `ESPECIFICACION.md` pide catálogo, plantillas,
series individuales, temporizador y sesión que sobrevive a recargar. **Nada de eso existe hoy.**

| # | Hueco | Consecuencia |
|---|---|---|
| H1 | **No hay catálogo de ejercicios.** No hay tabla. Los ejercicios son cadenas de texto libre dentro de `strength_logs.exercises` (JSON). | Imposible buscar, filtrar por grupo muscular o material, o tener ficha. |
| H2 | **No hay plantillas de rutina.** No existe tabla `workout_template`. | No se puede "guardar una rutina" y reutilizarla: solo sugerirla otra vez o reescribirla. |
| H3 | **No hay series individuales.** `ExerciseLogItem = {name, sets:int, reps:int, weight_kg, rir?}`. Un peso y unas reps por ejercicio. | No se puede registrar `4×10@80 + 1×8@90`, ni series al fallo, ni dropsets, ni corregir **una** serie. Mata el requisito "marcar serie hecha con corrección en el momento". |
| H4 | **No hay descanso ni notas por ejercicio**, ni tempo, ni RPE por serie. | El temporizador de descanso no tiene de dónde leer el descanso prescrito. |
| H5 | **No hay CRUD de sesión**: no existe `GET /strength/log/{id}`, ni `PUT`, ni `DELETE`. | No se puede abrir una sesión guardada ni corregirla después. |
| H6 | **No hay estado de sesión en curso** en el servidor. | "La sesión sobrevive a recargar" tendrá que resolverse en el navegador (decisión en `DECISIONES.md`). |
| H7 | **No hay "última marca por ejercicio"** para precargar peso/reps. | El requisito "la última marca de cada ejercicio a la vista" hay que calcularlo en cliente a partir del historial completo o pedir un endpoint nuevo. |
| H8 | **No hay 1RM estimado ni progresión por ejercicio**. Solo `max_weight_kg` y `best_volume_kg`. | El historial por ejercicio se queda en "mejor peso", sin evolución. |
| H9 | `strength/history` devuelve el JSON de ejercicios inline y filtra **en memoria** sobre 200 filas. | Con años de historial se vuelve lento y la respuesta pesa demasiado. |
| H10 | `GET /strength/exercises/prs` es un prefijo de ruta hermano de `/{activity_id}`… no choca hoy, pero el prefijo `/strength/exercises` no está reservado como router propio. | Al añadir catálogo conviene colgarlo de `/strength/exercises` (GET lista, GET ficha, POST crear). |

### 4.6 Contrato que el frontend nuevo debería generar

Al no haber `response_model`, el tipo se escribe a mano. Recomendación Nivel 1: un único
`frontend-nuevo/src/api/types.ts` con los tipos de §4.4, generado o copiado del OpenAPI y
verificado contra la sonda de §4.2. Sin eso, el frontend se llena de `any` y el primer bug es
un `undefined` en un campo de salud.

---

## 5. Propuesta: pantallas y funcionalidades ordenadas por valor

La regla para ordenar: **valor = cuánto acerca la misión ÷ lo que cuesta**. Y dentro de eso, primero
lo que desbloquea lo demás (no se puede pintar un editor contra un backend que no lo soporta).

### 5.1 Pantallas, de más a menos valor

| # | Pantalla | Qué resuelve | Backend | Coste | Nivel |
|---|---|---|---|---|---|
| 1 | **Hoy** (panel del día) | Readiness con sus 3 componentes, sueño, HRV, Body Battery, RHR, estrés, carga ATL/CTL/TSB, avisos, estado de sync | **ya existe y verificado** | M | 2 |
| 2 | **Entrenar** (sesión en curso) | Marcar serie, corregir peso/reps, descanso, sobrevivir a recargar, resumen | nuevo (T-01, hecho) | L | 2 |
| 3 | **Rutinas** (lista + editor) | Crear una rutina y reutilizarla | nuevo (T-01, hecho) | L | 2 |
| 4 | **Catálogo** | Buscar, filtrar, ficha, crear ejercicio propio | nuevo (T-01, hecho) | M | 2 |
| 5 | **Historial de fuerza** | Sesiones, PR, progresión por ejercicio | parcial (T-01, hecho) | M | 2 |
| 6 | **Ajustes / conexión Garmin** | Vincular, 2FA, estado de sync, borrar cuenta | ya existe | S | 1 |
| 7 | **Actividades** | Lista + detalle con mapa y streams | ya existe | L | 1 |
| 8 | **Calendario** | Eventos, recurrentes, readiness por día | ya existe | M | 1 |
| 9 | **Tendencias** | 8 métricas, sparklines | ya existe | S | 1 |
| 10 | **Rendimiento** | Resumen por deporte, zonas, PRs | ya existe | M | 1 |
| 11 | **Rutas** | Planificador + GPX | ya existe | L | 1 |
| 12 | **Social** | Leaderboard, amigos, invitaciones | ya existe | M | 1 |

**La tensión a resolver (Nivel 3, E-01)**: la especificación dice que las 8 pestañas viejas son
"casi todo" y que el objetivo de la tanda es el gimnasio. Un frontend nuevo con 12 pantallas es
demasiado para la primera versión. Mi recomendación: arrancar con **Hoy + Gimnasio (Rutinas,
Entrenar, Catálogo, Historial) + Ajustes** y dejar Actividades/Rutas/Calendario/Tendencias/
Rendimiento/Social detrás de una bandera. Recortar pantallas es decisión de producto: **Nivel 3**,
está en el backlog como E-01 y **no bloquea**: T-02 construye la navegación de forma que añadir una
pantalla después cueste poco.

### 5.2 Funcionalidades nuevas, de más a menos valor

| # | Funcionalidad | Por qué vale | Esfuerzo | Nivel |
|---|---|---|---|---|
| 1 | **Series individuales** (cada serie con su peso y reps) y corregibles una a una | Sin esto no se puede ni registrar bien ni corregir; es el cimiento | backend hecho, UI M | 2 |
| 2 | **Precarga de la última marca** por ejercicio | Elimina el fallo F2 de Garmin, el que más duele | UI S | 2 |
| 3 | **Descanso por ejercicio que arranca al marcar la serie**, con hora de fin absoluta | Es *el* motivo por el que la gente usa la app; sigue contando con la pantalla apagada (D-03) | UI M | 2 |
| 4 | **Marcar serie en 2 toques** (el check guarda y arranca el descanso) | El gesto más repetido; contra los 8-15 toques de Garmin para corregir | UI M | 2 |
| 5 | **Plantillas reutilizables** + "entrenar la plantilla del día" | Rutinas de verdad, no sugerencias que se pierden | backend hecho, UI M | 2 |
| 6 | **Catálogo con filtros y ficha** | Buscar "press" y encontrarlo en 2 segundos | backend hecho, UI M | 2 |
| 7 | **Duplicar serie y duplicar ejercicio** | Lo pide la especificación; ahorra la mitad de los toques al subir carga | UI S | 2 |
| 8 | **Sesión que sobrevive a recargar** | Cerrar el navegador sin perder la sesión (D-02) | UI S | 2 |
| 9 | **Resumen al terminar**: tonelaje, PRs, comparación con la sesión anterior | Cierra el bucle y da la sensación de progreso | UI S | 2 |
| 10 | **Historial por ejercicio con progresión** | La evolución que Garmin no da (F7) | backend hecho, UI M | 2 |
| 11 | **Notas por ejercicio y por sesión** | La especificación las pide; en Garmin no existen por ejercicio | backend hecho, UI S | 2 |
| 12 | **Entrada de peso pensada para el gimnasio**: incrementos de 2,5 / 0,5 kg, teclado grande, mantener pulsado | Teclear 82,5 en un móvil sudado es el 90 % de la fricción | UI M | 2 |
| 13 | **Mantener la pantalla encendida** durante la sesión (Wake Lock, con su fallback) | Evita desbloquear el móvil 30 veces | UI S | 2 |
| 14 | **Editar una sesión guardada y recalcular TSS** | La gente corrige después de entrenar (lección de Apple y Strava) | backend hecho, UI S | 2 |
| 15 | **Calculadora de discos y de calentamiento** | Muy valorada en Hevy/Strong; barata | UI S | **3** (no está en la especificación) |
| 16 | **Supersets** | Cambia el modelo de sesión; no está en la especificación | L | **3** |
| 17 | **RPE/RIR por serie** | La especificación no lo pide | UI S | **3** |
| 18 | **1RM estimado** | Extra sobre "marca personal" | UI S | **3** |
| 19 | **PWA offline con service worker** | Añade caché y versiones; no se valida bien sin desplegar (D-05) | L | **3** |
| 20 | **Envío real de rutinas al reloj** | Nunca se ha validado con un reloj real (solo `dry_run`) | M | **3** |

Las quince primeras son **Nivel 1/2**: están en la especificación o son detalles de implementación de
pantallas ya decididas. Las cinco últimas **cambian el alcance**: se proponen y se esperan (D-05 y
`BACKLOG.md` §Esperando decisión).

### 5.3 Lo que deliberadamente **no** se propone

- **Copiar el panel de Garmin**: 13 tarjetas fijas es justo el problema. Copiamos el patrón de Apple
  (héroe + secundarias reordenables) y de Fitbit (lectura de un vistazo).
- **Un feed social como pantalla principal**: el social ya existe en el backend y es secundario en la
  misión; además obliga a moderar contenido.
- **Un catálogo de 1.600 ejercicios con vídeo**: 52 bien elegidos con grupo muscular, material y enum
  de Garmin cubren el 90 % de un gimnasio, y los que falten se crean.
- **Prometer conteo automático de repeticiones**: no tenemos hardware para hacerlo bien y es el fallo
  F1 de Garmin. Mejor pedir tres datos y hacerlo en dos toques.


---

## 6. Qué se propone ejecutar y con qué nivel

### 6.1 Lo que se ha ejecutado ya (esta sesión)

**T-01 — Backend del gimnasio** (Nivel 2, `DECISIONES.md` D-01 y D-04). Era la primera tarea del
backlog porque **desbloquea las cuatro pantallas del gimnasio** y sin ella el frontend nuevo se
escribiría dos veces.

Entregado:

- 5 tablas nuevas (`exercises`, `workout_templates`, `template_exercises`, `workout_sessions`,
  `session_sets`) creadas por `create_all`. **Ninguna columna existente se ha tocado.**
- Catálogo sembrado con **52 ejercicios en español**, con grupo muscular, material, notas técnicas y
  el `enum` de Garmin cuando se conocía. Idempotente: se puede arrancar cien veces.
- **17 endpoints nuevos** bajo `/api/v1/strength`: catálogo (listar con búsqueda y filtros, crear,
  ficha con PR, editar, borrar), historial por ejercicio, últimas marcas, plantillas (CRUD completo),
  sesiones (crear, listar paginado, detalle, corregir, borrar).
- Verificado además con `tests/verify_migration_real_db.py`: arrancar sobre una **copia de la base
  de datos real** crea las 5 tablas y 52 ejercicios, deja las 13 tablas viejas con las mismas filas
  y mantiene los 200 en los endpoints que ya existían.- La sesión guarda **cada serie por separado** y crea una `Activity` espejo de tipo `strength` para
  que la fatiga (ATL/CTL/TSB) siga sumando. `POST /strength/log` sigue funcionando igual.
- Pruebas: `tests/test_gym_v2.py` (9 grupos) y **las 7 pruebas existentes siguen en verde**.

### 6.2 Lo que se propone ejecutar después, por orden

1. **T-02 · Esqueleto del frontend nuevo** (Nivel 1): Vite + React + TS + Tailwind + React Query,
   cliente HTTP con Bearer obligatorio, tipos a mano y navegación. Desbloquea todas las pantallas.
2. **T-03 · Panel "Hoy"** (Nivel 2): la pantalla de entrada, con el backend ya hecho.
3. **T-04 · Ejecutar sesión** (Nivel 2): el corazón del encargo, familia G.
4. **T-05 · Editor de plantilla** y **T-06 · Catálogo** (Nivel 2).
5. **T-07/T-08 · Historial** (Nivel 2).

### 6.3 Lo que necesita una decisión de David (Nivel 3)

1. **E-01, la más importante**: ¿el frontend nuevo mantiene las 8 pestañas o se recorta a
   Hoy + Gimnasio + Ajustes? Está en `BACKLOG.md` y **no bloquea**: T-02 diseña la navegación para
   que añadir pantallas después sea barato.
2. Supersets, calculadora de discos, PWA offline, RPE por serie, 1RM estimado y envío real al reloj
   (E-02 a E-06 en el backlog): son ampliaciones de alcance, propuestas y aparcadas.
3. La **frontera del `.env`** sigue igual: nada de secretos en git y la base de datos no se sube.


---

## 7. Riesgos y cosas que no se han podido verificar

1. **Los datos están parados** desde 2026-09-19. Cualquier pantalla que se enseñe con "hoy" saldrá
   vacía hasta que se sincronice. Hay que probar la UI con datos sembrados, no solo con la BD real.
2. **`push-to-garmin` nunca se ha enviado de verdad** (solo `dry_run`). Enviar una rutina al reloj
   no debe entrar en la primera versión del frontend sin validarlo antes con un reloj real.
3. **El temporizador con pantalla apagada** depende del navegador: `Notification` + Service Worker
   no están garantizados en iOS. La decisión de producto está en `DECISIONES.md`.
4. **Autenticación opcional**: un frontend que olvide el Bearer no da error, da datos vacíos.
   Es una trampa silenciosa; merece una prueba.
5. **Base de datos en SQLite y migraciones idempotentes** `ALTER TABLE` al arrancar. Añadir tablas
   es seguro (`create_all`), pero hay que comprobar el arranque en limpio y sobre la BD existente.
6. **No se ha probado el flujo 2FA de Garmin** (requiere la cuenta y el móvil de David).

---

## 8. Ampliación (2026-11-04): pantallas y funciones que entran

**Por qué hay sección nueva.** David decidió en `ESPECIFICACION.md` (2026-11-04) que el frontend nuevo arranca con **Hoy · Gimnasio · Ajustes** y el resto detrás de una bandera, y añadió una condición: **la bandera no es excusa para no hacerlas**. Con la investigación de §2 delante, el criterio de entrada es uno: **resuelve una pregunta que el usuario se hace de verdad**. Se adopta lo que la competencia demuestra valioso —sin copiar sus defectos (§2.9 y el cierre de §5.3)— y lo que no cumple el criterio se queda fuera y se dice por qué.

Las ocho entradas de §8.1 nacen en `BACKLOG.md` como tareas **Nivel 2** (T-13 a T-20) y **no se implementan en T-02**: T-02 solo deja la navegación preparada para que añadirlas después cueste poco (`DECISIONES.md` D-08).

Con esto queda resuelta la tensión de §5.1 (E-01): David elige arrancar con tres pestañas y encender el resto con la bandera, no renunciar a ellas. Y se actualiza §5.2: la **calculadora de discos**, que allí figura como Nivel 3 (fila 15, E-03), pasa a Nivel 2 como **T-19**.

### 8.1 Tabla de adopción

Coste: **S** = una acción o una pantalla pequeña; **M** = una pantalla con lógica y datos; **L** = varias pantallas o cambio de modelo.

| # | Nombre | Qué hace | De quién se copia | Por qué vale | Encaja en | Coste |
|---|---|---|---|---|---|---|
| 1 | **Entrenar sin plantilla** (sesión libre) | Empezar una sesión vacía y añadir ejercicios sobre la marcha | Hevy, Strong | Cubre los días sin rutina; evita el flujo rígido del builder de Garmin (F3) | Pantalla Entrenar | M |
| 2 | **Resumen al terminar la sesión** | Tonelaje, series por grupo muscular, PRs y comparación con la última sesión del mismo día o rutina | Hevy, Strong, Strava | Cierra el bucle y demuestra el progreso: es la pregunta que Garmin no responde (F7) | Pantalla de fin de sesión | S |
| 3 | **Progreso de fuerza** | Volumen semanal, series por grupo muscular, frecuencia y racha; detecta músculos desatendidos | Fitbod (músculos), Hevy (volumen), Apple Fitness (tendencias) | Convierte el historial en decisiones: qué falta y qué sobra | Pantalla nueva **Progreso** | M |
| 4 | **Marcas personales (PRs)** | Lista de récords por ejercicio con fecha y mejor serie; aviso de PR al terminar | Hevy, Apple Fitness (premios) | Recompensa barata y motivadora; el historial deja de ser un archivo | Pestaña **Marcas** | S |
| 5 | **Guardar sesión como plantilla** | Desde el detalle de una sesión: "guardar como rutina" | Strong, Hevy | La rutina nace del entreno real, no de un builder vacío | Acción en Historial y detalle de sesión | S |
| 6 | **Calendario semanal de entrenamiento** | Asignar plantillas a días de la semana y verlas junto a la disposición (readiness) | Garmin (calendario), Apple Fitness (resumen) | El plan deja de estar enterrado en "Más" (F9) y se ve junto al cuerpo del día | Pantalla **Calendario** | M |
| 7 | **Calculadora de discos y de calentamiento** | Qué discos poner por lado para un peso y qué series de aproximación hacer | Strong | El cálculo mental es fricción real en el gimnasio; estaba aparcada como E-03 | Herramienta dentro de la sesión | S |
| 8 | **Preferencias de unidades y descanso** | kg/lb, duración de descanso por defecto, aviso de descanso | Garmin (descanso), Hevy | Se usa a una mano y en un gimnasio; adapta la app al atleta | Ajustes | S |

Lo que las ocho tienen en común: **ninguna toca el modelo de datos ni migra nada**. Son pantallas y acciones sobre lo que el backend ya devuelve (sesiones con series, marcas, historial y calendario), por eso son reversibles.

### 8.2 Lo que se deja fuera y por qué

- **Supersets (E-02).** Cambian el modelo de sesión: dos ejercicios en un mismo bloque, con su descanso propio. No es una pantalla nueva, es otro modelo; se queda fuera hasta que David lo decida.
- **RPE/RIR por serie (E-06).** La especificación pide peso y repeticiones; añadir esfuerzo percibido obliga a decidir qué hacer con el dato cuando falta. Hevy o Fitbod lo tienen, aquí todavía no está pedido.
- **PWA offline con service worker (E-04).** Añade caché y versiones que no se validan bien sin despliegue; D-02 y D-03 ya cubren "no perder la sesión" y "el descanso sigue contando".
- **Envío real al reloj (E-05).** `push-to-garmin` solo se ha probado en `dry_run`. Enviar una rutina sin haberlo validado con un reloj real sería declarar que funciona sin haberlo hecho.
- **El feed social como pantalla principal.** Obliga a moderar contenido y no es la misión. El social ya existe en el backend y se enciende con la bandera; no se convierte en la pestaña de entrada.
- **1RM estimado (E-07).** Se muestra solo si David lo pide: una estimación a partir de una serie es precisión inventada si se enseña como dato. Las marcas personales de §8.1-4 se miden, no se estiman.

### 8.3 Mapa de pestañas resultante

**Visibles desde el primer día** (`DECISIONES.md` D-08):

| Pestaña | Qué contiene |
|---|---|
| **Hoy** | Panel del día: readiness y sus tres componentes, sueño, HRV, Body Battery, FC en reposo, estrés, carga ATL/CTL/TSB, avisos y estado de sync. |
| **Gimnasio** | Sección con cinco pantallas dentro: **Entrenar** (sesión en curso y sesión libre, T-13), **Rutinas** (lista y editor de plantilla), **Catálogo** (búsqueda y ficha), **Historial** (sesiones y detalle, de donde sale "guardar como plantilla", T-17) y la **calculadora de discos** como herramienta dentro de la sesión (T-19). |
| **Ajustes** | Vincular Garmin con 2FA, estado de sync, preferencias de unidades y descanso (T-20), interruptor para ver las pantallas de bandera y borrar cuenta. |

**Detrás de `VITE_FEATURE_EXTENDED`** (con interruptor en Ajustes):

| Pantalla | Qué resuelve | Nace en |
|---|---|---|
| **Actividades** | Lista y detalle con mapa, streams y parciales | §5.1-7 (ya propuesta) |
| **Calendario** | Eventos, recurrentes y plantillas asignadas a días de la semana | T-18 |
| **Tendencias** | Evolución de las 8 métricas con sparklines | §5.1-9 (ya propuesta) |
| **Rendimiento** | Resumen por deporte, zonas y PRs | §5.1-10 (ya propuesta) |
| **Rutas** | Planificador y exportación GPX | §5.1-11 (ya propuesta) |
| **Social** | Leaderboard, amigos e invitaciones | §5.1-12 (ya propuesta) |
| **Marcas** | Récords por ejercicio con fecha y mejor serie | T-16 |
| **Progreso** | Volumen, series por grupo muscular, frecuencia y racha | T-15 |

**Nota de coherencia.** La fila F9 de §3.3 hablaba de una navegación plana "Hoy · Entrenar · Gimnasio · Ajustes". Con la decisión de David, **Entrenar deja de ser pestaña y pasa a ser pantalla dentro de Gimnasio**: manda este mapa. Las pantallas marcadas con tarea nueva nacen en el backlog como **Nivel 2** y **no se implementan en T-02**; las que ya estaban en §5.1 se encienden con la bandera cuando su tarea del backlog esté hecha.

### 8.4 Fuentes

Enlaces ya citados en §2 (no se añaden URLs nuevas):

- **Garmin Connect**: [blog del panel "Mi día"](https://www.garmin.com/en-US/blog/fitness/unlocking-the-potential-of-garmin-connect/), [soporte: crear entrenamiento](https://support.garmin.com/en-US/?faq=wZ52AaLbLG2GC1Lxu2l4k7), [manual FR965](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-AU/GUID-CF2D7922-A1AC-4510-9480-E7CE8119EAF2.html) y los hilos de foro [441181](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/441181/how-do-you-track-progressive-overload-in-connect-weights-reps-don-t-carry-forward-between-strength-sessions), [430276](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/430276/strength-section-bugs-and-annoyance), [435363](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/435363/can-t-edit-multiple-exercises-in-strength-activities), [434866](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/434866/edit-workout-not-working) y [334287](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/334287/garmin-connect-my-day-display-issues-since-may-25th-2023).
- **Strava**: [fuerza](https://support.strava.com/en-us/articles/15401547-strength-training), [orden del feed](https://support.strava.com/en-us/articles/15402105-how-does-strava-order-my-activity-feed) y [nota de prensa 2026](https://press.strava.com/articles/strava-continues-to-evolve-strength-experience-with-new-coach-designed-strength-series-via-native-recording).
- **Fitbit/Google Health**: [ayuda de Google Health](https://support.google.com/googlehealth/answer/17068213?hl=en), [registro manual](https://support.google.com/googlehealth/answer/14236402?hl=en) y [Wikipedia](https://en.wikipedia.org/wiki/Fitbit).
- El foro de Garmin **191647** (fallo F7) se cita en §3.1 sin URL; no se inventa una.
- **Hevy, Strong, Fitbod y Apple Fitness** están descritos en §2.3-2.6 sin enlace directo en este documento; la ampliación no añade fuentes nuevas para ellas.
