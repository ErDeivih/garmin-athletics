# Pendiente: prueba física del Forerunner 255

Fecha: 2026-11-09. Ámbito: repo `F:\Proyectos\garmin` (Lyfta). Este documento describe
**solo lo que falta para cerrar la prueba con el reloj real** y qué parte de ello depende de
David. No sustituye a `GUION-PRUEBA-RELOJ.md`: lo concreta y corrige donde el código dice
otra cosa. Cuando algo no está demostrado en el repo se marca como **«no verificado en el
código»** o **«no verificado en el repo»**.

> **Actualización 2026-11-09 (posterior a este documento).**
>
> 1. La app ya está **desplegada** en el servidor de casa. Se abre sin Tailscale en
>    `http://192.168.1.139:8010` (red de casa) y con Tailscale en
>    `http://100.117.58.93:8010` (cualquier sitio). Ver `DESPLIEGUE.md`.
> 2. Donde este documento dice «backend y app arrancados en el PC», vale el despliegue, y
>    **no** hay que levantar además el backend local contra los mismos tokens de Garmin
>    (un solo backend por cuenta).
> 3. El 2026-11-09 se recorrió el flujo completo **contra el despliegue** (instancia
>    desechable, capturas en `docs/capturas-movil/`): planificar 60/65/70, editar, mapeo
>    `dry_run` con `unmapped: []`, envío sin credencial (400 limpio), 3 series y sesión
>    guardada. Todo correcto **salvo** un hallazgo que afecta a la prueba C: la sesión
>    guarda 60/60/60 en vez de 60/65/70 porque `SessionPage.tsx:115-116` ignora los
>    objetivos por serie. Detalle en `docs/revision-interfaz-movil.md` (problema 1).
> 4. **Falta exactamente esto, y solo David puede hacerlo**: (a) reloj fr255 cargado y
>    emparejado + sincronizar en Garmin Connect; (b) 2FA de Garmin delante, la primera
>    vez que se vincule la cuenta desde el móvil; (c) pulsar «Enviar al reloj» y mirar la
>    pantalla del reloj; (d) hacer una serie real y sincronizar; (e) contar las reps
>    reales de esa serie para poder medir el detector. Nada más del flujo depende de ti.


---

## 1. Resumen

Queda una sola cosa: **ejecutar el flujo completo contra el reloj físico** (enviar el entreno
desde la app, verlo y ejecutarlo en el fr255, devolver las series, importarlas y medir el
detector). El resto (código, contrato HTTP y prueba en seco) ya está en el repo y cubierto por
pruebas en seco (`PRUEBA-SECA-FINAL.md`,
`frontend-nuevo/screenshots/27-29`, `npm run visual`). Solo puede hacerlo David porque el
flujo exige **2FA de Garmin**, **el reloj en la muñeca** y **el móvil delante** para pulsar y
sincronizar; el agente no pide ni guarda contraseñas ni códigos.

| Qué | Estado | Quién |
|---|---|---|
| Código, contrato HTTP y prueba en seco | Hecho y cubierto por pruebas en el repo | Agente |
| Envío real al fr255 y objetivo visible en el reloj | Pendiente | David + agente |
| Actividad de fuerza real e importación de series | Pendiente (aún no hay actividad de fuerza nueva) | David + agente |
| Medición del detector con reps reales | Pendiente y **no medible con la API actual** (ver §4 D y Anexo A.6) | David (reps) + cambio de código o SQL de solo lectura |
| Captura de la watch-app en el simulador | Bloqueada: frame congelado y sin `.der` en el repo | David (clave y permiso de firewall) |
| Rutas en el reloj | Pendiente; el GPX se copia a mano (no hay envío de rutas en el código) | David |

---

## 2. Prerrequisitos que solo puede ejecutar David

