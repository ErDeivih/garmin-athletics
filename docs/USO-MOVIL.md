# Lyfta en el móvil: instalar y qué falta

Fecha: 2026-11-10. Este documento tiene **un solo bloque** con lo que hay que hacer para
usarla en el móvil y lo que falta para el reloj. Debajo, el detalle.

## Bloque único: instalar y lo que falta para el reloj

**URL (HTTPS con certificado del tailnet, sirve para cualquier sitio):**
**<https://servidor.tail4263a0.ts.net>**

*En casa, sin encender Tailscale:* `http://192.168.1.139:8010` (en esa puerta no hay
service worker; para instalarla de verdad usa la URL HTTPS).

**Instalarla (3 pasos)**

1. **Abre <https://servidor.tail4263a0.ts.net>** en el móvil, con Tailscale encendido, y
   entra con tu cuenta de Lyfta.
2. **Instálala**: en Android, menú ⋮ → **«Instalar app»** (si no sale, «Añadir a pantalla
   de inicio»); en iPhone, **Compartir → «Añadir a pantalla de inicio»**.
3. **Ábrela desde el icono**: arranca a pantalla completa y **funciona sin cobertura**
   (service worker ya activo). El servidor de casa tiene que estar encendido.

**Reloj real: todavía falta esto**

1. Reloj **Forerunner 255** cargado, emparejado y sincronizado en Garmin Connect.
2. Código **2FA de Garmin** delante la primera vez que vincules la cuenta desde el móvil.
3. Pulsar **«Enviar al reloj»**, abrir el entreno en el reloj, comprobar el peso de cada
   serie, hacer una serie real y **contar las repeticiones** para medir el detector.

La app te recuerda estos tres pasos en una tarjeta visible en **Gimnasio** («Reloj real ·
pendiente»). Pasos completos y criterios de aprobado: `PENDIENTE-PRUEBA-RELOJ.md` §7.

## Qué te vas a encontrar al abrirla

- La **primera vez** sale una pantalla de tres pasos con lo que hace la app y lo que necesita
  el reloj; se puede volver a ver desde **Ajustes → Introducción**.
- En **Ajustes** puedes cambiar **unidades (kg/lb)**, **tema claro/oscuro** y ver el aviso de que
  la app funciona sin conexión.
- En **Biblioteca** puedes **exportar** todos los planes a un JSON y **volver a importarlos**
  (útil como copia de seguridad o para pasar los planes a otro móvil).
- En **Entrenar** puedes pulsar **«Modo enfocado»**: una sola serie a la vista, peso objetivo
  grande, **calculadora de discos** (barra y discos por lado), botón de «Serie hecha», registro
  rápido de reps reales y RPE, y descanso con temporizador. Se maneja con una mano. Si no hay
  cobertura, aparece **«Sin conexión: la sesión se guarda en el móvil»** y se puede seguir.
- **Progreso** (desde Gimnasio) muestra por ejercicio y semana el volumen, las series y la
  mejor serie, con un gráfico de barras semanal.
- **Semana** (desde Gimnasio) resume la semana en curso: volumen, sesiones, series por grupo
  muscular y adherencia al plan (hechas frente a planificadas en el calendario).
- En **Historial** puedes descargar todo el historial en **CSV** (una fila por serie, con peso
  y reps **previstos frente a los reales**) o **JSON**, para analizarlo fuera de la app.
- En **Biblioteca** puedes **aplicar una plantilla a un día concreto** (crea el evento del
  calendario) y, desde una sesión entrenada, **guardarla como plantilla** reutilizable.
- **Gimnasio** es el punto de partida: tarjeta «Reloj real · pendiente», «Hoy toca» con el
  entreno del día, bloque «Enviar al reloj», plantillas y últimas sesiones.
- Flujo normal: **Empezar sesión**, marcar las series (los pesos del plan ya están puestos:
  60/65/70) y **Terminar sesión**. Después, «Corregir pesos» si el peso real no era el
  previsto.
- Los pesos por serie se editan en **Gimnasio → Editar pesos** con − / +; se guardan solos.
- El aviso del reloj se apaga poniendo `AVISO_RELOJ_REAL = false` en
  `frontend-nuevo/src/config/features.ts` cuando la prueba física esté hecha.

## Sin cobertura

Verificado el 2026-11-10 contra la URL HTTPS real, en una **ventana de aplicación** (el
equivalente visible a la app instalada: sin barra de direcciones ni pestañas):

- `display-mode: standalone` y service worker activo controlando la página.
- Con la red apagada, recargar abre la app: `onLine: false`, `transferSize: 0` y
  `workerStart > 0` (la página la sirvió el service worker, no la red).
