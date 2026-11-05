# Actividades y sus gráficas — investigación de competencia y propuesta de pantalla

Fecha: 2026-11-05. Autor: research-actividades. Alcance: **detalle de una actividad** (datos, gráficas,
jerarquía, estados) y **lista de actividades**; más el inventario real de lo que nuestro backend puede
dar hoy. App objetivo: **PULSO**, móvil primero, `frontend-nuevo` (React 19 + Tailwind,
sin librerías de gráficas ni de mapas — `frontend-nuevo/package.json:22-28`), sobre el sistema de
diseño de `frontend-nuevo/src/styles/tokens.generated.css`.

Regla de este documento: **cada afirmación lleva fuente o va marcada como propuesta**. Lo que no se
pudo comprobar está en §8, no disfrazado de dato.

---

## 1. Resumen ejecutivo

1. **Todas las apps serias separan "resumen" de "análisis".** El resumen (3–6 cifras, mapa) responde
   *qué hice*; el análisis (gráficas + parciales + zonas) responde *cómo me fue*. Strava lo hace con
   un panel de resumen persistente arriba y "View Analysis" aparte ([Strava, Run Activity Pages](https://support.strava.com/en-us/articles/15401883-run-activity-pages));
   COROS pone mapa arriba y "scroll down to view graphs" ([COROS Help](https://support.coros.com/hc/en-us/articles/15284799576980-Activities-Page-Activity-Summary));
   TrainingPeaks es el extremo: "Analyze 360" con biblioteca de gráficas configurable ([TrainingPeaks Help](https://help.trainingpeaks.com/hc/en-us/articles/36837856738957-Analyze-360)).
2. **El inventario de gráficas es convergente**: ritmo/velocidad, FC, desnivel, cadencia, potencia,
   temperatura, mapa, parciales/vueltas, zonas de FC y potencia. Strava documenta las series que
   existen en su API: `time, distance, latlng, altitude, velocity_smooth, heartrate, cadence, watts,
   temp, moving, grade_smooth` ([Strava API v3](https://developers.strava.com/docs/reference/)); COROS
   nombra "pace/speed, heart rate, elevation gain, and more" ([COROS Help](https://support.coros.com/hc/en-us/articles/15284799576980-Activities-Page-Activity-Summary)).
3. **Nadie enseña todas a la vez en móvil.** COROS y Strava muestran el juego de gráficas y dejan que
   el usuario expanda o cambie de pestaña; TrainingPeaks guarda una *vista* por deporte. La lección:
   **pocas gráficas por defecto y una interacción clara para profundizar**.
4. **Lo que no se copia**: el feed social como pantalla principal (Strava), el muro de suscripción
   (Strava Premium, TrainingPeaks Premium: *"some of the features listed below require a TrainingPeaks
   Premium Subscription"*), las vistas configurables (Analyze 360 no cabe en 400 px) y el comentario
   generado por IA (Runna: *"comentarios personalizados generados por IA"*,
   [Runna Support](https://support.runna.com/es/articles/10494265-que-es-el-analisis-del-entrenamiento)).
5. **Nuestro backend ya da el 80 % de un detalle decente y el 100 % de la lista**: `GET
   /api/v1/activities/{id}` devuelve 24 campos con vueltas, zonas de FC y meteo
   (`backend/app/api/v1/activities.py:245-271`), `/{id}/streams` devuelve FC y ritmo punto a punto
   (`activities.py:377-393`, `backend/app/services/track_service.py:258-285`), `/{id}/track` devuelve
   la polilínea y `/{id}/splits` los parciales por km (`activities.py:274-315`, `activities.py:396-411`).
6. **Pero hay tres agujeros medidos, no supuestos**: (a) la altitud punto a punto es `null` en el
   100 % de nuestros tracks (0 de 18.404 puntos); (b) la velocidad del stream viene a **0 en el 100 %
   de los puntos**; (c) `avg_cadence`, `avg_power` y `avg_speed_kmh` **no los escribe nadie** en la BD
   hoy. Detalle y método en §5.3; consecuencias para el diseño: **no se pinta cadencia, potencia ni
   perfil de desnivel hasta arreglar el backend**.
7. **Propuesta**: pantalla de detalle en 7 bloques (cabecera → resumen héroe → recorrido → FC → ritmo
   por km → zonas → vueltas → meteo, en ese orden), **gráficas SVG propias** reutilizando el patrón de
   `frontend-nuevo/src/components/charts.tsx:11-26`, **recorrido como silueta SVG** (no hay teselas ni
   Leaflet en `frontend-nuevo`), y **los cuatro estados** con textos de una línea, borrando los textos
   técnicos que hoy tiene el detalle viejo (`frontend/src/components/ActivityDetail.tsx:316`, `:196`,
   `:214-217`) por `DOCTRINA-CALIDAD.md` §8.
8. **Tareas propuestas**: T-35 (detalle, Nivel 2 — está en `ESPECIFICACION.md:109`), T-36 (gráficas SVG,
   Nivel 1), T-37 (lista con filtros y estados, Nivel 1), T-38 (arreglo de paginación/filtros en SQL,
   Nivel 2), T-39 (altitud de streams, Nivel 2, opcional). Lo que **no** se propone y por qué: §6.6.

---

## 2. Fuentes y método

**Método.** Lectura de documentación oficial de cada app (centros de ayuda y referencias de API),
descripción pública de las tiendas y **las capturas que ya están en `research/capturas/`** (hechas el
2026-11-04 por la tarea de UI y descritas aquí de nuevo, sin copiar ningún asset). No se abrió ninguna
cuenta, no se instaló ninguna app y no se descargó ningún recurso gráfico ajeno. Las cifras de nuestro
backend salen de ejecutar consultas de solo lectura contra `garmin_athletics.db` y de leer
`data/tracks/**` (§5.3): **son medidas, no estimadas**.

### 2.1 Tabla de fuentes

| # | Fuente | URL | Tipo | Se usa para |
|---|---|---|---|---|
| F1 | Strava Help · Run Activity Pages | https://support.strava.com/en-us/articles/15401883-run-activity-pages | Oficial, texto | Resumen persistente, Pace Analysis, distribución de ritmo, Relative Effort, zonas FC, segmentos, vueltas |
| F2 | Strava Help · Viewing Activities | https://support.strava.com/en-us/articles/15401981-viewing-activities | Oficial, texto | "View Analysis": desnivel, ritmo/velocidad, FC; cadencia solo en bici; zonas para suscriptores |
| F3 | Strava API v3 · referencia | https://developers.strava.com/docs/reference/ | Oficial, contrato | Lista exacta de series (`StreamSet`) y campos de `DetailedActivity` (temp, watts, elev_high/low, cadence, splits, laps) |
| F4 | COROS Help · Activities Page & Activity Summary | https://support.coros.com/hc/en-us/articles/15284799576980-Activities-Page-Activity-Summary | Oficial, texto | Mapa arriba, gráficas expandibles, filtros de la lista, tabla de vueltas y filtro 1 km/5 km, estadísticas |
| F5 | TrainingPeaks Help · Analyze 360 | https://help.trainingpeaks.com/hc/en-us/articles/36837856738957-Analyze-360 | Oficial, texto | Biblioteca de gráficas, solape de hasta 5 canales, detección de intervalos y subidas, comparación de vueltas |
| F6 | WHOOP · How does the Strain Target work? | https://www.whoop.com/us/en/thelocker/strain-coach/ | Oficial, texto | Strain 0–21, strain de día vs de sesión, zonas de FC en vivo, "Activity Details" |
| F7 | Runna Support (ES) · Análisis del entrenamiento | https://support.runna.com/es/articles/10494265-que-es-el-analisis-del-entrenamiento | Oficial, texto | Análisis post-sesión, valoración pulgar arriba/abajo, no disponible en carreras libres |
| F8 | Suunto App · ficha de App Store | https://apps.apple.com/us/app/suunto/id1230327951 | Oficial, descripción | Resúmenes de entrenamiento, tendencias, heatmaps, datos compartibles |
| F9 | Apple Support · Fitness en iPhone (origen de la captura) | https://support.apple.com/guide/iphone/get-started-with-fitness-ipha5dddb411/ios | Oficial, captura | Pantalla "Summary": anillos + tiles con sparkline |
| F10 | Garmin Connect · ficha de Google Play (origen de las capturas 01–03) | https://play.google.com/store/apps/details?id=com.garmin.android.apps.connectmobile&hl=en&gl=US | Oficial, captura | "Today's Activity" (distancia, tiempo, ritmo, miniatura de mapa), tarjetas del panel |
| F11 | Garmin · blog "Unlocking the Potential of Garmin Connect" | https://www.garmin.com/en-US/blog/fitness/unlocking-the-potential-of-garmin-connect/ | Oficial, texto | Contexto del panel (consultado; el HTML público devuelve navegación y no el cuerpo del artículo → ver §8) |
| F12 | `research/UI-COMPETENCIA.md` §2.1, §5 | (documento interno del repo) | Interno | Descripción visual de las capturas 01–03 de Garmin ya hecha con las mismas imágenes |

**Fecha de consulta:** 2026-11-05.

### 2.2 Capturas descritas

Capturas propias, **390×844 CSS px, DSF 2 (PNG 780×1688)**, en `research/capturas/`. Son páginas
públicas de tienda/soporte; se describen, **no se recortan ni se reutilizan** como assets del producto.

- **`garmin-connect-01.png`** — arte promocional ("Everything you need to beat yesterday") con pantalla
  real dentro. Se ve: cabecera `Home` con avatar, campana, refrescar y mini-anillo; bloque
  **"Today's Activity"** con etiqueta `Running`, `6.22 mi` grande, `55:15 · 8:53 /mi` y **miniatura de
  mapa** a la derecha; debajo **"In Focus"** con *Sleep Score* `90`, `Excellent / Quality`,
  `8h 12m / Duration` y un **gráfico de barras multicolor** con eje horario `10:42 PM – 6:54 AM`; puntos
  de paginación y "At a Glance · See All". **Lectura:** la tarjeta de actividad de Garmin es **una
  cifra héroe (distancia) + tiempo + ritmo + miniatura de mapa**; no hay gráfica de la actividad en el
  panel.
- **`strava-02.png`** — arte "Turn your stats into stories" con pantalla real. Se ve la pantalla de
  actividad compartida: `Your Story 2h`, y **tres métricas apiladas y centradas**: `Distance 14.7 mi`,
  `Elev Gain 512 ft`, `Time 1h 30m`; debajo, **el contorno naranja del recorrido** (polilínea sin
  teselas) y fotos. **Lectura:** en Strava móvil el resumen es de **tres métricas, en columna**, y la
  geometría se dibuja como trazo, no como mapa con calles. **No hay ninguna gráfica de series en esta
  captura.**
- **`apple-fitness-01.png`** — página de soporte de Apple, captura real de la app. Se ve la pestaña
  **`Summary`**: tarjeta `Activity Rings` (anillo + `Move 370/800 CAL`, `Exercise 28/30 MIN`,
  `Stand 3/12 HRS`), dos tiles medianos `Step Count 2,210` y `Step Distance 2.77 MI`, cada uno con una
  **micro-gráfica de barras** sobre eje `12AM–6PM`, tarjeta Fitness+ y barra de 4 pestañas
  (`Summary · Fitness+ · Workout · Sharing`). El texto de la propia Apple debajo: *"Open the Fitness app
  to see a summary of your Activity rings, the number of steps you've taken, distance traveled, trends,
  and more… tap Edit Summary"*. **Lectura:** un héroe (anillos) + tiles con sparkline; el detalle de un
  entrenamiento concreto no aparece en esta captura.

**No hay captura propia de la pantalla de *detalle de actividad* de Garmin, COROS, Suunto, Whoop ni
TrainingPeaks** (§8). Las afirmaciones sobre esas pantallas se apoyan en su documentación (F1–F8), no en
píxeles.

---

## 3. Inventario comparado: qué enseña el detalle de una actividad

Solo filas con fuente. "—" = no aparece en la fuente consultada (puede existir y no estar documentado;
§8).

| Dato / bloque | Garmin Connect | Strava | COROS | Suunto | TrainingPeaks | WHOOP | Runna | Apple Fitness |
|---|---|---|---|---|---|---|---|---|
| Distancia | **Sí** (tarjeta del panel, F10) | Sí (`Distance`, `splits_metric`, F1/F3) | Sí (F4) | Sí (dato compartible, F8) | Sí (canal de datos, F5) | No propio: importa de Strava (F6) | Sí (compara plan vs hecho, F7) | Sí (`Step Distance` en el panel, F9) |
| Tiempo / duración | **Sí** (`55:15`, F10) | Sí (elapsed/moving, F1/F3) | Sí (F4) | Sí (F8) | Sí (F5) | Sí (duración de la sesión, F6) | Sí (F7) | Sí |
| Ritmo / velocidad | **Sí** (`8:53 /mi`, F10) | Sí (pace/speed analysis, F1) | Sí ("pace/speed", F4) | Sí (speed/pace) | Sí (canal) | No de forma nativa (F6) | Sí (F7) | — |
| FC (media, serie) | Sí (panel y detalle, F12 corpus) | Sí (gráfica y zonas, F1/F2) | Sí ("heart rate", F4) | — | Sí (canal) | Sí (FC en vivo y por zonas, F6) | — | — |
| Desnivel | Sí (F12 corpus) | Sí (elevación en Analysis, F2) | Sí ("elevation gain", F4) | — | Sí (canal) | No (F6) | — | — |
| Cadencia | — | Sí, **solo bici/virtual/e-bike** (F2); campo `average_cadence` (F3) | — | — | Sí (canal) | — | — | — |
| Potencia | — | Sí (zonas de potencia para bici, F2; `average_watts`, `max_watts`, `weighted_average_watts`, F3) | — | — | Sí (canal; Normalized Power) | — | — | — |
| Temperatura | — | Sí (`temperature` stream y `average_temp`, F3) | — | — | Sí (canal; no recalculable en tramos personalizados, F5) | — | — | — |
| Mapa | **Sí** (miniatura en panel, F10) | Sí, a pantalla completa y enlazado a los parciales (F1) | Sí, arriba del todo (F4) | — (heatmaps de rutas, F8) | — | — | — | — |
| Parciales por km | — | Sí (`splits_metric` con `pace_zone`, F3) | Sí, con filtro 1 km/1 mi (F4) | — | Sí (grid de vueltas, F5) | Anunciado para Activity Details (F6) | — | — |
| Vueltas / intervalos | — | Sí (`laps`, F1) | Sí: fases de calentamiento/serie/descanso y filtro de series activas (F4) | — | Sí: vueltas de dispositivo, de usuario, detectadas, subidas, comparación (F5) | — | — | — |
| Zonas de FC | — | Sí (Heart Rate, con Relative Effort, F1) | Sí ("intensity distribution", F4) | — | Sí (canales) | Sí (zona en vivo, F6) | — | — |
| Zonas de potencia | — | Sí para bici (F2) | — | — | Sí (F5) | — | — | — |
| Efecto del entrenamiento | — | *Relative Effort* (carga percibida cardiovascular, F1) | EvoLab (F4) | — | TSS / Normalized Power (F3, F5) | Strain de sesión 0–21 (F6) | — | — |
| Carga / recuperación | — | — | Training Load (F4) | — | TSS (F5) | Strain del día + Recovery previo (F6) | — | — |
| Comparación con la misma ruta | — | Segmentos + "matched runs" (F1) | Comparar con actividades históricas (F4) | — | Comparación de vueltas contra una base (F5) | — | Compara con el plan, no con la ruta (F7) | — |
| Comentario / interpretación | — | Athlete Intelligence (F1, artículo enlazado) | EvoLab / análisis (F4) | — | — | Recomendación de Strain Target (F6) | **Sí, IA** (F7) | — |

**Lo que se deduce de la tabla.** (a) Nadie que no sea de ciclismo enseña potencia; (b) la temperatura
es rara y suele venir como serie, no como cifra; (c) "efecto del entrenamiento" y "carga" son **cada
app su métrica** (TSS en TrainingPeaks, Relative Effort en Strava, Strain en Whoop) — no hay estándar;
(d) la comparación con la misma ruta **solo Strava y COROS** la resuelven, y con un modelo de datos
propio (segmentos / actividades históricas), no con un truco de UI.

### 3.1 Fichas por app (solo lo verificado)

**Strava (F1, F2, F3).** El panel de resumen es **persistente en todas las vistas** y se puede colapsar
(F1). El análisis se separa en pestañas: *Overview*, *Pace Analysis* (parciales/vueltas + perfil de
elevación + mapa, con resaltado cruzado al pasar el cursor), *Pace Distribution* (zonas de ritmo),
*Heart Rate* (tiempo por zona + Relative Effort), *Segments*, *Laps* (F1). La cadencia solo existe para
bici (F2). En la API, `DetailedActivity` trae `average_temp`, `average_watts`, `max_watts`,
`weighted_average_watts`, `elev_high`, `elev_low`, `average_cadence`, `suffer_score`, `splits_metric`,
`laps` y `segment_efforts` (F3).

**COROS (F4).** Arriba: **GPX del recorrido**, mapa muscular en fuerza o distribución de intensidad en
interior. Debajo, **gráficas de ritmo/velocidad, FC, desnivel y más**, y **cada gráfica se expande al
tocarla** con solape interactivo de varios datos y arrastre del dedo para leer un tramo. Al final, la
**tabla de vueltas** con vista apaisada y **filtro por km/milla** (carrera) o 5 km/5 mi (bici); en
entrenamientos estructurados muestra calentamiento, series, descansos y enfriamiento, con filtro para
ocultar descansos. La lista se filtra por tipo de actividad y por *tags* (notas, RPE, media, grupo).

**TrainingPeaks (F5).** "Analyze 360": biblioteca de gráficas con cuatro tipos (**línea simple, apilada,
multicanal y grid de vueltas**), solape de **hasta 5 canales**, reordenar y redimensionar, **vista
guardada por deporte**, **detección de intervalos** (por potencia o ritmo normalizado, con umbral de
zona y duración: Z3 8 min, Z4 2 min, Z5 45 s, Z6 20 s, Z7 7,5 s), **detección de subidas** y
**comparación de vueltas** contra una base. La temperatura y la oscilación vertical no se pueden
recalcular en tramos personalizados porque las calcula el dispositivo.

**WHOOP (F6).** Strain 0–21 logarítmico; **strain de día** (todo el día) frente a **strain de sesión**;
zonas de FC en vivo; **no tiene GPS propio** y declara que "WHOOP doesn't show live pace, splits, or
distance" — el ritmo y los splits llegan cuando la actividad se registra en Strava. La tabla de su
artículo dice literalmente que el strain de sesión se muestra en **"Activity detail"** y que el de día
en el resumen diario. Anuncia "splits in Activity Details" con el rediseño de noviembre.

**Runna (F7).** El análisis es **post-sesión y textual**: compara el entrenamiento planificado con el
realizado, destaca marcas y progreso. Se desbloquea valorando la sesión con pulgar arriba/abajo. **No
está disponible en carreras libres, fuerza, yoga, pilates, estiramientos, parkruns.** Es el único de la
lista que no intenta competir en gráficas.

**Apple Fitness (F9).** El panel `Summary` es un héroe (anillos) + tiles con **micro-gráficas de barras**
+ personalización ("Edit Summary"). La captura no muestra el detalle de un entrenamiento.

**Suunto (F8).** La ficha oficial describe "key training, activity and sleep summaries", tendencias,
heatmaps por actividad, y que al compartir se eligen **distancia, calorías, velocidad, ritmo, duración,
FC, ascenso y velocidad máxima**. No detalla el detalle de una actividad → §8.

**Garmin Connect (F10, F12).** Verificado en capturas: la tarjeta de actividad del panel muestra
**distancia héroe, tiempo, ritmo y miniatura de mapa**, y el resto son tarjetas del día (sueño, Body
Battery, Garmin Coach con `TIME / PACE / AVG HR`). **No se pudo verificar en fuente primaria el
inventario de gráficas de su pantalla de detalle** → §8; no se inventa aquí.

---

## 4. Lista frente a detalle: jerarquía y filtros

### 4.1 Qué va en la lista

| App | Qué enseña por fila | Filtros de la lista | Fuente |
|---|---|---|---|
| Garmin Connect | Tarjeta de la actividad del día: deporte, **distancia** (héroe), tiempo, ritmo, miniatura de mapa | — en la captura | F10 |
| Strava | Actividad del feed; el resumen completo vive en el detalle (persistente) | — en la fuente | F1 |
| COROS | Historial + detalle; la lista se filtra **por tipo** y por **tags** (notas, RPE, media, grupo) | Sí | F4 |
| WHOOP | Sesiones con strain de sesión | — | F6 |
| TrainingPeaks | Tarjeta de entrenamiento ("workout card") que abre Analyze 360 | Vista guardada por deporte | F5 |
| Apple Fitness | Resumen del día (anillos + tiles) | — | F9 |

**Patrón:** la lista enseña **tres o cuatro cosas como mucho** —deporte, fecha, una cifra héroe y un
indicador de que hay recorrido—; **todo lo demás vive en el detalle**. Los filtros que el mercado
ofrece son **deporte**, **texto**, **fechas** y **tags** (COROS, F4).

### 4.2 Jerarquía del detalle (qué va arriba)

1. **Cabecera con identidad**: nombre de la actividad + fecha/hora + deporte. Strava la mantiene
   persistente y colapsable (F1); COROS identifica arriba y deja el resto en scroll (F4).
2. **Resumen**: 3–6 cifras. Strava: tres en columna (F1 y captura `strava-02.png`). Garmin: distancia
   héroe + tiempo + ritmo (F10). COROS: primero mapa, luego cifras y gráficas (F4).
3. **Soporte visual**: mapa (Garmin, Strava, COROS) **antes** que las gráficas; en Strava el mapa y los
   parciales se resaltan mutuamente (F1).
4. **Gráficas**: en COROS cada una es una tarjeta expandible (F4); en TrainingPeaks es un lienzo
   configurable (F5); en Strava son pestañas (F1).
5. **Vueltas/parciales al final**, en tabla, con filtro de distancia (COROS, F4) o comparación (F5).

**Regla que se extrae:** arriba lo que contesta "¿qué es esto?", en medio lo que contesta "¿cómo fue?",
abajo lo que contesta "¿dónde exactamente?". Y **una sola interacción de profundización** por pantalla:
pestañas (Strava), expandir (COROS) o vista guardada (TrainingPeaks). No las tres.

---

## 5. Qué puede dar nuestro backend hoy

### 5.1 Endpoints que ya existen (no hay que construir backend para el detalle básico)

| Endpoint | Devuelve | Archivo:línea |
|---|---|---|
| `GET /api/v1/activities/` | Lista con `id, source, type, name, start_time, duration_min, distance_m, avg_hr, max_hr, gain_m, has_track, tss, rpe` + `X-Total-Count` | `backend/app/api/v1/activities.py:67-131` (campos en `:114-131`) |
| `GET /api/v1/activities/{id}` | 24 campos: `duration_min, distance_m, avg_hr, max_hr, avg_cadence, avg_power, avg_speed_kmh, calories, gain_m, loss_m, min_alt, max_alt, tss, rpe, has_track, bbox, hr_zones, weather, laps` | `backend/app/api/v1/activities.py:245-271` |
| `GET /api/v1/activities/{id}/track` | `points{lat, lon, ele, t, speed, hr, dist}`, `point_count, distance_m, gain_m, loss_m, bbox, privacy_cropped` (simplificado Douglas-Peucker, máx. 2000) | `activities.py:274-315`; simplificación en `backend/app/services/track_service.py:38-58` |
| `GET /api/v1/activities/{id}/streams` | `count, t_s, dist_m, ele, speed_ms, hr, pace_sec_km` (diezmado a `max_points`, por defecto 500) | `activities.py:377-393`; cálculo en `track_service.py:258-285` |
| `GET /api/v1/activities/{id}/splits` | `splits[{km, duration_s, pace, hr_avg, gain_m}]` calculados del track | `activities.py:396-411`; cálculo en `track_service.py:288-319` |
| `GET /api/v1/activities/{id}/export` | GPX (con recorte de privacidad) | `activities.py:414-434` |
| `POST /api/v1/activities/{id}/refresh` | Re-descarga el detalle desde Garmin | `activities.py:318-331` |
| `POST /api/v1/routes/from-activity/{id}` | Guarda el recorrido como ruta | `backend/app/api/v1/routes.py:154-183` |
| `GET /api/v1/performance/zones` | Suma de tiempo en zonas FC del periodo (usa `Activity.hr_zones`) | `backend/app/api/v1/performance.py:75-97` |
| `GET /api/v1/performance/prs` | Marcas personales (con `activity_id`) | `performance.py:100-124` |

### 5.2 Campos de `Activity` y de dónde salen

Modelo en `backend/app/db/models.py:95-128`.

| Campo | Línea | ¿Se rellena hoy? | Origen |
|---|---|---|---|
| `start_time` | `:103` | Sí | `startTimeLocal` de Garmin (`backend/app/services/garmin_service.py:258`) |
| `duration_seconds` | `:104` | Sí | `duration` (`garmin_service.py:259`) |
| `distance_meters` | `:105` | Sí | `distance` (`garmin_service.py:260`) |
| `avg_hr` / `max_hr` | `:106-107` | Sí (y se recalcula desde vueltas) | `garmin_service.py:261-262`; `activities.py:171-177` |
| `rpe` | `:108` | Solo en actividades manuales | `activities.py:47` |
| `training_load_tss` | `:109` | Sí | `FatigueEngine` sobre EPOC/FC (`backend/app/services/sync_service.py:182-184`) |
| `garmin_epoc` | `:110` | **No: nunca se guarda** | Se lee y se descarta en `garmin_service.py:263` + `sync_service.py:183` (no está en el `Activity(...)` de `:185-192`) |
| `elevation_gain_m` / `elevation_loss_m` | `:112-113` | Parcial: suma de vueltas o del track | `activities.py:167-175`, `:192-194` |
| `avg_cadence` | `:114` | **No (0 filas)** | Ningún escritor (§5.3) |
| `avg_power` | `:115` | **No (0 filas)** | Ningún escritor |
| `avg_speed_kmh` | `:116` | **No, pero se calcula al vuelo** | Fallback `distancia/duración` en `activities.py:232-234` |
| `calories` | `:117` | Sí, desde vueltas | `activities.py:178-180` |
| `has_track` / `track_path` | `:118-119` | Sí | `activities.py:185-188` |
| `bbox_*` | `:120-123` | Sí, si hay track | `activities.py:189-191` |
| `hr_zones` (JSON) | `:124` | Sí (23 de 26 medidas) | `track_service.py:197-205` desde `get_activity_hr_in_timezones` |
| `weather` (JSON) | `:125` | Sí, pero puede ser un objeto de `null` | `track_service.py:208-221` |
| `detail_fetched_at` | `:126` | Sí: marca el enriquecido lazy | `activities.py:200-201` |

**Detalle enriquecido:** `_enrich_from_garmin` (`activities.py:140-206`) descarga `get_activity_full`
(`garmin_service.py:317-348`: `details`, `splits`, `hr_zones`, `power_zones`, `weather`), normaliza las
vueltas (`track_service.py:224-245`), guarda el track completo en disco y sube a la fila desnivel, FC
media, calorías, zonas, meteo y bbox. **Las vueltas solo existen dentro del fichero del track**
(`activities.py:184`: *"las vueltas viajan en el fichero (no hay columna)"*). El sync en segundo plano
enriquece **5 actividades por pasada** las que no tienen detalle (`sync_service.py:205-220`).

**Lo que ya está en el frontend nuevo:** el contrato tipado solo conoce el resumen
(`frontend-nuevo/src/api/types.ts:480-494`), el hook pide `limit=20` sin filtros
(`frontend-nuevo/src/api/queries.ts:289-294`) y la pantalla pinta una tarjeta por actividad con nombre,
fecha, tipo, duración, distancia, FC y TSS (`frontend-nuevo/src/pages/extended/ActivitiesPage.tsx:21-40`).
**No existía ruta ni componente de detalle** al empezar esta investigación (búsqueda de `activities/`
en `frontend-nuevo/src`: cero resultados). **Estado a la entrega (2026-11-05, 11:47):** otro agente está
construyendo T-35 en paralelo y ya hay `frontend-nuevo/src/pages/extended/ActivityDetailPage.tsx`
(sin commitear) enganchada en `frontend-nuevo/src/App.tsx:12` y `:99`, con gráficas nuevas en
`components/charts.tsx` (`ActivityStreamChart`, `HrZonesChart`). Esa implementación **pinta una gráfica
de altitud desde `streams.ele`**, que hoy llega `null` al 100 %: o se oculta cuando todos los valores son
`null`, o queda vacía hasta T-39 (§5.3, §7). El único detalle funcional hasta ahora era el del frontend
viejo (`frontend/src/components/ActivityDetail.tsx`), que usa **recharts y react-leaflet** — dos
dependencias que `frontend-nuevo` no tiene.

### 5.3 Verificación sobre datos reales (medido, no estimado)

Consultas de solo lectura contra `garmin_athletics.db` y lectura de `data/tracks/**/*.json`:

| Medida | Valor |
|---|---|
| Actividades en BD | **26** (todas `source = garmin`; 8 `running`, 9 `lap_swimming`, 5 `cycling`, 4 `soccer`) |
| Con `detail_fetched_at` | 23 |
| Con `hr_zones` | 23 |
| Con desnivel (`elevation_gain_m`) | 13 |
| Con meteo con temperatura real | 14 (de 23 con el objeto `weather`; 9 lo tienen con todos los valores `null`) |
| Con `rpe` | 0 |
| Con `avg_cadence`, `avg_power`, `avg_speed_kmh`, `garmin_epoc` | **0** |
| Con `has_track = 1` | 14 |
| Ficheros de track en `data/tracks/<user>/` | 14 (coherente con `has_track`) |
| Puntos de track totales | 18.404 |
| Puntos con `hr` | 18.404 (100 %) |
| Puntos con `t` | 18.404 (100 %) |
| Puntos con `speed` | 18.404 (100 %) — **todos = 0.0** |
| Puntos con `ele` | **0 (0 %)** |
| Puntos con `dist` | **0 (0 %)** |
| Vueltas guardadas en los tracks | 58 |

**Consecuencias directas para el diseño** (esto es lo que evita pintar gráficas rotas):

1. **La FC punto a punto sí se puede graficar** y es lo primero que hay que enseñar.
2. **El ritmo sí se puede calcular** — `build_streams` lo deriva de tiempo y distancia acumulada
   (`track_service.py:274-282`), no de `speed`. **No usar `speed_ms`**: viene a cero.
3. **No hay perfil de desnivel por punto**: `ele` es `null` en todos los tracks y `min_alt`/`max_alt`
   del detalle salen `null` (`activities.py:235-244`). El desnivel solo existe **agregado** (vueltas y
   `elevation_gain_m`). `ensure_track_elevation` (Valhalla) existe (`track_service.py:413-434`) pero
   **nadie la llama con `fill_ele=True`**: hoy es código muerto (`activities.py:334-356`, el parámetro
   nunca se pasa a `True`).
4. **Cadencia y potencia no se pintan**: columnas a `NULL` en el 100 % de las filas.
5. **La meteo se comprueba antes de pintar** (`temp_c != null`), o se enseña una fila de "—".
6. **El mapa no puede ser un mapa de teselas** sin añadir una dependencia: `frontend-nuevo` solo tiene
   react, react-dom, react-router, react-query y lucide (`frontend-nuevo/package.json:22-28`).

### 5.4 Qué habría que pedirle a Garmin (o calcular) para cerrar huecos

| Falta | Qué haría falta | Coste / riesgo |
|---|---|---|
| Altitud por punto | Activar el relleno con Valhalla (`track_service.py:368-434`) al leer `/streams`, cacheado en el fichero del track | Llamada externa (hasta 20 s de timeout), un punto de fallo más; cachear es obligatorio |
| Velocidad real por punto | Usar `directSpeed` del polyline en vez de `point.speed` (hoy `track_service.py:98` mapea `directSpeed → point.get("speed")` y ese campo viene a 0) o recalcular por distancia/tiempo (ya se hace) | Bajo: ya está resuelto por derivación |
| Cadencia y potencia medias | Leerlas del detalle de Garmin y escribirlas en la fila; hoy no se leen siquiera | Requiere cambio en `_enrich_from_garmin` + un campo más en el JSON de Garmin que hay que localizar en `get_activity_details` |
| Efecto del entrenamiento (aeróbico/anaeróbico) | Guardar `garmin_epoc`/`trainingEffect` (hoy se lee y se tira) y exponerlo | Bajo en backend; **decisión de producto**: es una métrica de Garmin, no nuestra |
| Zonas de potencia | `power_zones` ya se descarga (`garmin_service.py:341`) y **se descarta**: no se guarda ni se expone | Bajo, pero solo tiene sentido con potencia real |
| Comparación con la misma ruta | Modelo de rutas + emparejamiento por geometría (nuestro `Route` guarda distancia, desnivel y puntos, `models.py:42-54`) | Alto: es producto nuevo, no UI (§6.6) |
| Parciales “oficiales” de Garmin | Las vueltas de Garmin ya llegan (`track_service.py:224-245`) pero solo al fichero del track; `/splits` recalcula por km del track | Medio: decidir si se confía en la vuelta del dispositivo o en el cálculo propio |

---

## 6. Propuesta de pantalla: detalle de Actividad (móvil, 400 px)

Ruta: `/actividades/:id` (hija del registro de pantallas, como `gimnasio/entrenar` en
`frontend-nuevo/src/App.tsx:93-95`). La lista de `ActividadesPage` pasa a ser navegable: toda la tarjeta
es un enlace al detalle.

### 6.1 Bloques, en orden, con su regla de aparición

| # | Bloque | Contenido | Cuándo aparece |
|---|---|---|---|
| 1 | **Cabecera** | ← Actividades · nombre · `sáb 5 nov · 18:32` · icono de deporte. Acciones en un menú `···`: *Descargar GPX*, *Guardar como ruta*, *Actualizar* | Siempre |
| 2 | **Resumen** | Cifra héroe + 3 cifras medianas + 1 fila de apuntes (ver 6.2) | Siempre |
| 3 | **Recorrido** | Silueta SVG del track, punto de salida y de llegada, caja 4:3 | Solo si `has_track` y `/track` responde |
| 4 | **Pulso** | Gráfica de línea FC vs tiempo + FC media/máx en la leyenda | Si `/streams` trae `hr` con al menos 2 valores |
| 5 | **Ritmo por km** | Barras por km (de `/splits`) + mejor/peor km | Si hay `splits.length >= 2` (carrera, bici, fútbol con GPS) |
| 6 | **Zonas de FC** | Barra apilada Z1·Z2·Z3·Z4·Z5 + tiempos y % | Si `hr_zones` tiene `secs > 0` |
| 7 | **Vueltas** | Tabla `# · Dist · Tiempo · Ritmo · FC med · Desnivel` | Si `laps.length >= 2` |
| 8 | **Meteo** | Una línea: `15 °C · sensación 15 °C · 63 % · viento N 11 km/h · Salamanca/Matacán` | Si `weather.temp_c != null` |

**Nada de bloques vacíos.** Un bloque sin datos **no se pinta**; no se deja un hueco con una
explicación. La única excepción es la pantalla entera sin detalle (6.4).

### 6.2 El resumen: qué cifra manda

Depende del deporte, porque un ritmo de natación en `/km` no significa nada:

| Deporte | Héroe | Medianas | Apuntes |
|---|---|---|---|
| Carrera / trail | **Ritmo medio** (`5:32 /km`) | Distancia · Tiempo · Desnivel + | FC media · Calorías · Carga (TSS) |
| Bici | **Velocidad media** (`28,4 km/h`) | Distancia · Tiempo · Desnivel + | FC media · Calorías · Carga (TSS) |
| Natación | **Ritmo** (`2:05 /100 m`) | Distancia · Tiempo · Largo medio | FC media · Calorías · Carga (TSS) |
| Fútbol / fuerza / manual | **Tiempo** | FC media · Calorías · Carga (TSS) | Distancia (si > 0) · Desnivel (si > 0) |

- **Carga (TSS)** lleva una línea corta debajo, la única explicación permitida por §8: *"lo que te ha
  costado la sesión"*. Es el caso que la propia doctrina autoriza ("cálculo se hace bien y se calla",
  pero se explica **la medida que el usuario ve**; `DOCTRINA-CALIDAD.md:116`).
- Si falta un dato, **se omite la cifra**, no se enseña `—`. La raya solo se admite en la tabla de
  vueltas, donde la columna tiene que existir.

### 6.3 Gráficas SVG propias (sin librerías nuevas)

Se copia el patrón que ya está en producción en `frontend-nuevo/src/components/charts.tsx:11-26`:
`viewBox` fijo, `PADDING = 16`, proyección lineal, colores por variable CSS (`var(--ga-*)`), `<figcaption>`
con el dato en texto **para que se pueda leer sin ver el dibujo**, `role="img"` + `aria-label`.

1. **`HrSeriesChart`** — `600×180`. Entrada: `t_s: number[]`, `hr: (number|null)[]`, `hr_zones` (para
   bandas de fondo con `low`). Salida: polilínea, eje Y con dos marcas (mín/máx), eje X con dos marcas
   (0 y total). Sin librería, sin animación. **Interacción**: arrastrar el dedo mueve un cursor vertical
   y el `figcaption` cambia a `"18:42 · 154 lpm"`. Con teclado, `←/→` mueven el cursor.
2. **`PaceBarsChart`** — `600×200`. Entrada: `splits[{km, duration_s, pace}]`. Una barra por km,
   **altura = ritmo invertido** (más alto = más rápido, para que "subir" signifique "mejor"), etiqueta
   del km debajo, mejor km en `--ga-success` y peor en `--ga-warn` **solo con la etiqueta numérica
   al lado** (color con significado, `UI-COMPETENCIA.md` §4.9).
3. **`ZoneStackChart`** — barra horizontal apilada de 8 px + filas de zona: `Z2 · 12:04 · 34 %`. Los
   colores de zona salen de `--ga-info`, `--ga-accent`, `--ga-success`, `--ga-warn`, `--ga-danger`, en
   ese orden, **siempre con el tiempo y el % escritos**.
4. **`RouteSketch`** — no es gráfica de datos: es el recorrido. Se normaliza `lat/lon` a la caja
   `viewBox` con la relación del `bbox` (que `/track` ya devuelve), se dibuja con `stroke
   var(--ga-accent)` 2 px, salida `--ga-success` y llegada `--ga-danger`, y se rellena una sombra suave.
   **Sin teselas, sin calles, sin zoom.** Es el equivalente honesto de la "silueta naranja" de Strava
   (`strava-02.png`) y no introduce Leaflet.
5. **`ElevationChart`** — **no se implementa ahora**: `ele` es `null` en el 100 % de los puntos. Se deja
   el componente escrito y se enciende cuando T-39 rellene la altitud. Sin esto, el bloque 3 podría
   llevar el perfil superpuesto (Strava lo hace, F2), pero se pospone.

**Presupuesto de la pantalla:** 3 gráficas + 1 silueta + 1 tabla. El detalle de Strava tiene 7 pestañas
(F1) y el de TrainingPeaks es configurable (F5); en 400 px, más de tres gráficas es scroll infinito. Si
un usuario quiere más, el sitio natural es *Rendimiento*/*Tendencias*, no el detalle.

### 6.4 Estados (los cuatro)

| Estado | Qué se ve | Texto exacto |
|---|---|---|
| **Cargando** | Esqueleto con la forma de los bloques (no spinner suelto): una barra de título, una caja 4:3 y tres barras | `LoadingBlock label="Cargando la actividad"` |
| **Error** | `ErrorState` con reintento; el botón vuelve a pedir detalle y streams | `No se pudo cargar la actividad.` + `Reintentar` |
| **No existe (404)** | `EmptyState` con vuelta a la lista | `Esa actividad ya no está.` + `Volver a Actividades` |
| **Vacío / sin detalle** | Cuando `detail_fetched_at` es `null` y no hay track ni zonas: una línea y una acción | `Faltan los datos de esta actividad.` + `Actualizar` |
| **Sin permiso (401/403)** | Lo resuelve `AuthGate` (`frontend-nuevo/src/App.tsx:83-96`); la pantalla no duplica el mensaje | — |

### 6.5 Textos: qué se borra por §8 y qué se queda

**Se borran** (todos existen hoy en `frontend/src/components/ActivityDetail.tsx`; no se trasladan al
nuevo):

| Texto actual | Línea | Motivo (§8) |
|---|---|---|
| "El detalle completo (mapa, vueltas, zonas) se descarga de Garmin al abrir. Si algo falta, pulsa ⟳." | `:316` | Explica cómo está hecho (lazy fetch + botón) |
| "· 1948 puntos GPS" | `:214-217` | Métrica de relleno |
| "Pasa el cursor para localizar" | `:196` | Instrucción de UI que la propia interacción debe hacer evidente |
| "Colorear por: … bajo → alto (sin datos de velocidad)" | `:169-180` | Jerga de implementación del degradado |
| "Garmin no respondió. Prueba más tarde (límite de peticiones)." | `:69` | Detalle técnico (rate limit) |
| "No se pudo guardar (¿sin GPS?)" | `:35` | Causa interna + duda del desarrollador |
| Chip "con track" en la lista | `ActivitiesPage.tsx:35` | Jerga; se sustituye por nada o por un icono de mapa si el diseño lo pide |
| "RPE 7" en la lista | `frontend/src/pages/Activities.tsx:159` | Dato de esfuerzo sin contexto en una lista; vive en el detalle |
| "Solo con mapa GPS" (filtro) | `frontend/src/pages/Activities.tsx:119` | Jerga; si el filtro se queda, se llama "Con recorrido" |

**Se quedan** (etiqueta corta + unidad): `Distancia`, `Tiempo`, `Ritmo`, `Velocidad`, `Desnivel +`,
`FC media`, `FC máx`, `Calorías`, `Carga`, `Parciales`, `Vueltas`, `Tiempo en zonas`, `Meteo`,
`Actualizar`, `Descargar GPX`, `Guardar como ruta`, `Volver a Actividades`. Y **una sola** frase
explicativa, la de Carga.

### 6.6 Lo que NO se propone (y por qué)

| Idea | Por qué no ahora |
|---|---|
| Mapa con teselas (Leaflet / MapLibre) | `frontend-nuevo` no tiene la dependencia y la regla es no añadir librerías para esto; además ya dibujamos el recorrido como silueta. Si David quiere mapa real, es decisión de producto (Nivel 3) |
| Comparación con la misma ruta | No hay emparejamiento de rutas: `Route` existe (`models.py:42-54`) y `route_from_activity` guarda el track (`routes.py:154-183`), pero **nada compara** una actividad con una ruta. Es producto nuevo, no UI (§5.4) |
| Cadencia y potencia | Sin datos (§5.3). Pintar columnas a `NULL` es mentir con la interfaz |
| Perfil de desnivel | `ele` vacío en el 100 % de los tracks (§5.3) |
| Comentario generado por IA | Runna lo hace (F7), pero exige proveedor externo, consentimiento y anonimización (F7: *"anonimizamos tus datos antes de compartirlos"*): Nivel 3 |
| Vista de gráficas configurable | TrainingPeaks la tiene (F5) pero en móvil de 400 px no cabe y multiplica los estados |
| Selector de periodo por pills en el detalle | El detalle es de **una** actividad: no hay periodo que elegir |

---

## 7. Tareas propuestas (Nivel 1 y 2)

Convención del proyecto: ids `T-xx` en `BACKLOG.md`; Nivel 2 se anota en `DECISIONES.md`
(`PROTOCOLO-AUTONOMIA.md:26-30`). La pantalla de Actividades **ya está en la especificación**
(`ESPECIFICACION.md:109`: *"Qué actividad fue y con qué detalle (mapa, streams, parciales)"*), así que
construirla es Nivel 2, no Nivel 3.

### T-35 · Detalle de Actividad (Nivel 2)
**Qué:** ruta `/actividades/:id`, bloques 1–8 de §6.1, con bloques que aparecen solo si hay datos.
Backend: **sin cambios** (todo está en §5.1).
**Criterios de aceptación (observables):**
1. Desde la lista, tocar una actividad navega a su detalle y el botón atrás devuelve a la lista en la
   misma posición de scroll.
2. Una actividad de carrera con track enseña, en este orden: resumen, recorrido, pulso, parciales,
   zonas, vueltas, meteo.
3. Una natación en piscina (sin track) **no dibuja** ni el recorrido ni los parciales, y **no deja
   huecos**: el primer bloque tras el resumen es el de pulso.
4. Una actividad sin detalle enriquecido (`detail_fetched_at = null`) enseña "Faltan los datos de esta
   actividad." y un botón `Actualizar` que, al terminar, rellena la pantalla sin recargar.
5. Con la red cortada, la pantalla enseña `No se pudo cargar la actividad.` y `Reintentar` recarga.
6. A 400 px de ancho: sin scroll horizontal, ningún texto cortado, objetivo táctil ≥ 44 px.
7. Prueba de flujo (una): *abrir actividad con track → ver las tres gráficas → volver a la lista*. Se
   escribe con `frontend-nuevo/src/test/renderApp.tsx` y `fakeApi.ts`; se borra la prueba del detalle
   viejo si se retira esa pantalla (`DOCTRINA-CALIDAD.md:25`).

### T-36 · Gráficas SVG de actividad (Nivel 1)
**Qué:** `HrSeriesChart`, `PaceBarsChart`, `ZoneStackChart`, `RouteSketch` en
`frontend-nuevo/src/components/` con el patrón de `charts.tsx`.
**Criterios:**
1. Cada componente tiene `role="img"`, `aria-label` en español y un `<figcaption>` con el dato en
   texto; sin `figcaption` la gráfica no se considera terminada.
2. Con `hr` todo a `null` el componente **no se renderiza** (devuelve `null`); con un solo punto
   tampoco.
3. `PaceBarsChart` dibuja "más alto = más rápido" y usa `--ga-success`/`--ga-warn` **con la etiqueta
   numérica al lado**.
4. `RouteSketch` no consulta red: recibe `lat`/`lon` y pinta; con menos de 2 puntos devuelve `null`.
5. Sin dependencias nuevas: `frontend-nuevo/package.json` no cambia.
6. `npm run check` en verde (tokens, contraste, escala, typecheck, test).

### T-37 · Lista de Actividades: filtros, estados y enlace al detalle (Nivel 1)
**Qué:** filtros de deporte, texto y fechas contra `GET /activities/` (los parámetros ya existen:
`activities.py:69-77`), paginación con `limit/offset`, estados vacío/carga/error y tarjeta entera como
enlace.
**Criterios:**
1. Elegir "Natación" deja en la lista solo actividades de natación y el contador coincide con lo que se
   ve.
2. Escribir tres letras del nombre filtra; borrarlas restaura la lista completa.
3. Sin resultados se ve `Sin actividades con esos filtros.` y un botón `Quitar filtros`; sin actividades
   en absoluto, el vacío actual (`ActivitiesPage.tsx:16-19`) sin mencionar "TSS" si no hay datos.
4. Los filtros viven en la URL (`?sport=running&q=...`) para que atrás/adelante funcione.
5. Ningún texto de la lista menciona detalles internos (§6.5).

### T-38 · Lista con paginación y filtros en SQL (Nivel 2)
**Qué:** hoy `list_activities` trae **hasta 2000 filas** a memoria y filtra en Python
(`activities.py:90-109`); `limit`, `offset`, `sport` y `q` **no llegan al SQL**. Se mueve a `WHERE` y
`LIMIT/OFFSET` con `COUNT(*)` para `X-Total-Count`.
**Por qué Nivel 2:** cambia comportamiento observable (orden del total, tiempos) y hay que anotarlo en
`DECISIONES.md`; no cambia esquema.
**Criterios:**
1. `GET /activities/?limit=20&offset=20` devuelve la segunda página y `X-Total-Count` es el total real
   filtrado, no el de la página.
2. `sport` y `q` filtran en la consulta (comprobable con `EXPLAIN`/log de SQLAlchemy) y no en Python.
3. Con 26 filas actuales el resultado visible es idéntico al de antes (no se rompe nada).
4. Hay una prueba de contrato que fija la forma de la respuesta (`types.ts:480-494`).

### T-39 · Altitud por punto para el perfil de desnivel (Nivel 2, opcional)
**Qué:** llamar a `ensure_track_elevation(..., fill_ele=True)` desde `/streams` (y opcionalmente desde
`/track`), cacheando en el fichero del track. El código existe (`track_service.py:368-434`); hoy nadie
lo invoca con `True` (`activities.py:334-356`).
**Riesgo:** depende de un servicio externo (Valhalla); hay que cachear y no bloquear la respuesta más de
lo aceptable.
**Criterios:**
1. Tras abrir una actividad con GPS, `GET /streams` devuelve `ele` sin `null` en la mayoría de puntos y
   la segunda vez no hace la llamada externa (se sirve del fichero).
2. Si Valhalla falla, la respuesta es la misma que hoy (sin `ele`) **y la pantalla no se rompe**.
3. Se anota en `DECISIONES.md` la dependencia externa y su límite.

### Orden sugerido
T-37 → T-36 → T-35 → T-38 → (T-39 cuando T-35 esté cerrada y probada). T-37 y T-36 no dependen de nada;
T-35 consume ambas.

---

## 8. Lo no verificado (no se afirma nada de esto)

1. **Garmin Connect — pantalla de detalle de una actividad.** No se pudo leer en fuente primaria:
   `support.garmin.com` y `garmin.com/blog` devuelven navegación en el HTML público, y el listado de
   Google Play no enseña el detalle. Lo verificado es solo la tarjeta del panel (distancia/tiempo/ritmo/
   miniatura de mapa) en `garmin-connect-01.png`. **El inventario de gráficas que se le atribuye en §3**
   procede de `research/UI-COMPETENCIA.md` §2.1 y del corpus interno, no de una fuente primaria
   consultada hoy.
2. **Suunto — detalle de una actividad.** Solo hay la descripción de App Store (F8); `suunto.com` y
   `support.suunto.com` no respondieron (404 / error de conexión). No se describe su pantalla.
3. **Apple Fitness — detalle de un entrenamiento** (parciales, gráficas propias). La captura solo cubre
   el `Summary`; la guía de Apple no se pudo abrir (`unsupported content type`).
4. **WHOOP — pantalla real.** Verificado el marco (Strain 0–21, strain de sesión vs de día, zonas de FC,
   splits "anunciados"); **no** se ha visto la pantalla.
5. **COROS, TrainingPeaks y Runna** se han verificado **por su documentación escrita**, no por capturas:
   puede haber cambios de UI posteriores al artículo.
6. **No se ha ejecutado el backend ni abierto la app** en esta sesión: los endpoints se han leído en el
   código, no probados con `curl`. Las cifras de §5.3 sí se han medido contra la BD y los ficheros del
   repo.
7. **No se han medido tiempos** de `/streams`, `/splits` ni `/track` con datos reales, ni el peso del
   SVG con 2.000 puntos. Si el `RouteSketch` se dibuja con 2.000 vértices conviene probarlo antes de
   dar T-36 por buena.
8. **Fechas de los artículos oficiales**: las fuentes F1–F7 son las vigentes el 2026-11-05; Strava y
   TrainingPeaks han cambiado estas pantallas varias veces en 2026.
9. **Riesgo detectado y no reproducido**: si `has_track = 1` pero el fichero del track falta (por
   ejemplo, `data/` recreado), `/track` responde 404 y `_enrich_from_garmin` **no re-descarga** porque
   `detail_fetched_at` ya está puesto (`activities.py:151-152`): la lista diría "con track" y el detalle
   no tendría mapa hasta pulsar `Actualizar`. Está en los criterios de T-35 (punto 4) y conviene una
   prueba que lo fije.
