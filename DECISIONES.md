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
manda al servidor una sola vez con todas las series (`POST /strength/sessions/finish`).
El servidor guarda sesiones **terminadas**, no borradores.

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