| # | Prerrequisito | Por qué es suyo | Cómo se comprueba en el repo |
|---|---|---|---|
| 1 | Reloj **Forerunner 255** cargado y emparejado; una **sincronización de Garmin Connect** (arrastrar hacia abajo) antes de buscar el entreno | Sin sincronizar, la cola de mensajes de Garmin no baja al reloj (evidencia real: `PRUEBA-RELOJ-2026-11-07.md`, la cola pasó de 4 a 0 tras sincronizar) | `scripts/garmin_diagnose_watch.py` lee `deviceId`, dispositivo y mensajes |
| 2 | **Sesión de Garmin viva**: no cerrar sesión ni borrar los tokens | Los scripts del backend no piden contraseña; si el token falta o caduca, el login falla | Hay tokens en `backend/garmin_tokens/garmin_tokens.json` **y** en `backend/garmin_tokens_f8aae4f6-7ab0-4628-9d03-8d67f70c8cab/`. La API usa el directorio **por usuario**: `GARMIN_TOKENS_DIR_<user.id>` (`backend/app/api/v1/social_auth.py:168-169`) |
| 3 | **2FA**: si Garmin lo pide, lo teclea David en la app | El agente no pide ni guarda códigos; la vinculación vive en **Ajustes → Vincular cuenta → «Código de verificación» → «Completar vinculación»** (`frontend-nuevo/src/pages/SettingsPage.tsx:41-112`) | El script `scripts/garmin_login_once.py:16-26` **no puede completar el 2FA**: su callback lanza `MFARequired` y solo imprime `MFA_REQUIRED` |
| 4 | **Cuenta Lyfta** con sesión iniciada y Garmin vinculado | La app no muestra «Vinculado» si no existe la fila de credenciales | `GET /api/v1/sync/status` devuelve `linked`, `garmin_email`, `needs_reauth`, `last_sync_at` (`backend/app/api/v1/sync.py:56-85`) |
| 5 | **Plantilla de 2–3 ejercicios** con series, pesos y descansos, **asignada al día de la semana de hoy** | El botón de envío del gimnasio solo existe si hay plantilla para el día actual (`GymPage.tsx:17-19,109-156`); con `weekday=null` no aparece | Campo `weekday` 0=lunes..6=domingo (`backend/app/api/v1/gym.py:85-107`) |
| 6 | Ejercicios **con `garmin_enum`** en el catálogo | Si un ejercicio no se resuelve, el envío devuelve `unmapped` y **no envía** | `GARMIN_EXERCISE_MAP` en `backend/app/api/v1/strength.py:37-85`; los ejercicios de la semilla con enum en `backend/app/services/gym_seed.py` |
| 7 | **Ajustes → Secciones** con las secciones ampliadas encendidas (Calendario, Actividades, Rutas) | Por defecto están apagadas: `VITE_FEATURE_EXTENDED=false` y la bandera del navegador manda (`frontend-nuevo/src/config/features.ts:12-26`) | Sin eso, Calendario/Actividades/Rutas no aparecen en el menú (`AppShell.tsx:60`) |
| 8 | **App abierta en el móvil** | Es una app web (React/Vite), no un APK: el móvil tiene que alcanzar el servidor y la API | `frontend-nuevo/vite.config.ts` sirve en `5173` y hace proxy a `http://127.0.0.1:8000` por defecto. El guion arranca el backend en **8010**, así que hace falta `VITE_API_PROXY_TARGET=http://127.0.0.1:8010`. Para abrirla desde el móvil en desarrollo hace falta exponer Vite en la red (`npm run dev -- --host`). **No hay APK en el repo.** Ojo: al redactar esto hay un cambio **en curso y sin commitear** en el árbol de trabajo (PWA con `manifest.webmanifest` + `sw.js` en `frontend-nuevo/public/`, y servido del build por el propio backend en `backend/main.py` + `tests/test_spa_serving.py`); si ese cambio ya está aplicado, el móvil puede abrir la app servida por el backend en una sola URL. Comprobar `git status` antes de la prueba |
| 9 | (Solo D/E) **Clave de desarrollador `.der`** para compilar/instalar la watch-app | No está en el repo: `watch/lyfta-watch/README.md:11,24` dice que la clave es local y que instalar en el reloj es Nivel 3 | Búsqueda de `*.der` en el repo: 0 ficheros |

Comandos de arranque (los del guion, sin cambios):

```powershell
# Backend real, desde F:\Proyectos\garmin\backend
$env:DATABASE_URL="sqlite+aiosqlite:///F:/Proyectos/garmin/garmin_athletics.db"
$env:GARMIN_TOKENS_DIR="F:\Proyectos\garmin\backend\garmin_tokens"
$env:TRACKS_DIR="F:\Proyectos\garmin\data"
..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8010

# App móvil, desde F:\Proyectos\garmin\frontend-nuevo
$env:VITE_API_PROXY_TARGET="http://127.0.0.1:8010"   # el proxy por defecto es 8000
npm run dev
```

---

## 3. Pasos ordenados

Orden recomendado: **A → C → B → G → F → D → E**. Primero el flujo principal (A) y la
importación (C), que es lo que da valor; B/G/F son de interfaz y se pueden hacer en cualquier
momento; D y E exigen instalar la watch-app y no deben bloquear lo anterior.

### 3.0 Antes de tocar nada (David)

1. Reloj cargado, emparejado y sincronizado con Garmin Connect una vez.
2. Backend y app arrancados con los comandos de §2.
3. Iniciar sesión en Lyfta; **Ajustes** debe mostrar el badge **«Vinculado»**. Si sale
   «Vuelve a vincular tu cuenta para seguir sincronizando», re-vincular antes de seguir.
4. **Ajustes → Secciones**: encender las secciones ampliadas.
5. Comprobar que la plantilla de hoy tiene 2–3 ejercicios, series con peso y descanso.

