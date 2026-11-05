# DECISIONES.md — PULSO

Decisiones de **Nivel 2** (las tomo yo, las dejo escritas y David las revisa cuando quiera).
Formato: decisión · motivo · cómo se revierte.

---

## 2026-11-04 — D-01 · El modelo de datos del gimnasio es nuevo, y es relacional

**Contexto.** El backend actual solo tiene `strength_logs`, con los ejercicios metidos en un
`JSON` (`[{name, sets, reps, weight_kg, rir}]`). Eso no soporta catálogo, plantillas ni series
individuales, que son los tres requisitos de la especificación.

**Decisión.** Añadir cinco tablas nuevas, **sin tocar las existentes**:

| Tabla | Para qué |
|---|---|
| `exercises` | Catálogo: `name`, `slug`, `muscle_group`, `secondary_muscles` (JSON), `equipment`, `is_unilateral`, `is_timed`, `notes`, `source` (`seed`/`custom`), `garmin_enum` (nullable), `user_id` (null = catálogo global del sistema) |
| `workout_templates` | Plantilla de rutina: `name`, `weekday` (0-6, nullable), `focus`, `notes`, `user_id` |
| `template_exercises` | Ejercicio dentro de plantilla: `position`, `exercise_id`, `sets`, `reps`, `weight_kg`, `rest_seconds`, `notes` |
| `workout_sessions` | Sesión ejecutada: `started_at`, `finished_at`, `template_id` (nullable), `name`, `notes`, `status` (`in_progress`/`done`), `total_tonnage_kg`, `computed_tss` |
| `session_sets` | Serie individual: `position`, `exercise_id`, `set_number`, `weight_kg`, `reps`, `rir`, `is_warmup`, `set_type` (`normal`/`warmup`/`drop`/`failure`), `rest_seconds`, `completed_at` |

**Motivo.** (a) Es lo que piden las pantallas; (b) `session_sets` es lo que permite "marcar una
serie hecha y corregir el peso de esa serie sin tocar las demás"; (c) `template_exercises` es lo
que permite reutilizar una rutina. Con `JSON` no se puede filtrar por músculo ni calcular PRs
por ejercicio sin recorrer todo el historial. Ver `INVESTIGACION.md` §4.5 (huecos H1-H4).

**Se mantiene** `strength_logs` y `POST /strength/log` para no romper nada de lo que ya existe
(las pruebas actuales lo usan). El endpoint nuevo de sesiones escribe además la fila `Activity`
de siempre, para que el modelo de fatiga siga sumando.

**Cómo se revierte.** Las tablas son nuevas: `DROP TABLE` de las cinco y el backend queda como
estaba. No se modifica ni una columna existente. `create_all` las crea solas al arrancar; no hace
falta Alembic ni tocar `init_db()`.

---

## 2026-11-04 — D-02 · La sesión en curso vive en el navegador, no en el servidor

**Contexto.** La `ESPECIFICACION.md` deja abierto "¿la sesión corre en el servidor o en el
navegador?" y pide que la sesión sobreviva a recargar la página.

**Decisión.** El **estado en curso** (qué serie toca, qué peso se ha escrito pero no confirmado)
vive en el navegador (`localStorage`), con escritura en cada cambio. Al **terminar** la sesión se
manda al servidor una sola vez con todas las series (`POST /strength/sessions`). El servidor guarda
sesiones **terminadas**, no borradores. La última marca por ejercicio se lee de
`GET /strength/last-marks` para precargar peso y repeticiones.

**Motivo.** (a) Sobrevive a recargar sin un endpoint de latido ni permisos; (b) no deja basura en
la base de datos si el usuario cierra el navegador; (c) el gimnasio se usa a una mano y con mala
cobertura: escribir en local es siempre rápido; (d) es reversible: si más adelante se quiere
multidispositivo, se añade un endpoint de borrador sin migrar lo existente.

**Contrapartida aceptada.** Si el usuario abre la sesión en otro dispositivo, no la ve. Se acepta
en la primera versión; queda anotado como mejora.

---

## 2026-11-04 — D-03 · El temporizador de descanso se calcula por marca de tiempo, no por cuenta atrás

