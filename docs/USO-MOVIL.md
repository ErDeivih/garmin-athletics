# Lyfta en el móvil: cómo se instala y cómo se usa

Fecha: 2026-11-09. Este documento es la guía práctica para David: qué URL abrir, cómo
dejarla en la pantalla de inicio, qué funciona sin cobertura y qué queda pendiente.

## 1. Las dos puertas

| Dónde estás | URL | Qué necesitas |
|---|---|---|
| En casa, misma wifi | `http://192.168.1.139:8010` | Nada |
| Fuera de casa | `http://100.117.58.93:8010` | Tailscale encendido en el móvil |

El servidor de casa tiene que estar encendido (lo está siempre). Las dos puertas sirven
la misma app y la misma base de datos; entra con tu cuenta de Lyfta de siempre.

> El móvil (`poco-x4-pro-5g`) ya está dado de alta en el tailnet; solo hay que abrir la
> app Tailscale y dejarla conectada. Si aparece desconectado, el botón de encendido de
> Tailscale en el móvil.

## 2. Cómo instalarla en la pantalla de inicio (hoy)

La app **se abre y se puede añadir a la pantalla de inicio por las dos puertas**, pero
hoy todavía **no se instala como PWA completa** en Android. No es un fallo de la app: es
que las dos puertas son `http://` y Chrome solo permite instalar PWA en HTTPS. Comprobado
con el propio navegador (detalle en §4).

### Android (Chrome)

1. Abre `http://192.168.1.139:8010` (en casa) o `http://100.117.58.93:8010` (fuera).
2. Entra con tu cuenta.
3. Menú ⋮ → **Añadir a pantalla de inicio**. Aparece el icono «Lyfta» con el fondo oscuro
   y la «L» cian.
4. Al abrirla desde el icono se comporta como una pestaña del navegador (con barra de
   direcciones). Es una limitación del HTTP, no de la app: se quita al activar HTTPS (§5).

### iPhone / iPad (Safari)

1. Abre la misma URL en **Safari**.
2. Botón **Compartir** → **Añadir a pantalla de inicio**.
3. Al abrirla desde el icono se abre **a pantalla completa**, sin barra de Safari (la app
   declara `apple-mobile-web-app-capable`). Es la experiencia más parecida a una app que
   se puede tener hoy.

## 3. Qué funciona y qué no sin cobertura

Comprobado el 2026-11-09 contra el despliegue (instancia de prueba, ver §4):

| Caso | Estado |
|---|---|
| Abrir la app por primera vez (con red) | ✅ |
| Entrenar sin cobertura con la app ya abierta | ✅ el borrador se guarda en el móvil |
| Cambiar pesos/reps/hechas sin red y volver | ✅ se recupera al reconectar (probado: peso 61 kg) |
| Recargar o abrir la app **sin red** | ❌ error del navegador (hace falta service worker, y para eso HTTPS) |
| Terminar la sesión sin red | ❌ error visible; el borrador **no se pierde** y se puede reintentar con red |
| Datos ya descargados (historial, plantillas) sin red | ❌ se piden al servidor |

En resumen: **no pierdes el entrenamiento** si te quedas sin cobertura a mitad de sesión,
pero la app necesita red para abrirse desde cero hasta que se active HTTPS.

## 4. Qué se ha verificado (evidencia)

Ejecutado con Chrome real a 390 × 844 contra las dos puertas y contra un contexto seguro
de control:

| Comprobación | LAN `192.168.1.139:8010` | Tailnet `100.117.58.93:8010` | Control seguro `127.0.0.1` |
|---|---|---|---|
| La app carga (200, título «Lyfta») | ✅ | ✅ | ✅ |
| Manifiesto servido y sin errores | ✅ 200 | ✅ 200 | ✅ 200 |
| Contexto seguro (`isSecureContext`) | ❌ | ❌ | ✅ |
| Service worker activo y controlando | ❌ | ❌ | ✅ |
| Chrome la considera **instalable** | ❌ `not-from-secure-origin` | ❌ `not-from-secure-origin` | ✅ **sí** |
| Captura | `capturas-movil/pwa-192-168-1-139-8010.png` | `capturas-movil/pwa-100-117-58-93-8010.png` | `capturas-movil/pwa-127-0-0-1-8021.png` |

Datos crudos: `docs/capturas-movil/informe-pwa.json`. El único error que sale en el
control seguro es `in-incognito`, que lo añade el navegador de pruebas por ir en modo
privado; en el móvil no aparece.

Flujo completo contra el despliegue (misma app, copia desechable de la base, sin tocar tu
cuenta de Garmin): plan 60/65/70 → editar una serie (65 → 67,5 y vuelta) → envío al reloj
→ 3 series → sesión guardada **60/65/70, 1420 kg**. Informe:
`docs/capturas-movil/informe-flujo.json`.

## 5. Lo que falta para la PWA completa (y cómo se activa)

Todo el bloqueo está en una casilla del panel de Tailscale que solo puede activar David:

1. Entrar en **login.tailscale.com** → **DNS** → activar **HTTPS Certificates** para el
   tailnet (es un interruptor; hoy la API responde *«your Tailscale account does not
   support getting TLS certs»*).
2. En el servidor, servir la app por HTTPS en el tailnet:
   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:8010
   ```
3. Abrir en el móvil **`https://servidor.tail4263a0.ts.net`**. A partir de ahí:
   - aparece el aviso **«Instalar app»** en Android (y la opción en el menú ⋮);
   - el service worker se registra: la app **arranca sin cobertura** y guarda los
     recursos ya descargados;
   - la instalación pasa a ser una app de verdad (WebAPK en Android), sin barra del
     navegador.

Mientras eso no se active, la app se usa desde el icono de la pantalla de inicio como se
explica en §2. No hay otra forma de tener HTTPS desde fuera de casa sin abrir puertos en
el router ni contratar un dominio.

## 6. Lo que falta para cerrarlo del todo

- **Prueba física del reloj** (lo único que depende de David): reloj cargado y
  emparejado, 2FA de Garmin delante, «Enviar al reloj», mirar el peso por serie en el
  reloj, hacer una serie y contar las reps reales. Pasos exactos en
  `PENDIENTE-PRUEBA-RELOJ.md` §7.
- **Interruptor HTTPS de Tailscale** (§5) si quiere PWA instalable y arranque sin
  cobertura.
- **Servidor encendido**: la app vive en el servidor de casa; si está apagado, no hay
  app (ni por la LAN ni por el tailnet).

## 7. Notas de seguridad

- La puerta de la LAN está abierta en la red de casa y pide usuario y contraseña, como
  cualquier servicio del servidor. La de fuera solo existe dentro del tailnet.
- No hace falta abrir ningún puerto en el router ni publicar la app en Internet.
- La sesión dura 30 días; si cambia `SECRET_KEY` en el servidor, habrá que volver a
  entrar en todos los dispositivos.