### 3.1 Prueba A — Del móvil al reloj

| # | Qué se pulsa / hace | Qué debe verse | Evidencia que se deja |
|---|---|---|---|
| A1 | **Gimnasio**. En «Hoy toca» debe estar la plantilla del día | Nombre de la plantilla, «N ejercicios · N series · X kg» | Captura de la tarjeta «Hoy toca» |
| A2 | Pulsar **Editar pesos** (o la ruta `/gimnasio/plantillas/<id>`) | Una fila **«Serie 1», «Serie 2»…** por serie, con su peso | Captura con los pesos por serie |
| A3 | Cambiar un peso con **− / +** | El número cambia en pasos de **2,5 kg** (`PlanEditorPage.tsx:19`) y arriba aparece **«Guardado a las HH:MM:SS»** (guardado solo, debounce 450 ms) | Captura del aviso «Guardado a las…» |
| A4 | Volver a **Gimnasio**. En la tarjeta **«Enviar al reloj»** el badge está en **«Pendiente»** | «N ejercicios · N series» y el botón **«Enviar al reloj»** activo | Captura del estado Pendiente |
| A5 | Pulsar **Enviar al reloj** | Primero **«Enviando…»**; al terminar badge **«Enviado»** y bloque **«Enviado al reloj»** con «Si no aparece, acerca el reloj y sincroniza» | Captura del bloque «Enviado al reloj». **Además**: pestaña Red del navegador → `POST /api/v1/strength/push-to-garmin` → respuesta con `status: "sent"`, `unmapped_exercises: []`, `garmin_response.workoutId` y `pushed_to_device` sin `error` |
| A6 | En el reloj: **Entrenamiento → Entrenamientos**, abrir el entreno de hoy | Nombre del entreno, cada ejercicio y **el peso objetivo de cada serie**; no hay que escribir pesos | Foto/captura del reloj |
| A7 | Pulsar **Empezar** y hacer **una serie** de un ejercicio | El reloj registra la serie. El avance de paso lo decide la app nativa de Garmin; si no avanza solo, usar el botón de vuelta (**no verificado en el código**: es comportamiento de Garmin, no de Lyfta) | Hora de inicio y captura si se puede |
| A8 | Sincronizar Garmin Connect (arrastrar hacia abajo) | La actividad de fuerza aparece en Garmin y en Lyfta tras «Sincronizar ahora» o al pasar a C | Captura del reloj sincronizado / `last_sync_at` |

**Si sale «No se pudo enviar»**: acercar el reloj, sincronizar Garmin Connect y pulsar
**Reintentar**. Aviso: ese reintento **sube un workout nuevo** a Garmin (no hay idempotencia
en esa ruta, ver Anexo A.4).

### 3.2 Prueba C — Importar las series y corregir pesos

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| C1 | Terminar la actividad de fuerza en el reloj y **sincronizar** Garmin Connect | La actividad sube a Garmin | Hora de la sincronización |
| C2 | Con el backend en 8010: `.\venv\Scripts\python.exe scripts\import_latest_strength.py` | Primero `ACTIVIDAD <id> <hora> <nombre>`; después `IMPORT_OK {...}` con `status`, `session_id`, `sets_imported`, `unmapped`, `weight_unit` | Salida completa del comando (sin tokens) |
| C3 | **Gimnasio → Últimas sesiones**: abrir la sesión nueva | Series con su **peso y reps**; volumen total y número de series | Captura del historial |
| C4 | **Corregir pesos**: cambiar una serie con **− / +** | **«Guardado.»** y el volumen total recalculado | Captura antes/después del volumen |
| C5 | Repetir la importación del mismo `activity_id` | HTTP **409** `already_imported`; el script imprime `ALREADY_IMPORTED`. **No** se crea otra sesión | Salida del comando |

Si no encuentra actividad de fuerza de hoy, el script imprime
`NO_STRENGTH_ACTIVITY: no hay una actividad de fuerza de hoy en Garmin.` Ojo: la
**sincronización de Lyfta no importa series**; solo trae la
`Activity`. Las series entran únicamente por `POST /api/v1/strength/import-garmin/{id}` o por
este script (`backend/app/services/sync_service.py` no llama a `import_exercise_sets`).

### 3.3 Prueba B — Calendario y auto-carga

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| B1 | **Calendario → Programar entrenamiento**: plantilla, «Se repite cada semana», días, hora, **Programar** | «Entrenamiento semanal guardado…» | Captura del formulario y del aviso |
| B2 | Pulsar **Preparar los próximos 7 días** | «Entrenos de hoy y próximos días enviados» si hubo envíos | Red: `POST /api/v1/calendar/sync-upcoming?days=7` → `sent > 0` y `events[]` con `status: "sent"`, `workout_id`, `target_date` |
| B3 | Volver a pulsarlo el mismo día | `status: "nothing"`, `sent: 0`; **sin duplicados** (idempotente por `last_scheduled_date`, `calendar_auto.py:62-63,153`) | JSON de la segunda llamada |
| B4 | Programar **dos entrenos el mismo día** y quitar uno («Quitar todo» / «Quitar desde aquí») | Quedan los dos; al quitar uno **no desaparece el otro** | Captura del calendario |

