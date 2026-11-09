# Revisión de interfaz móvil — Lyfta

Fecha: 2026-11-09 (actualizado tras el arreglo de pesos por serie del mismo día). Ámbito:
app desplegada (no una copia local). Este documento sirve para que un revisor externo
juzgue la interfaz sin acceso al proyecto: qué pantallas hay, qué textos exactos
muestran, qué estados existen y diez problemas concretos con evidencia.

## Cómo se ha generado

- La app se sirve desde el **servidor de casa** con la imagen que está en producción y
  una **copia desechable** de la base de datos (sin credencial de Garmin y sin eventos
  de calendario, para que ningún envío pueda salir hacia el reloj). Esa copia se retira
  al terminar; no queda ningún servidor extra abierto.
- El recorrido es automático (Playwright, Chrome real) y recorre el flujo entero:
  planificar pesos por serie → editarlos → enviar al reloj → entrenar → sesión
  guardada. Guion: `frontend-nuevo/scripts/flujo-movil-desplegado.mjs`.
- Capturas a **390 × 844 CSS** (viewport real de móvil, densidad 2 → PNG de 780 × 1688).
  Sin `fullPage`: con la página entera la barra fija se pinta a media altura y parece
  que tapa contenido (artefacto, no fallo).
- Las capturas de este directorio son las de **después** del arreglo de pesos por serie.
  Las de **antes** están en `antes/`, y el informe anterior en `informe-flujo-antes.json`.
- Datos del recorrido: `docs/capturas-movil/informe-flujo.json`.

## 1. Cómo se abre desde el móvil

| Desde | URL | Requisito |
|---|---|---|
| Casa, misma wifi | `http://192.168.1.139:8010` | Ninguno |
| Cualquier sitio | `http://100.117.58.93:8010` | Tailscale encendido en el móvil |

Comprobado desde otro equipo de la red local y desde otro nodo del tailnet (200 en `/`,
`/gimnasio` y `/manifest.webmanifest`; login con credenciales falsas devuelve 401 JSON).
El túnel es **Tailscale** (WireGuard, cifrado extremo a extremo, sin abrir puertos en el
router). Cloudflare Tunnel no se usa: `cloudflared` no está instalado y el servidor no
resuelve nombres. Detalle y runbook en `DESPLIEGUE.md`.

Las capturas `00-login-tailnet.png` y `01-login-movil.png` son la misma pantalla por las
dos puertas.

## 2. Inventario de las pantallas del flujo

| # | Pantalla | Ruta | Para qué | Captura |
|---|---|---|---|---|
| 1 | Gimnasio | `/gimnasio` | Punto de partida: entreno de hoy, envío al reloj, plantillas y últimas sesiones | `02-gimnasio-movil.png` |
| 2 | Editar pesos (plan) | `/gimnasio/plantillas/:id` | Peso de cada serie con − / +, guardado automático | `03-plan-pesos.png` |
| 3 | Enviar al reloj | bloque dentro de `/gimnasio` | Botón único, estado del envío y guía de sincronización | `04-envio-pendiente.png`, `05-envio-error.png` |
| 4 | Entrenar | `/gimnasio/entrenar?template=:id` | Ejecutar la sesión: peso, reps, esfuerzo y «Hecha» por serie | `06-entrenar.png` |
| 5 | Sesión terminada | estado de la misma ruta | Resumen: volumen, series, reparto y enlaces | `07-sesion-terminada.png` |
| 6 | Editar pesos reales | `/gimnasio/sesiones/:id` | Corregir el peso real por serie después de entrenar | `08-sesion-guardada.png` |

### Textos exactos por pantalla

**Gimnasio.** Título «GIMNASIO»; subtítulo «Tu entreno de hoy, tus plantillas y tu
historial.»; acciones «Biblioteca» y «Catálogo». Tarjeta «Hoy toca» con «Lunes»,
«EMPUJE A», «1 ejercicios · 3 series · 1420 kg», botón «Empezar sesión» y una insignia
«SERIES, DESCANSO Y ESFUERZO». Bloque «Enviar al reloj»: «1 ejercicios · 3 series»,
enlace «Editar pesos», «Estado del envío» + insignia «PENDIENTE» / «ERROR» / «Enviado»,
botón «Enviar al reloj», pie «Tú decides cuándo; el reloj solo muestra el objetivo.».
Después «Tus plantillas» («1 en total»), tarjeta «Empuje A», «Lunes · 1 ejercicios ·
3 series», «1420 kg», botones «Pesos» y «Empezar». Cierra «Últimas sesiones» («5
últimas») con el vacío «Todavía no hay sesiones».

