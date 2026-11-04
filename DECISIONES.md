# DECISIONES.md — Garmin Athletics

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
`claude-design-system`, en `designs/garmin-athletics-design-system/`:

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