Ojo (Anexo A.7): esta ruta **no manda el peso por serie**; usa un solo `weight_kg` por
ejercicio. El «peso objetivo de cada serie» de A solo lo manda el envío del Gimnasio.

### 3.4 Prueba G — Biblioteca y filtros móviles

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| G1 | **Gimnasio → Biblioteca**; filtrar por foco (Todos/Empuje/Tirón/Pierna) | La lista cambia de forma coherente | Captura por filtro |
| G2 | Abrir una rutina | **Activación / Bloque principal / Cierre** y, por ejercicio, una fila por serie con peso y reps (`LibraryPage.tsx:17-25,157-158`) | Captura de la rutina |
| G3 | Comprobar el resumen del ejercicio (series × reps · peso) y el volumen | Coinciden con las series mostradas | Captura |
| G4 | **Actividades**: filtros por deporte, texto, **Desde/Hasta**, atajos **Últimos 30 días** y **Este mes** | Resultados coherentes | Captura |
| G5 | Forzar **sin resultados** | Estado vacío con **Quitar filtros** | Captura |
| G6 | **Fechas invertidas** (Desde > Hasta) | Aviso **«La fecha Desde no puede ser posterior a Hasta.»** (`ActivitiesPage.tsx:114`) y sin consulta rota | Captura del aviso |

### 3.5 Prueba F — Ruta en el reloj

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| F1 | **Rutas → Generar**: nombre, inicio, puntos de paso, distancia, esfuerzo | Ruta con distancia, desnivel y parciales («ritmo por kilómetro») | Captura |
| F2 | **Descargar GPX para el reloj** | Se descarga `*.gpx` | Fichero descargado |
| F3 | Llevar el GPX al reloj **a mano** | En el reloj, el recorrido se abre con su **perfil de elevación** | Captura del reloj |

No hay envío de rutas por API en el repo (solo exportar GPX: `backend/app/api/v1/routes.py:273-291`),
así que la copia al reloj es manual. **No verificado en el código** ningún automatismo para
instalar cursos en el fr255.

### 3.6 Prueba D — Detección automática (watch-app)

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| D1 | Instalar la watch-app (ver E1) y configurar `apiUrl` y `token` en los ajustes de la app desde Garmin Connect | La app arranca y pide el entreno de hoy | Captura de la pantalla |
| D2 | Abrir **Lyfta** en el reloj | «Buscando entreno» → el entreno de hoy (nombre, «Ejercicio 1/N», «Serie 1/N», «Peso (kg)», «Objetivo x N») | Captura |
| D3 | Hacer **8–10 reps** en press y **8–10** en curl. **No pulsar nada más** | «Reps: N» sube durante la serie y la serie **se cierra sola** tras el reposo | Anotar reps reales por serie |
| D4 | Esperar 5–10 s sin moverte después de la última rep | La app guarda la serie y pasa a la siguiente serie/ejercicio | Captura de la pantalla siguiente |
| D5 | Comprobar el envío en el móvil/backend | `POST /api/v1/watch/sets` → `{"status":"accepted","duplicate":false,...}`; la serie aparece en la sesión «Entrenamiento en el reloj» | JSON del envío y captura del historial |

Criterio numérico del guion: **≥95 % de series con error ≤1 rep** y ningún cierre prematuro.
Hoy **no se puede medir con la API**: `detected_reps` se guarda en la base de datos
(`backend/app/db/models.py:302`, `backend/app/api/v1/watch.py:157`) pero **no se devuelve** en
la sesión (`_set_out`, `backend/app/api/v1/gym.py:171-185`). Ver §4 D y Anexo A.6.

### 3.7 Prueba E — Watch-app propia

| # | Qué se pulsa / hace | Qué debe verse | Evidencia |
|---|---|---|---|
| E1 | Instalar `watch/lyfta-watch/build/lyfta-fr255.prg` con el flujo de desarrollador | La app **Lyfta** aparece en el reloj | Captura de la lista de apps del reloj |
| E2 | Configurar `apiUrl` (URL del backend alcanzable desde el móvil/reloj) y `token` en los ajustes de la app en Garmin Connect (`watch/lyfta-watch/resources/resources.xml:8-9`) | La app deja de usar la rutina de demostración (`LyftaView.mc:26-36`) | Captura de los ajustes |
| E3 | Abrir **Lyfta** en el reloj | «Lyfta», nombre del entreno, **«Ejercicio 1/N»**, ejercicio, **«Serie 1/N»**, **«Peso (kg)»**, **«Objetivo x N»**, **«Reps: N»**, «Vel: … m/s», «Fuerza: … N», «AUTO - no pulses nada», «ATRAS salir» (`LyftaView.mc:225-279`) | Capturas |
| E4 | Hacer una serie | Se cierra sola; **no vibra** (no hay ninguna llamada de vibración en `watch/lyfta-watch/source/`) | Vídeo/captura |
| E5 | Enviar la misma serie dos veces | El backend responde `duplicate: true` y no duplica | JSON con `duplicate` |