**Editar pesos.** «EDITAR PESOS»; «Empuje A · toca − o + en cada serie»; enlace
«Gimnasio»; «Los cambios se guardan solos.» → tras editar, «Guardado a las 18:44:12».
Por ejercicio: «Press de banca con barra» y «3 × 8»; filas «Serie 1/2/3» con
«60 kg», «65 kg», «70 kg» y botones − / +.

**Enviar al reloj (error).** Insignia «ERROR»; tarjeta «No se pudo enviar»; «Acerca el
reloj, sincroniza y vuelve a intentarlo.»; botón «Reintentar».

**Entrenar.** «ENTRENAR»; «Empuje A · 0:02 · 3 series hechas»; botones «Descartar»
(rojo) y «Terminar sesión» (cian) arriba; «DESCANSO 1:00» + «Sigue aunque bloquees el
móvil»; tarjeta «Press de banca con barra» + «3/3 SERIES»; «Objetivo 3×8 · descanso 60s ·
sin marca anterior»; «Press horizontal»; cabeceras «Serie / Peso (kg) / Reps / Esfuerzo /
Hecha»; al pie, otra vez «Descartar sesión» y «Terminar sesión».

**Sesión terminada.** «SESIÓN TERMINADA»; «Empuje A»; «Editar pesos reales» y «Volver a
Gimnasio»; «PESO MOVIDO 1440 kg»; «SERIES 3»; «Reparto muscular» → «pecho 1440 kg»;
«Series registradas» → «Serie 1/2/3 → 60 kg × 8»; «Guardada en tu historial.».

**Editar pesos reales.** «EDITAR PESOS REALES»; «Empuje A · 09 nov»; «Gimnasio»;
«Ajusta el peso real con − o +. Se guarda solo y recalcula el total.»; filas «Press de
banca con barra · Serie 1/2/3» con «60 kg × 8»; pie «Toca − o + para cambiar una serie.».

### Estados que existen y estados que no

| Pantalla | Carga | Vacío | Error | Éxito |
|---|---|---|---|---|
| Gimnasio | «Cargando el gimnasio» | tarjeta «Todavía no hay sesiones» | «No se pudo leer el gimnasio.» + Reintentar | «Enviado» en la insignia |
| Editar pesos | «Cargando» | — | «No se pudo…» + Reintentar | «Guardado a las …» |
| Enviar al reloj | «Enviando…» | «Pendiente» (estado inicial) | «No se pudo enviar» | «Enviado al reloj» |
| Entrenar | «Cargando» | — | — | «Sesión terminada» |
| Editar pesos reales | «Cargando» | — | no verificado | guardado automático |

No existe: confirmación al terminar sesión, estado persistido del envío, aviso de
«sesión a medias» al volver, ni confirmación al salir de Entrenar.

## 3. Capturas

| Fichero | Qué muestra |
|---|---|
| `00-login-tailnet.png` | Login por la puerta del tailnet (icono, nombre, campos) |
| `01-login-movil.png` | Login por la puerta de la red local |
| `02-gimnasio-movil.png` | Gimnasio completo: Hoy toca, Enviar al reloj, plantillas |
| `03-plan-pesos.png` | Plan con pesos por serie 60/65/70 y botones − / + |
| `03b-edicion-serie.png` | Edición de la serie 2 (65 → 67,5 kg) con «Guardado a las …» |
| `04-envio-pendiente.png` | Bloque de envío en estado «PENDIENTE» |
| `04b-envio-enviado.png` | Envío confirmado: «ENVIADO» + «Enviado al reloj». **Estado simulado**: la respuesta de Garmin se sustituye en el navegador para poder capturarlo sin tocar la cuenta |
| `05-envio-error.png` | Envío con error real (sin credencial Garmin): «ERROR» + «Reintentar» |
| `06-entrenar.png` | Sesión en curso con las tres series marcadas (60/65/70 · 8/8/6) |
| `07-sesion-terminada.png` | Resumen: 1420 kg, 3 series (60/65/70), reparto muscular |
| `08-sesion-guardada.png` | Edición posterior de pesos reales (60/65/70) |
| `pwa-*.png` | Las dos puertas y un contexto seguro, para la comprobación de instalación (`USO-MOVIL.md` §4) |

