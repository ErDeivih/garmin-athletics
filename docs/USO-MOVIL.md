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

- **Gimnasio** es el punto de partida: tarjeta «Reloj real · pendiente», «Hoy toca» con el
  entreno del día, bloque «Enviar al reloj», plantillas y últimas sesiones.
- Flujo normal: **Empezar sesión**, marcar las series (los pesos del plan ya están puestos:
  60/65/70) y **Terminar sesión**. Después, «Corregir pesos» si el peso real no era el
  previsto.
- Los pesos por serie se editan en **Gimnasio → Editar pesos** con − / +; se guardan solos.
- El aviso del reloj se apaga poniendo `AVISO_RELOJ_REAL = false` en
  `frontend-nuevo/src/config/features.ts` cuando la prueba física esté hecha.

## Sin cobertura

Verificado el 2026-11-10 contra la URL HTTPS real (`informe-https.json`): contexto seguro,
service worker activo controlando la página y **la app arranca con la red apagada**. Captura:
`docs/capturas-movil/https-pwa-instalada.png` y
`docs/capturas-movil/https-arranque-sin-cobertura.png`.

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

Capturas: `docs/capturas-movil/02` a `10`. Informe: `informe-flujo.json`.

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

## Notas

- La puerta de la LAN está abierta en la red de casa y pide usuario y contraseña; la de
  fuera solo existe dentro del tailnet. No hay puertos abiertos en el router.
- La sesión dura 30 días; si cambia `SECRET_KEY` en el servidor, hay que volver a entrar
  en todos los dispositivos.
- Al pasar a HTTPS, la sesión que tuvieras guardada en `http://` no se traslada: hay que
  entrar una vez en la URL nueva.