**Contexto.** La especificación exige que el descanso "siga contando con la pantalla apagada".
Un contador que resta `1` cada segundo deja de contar cuando el navegador congela la pestaña.

**Decisión.** Guardar **la hora absoluta de fin** del descanso (`endsAt`). El tiempo restante se
calcula siempre como `endsAt - now`, y se recalcula al volver a la pestaña. El aviso al terminar
usa la API de notificaciones si el usuario la concede; si no, un aviso dentro de la página.
No se usa `service worker` en esta tanda (ver D-05).

**Motivo.** Funciona con la pantalla apagada y con la pestaña congelada sin depender de permisos.
Es un cambio pequeño y local.

**Cómo se revierte.** Es lógica de cliente; se sustituye sin tocar datos.

---

## 2026-11-04 — D-04 · El catálogo de ejercicios es propio, con semilla en español

**Contexto.** La especificación pregunta si el catálogo es propio o se importa de algún sitio.

**Decisión.** Catálogo **propio** (`exercises`), sembrado con los ejercicios que ya existen
hardcodeados en el backend (`GARMIN_EXERCISE_MAP`, 35 entradas, y `EXERCISE_POOLS`, 32), en
español, con grupo muscular, material y el `enum` de Garmin cuando se conozca. El usuario puede
crear ejercicios propios (`source='custom'`).

**Motivo.** (a) No hay una fuente abierta con licencia clara para el catálogo de Hevy/Fitbod;
(b) ya tenemos 35-40 nombres en español con su `enum` de Garmin, que es lo que hace falta para
el envío al reloj; (c) el estado vacío deja de existir y la pantalla se puede probar de verdad.

**Cómo se revierte.** Borrar las filas con `source='seed'`. No afecta a los ejercicios creados.

---

## 2026-11-04 — D-05 · Fuera de esta tanda: service worker, supersets y envío real al reloj

**Contexto.** La investigación de la competencia sugiere tres cosas que la especificación no pide.

**Decisión.** No se implementan en esta tanda:

- **Service worker / PWA offline**: añade una capa de caché y versiones que no se puede probar
  bien sin despliegue. El `localStorage` de D-02 ya cubre "no perder la sesión".
- **Supersets**: cambian el modelo de la sesión (dos ejercicios por bloque). No está en la
  especificación y no es imprescindible para ser más rápido que Garmin.
- **Envío real de rutinas al reloj** (`dry_run=false`): nunca se ha validado con un reloj real
  y puede rechazar el entreno. Enviarlo sin probar sería declarar que funciona sin haberlo hecho.

**Motivo.** El protocolo marca que añadir alcance es **Nivel 3**: se propone y se espera. Las tres
quedan en `BACKLOG.md` como `esperando decisión`.

**Cómo se revierte.** Nada que revertir: no se ha hecho.

---

## 2026-11-04 — D-06 · El frontend nuevo se escribe contra el contrato real, con tipos a mano

**Contexto.** El backend no declara `response_model` en 46 de 58 rutas, así que el OpenAPI sale
vacío de esquemas y TypeScript no puede generar tipos útiles.

**Decisión.** El frontend nuevo tendrá `src/api/types.ts` con los tipos **escritos a mano** y
contrastados contra la sonda de `INVESTIGACION.md` §4.2. Nada de `any` en las respuestas de salud.

**Motivo.** Generar tipos de un OpenAPI vacío produce `{}` y da una falsa sensación de seguridad.

**Alternativa descartada.** Añadir `response_model` a 46 endpoints antes de empezar: es trabajo
útil pero no desbloquea ninguna pantalla y retrasa todo. Se puede hacer después, endpoint a
endpoint, a medida que el frontend los consuma.

---

## 2026-11-04 — D-07 · El sistema de diseño se construye antes que la primera pantalla

**Contexto.** La `DOCTRINA-CALIDAD.md` §2 lo exige: tokens de color, tipografía, espaciado y radios
en un solo sitio, contraste AA calculado, escala corta y animación de 120–220 ms con propósito. La
primera pantalla del frontend nuevo (T-03) está a punto de empezar y, si cada pantalla inventa sus
colores y tamaños, corregirlo después cuesta más que hacerlo bien una vez.