## 4. Qué pasó al recorrer el flujo contra el despliegue

Resultado de la pasada **después del arreglo** (2026-11-09 19:45). Las capturas de este
directorio son las de después; las de antes están en `antes/` y el informe anterior en
`informe-flujo-antes.json`.

| Comprobación | Resultado |
|---|---|
| La app abre por la red local y por el tailnet | OK (390 px, sin errores de consola) |
| Plantilla con pesos por serie 60/65/70 creada | OK (`set_targets=60/65/70`) |
| Ruta profunda `/gimnasio/plantillas/:id` al recargar | OK (fallback SPA del servidor) |
| Editar una serie con + y − y guardar | OK (65 → 67,5 → 65 en el servidor) |
| Mapeo del entreno con `dry_run` | OK: `dry_run`, `unmapped: []`, los tres pesos en el payload |
| Enviar al reloj sin credencial de Garmin | 400 limpio, la UI muestra «No se pudo enviar» |
| 3 series ejecutadas y sesión guardada | OK: 3 series |
| Pesos y reps por serie en la sesión guardada | **OK: 60/65/70 y 8/8/6** (antes 60/60/60 y 8/8/8) |
| Corregir después de entrenar | OK: 62,5/67,5/72,5 persisten y el tonelaje pasa de 1420 a 1475 |

### Antes y después (2026-11-09)

El plan decía 60/65/70 kg y 8/8/6 reps. Esto es lo que se guardaba antes y lo que se
guarda ahora:

| Captura | Antes (`antes/`) | Después |
|---|---|---|
| `06-entrenar.png` | 60 / 60 / 60 kg · 8 / 8 / 8 reps | **60 / 65 / 70 kg · 8 / 8 / 6 reps** |
| `07-sesion-terminada.png` | «PESO MOVIDO 1440 kg», series 60 × 8 | **«PESO MOVIDO 1420 kg»**, series 60×8, 65×8, 70×6 |
| `08-sesion-guardada.png` | filas a 60 / 60 / 60 | **filas a 60 / 65 / 70** |
| `informe-flujo.json` | `pesos: [60,60,60]`, `coincide: false` | **`pesos: [60,65,70]`, `coincide: true`, `resultado: OK`** |

**Causa.** `buildDraft` (`SessionPage.tsx`) creaba todas las series con
`mark?.weight_kg ?? exercise.weightKg`, es decir, el peso de la última marca o el del
ejercicio; el objetivo por serie (`set_targets`) ni siquiera se pasaba al borrador
(`SessionPage.tsx:270-272`). Se perdía en la pantalla de entrenar: el plan y el envío al
reloj sí llevaban los tres pesos.

**Arreglo.** El borrador recibe `set_targets` y cada serie toma su objetivo
(`setTargets[index].weight_kg` y `.reps`), con esta prioridad: **objetivo de la serie >
última marca > peso del ejercicio**. Así un plan 60/65/70 se entrena y se guarda como
60/65/70, y si no hay objetivos se mantiene el respaldo anterior.

**Prueba rojo → verde.**
`frontend-nuevo/src/test/session-pesos.test.tsx` recorre el camino real (plantilla con
`set_targets` → pantalla de entrenar → POST de la sesión) y comprueba los campos y el
cuerpo enviado. Antes del arreglo falla en la primera serie (`esperado 60`, recibido
82,5) y después pasa (2/2). El segundo caso fija el respaldo con la última marca.
`tests/test_session_weight_correction.py` cubre el camino HTTP completo de la corrección
posterior: guardar 60/65/70, corregir a 62,5/67,5/72,5, releer y comprobar tonelaje.


## 5. Diez problemas concretos

Cada uno lleva su **arreglo concreto** (CSS o texto) en esta tabla; debajo está el
detalle con evidencia. El 1 ya está cerrado en esta pasada; los demás siguen abiertos.