Cómo instalar en el reloj real: el repo **solo** documenta compilar
(`build-matrix.ps1`) y ejecutar en el simulador (`monkeydo`), y dice explícitamente que
instalar en el reloj es Nivel 3 (`watch/lyfta-watch/README.md:24`). El procedimiento exacto de
instalación en el dispositivo **no verificado en el repo**.

---

## 4. Criterio de aprobado por prueba

Los nombres de campo son los que devuelve el código, no una descripción.

| Prueba | Aprobado cuando | Dónde se lee el dato |
|---|---|---|
| **A** | `status == "sent"`, `unmapped_exercises == []` y `garmin_response.workoutId` presente; `pushed_to_device` sin `error`; y en el reloj se ve el peso objetivo de cada serie sin escribirlo | Red del navegador (`POST /api/v1/strength/push-to-garmin`) + reloj. Campos en `backend/app/api/v1/strength.py:155-161` |
| **B** | Primera pasada: `sent > 0` y `events[].status == "sent"` con `workout_id`. Segunda pasada el mismo día: `sent == 0` y `status == "nothing"`, sin eventos nuevos | `POST /api/v1/calendar/sync-upcoming?days=7` (`calendar_auto.py:160-164`) |
| **C** | `sets_imported` == número de series activas hechas, `unmapped == []`, `session_id` visible en «Últimas sesiones» y volumen recalculado al corregir; reimportar devuelve HTTP **409** `already_imported` | `POST /api/v1/strength/import-garmin/{activity_id}` y `scripts/import_latest_strength.py` |
| **D** | ≥95 % de las series con `abs(detected_reps − reps_reales) ≤ 1` y ningún cierre antes de ~5 s de reposo. Si no se cumple, se deja el conteo manual (decisión del guion) | **No medible con la API actual**: `detected_reps` no se devuelve. Haría falta SQL de solo lectura sobre `session_sets` o exponer el campo. El 95 % es un **objetivo**, no un resultado medido en el repo |
| **E** | El móvil recibe `POST /api/v1/watch/sets` con `duplicate: false` la primera vez y `duplicate: true` la segunda, con el mismo `session_id`; la pantalla muestra los textos de E3 | `backend/app/api/v1/watch.py:108-172` |
| **F** | El GPX se descarga y el reloj abre el recorrido con perfil de elevación | `GET /api/v1/routes/{id}/export` |
| **G** | Filtros devuelven lo esperado, sin resultados aparece **«Quitar filtros»** y fechas invertidas muestran el aviso sin romper la consulta | `frontend-nuevo/src/pages/extended/ActivitiesPage.tsx`; `LibraryPage.tsx` |

Evidencia mínima común a todas: captura de pantalla del móvil, captura/foto del reloj y el
JSON de la llamada implicada **sin tokens ni contraseñas** (el `workoutId` sí se puede
enseñar; `PRUEBA-RELOJ-2026-11-07.md` ya usó `workoutId=1753715348` como evidencia).

---

## 5. Qué puede hacer el agente y qué exige a David

| Momento | El agente puede, solo, después del paso | Necesita a David delante |
|---|---|---|
| A (envío) | Leer la respuesta de `push-to-garmin` y los logs del backend; comprobar en Garmin con `scripts/garmin_check_scheduled.py` (scheduled) o `scripts/garmin_diagnose_watch.py` (workout y dispositivo, con IDs fijos). **No** puede abrir el reloj ni sincronizarlo | Pulsar «Enviar al reloj» en el móvil, abrir el entreno en el reloj, pulsar Empezar y sincronizar Garmin Connect |
| C (importación) | Ejecutar `scripts/import_latest_strength.py`, leer `sets_imported`, `unmapped` y `session_id`, y repetir la importación para comprobar el 409. Corregir pesos por API (`PUT /api/v1/strength/sessions/{id}`) **es una escritura en la base real** y además borra `detected_reps` (Anexo A.5): no hacerlo si hay que medir el detector; que lo haga David en la pantalla | Terminar y sincronizar la actividad, y corregir en la UI si hay que medir el detector |
| B (calendario) | Leer `sent`, `events[].workout_id`; comprobar que no hay duplicados; revisar `last_scheduled_date` | Pulsar «Preparar los próximos 7 días», programar/quitar eventos en el móvil |
| D (detector) | **Nada automático con el código actual**: no hay endpoint que devuelva `detected_reps`. Por adelantado puede generar el token de la watch-app y revisar los envíos | Hacer las series, contar las reps reales, capturar el reloj |
| E (watch-app) | Generar el token Bearer de Lyfta (`create_token(user_id)`, 30 días, `backend/app/core/security.py:54`) para que David lo pegue; leer los envíos y el `duplicate` | Instalar la app en el reloj, configurar `apiUrl`/`token` en Garmin Connect, ejecutar |
| F (rutas) | Nada: solo existe exportar GPX | Generar, descargar, copiar al reloj y comprobar |
| G (filtros) | Nada: es interfaz | Pulsar y capturar |