- Informe: `docs/capturas-movil/informe-instalacion.json`. Capturas:
  `pwa-instalada-ventana.png` (instalada) y `pwa-instalada-sin-cobertura.png` (recargada
  sin red). Las dos enseñan la misma pantalla de login porque la app no tiene estado
  distinto sin sesión; lo que cambia es de dónde viene la página.

| Caso | Estado |
|---|---|
| Abrir la app con red | ✅ |
| Abrirla desde cero **sin red** (instalada por HTTPS) | ✅ service worker |
| Entrenar sin cobertura con la app ya abierta | ✅ el borrador se guarda en el móvil |
| Cambiar pesos/reps/hechas sin red y volver | ✅ se recupera al reconectar (probado con 61 kg) |
| Terminar la sesión sin red | ⚠️ error visible; el borrador no se pierde |
| Historial ya descargado sin red | ❌ se pide al servidor |

## Comprobación del flujo completo

Ejecutado con Chrome real a 390 × 844 contra el despliegue (copia desechable de la base,
sin tocar la cuenta de Garmin):

| Paso | Resultado |
|---|---|
| Crear plan con pesos por serie | 60 / 65 / 70 kg y 8 / 8 / 6 reps |
| Editar una serie con − / + | 65 → 67,5 guardado en el servidor y vuelta a 65 |
| Enviar al reloj | error real 400 (copia sin credencial) y estado «Enviado» simulado para la captura |
| Entrenar y guardar | sesión con 3 series: 60/65/70, 1420 kg |
| Corregir después de entrenar | 60 → 62,5 en la serie 1, persistido en el servidor |
| Verlo en el historial | «Últimas sesiones: 10 nov · 1420 kg · 3 series · Corregir pesos» |

Capturas: `docs/capturas-movil/02` a `10` e informe `informe-flujo.json`.

## Prueba de los tres pesos, paso a paso

Objetivo: comprobar de una vez que un plan con **tres pesos distintos (60 / 65 / 70 kg)**
llega bien al reloj, a la sesión, al historial y al CSV. Tarda unos 5 minutos.

1. **Crea la cuenta** y entra en la app (primera vez: pulsa «Empezar» en la introducción).
2. **Planifica**: Gimnasio → plantilla «Empuje A» → **Editar pesos** → deja la serie 1 a
   **60 kg**, la 2 a **65 kg** y la 3 a **70 kg** (reps 8 / 8 / 6). Se guarda solo.
3. **Entrena**: desde Gimnasio pulsa **Empezar sesión** y luego **Modo enfocado**.
4. **Serie 1**: verifica que pone «Serie 1 de 3», «Peso objetivo 60 kg», «Anterior: …» y
   los discos por lado; pulsa **Serie hecha**. En el registro rápido deja las reps reales y
   el RPE si quieres, pulsa **Confirmar serie** y espera o salta el descanso.
5. **Series 2 y 3**: repite el paso 4; deben mostrar **65 kg** y **70 kg**. Al terminar las
   tres, escribe una nota y pulsa **Terminar y guardar**.
6. **Corrige** (opcional, para ver la diferencia): en «Sesión terminada» → **Editar pesos
   reales**, sube la serie 1 hasta **62,5 kg**. Debe verse
   **«60 → 62,5 kg × 8 reps de plan»** con la etiqueta **+2,5 kg**.
7. **Comprueba el historial**: Gimnasio → Historial → sesión; las tres series deben aparecer
   con su plan, su real y la diferencia marcada.
8. **Exporta**: en Historial pulsa **Exportar CSV** y abre el fichero: debe tener
   **cabecera + 3 filas** (una por serie) con `sesion_id`, `unidad`, `peso_previsto`,
   `peso_real` y `dif`.

Notas de la prueba:

- Si el móvil se queda **sin cobertura**, la sesión muestra el aviso **«Sin conexión: la
  sesión se guarda en el móvil»** y puedes seguir entrenando; el borrador no se pierde.
- La pantalla de modo enfocado **cabe a 390 × 844 sin scroll** y los controles miden al
  menos **44 × 44 px** sin solaparse (medido con Chrome real; queda en
  `docs/capturas-movil/informe-flujo.json`).
- El único paso que necesita el reloj físico es el envío real a Garmin: hasta que se pruebe,
  la app mantiene el aviso «Reloj real · pendiente».

## Cómo está montado el HTTPS

`tailscaled` termina el TLS con el certificado del tailnet y hace de proxy a la app; no hay
que configurar certificados en el contenedor:

```bash
sudo tailscale serve --bg --https=443 http://100.117.58.93:8010
sudo tailscale serve status     # https://servidor.tail4263a0.ts.net → 100.117.58.93:8010
```