| # | Problema | Arreglo concreto (CSS o texto) |
|---|---|---|
| 1 | Pesos por serie no llegaban a la sesión | **Hecho**: `buildDraft` recibe `set_targets` y usa `setTargets[index]` (código, no CSS) |
| 2 | Cabecera del plan dice «3 × 8» con series 8/8/6 | Texto: en `PlanEditorPage.tsx:120`, si los objetivos no coinciden, `hint={`${sets} series · ${targets.map(t => t.reps).join('/')}`}` |
| 3 | «Objetivo 3×8» no dice el objetivo de cada serie | CSS/texto: `placeholder={String(target.weight_kg)}` en el input de peso y `placeholder={String(target.reps)}` en reps, con `placeholder:text-ink-faint`; o un `<span className="text-caption text-ink-faint">obj. 70 kg</span>` bajo el número de serie |
| 4 | Acciones duplicadas arriba/abajo; «Terminar» sin confirmar | CSS: borrar la fila superior (`SessionPage.tsx:436-454`) y dejar solo la barra inferior `sticky bottom-[calc(var(--ga-space-bottom-nav)+env(safe-area-inset-bottom))]`; texto: confirmación `role="alertdialog"` «Te faltan N de M series. ¿Terminar y guardar?» |
| 5 | Barra de pestañas activa durante la sesión | CSS: en `AppShell`, si `pathname.startsWith('/gimnasio/entrenar')` devolver `<main className="mx-auto w-full max-w-[var(--ga-space-content)] px-4 py-6 pb-28"><Outlet /></main>` sin `<nav>` ni cabecera de marca; `pb-28` deja sitio a la barra de acción propia |
| 6 | «Estado del envío» no persiste | Texto/UI: sustituir la insignia de mutación por `usePushStatus` y mostrar «Enviado hoy a las 18:04» / «Sin enviar»; requiere guardar `last_pushed_at` y `workout_id` en el backend |
| 7 | El error de envío no dice la causa | Texto: pintar `error.message` (el `detail` del servidor) y, si incluye «Vincula», añadir `<Button variant="secondary">Vincular cuenta</Button>`; CSS: `text-stop` en vez de `text-ink-muted` |
| 8 | «1 ejercicios» | Texto: helper `plural(n, 'ejercicio', 'ejercicios')` en `GymPage.tsx:91` y los otros tres puntos que lo repiten |
| 9 | Dos CTA para empezar | Texto: en «Tus plantillas», «Empezar» → «Abrir» con `className={secondaryLink}` (deja de competir con el primario «Empezar sesión»); CSS: quitar `btn-primary` de esa acción |
| 10 | «recalcula el total» sin total visible | Texto/CSS: añadir sobre las filas `<p className="text-caption text-ink-muted">{n} series · {formatNumber(total, 'kg')}</p>` (`SessionEditPage.tsx:102`) o borrar la promesa del texto |

### 1. Los pesos por serie del plan no llegaban a la sesión — **resuelto el 2026-11-09**

**Qué pasaba.** Con el plan a 60/65/70, la pantalla de entrenar rellenaba las tres series
con 60 y la sesión se guardaba 60/60/60. Evidencia de antes: `antes/06-entrenar.png`,
`antes/08-sesion-guardada.png` e `informe-flujo-antes.json` (`pesos: [60,60,60]`).
Código: `buildDraft` usaba `mark?.weight_kg ?? exercise.weightKg` e ignoraba
`set_targets`, que ni se pasaba al borrador.

**Causa.** No se perdía ni en el envío ni en el reloj: el plan y el `dry_run` llevaban
los tres pesos. Se perdía al montar el borrador de la sesión, en el móvil.

**Arreglo.** El borrador recibe `set_targets` y cada serie toma su objetivo, con
prioridad **objetivo de la serie > última marca > peso del ejercicio**.

**Prueba.** `src/test/session-pesos.test.tsx` (rojo antes: esperaba 60 y recibía 82,5;
verde después: 2/2) sobre el camino real plantilla → borrador → POST de sesión.
Verificado además contra el despliegue: `06-entrenar.png`, `07-sesion-terminada.png`
(1420 kg) y `08-sesion-guardada.png` ya con 60/65/70, e `informe-flujo.json` con
`coincide: true`.

### 2. Las repeticiones por serie tampoco llegaban, y el plan lo esconde — **mitad resuelto**