**Decisión.** Antes de T-03 se construye el sistema de diseño **dark-first** con la skill
`claude-design-system`, en `designs/pulso-design-system/`:

- tokens de color, tipografía, espaciado y radios **en un solo fichero**;
- **contraste AA calculado**, no estimado;
- escala de espaciado **4/8/12/16/24/32/48** (la app usa la escala de Tailwind que coincide, y un
  check falla si una pantalla sale de ella) y **cinco pasos tipográficos**;
- animación de **120–220 ms** con propósito y respeto a `prefers-reduced-motion`.

El frontend nuevo **consume los tokens generados** por el sistema de diseño: una sola fuente, sin
copiarlos a mano pantalla a pantalla.

**Motivo.** DOCTRINA §2, y es más barato cambiar un token que veinte pantallas. El sistema es local
al repositorio (no es un servicio externo), así que no añade dependencia operativa.

**Cómo se revierte.** Los tokens se regeneran desde el sistema de diseño; como ninguna pantalla
guarda valores propios, revertir la fuente o cambiar la escala es un cambio de un fichero.

---

## 2026-11-04 — D-08 · Navegación por registro con banderas

**Contexto.** David decidió que el frontend nuevo arranca con **Hoy · Gimnasio · Ajustes** y el
resto detrás de una bandera (E-01, `ESPECIFICACION.md`). T-02 construye la navegación ahora y
añadir una pantalla después no debe obligar a tocar el layout.

**Decisión.** La navegación es un **registro de pantallas con su bandera**. Visibles por defecto:
**Hoy, Gimnasio y Ajustes**. El resto vive detrás de `VITE_FEATURE_EXTENDED`, con un **interruptor
en Ajustes** para verlas sin reconstruir. **Añadir una pantalla es una entrada en el registro**, no
tocar el layout.

**Motivo.** ESPECIFICACION (decisión de David) + E-01. Así ampliar después es barato y la
ampliación de `INVESTIGACION.md` §8 no rehace la navegación. El registro es además el sitio donde
se ve de un vistazo qué está encendido y qué no.

**Cómo se revierte.** Quitar la bandera del registro: la pantalla desaparece de la navegación sin
tocar su código. Si se decide que todo sea visible, se dejan todas las banderas encendidas.

---

## 2026-11-04 — D-09 · Se adopta la ampliación de la competencia como alcance de la tanda

**Contexto.** La `ESPECIFICACION.md` delega en el agente qué pantallas y funciones entran, con la
investigación delante: la bandera no es excusa para no hacerlas y el criterio es que la pantalla
resuelva una pregunta que el usuario se hace de verdad. `INVESTIGACION.md` §8 propone ocho.

**Decisión.** Entran las **ocho adopciones de `INVESTIGACION.md` §8** como alcance de la tanda, con
la **calculadora de discos y de calentamiento** que estaba aparcada como E-03. Cada una nace como
tarea Nivel 2 en `BACKLOG.md` (T-13 a T-20). Las que son pantalla nueva (Progreso, Marcas,
Calendario) nacen detrás de la bandera de D-08; las que son acción dentro de una pantalla visible
(sesión libre, resumen de fin de sesión, guardar como plantilla, calculadora) **no necesitan
bandera**: viven dentro de Entrenar, que es visible.

**Motivo.** Las ocho resuelven preguntas reales (la tabla de §8.1 lo dice una a una), son baratas
comparadas con su valor y **son reversibles**: pantallas y acciones nuevas, sin tocar datos ni
migrar nada.

**Nota de alcance.** **No se adelanta ninguna decisión Nivel 3**: supersets (E-02), PWA offline
(E-04), envío real al reloj (E-05), RPE por serie (E-06) y 1RM estimado (E-07) siguen esperando y
no se implementan en esta tanda (`INVESTIGACION.md` §8.2).

**Cómo se revierte.** Las tareas T-13 a T-20 se retiran del backlog y las pantallas de la bandera
no se encienden. Lo ya construido se queda sin usar, sin migración que deshacer.

---