- El certificado lo emite y renueva Tailscale solo. Para comprobarlo o sacarlo a fichero:
  `sudo tailscale cert --cert-file=/tmp/x.crt --key-file=/tmp/x.key servidor.tail4263a0.ts.net`
  (los flags van **antes** del dominio y con `=`; si no, Tailscale los lee como argumentos).
- Solo accesible **dentro del tailnet** (no es Tailscale Funnel): no se publica en Internet
  ni se abre ningún puerto en el router.
- Para apagarlo: `sudo tailscale serve --https=443 off`.

Verificado desde otro equipo del tailnet: `curl https://servidor.tail4263a0.ts.net/healthz`
responde 200 con `ssl_verify_result=0` (certificado válido), el manifiesto y el `sw.js` se
sirven, Chrome la considera **instalable** y arranca sin cobertura.

### Nombre del tailnet

El servidor anuncia hoy `servidor.tail4263a0.ts.net` (`MagicDNSSuffix: tail4263a0.ts.net`,
también tras reiniciar `tailscaled`). El nombre `ta4283ad.ts.net` que aparece en el panel no
resuelve desde los dispositivos (`servidor.ta4283ad.ts.net` → sin DNS) y la API de
certificados lo rechaza con «For domain, use "servidor.tail4263a0.ts.net"». Si el panel
muestra `ta4283ad` porque has renombrado el tailnet, el cambio tiene que llegar a los
dispositivos; cuando lo haga, la URL será `https://servidor.ta4283ad.ts.net` y el proxy
seguirá funcionando igual (el certificado se emite para el nombre nuevo). Pasos para
comprobarlo desde el servidor:

```bash
sudo tailscale status --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["Self"]["DNSName"])'
```

## Lo único pendiente: la prueba física del reloj

Todo lo demás está hecho y verificado. Esto es lo que queda, y es lo que solo puede hacer
David porque exige el reloj en la muñeca y el código 2FA de Garmin.

| # | Qué haces | Qué debe salir |
|---|---|---|
| 1 | Reloj **Forerunner 255** cargado, emparejado con el móvil y sincronizado en Garmin Connect (abrir la app y arrastrar hacia abajo). Una plantilla con 2–3 ejercicios, series, pesos y descansos. | El reloj aparece al día y sin avisos de sincronización pendiente. |
| 2 | En la app, **Ajustes → Vincular cuenta**; introducir el código **2FA** cuando lo pida Garmin. | «Vinculado». Si sale error, apuntarlo sin escribir la contraseña ni el código en ningún sitio. |
| 3 | **Gimnasio → Editar pesos**: cambiar un peso con − / + (por ejemplo 65 → 67,5). | «Guardado a las …». Al volver a entrar, el peso nuevo sigue ahí. |
| 4 | **Gimnasio → Enviar al reloj** y esperar el resultado. | Primero «Pendiente», luego **«Enviado al reloj»**. Si sale «No se pudo enviar»: acercar el reloj, sincronizar en Garmin Connect y **Reintentar**. |
| 5 | En el reloj: **Entrenamiento → Entrenamientos**, abrir el entreno de hoy y pulsar **Empezar**. | El entreno muestra el nombre y, en cada serie, **el peso objetivo** (60/65/70). No hay que teclear el peso en el reloj. |
| 6 | Hacer una serie de verdad. Contar las repeticiones reales que has hecho. | La serie se cierra sola y avanza sin pulsar OK. Anotar: ejercicio, peso, reps reales. |
| 7 | Sincronizar el reloj y volver a la app: **Gimnasio → Últimas sesiones**. | La sesión aparece con sus series (peso y reps) y se puede **Corregir pesos** con − / +; se guarda solo y recalcula el total. |
| 8 | Si quieres medir el detector: repetir con series de **8–10 reps**, sin corregir pesos antes de sacar los datos. | Criterio: ≥95 % de series con error ≤1 rep y ningún cierre prematuro. |

Evidencia que hay que dejar: captura del estado **«Enviado al reloj»**, captura de la
pantalla del reloj, y la sesión en el historial. Si algo falla, apuntar la hora, el modelo
y lo que se vio (sin contraseñas ni códigos). El detalle largo, con criterios de aprobado
por prueba, está en `PENDIENTE-PRUEBA-RELOJ.md`.

## Notas

- La puerta de la LAN está abierta en la red de casa y pide usuario y contraseña; la de
  fuera solo existe dentro del tailnet. No hay puertos abiertos en el router.
- La sesión dura 30 días; si cambia `SECRET_KEY` en el servidor, hay que volver a entrar
  en todos los dispositivos.
- Al pasar a HTTPS, la sesión que tuvieras guardada en `http://` no se traslada: hay que
  entrar una vez en la URL nueva.