**Evidencia.** El plan se creó con reps 8/8/6 y en `antes/06-entrenar.png` las tres filas
mostraban 8. Tras el arreglo del problema 1, las reps ya se guardan (8/8/6, visible en
`08-sesion-guardada.png`). Lo que **sigue** mal es la cabecera del plan, que dice «3 × 8»
(`PlanEditorPage.tsx:120`) aunque las series tengan reps distintas.

**Por qué duele.** La sesión ya reproduce el plan, pero el plan se describe a sí mismo de
forma engañosa.

**Arreglo pendiente.** Mostrar «3 series · 8/8/6» cuando los objetivos no coincidan, o
quitar el «× reps» si no es representativo. Cambio pequeño y aislado en el editor.

### 3. «Objetivo 3×8» en Entrenar no dice cuál toca en cada serie

**Evidencia.** `06-entrenar.png`: bajo el nombre del ejercicio solo hay «Objetivo 3×8 ·
descanso 60s · sin marca anterior»; no hay objetivo por serie. Código:
`SessionPage.tsx:499`.

**Por qué duele.** Con pesos distintos por serie, lo único que necesitas saber al
levantarte de la máquina es «esta serie toca 70». La pantalla no lo dice y el campo de
peso viene con otro valor.

**Arreglo.** Añadir el objetivo por serie junto al número de la fila (por ejemplo
«Objetivo 70 kg × 6»), o como marcador de agua dentro del campo.

### 4. Acciones duplicadas y confirmación al revés

**Evidencia.** `06-entrenar.png` muestra dos parejas idénticas: «Descartar» + «Terminar
sesión» arriba y «Descartar sesión» + «Terminar sesión» abajo. «Descartar» es rojo y
ocupa el mismo tamaño que «Terminar». En el recorrido, «Terminar sesión» guardó y cerró sin pedir
confirmación; «Descartar» sí la pide. Código: `SessionPage.tsx:449-451` (terminar) frente
a `:456-477` (descartar).

**Por qué duele.** Al acabar la última serie, con la mano cansada, el botón que guarda
una sesión incompleta es el más grande y no pregunta; el que borra sí. La duplicación
invita a pulsar el equivocado según dónde mire.

**Arreglo.** Una sola barra de acción fija abajo (la superior sobra) y confirmar
«Terminar» cuando falten series, con un resumen de lo que se guarda («2 de 3 series»).

### 5. La barra de navegación global sigue activa durante la sesión

**Evidencia.** `06-entrenar.png`: la barra «Hoy · Gimnasio · Ajustes» está fija abajo
(`AppShell.tsx:135`), fija abajo, justo donde reposa el pulgar con una mano. La ruta
`/gimnasio/entrenar` es hija del layout (`App.tsx:98`), así que conserva cabecera de
marca y barra.

**Por qué duele.** Un toque accidental abandona la sesión en curso y esconde el
temporizador de descanso; el borrador se conserva, pero el usuario no lo sabe y cree que
ha perdido la sesión.

**Arreglo.** Modo foco: sin cabecera de marca ni barra de pestañas cuando la ruta empieza
por `/gimnasio/entrenar`, con una salida explícita («Salir» → confirmación).

### 6. «Estado del envío: PENDIENTE» no es un estado real

**Evidencia.** `02-gimnasio-movil.png` y `05-envio-error.png`: la insignia vive en el
mismo bloque, pero viene de una mutación en memoria (`GymPage.tsx:19,130-131`), no de una
consulta ni de `localStorage`. Al cambiar de pantalla y volver, vuelve a «Pendiente»
aunque el envío se haya hecho. Solo la sesión de navegador actual lo recuerda.

**Por qué duele.** Es justo el dato que quieres consultar al llegar al gimnasio: «¿esto
está ya en el reloj?». La interfaz contesta «Pendiente» sin saberlo.

**Arreglo.** Persistir el resultado (último envío, hora y `workoutId`) en el backend y
pintarlo desde una consulta: «Enviado hoy a las 18:04» o «Sin enviar».

### 7. El error de envío no dice lo que ha pasado

**Evidencia.** `05-envio-error.png`: el servidor respondió 400 con «Vincula tu Garmin
primero» y la pantalla muestra siempre «Acerca el reloj, sincroniza y vuelve a
intentarlo.» (`GymPage.tsx:147`). El texto es el mismo para un fallo de vinculación, de
red o del dispositivo.

**Por qué duele.** Manda a hacer un gesto (acercar el reloj) que no arregla nada cuando
el problema es que la cuenta no está vinculada. El usuario pierde el tiempo y desconfía.