## 2026-11-04 — D-10 · Un 401 de Garmin no es una sesión caducada, y la caché no cruza cuentas

**Contexto.** La revisión adversarial de T-02 encontró dos fallos de flujo. (a) El cliente trataba
cualquier 401 como sesión caducada; pero `PUT /auth/garmin-credentials` y `POST /auth/garmin-mfa`
responden 401 cuando la contraseña o el código de Garmin son incorrectos, así que un dedazo en la
vinculación expulsaba al atleta de su propia sesión. (b) La caché de React Query es un singleton y
no se vaciaba al cambiar de cuenta: en un navegador compartido, las métricas y el correo de Garmin
de la cuenta anterior podían pintarse para la siguiente.

**Decisión.**
- El 401 solo cierra la sesión cuando lo produce la sesión de la app (`session: 'app'`, el valor por
  defecto). Las llamadas a la vinculación de Garmin pasan `session: 'external'`: el error se enseña
  en el formulario y la sesión sigue intacta.
- La caché de consultas se vacía en el logout, en el 401 de sesión y en cada login, antes de montar
  las pantallas de la cuenta nueva.
- Cuando la sesión caduca a mitad de uso, la entrada lo dice («La sesión ha caducado») en vez de
  dejar al atleta sin explicación.

**Motivo.** Datos de salud y credenciales de terceros no pueden sobrevivir a un cambio de usuario;
y un error de credencial de Garmin no es motivo para cerrar la sesión. Ambas cosas tienen prueba de
flujo (`login.test.tsx`, `settings.test.tsx`).

**Cómo se revierte.** Es lógica de cliente: se quita `session: 'external'` de las llamadas de
vinculación y las llamadas a `queryClient.clear()`. No toca datos.

---

## 2026-11-04 — D-11 · Se adopta el alcance completo (app de entrenamiento, no panel)

**Contexto.** David escribió `ALCANCE-COMPLETO.md`: el producto deja de ser un panel de lectura y
pasa a ser una app completa que crea, lleva al reloj, ejecuta y analiza entrenamientos. Orden de
valor fijado por él: datos/gráficas, registro, creación, reloj, detección por movimiento.

**Decisión.** Se adopta el alcance y se traduce a tareas T-26 a T-34 en `BACKLOG.md`, con
`INVESTIGACION-AMPLIACION.md` como investigación previa. El backend se amplía de forma **aditiva**
(endpoints de agregación, campos opcionales, importación de series de Garmin); no se reescribe el
modelo del gimnasio.

**Motivo.** Es una decisión de producto de David, con orden de valor explícito. La ampliación es
reversible y no destruye datos.

**Cómo se revierte.** Se retiran las tareas T-26 a T-34 del backlog; los endpoints aditivos y las
columnas opcionales pueden quedarse sin usar sin migración destructiva.

---

## 2026-11-04 — D-12 · El reloj: primero el workout nativo, después la watch-app

**Contexto.** Hay dos caminos técnicos verificados en la investigación: subir un entrenamiento a
Garmin Connect con la API **no oficial** (`upload_strength_workout` + `push_workout_to_device`) y
leer de vuelta las series de una actividad con `get_activity_exercise_sets`; o escribir una app
Connect IQ propia. El SDK 8.3.0 compila para el fr965 con acelerómetro, grabación y HTTP.

**Decisión.**
1. **Camino principal**: corregir el builder actual con los modelos tipados de la librería
   (`StrengthWorkout`: sportType 5, repeat groups, unidades, descansos, catálogo de ejercicios) y
   probar **un** entrenamiento real en el reloj de David. Después, importar las series de vuelta.
2. **Watch-app Connect IQ** solo cuando el camino nativo no cubra una necesidad (p. ej. mostrar la
   sesión con nuestros dibujos o marcar series con HTTP/offline).
3. **La detección de repeticiones por IMU** es un POC medido, el último paso; no se promete conteo
   automático general. La mano del reloj se pregunta (el SDK no la expone).

**Motivo.** El camino nativo da más valor con menos código y usa el reloj como lo usa David; la
watch-app añade control pero también instalación, memoria y batería. La prueba real en el reloj es
**Nivel 3** porque toca su cuenta y su dispositivo.