Regla de seguridad que se mantiene: el agente **no** pide contraseña, token de Garmin ni
código 2FA, y no los escribe en ningún fichero de evidencia.

---

## 6. Bloqueos conocidos y cómo se esquivan

| # | Bloqueo | Qué se observa | Cómo se esquiva |
|---|---|---|---|
| 1 | **Frame congelado del simulador** | La ventana devuelve siempre la misma imagen antigua con el estado **Off**; `capture-simulator.ps1` termina con `capture=False nonBlack=False exit=1` y **no guarda PNG** (`watch/lyfta-watch/screenshots/captura-error.log`) | Seguir `SIMULADOR.md`: `onUpdate` ya está corregido; permitir el simulador en el **firewall** («Permitir», una vez); encender la pantalla con **LIGHT**; probar **File > Save Screen Capture**; `Reset Simulator` / `Delete All Apps` antes de reinstalar. Si sigue, es el simulador de esta instalación, no la app. Para ejecutar los scripts hace falta la **clave `.der`**, que no está en el repo |
| 2 | **Expiración/renovación de tokens de Garmin** | Un fallo 401/auth marca `needs_reauth=True` (`backend/app/api/v1/sync.py:40-53`, `app/scheduler/scheduler.py:47-57`) y la app avisa «Vuelve a vincular tu cuenta» | Re-vincular en **Ajustes → Cambiar cuenta**: el flujo con `ticket` + `complete_mfa_link` sí completa el 2FA (`social_auth.py:172-240`). No usar `garmin_login_once.py` para el 2FA: no acepta el código. No borrar `backend/garmin_tokens*` sin querer re-vincular |
| 3 | **Dependencia del móvil** | Es una web: sin servidor de desarrollo (o sin el build servido por el backend) la app no habla con la API; el guion arranca el backend en **8010** y el proxy de Vite por defecto apunta a **8000** | En desarrollo: `$env:VITE_API_PROXY_TARGET="http://127.0.0.1:8010"` y, para el móvil, `--host` en la red local. El PWA y el servido de un solo origen están **en curso sin commitear** al redactar esto; si ya están aplicados, basta compilar (`npm run build`) y abrir la URL del backend. No hay APK |
| 4 | **Duplicados al reimportar** | Reimportar la **misma** actividad: HTTP 409 `already_imported` y no duplica (correcto). Pero la sesión de la watch-app (`activity_id = "watch:YYYY-MM-DD"`) y la actividad nativa importada son **dos sesiones distintas** del mismo entreno | Decidir de antemano qué camino se mide en cada pasada (nativo o watch-app) y no corregir en ambos. El envío del Gimnasio **no es idempotente**: cada clic sube un workout nuevo a Garmin y no guarda `workout_id` |
| 5 | **«Enviado» puede ser falso positivo** | El backend responde `status: "sent"` aunque el push al dispositivo falle (lo deja en `pushed_to_device.error`); la UI solo mira `status === 'sent'` | Revisar `pushed_to_device` en la respuesta de red, no solo el badge |
| 6 | **El estado del envío no persiste** | Al salir y volver a **Gimnasio**, el badge vuelve a **«Pendiente»** (estado de mutación en memoria, `GymPage.tsx:19,130-131`) | No usar el badge como prueba duradera: la evidencia es la respuesta JSON y el reloj |

Riesgos menores que conviene tener apuntados:

- `push_workout_to_device` se llama sin `device_id` (`strength.py:152`): la librería usa el
  **último dispositivo usado**. En esta cuenta solo hay un fr255 (`PRUEBA-RELOJ-2026-11-07.md`).
- Los ejercicios con `garmin_enum` pero sin entrada en `GARMIN_EXERCISE_MAP` fallan en el
  envío del Gimnasio (ver Anexo A.7, caso «Prensa de piernas»).
- La prueba con 11–12 reps no se contará como fiable (Anexo A.2): usar **8–10**.

---

## 7. Comprobación rápida (para David, sin leer lo demás)