**Arreglo.** Mostrar el `detail` del servidor cuando exista y, si es «no vinculado»,
ofrecer el botón «Vincular cuenta» en el propio bloque.

### 8. Plurales sin concordancia

**Evidencia.** «1 ejercicios» aparece tres veces en `02-gimnasio-movil.png` (Hoy toca,
Enviar al reloj, plantillas). Código: `GymPage.tsx:91` y siguientes, sin condición para
el singular. La misma app sí concuerda en otros sitios («1 serie hecha», «1 actividad»).

**Por qué duele.** Es el texto que más se repite en la pantalla principal; el error se
lee como descuido y resta confianza en los números que sí importan.

**Arreglo.** Un ayudante `plural(n, 'ejercicio', 'ejercicios')` y aplicarlo en los cuatro
puntos detectados.

### 9. Dos botones para lo mismo y sin jerarquía

**Evidencia.** `02-gimnasio-movil.png`: «Empezar sesión» en la tarjeta «Hoy toca» y
«Empezar» en la tarjeta de plantilla: dos botones para la misma acción, uno primario y
otro secundario.
Además la tarjeta «Hoy toca» incluye una insignia que no es una acción («SERIES,
DESCANSO Y ESFUERZO»), que ocupa el sitio donde debería leerse el objetivo por serie.

**Por qué duele.** Dos caminos para lo mismo obligan a decidir en un momento (de pie,
entre series) en el que no quieres decidir nada. Y la insignia ocupa el espacio del dato
útil.

**Arreglo.** Un único botón primario «Empezar» en «Hoy toca»; en la lista de plantillas,
acción secundaria «Abrir» (no «Empezar»). Sustituir la insignia por «60 / 65 / 70 kg ·
8/8/6».

### 10. Textos que prometen datos que la pantalla no pinta

**Evidencia.** `08-sesion-guardada.png`: el texto dice «Se guarda solo y recalcula el
total» (`SessionEditPage.tsx:102`) pero no hay ningún total en la pantalla. En
`03-plan-pesos.png` tampoco hay volumen total del plan. En las dos pantallas, la mitad
inferior del viewport queda vacía (390 × 844) y no hay acción siguiente («Empezar»,
«Volver»).

**Por qué duele.** El texto crea una expectativa que la interfaz no cumple, y el espacio
vacío desaprovecha el único momento en el que el usuario mira su plan o su sesión con
calma.

**Arreglo.** Pintar un resumen compacto («3 series · 1420 kg · pecho») encima de las
filas, y usar el hueco inferior para la acción siguiente. Si no se va a mostrar el total,
quitar la promesa del texto.

## 6. Límites de esta revisión

- No se probó en el móvil físico de David: el Poco aparece `offline` en el tailnet desde
  hace 10 días. La comprobación se hizo desde otro equipo de la red local y desde otro
  nodo del tailnet, que es el mismo camino de red que usará el móvil.
- No se envió nada a Garmin: la instancia de revisión no tiene credencial, así que el
  camino «enviado de verdad» queda para la prueba física (`PENDIENTE-PRUEBA-RELOJ.md`).
- No se capturaron los estados de carga ni los errores de las pantallas que no forman
  parte de este flujo (Actividades, Calendario, Rutas, Tendencias).

## 7. Preguntas para el revisor externo

1. Con el plan a 60/65/70, ¿la sesión debe heredar esos pesos (mi propuesta) o es mejor
   que el atleta los teclee siempre y el plan sea solo una sugerencia del reloj?
2. En una pantalla de ejecución, ¿qué es aceptable mantener en pantalla: la barra de
   pestañas, la cabecera de marca, el temporizador? ¿Dónde va «Terminar sesión» para que
   no se pulse por accidente ni se esconda?
3. El bloque «Enviar al reloj» y la tarjeta «Hoy toca» repiten la misma información (1
   ejercicios · 3 series). ¿Deberían ser una sola tarjeta con dos acciones o dos bloques
   separados?
4. ¿Qué debe enseñar la app cuando no sabe si el entreno está en el reloj? ¿Un estado
   explícito con hora, un aviso, o nada?
5. ¿Los resúmenes (volumen, series, reparto) deben ir siempre visibles o solo cuando hay
   datos que merezcan la pena?
