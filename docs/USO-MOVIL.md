# Lyfta en el móvil: instalar y qué falta

Fecha: 2026-11-10. Este documento tiene **un solo bloque** con lo que hay que hacer para
usarla en el móvil y lo que falta para el reloj. Debajo, el detalle (sin cobertura,
comprobaciones y HTTPS).

## Bloque único: instalar y lo que falta para el reloj

**Direcciones**

| Dónde estás | URL |
|---|---|
| En casa, misma wifi | `http://192.168.1.139:8010` |
| Fuera de casa | `http://100.117.58.93:8010` (con Tailscale encendido) |

**Instalarla (3 pasos)**

1. **Abre la dirección** que toque y entra con tu cuenta de Lyfta.
2. **Añádela a la pantalla de inicio**: en Android, menú ⋮ → «Añadir a pantalla de inicio»;
   en iPhone, botón Compartir → «Añadir a pantalla de inicio». Queda el icono «Lyfta».
3. **Ábrela desde el icono** y comprueba que entra (en iPhone se abre a pantalla completa).
   El servidor de casa tiene que estar encendido.

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
- El flujo normal: **Empezar sesión**, marcar las series (los pesos del plan ya están
  puestos: 60/65/70) y **Terminar sesión**. Después, «Corregir pesos» si el peso real no
  era el previsto.
- Los pesos por serie se editan en **Gimnasio → Editar pesos** con − / +; se guardan solos.
- El aviso del reloj se apaga poniendo `AVISO_RELOJ_REAL = false` en
  `frontend-nuevo/src/config/features.ts` cuando la prueba física esté hecha.

## Qué funciona y qué no sin cobertura

| Caso | Estado |
|---|---|
| Abrir la app con red | ✅ |
| Entrenar sin cobertura con la app ya abierta | ✅ el borrador se guarda en el móvil |
| Cambiar pesos/reps/hechas sin red y volver | ✅ se recupera al reconectar (probado con 61 kg) |
| Recargar o abrir desde cero sin red | ✅ **solo con HTTPS** (service worker); por `http://` falla el navegador |
| Terminar la sesión sin red | ⚠️ error visible; el borrador no se pierde |
| Historial ya descargado sin red | ❌ se pide al servidor |

Comprobado el 2026-11-10 con este mismo build servido por HTTPS: contexto seguro, service
worker activo controlando la página, Chrome la considera instalable y **con la red
apagada la app arranca** desde la caché. Captura:
`docs/capturas-movil/https-arranque-sin-cobertura.png`; datos: `informe-https.json`.

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

## Activar HTTPS en el tailnet (PWA completa)

Solo puede hacerlo David, con su cuenta de Tailscale. Dos minutos:

1. Entrar en **<https://login.tailscale.com/admin/dns>** (menú **DNS**).
2. Bajar a **HTTPS Certificates** y pulsar **Enable HTTPS…**; confirmar en el diálogo.
   MagicDNS ya está encendido en este tailnet, que es el requisito previo.
3. En el servidor, servir la app por HTTPS:
   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:8010
   ```
4. Abrir en el móvil **`https://servidor.tail4263a0.ts.net`** y pulsar **Instalar app**
   (Android) o **Añadir a pantalla de inicio** (iPhone).

Comprobar: `tailscale cert servidor.tail4263a0.ts.net` debe emitir el certificado y
`tailscale serve status` debe mostrar el proxy. Hoy la API responde `500 Internal Server
Error: your Tailscale account does not support getting TLS certs`, que es lo que cambia
ese interruptor. Documentación oficial:
[Enabling HTTPS](https://tailscale.com/docs/how-to/set-up-https-certificates).

## Notas

- La puerta de la LAN está abierta en la red de casa y pide usuario y contraseña; la de
  fuera solo existe dentro del tailnet. No hay puertos abiertos en el router.
- La sesión dura 30 días; si cambia `SECRET_KEY` en el servidor, hay que volver a entrar
  en todos los dispositivos.
- El servidor tiene que estar encendido: la app vive ahí, no en el móvil.