**Cómo se revierte.** El envío real sigue apagado por defecto (`dry_run`); la watch-app sería una
carpeta nueva que no afecta al resto.

---

## 2026-11-04 — D-13 · Las métricas derivadas se calculan en el servidor y se etiquetan

**Contexto.** La ampliación pide monotonía, tensión, volumen por músculo, empuje/tirón, 1RM estimado
y tiempo bajo tensión. Varias no tienen un dato directo y algunas son estimaciones.

**Decisión.** Las agregaciones se calculan en el backend con SQL sobre las series guardadas
(T-26); el cliente solo dibuja. Cada métrica lleva su fórmula en la ficha y su etiqueta cuando es
estimación (el 1RM de Epley, por ejemplo). Si falta el dato de entrada (tempo, patrón de movimiento,
biometría), la pantalla muestra "sin dato" y qué falta; **no se rellena con ceros ni con constantes**.

**Motivo.** DOCTRINA §2 y la regla de David: "toda métrica que se muestre se mide o no se muestra".
Se calcula una vez en servidor para que todas las pantallas den el mismo número.

**Cómo se revierte.** Son endpoints y cálculos nuevos; se dejan de usar sin tocar datos.

---

## 2026-11-04 — D-14 · El registro de sesión usa un borrador local por usuario y plantilla

**Contexto.** T-04/T-29 exige marcar series en el gimnasio, corregirlas después, que el descanso
siga contando con la pantalla apagada y que recargar no pierda la sesión. D-02 ya decidió que el
borrador vive en el navegador y D-03 que el descanso se calcula por hora absoluta.

**Decisión.**
- El borrador se guarda en `localStorage` bajo
  `pulso.session.<userId>.<templateId>`: cambiar de usuario o de plantilla no mezcla
  sesiones. Se escribe en cada cambio y se borra al terminar o descartar.
- Cada serie guarda `weight`, `reps`, `rpe` y `completedAt`; el RPE es opcional y se añade al modelo
  como columna `rpe` (migración aditiva) y al cuerpo de `POST /strength/sessions`.
- El descanso guarda `restEndsAt` (hora absoluta) y se recalcula al volver a la pestaña; la barra es
  fija sobre la tabla, no un modal.
- Al terminar se envía **una vez** la sesión completa; el servidor crea la sesión y su actividad
  espejo (D-01) y devuelve el resumen.

**Motivo.** Es el gesto más repetido de la app y el sitio donde Garmin falla (F2/F5/F10): la
precarga y la corrección en el sitio eliminan memoria y scroll. Guardar por usuario/plantilla evita
que una sesión a medias aparezca en otra cuenta.

**Cómo se revierte.** Es lógica de cliente más una columna opcional; borrar el borrador local o
ignorar la columna no afecta a las sesiones ya guardadas.

---

## 2026-11-04 — D-15 · Compatibilidad del reloj: fr255 como referencia, mínimo API 3.3

**Contexto.** David usa un **Forerunner 255** y quiere cubrir el máximo de modelos posibles, no solo
el suyo. La PoC Connect IQ compila en fr255, fr255m, fr265, fr965, fenix7, venu3, fr245, fenix6 y
venu2, y no en fr235 (API 1.4).

**Decisión.**
- `minSdkVersion` **3.3.0**: cubre fr245 (API 3.3) en adelante y las APIs usadas
  (`AccelerometerData` desde 2.3, `Communications` y `ActivityRecording` desde 1.0).
- **No usar `AccelerometerData.timestamp`** (API 5.1.1) en el camino común: el conteo por IMU usará
  índice de muestra y periodo; el timestamp queda como mejora opcional solo en modelos que lo
  soportan, y se decidirá con medición.
- Lista amplia de productos en el manifest (21) y matriz de compilación reproducible en
  `watch/connectiq-poc/`.
- **fr235 queda fuera** conscientemente: su API 1.4 no llega al mínimo; si se quisiera cubrir sería
  otra app sin acelerómetro. Se puede bajar el listón solo si se renuncia al sensor.