1. Reloj cargado, emparejado y **sincronizado** en Garmin Connect; backend y app arrancados.
2. En **Ajustes**: «Vinculado» y secciones ampliadas encendidas.
3. **Gimnasio → Editar pesos**: cambia una serie con −/+ y espera «Guardado a las …».
4. **Gimnasio → Enviar al reloj**: verás «Pendiente» → «Enviando…» → «Enviado al reloj».
5. En la pestaña **Red**: la respuesta de `push-to-garmin` tiene `status: "sent"`, `unmapped_exercises: []` y un `workoutId`.
6. En el reloj: **Entrenamiento → Entrenamientos**, abre el entreno, comprueba **el peso de cada serie** y pulsa **Empezar**; haz una serie.
7. Sincroniza Garmin Connect y ejecuta `.\venv\Scripts\python.exe scripts\import_latest_strength.py`: debe imprimir `IMPORT_OK` con `sets_imported` y `unmapped: []`.
8. Repite el comando: debe dar **409 / `ALREADY_IMPORTED`**, sin duplicar.
9. Si vas a medir el detector: haz series de **8–10 reps**, cuenta las reales y no corrijas pesos antes de sacar los datos.
10. Si haces la captura del simulador: permite el firewall y enciende la pantalla con **LIGHT**; si sale negra, no la guardes como evidencia.

---

## Anexo A — Contradicciones entre el código y la documentación existente

Esto es lo que no hay que dar por hecho al leer los documentos anteriores.

1. **El cierre de serie no es de ~1,9 s.** `PRUEBA-RELOJ-2026-11-07.md:87` dice «cierre por
   inactividad (~1,9 s)». El código cierra tras `max(5000, min(10000, mediana × 2,5))` ms, es
   decir **entre 5 y 10 s** (`watch/lyfta-watch/source/LyftaSensor.mc:274-281`). No cerrará
   «solo» a los 2 s; hay que estarse quieto 5–10 s.
2. **«8–12 reps» choca con el criterio de fiabilidad.** `isReliable()` exige **3 a 10 reps**
   (`LyftaSensor.mc:287-289`); con 11–12 reps la serie se marca `needs_review = true` y el
   1RM estimado queda en 0. Para la prueba D, usar 8–10.
3. **El 95 % del detector no está medido.** El guion lo pone como criterio
   (`GUION-PRUEBA-RELOJ.md:67`); el repo no tiene ninguna herramienta ni resultado que lo
   mida. `PRUEBA-SECA-FINAL.md:46` lo deja como pendiente.
4. **El envío del Gimnasio no guarda nada ni es idempotente.** `POST /strength/push-to-garmin`
   sube un workout nuevo y hace push al dispositivo, pero **no agenda** y no persiste el
   `workoutId` (`backend/app/api/v1/strength.py:142-161`). Por eso «Reintentar» puede dejar
   varios entrenos en Garmin Connect. La ruta del calendario sí guarda
   `garmin_workout_id` y `last_scheduled_date`, pero **no hace push al dispositivo**
   (`calendar.py:288-308`).
5. **Corregir pesos borra la evidencia del detector.** `PUT /strength/sessions/{id}` borra
   todas las series y las recrea (`gym.py:1210-1231`), y `SetIn` no incluye `client_set_id`
   ni `detected_reps` (`gym.py:93-105`): tras corregir un peso, `detected_reps` pasa a NULL y
   se pierde la idempotencia de la watch-app. `PRUEBA-RELOJ-2026-11-07.md:89-91` dice que se
   pueden cambiar «peso y reps reales», pero la UI **solo edita el peso**
   (`SessionEditPage.tsx:40-45,136`); las reps se muestran, no se editan.
6. **`detected_reps` no se puede leer por API.** Se guarda y se usa para `needs_review`, pero
   `_set_out` no lo devuelve (`gym.py:171-185`). Medir el detector exige SQL de solo lectura
   o un cambio de código.
7. **El peso por serie solo viaja por una de las tres rutas.** El envío del Gimnasio manda
   `set_targets` (`GymPage.tsx:26-39`); el envío del Calendario (`calendar.py:204-216`) y la
   auto-carga (`calendar_auto.py:84-97`) **no** los mandan, así que el workout nativo se
   construye con un único `weight_kg` por ejercicio. Además, «Prensa de piernas» tiene
   `garmin_enum=LEG_PRESS` (`gym_seed.py:131-132`) pero no está en `GARMIN_EXERCISE_MAP`
   (que solo tiene «prensa», `strength.py:75`): por el Gimnasio daría `unmapped` y por la
   auto-carga sí se mapearía, porque esa ruta añade el enum del catálogo
   (`calendar_auto.py:88-89`).
8. **La importación de series no se ha validado contra la cuenta real.** Lo dicen el propio
   módulo (`backend/app/services/garmin_import.py:9-10`) y su test
   (`tests/test_garmin_import.py:6`): el contrato está probado con un doble, no con Garmin.