**Motivo.** Es el mínimo realista que cubre los modelos objetivo y los cercanos; el reloj de David
(fr255) está verificado. El camino principal para llevar entrenamientos (API de workouts) no depende
de la watch-app.

**Cómo se revierte.** Cambiar `minSdkVersion` o quitar productos del manifest; no toca datos.

---

## 2026-11-04 — D-16 · Workouts de Garmin: modelos tipados y nunca enviar ejercicios sin mapear

**Contexto.** El builder anterior fabricaba JSON a mano: sportType 4 (el servidor espera 5), pasos
planos sin descansos, pesos en kg donde la API usa gramos y, para un ejercicio desconocido, enviaba
un `CALISTHENICS_GENERIC` que el atleta no había pedido. Además, `upload_strength_workout` de la
librería exige un `StrengthWorkout`, no un diccionario, así que el envío real fallaba.

**Decisión.**
- Construir con `garminconnect.workout.StrengthWorkout` + `create_strength_set`: un
  `RepeatGroupDTO` por ejercicio con serie y descanso, sportType 5 y peso en gramos.
- Resolver el ejercicio contra el catálogo de **1.527** ejercicios por categoría + variante, con
  alias explícitos para los enums que Garmin nombra distinto.
- **No enviar nada** si algún ejercicio queda sin mapear: el dry-run lo lista y el envío real
  devuelve 400. Nada de sustituciones silenciosas.
- La importación (T-30) es idempotente por `activity_id`, no crea una segunda `Activity` y deja TSS 0
  para no contar dos veces; si no mapea ningún ejercicio, no guarda nada.

**Motivo.** Un workout mal formado puede rechazarse en Garmin o, peor, llegar al reloj con otro
ejercicio. Es preferible negarse y explicar qué falta.

**Cómo se revierte.** Volver al builder anterior o permitir un fallback; no toca datos.

---

## 2026-11-05 — D-17 · La app se llama PULSO

**Contexto.** «Garmin» es marca registrada y `DOCTRINA-CALIDAD.md` §9 prohíbe usar el nombre de otra
empresa como nombre de la app. David elige **PULSO**.

**Decisión.**
- Nombre de producto **PULSO**; paquete `pulso-frontend`; título `PULSO`; claves de
  almacenamiento `pulso.*`.
- «Garmin» se mantiene solo para la cuenta/reloj del usuario («Vincular cuenta», «Enviar al reloj»,
  integración en Ajustes) y en el código de integración, nunca como nombre de la app.
- El repositorio y la carpeta del monorepo no se renombran en esta sesión (sería otra operación);
  los documentos y la interfaz sí.

**Cómo se revierte.** Es una constante de marca y cadenas de texto; cambiarla no toca datos.

---

## 2026-11-05 — D-18 · Regla de textos: se borran, no se sustituyen

**Contexto.** `DOCTRINA-CALIDAD.md` §8: la interfaz no explica cómo está hecha.

**Decisión.** Antes de publicar una pantalla se recorre cada texto y se pregunta si sirve para
decidir o actuar. Si no, se borra: no se reescribe con otra explicación técnica. Sí se conservan
explicaciones breves de las medidas («carga aguda», «frescura») porque ayudan a interpretar un dato.
La verificación incluye capturas y revisión de textos en todas las pantallas.

**Cómo se revierte.** No hay datos afectados.

---

## 2026-11-05 — D-19 · Calendario: la plantilla se programa y se envía por la vía nativa

**Contexto.** David quiere programar entrenos en días concretos o repetirlos cada semana y que el
entreno del día llegue solo al reloj. Una app Connect IQ no puede crear workouts nativos ni
calendario (ver `research/IMU-CALENDARIO.md`).

**Decisión.** El calendario guarda eventos recurrentes con `weekday` y `template_id`; el backend
construye el workout tipado y lo sube y programa con la API de Garmin Connect. La UI permite
previsualizar, enviar y cargar el de hoy. El job diario automático (CAL-1/CAL-2) queda como tarea
siguiente; hoy el envío es explícito desde la app. La prueba real en el fr255 es Nivel 3.

**Cómo se revierte.** Columnas nuevas y endpoints; borrar el evento no borra historial.