9. **La «cola offline» de la watch-app no se reintenta.** `README.md:5` y `DESIGN.md:87-89,106`
   dicen que la cola se guarda en `pending_sets` y se reintenta al arrancar y al volver a
   primer plano. El código guarda la cola con la clave `pending`
   (`LyftaModel.mc:16-18,145-158`) y **no hay ningún reintento** al cargar
   (`LyftaView.mc:26-36`): si el envío falla, la serie se queda guardada y no se reenvía.
10. **Los textos de la watch-app no son los de `DESIGN.md`/`README.md`.** El diseño promete
    `OK hecha` / `ABAJO siguiente` y `README.md:62` «OK serie · ABAJO ejercicio / ATRÁS salir»;
    la vista pinta «AUTO - no pulses nada» y «ATRAS salir», sin pista de OK
    (`LyftaView.mc:276-278`). Además `Peso (kg)` se dibuja en `y=106` y `Serie 1/N` en
    `y=108` (`LyftaView.mc:247-255`): riesgo de solapamiento; **no verificado en pantalla**.
    El algoritmo tampoco es el del diseño (pico > ~1,25 g): es adaptativo al 55 % del
    recorrido (`LyftaSensor.mc:183-219`).
11. **«Vinculado» no prueba que los tokens funcionen.** El badge sale de la fila de
    credenciales (`sync/status.linked`), no de un login correcto. La prueba real es un envío
    o una sincronización correctos.
12. **Los scripts de diagnóstico llevan IDs fijos.** `scripts/import_latest_strength.py:24`
    fija `USER_ID`; `scripts/garmin_check_scheduled.py:11` fija la carpeta de tokens de ese
    usuario; `scripts/garmin_diagnose_watch.py:11-13` fija `USER`, `WORKOUT_ID` y
    `DEVICE_ID`, todos de la sesión del 2026-11-07. Si en la prueba se usa otro usuario o
    workout, no sirven tal cual (la importación busca `garmin_tokens_<USER_ID>`).
13. **El planificador no se ejecuta al arrancar.** La auto-carga es un cron a las **06:30**
    (`scheduler.py:119-126`); si el backend se arranca más tarde, ese día no ha corrido y hay
    que pulsar **Preparar los próximos 7 días**.
14. **La app móvil no es una app instalable desde una tienda.** `frontend-nuevo` es una web
    con proxy de Vite (`vite.config.ts`) y no hay APK en el repo. Al redactar esto hay un PWA
    (manifest + service worker) y el servido del build por el backend **en curso y sin
    commitear** (`frontend-nuevo/public/`, `backend/main.py`, `tests/test_spa_serving.py`);
    mientras no esté cerrado, para el móvil hay que usar la red local con `--host` o el
    navegador del propio PC. Este punto y §2.8 pueden cambiar en cuanto se commitee ese
    trabajo: comprobar `git status` antes de la prueba.

---

## Anexo B — Fuentes usadas

- `GUION-PRUEBA-RELOJ.md`, `PRUEBA-SECA-FINAL.md`, `WALL.md`, `ESTADO-AGENTE.md`,
  `PRUEBA-RELOJ-2026-11-07.md`.
- Código: `backend/app/api/v1/watch.py`, `sync.py`, `gym.py`, `strength.py`, `calendar.py`,
  `social_auth.py`, `routes.py`; `backend/app/services/garmin_workout.py`, `garmin_import.py`,
  `garmin_service.py`, `calendar_auto.py`, `sync_service.py`, `motion_detection.py`,
  `gym_seed.py`; `backend/app/scheduler/scheduler.py`; `backend/app/core/config.py`,
  `security.py`; `backend/app/db/models.py`.
- Scripts: `scripts/import_latest_strength.py`, `scripts/garmin_login_once.py`,
  `scripts/garmin_check_scheduled.py`, `scripts/garmin_diagnose_watch.py`.
- Watch-app: `watch/lyfta-watch/manifest.xml`, `README.md`, `DESIGN.md`, `SIMULADOR.md`,
  `watch/lyfta-watch/resources/resources.xml`, `source/LyftaApi.mc`, `LyftaApp.mc`,
  `LyftaModel.mc`, `LyftaSensor.mc`, `LyftaView.mc`, `capture-simulator.ps1`; capturas y
  `screenshots/captura-error.log`.
- Frontend: `GymPage.tsx`, `PlanEditorPage.tsx`, `SessionEditPage.tsx`, `SettingsPage.tsx`,
  `CalendarPage.tsx`, `ActivitiesPage.tsx`, `LibraryPage.tsx`, `config/features.ts`,
  `vite.config.ts`.
- Pruebas: `tests/test_watch_api.py`, `test_dry_run_watch_flow.py`, `test_calendar_auto.py`,
  `test_garmin_import.py`, `test_motion_profile.py`.
