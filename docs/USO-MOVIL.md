# Lyfta en el móvil: instalación y uso

Fecha: 2026-11-10. Guía práctica para David. Resumen: **tres pasos** para dejarla
instalada, y al final lo único que queda pendiente (la prueba con el reloj físico).

## Los 3 pasos para instalarla

**1. Abre la dirección correcta y entra con tu cuenta.**

| Dónde estás | URL |
|---|---|
| En casa, misma wifi | `http://192.168.1.139:8010` |
| Fuera de casa | `http://100.117.58.93:8010` (con Tailscale encendido en el móvil) |

**2. Añádela a la pantalla de inicio.**

- **Android (Chrome)**: menú ⋮ → **Añadir a pantalla de inicio**.
- **iPhone/iPad (Safari)**: botón **Compartir** → **Añadir a pantalla de inicio**.

Queda el icono «Lyfta» (fondo oscuro, «L» cian). En iPhone se abre a pantalla completa,
sin barra de Safari.

**3. Ábrela desde el icono y comprueba que entra.** Si entra directa a «Hoy» o al login,
está instalada. El servidor de casa tiene que estar encendido.

> Cuando David active el HTTPS del tailnet (§5), en Android aparecerá además
> **«Instalar app»** y la app arrancará sin cobertura. Los tres pasos siguen siendo los
> mismos: ese aviso de instalación es el que convierte el acceso directo en app completa.

## Qué te vas a encontrar al abrirla

- En **Gimnasio** hay una tarjeta visible, **«Reloj real · pendiente»**, con los tres pasos
  concretos que faltan para probar el envío en el Forerunner 255. No es un mensaje
  escondido: está siempre arriba mientras la prueba siga pendiente. Desaparece cuando se
  cierre la prueba y se ponga `AVISO_RELOJ_REAL = false` en `frontend-nuevo/src/config/features.ts`.
- El flujo normal es: **Hoy → Gimnasio → Empezar sesión**, marcar series y **Terminar
  sesión**. Los pesos por serie del plan (60/65/70) aparecen ya puestos en su serie.
- **Gimnasio → Enviar al reloj** manda el entreno a Garmin. El estado se ve en el bloque.

## 2. Qué funciona y qué no sin cobertura

Comprobado contra el despliegue y contra el mismo build servido por HTTPS:

| Caso | Estado |
|---|---|
| Abrir la app con red | ✅ |
| Entrenar sin cobertura con la app ya abierta | ✅ el borrador se guarda en el móvil |
| Cambiar pesos/reps/hechas sin red y volver | ✅ se recupera al reconectar (probado: 61 kg) |
| Recargar o abrir desde cero sin red | ✅ **solo con HTTPS** (service worker); por `http://` falla el navegador |
| Terminar la sesión sin red | ⚠️ error visible; el borrador no se pierde |
| Historial ya descargado sin red | ❌ se pide al servidor |

En resumen: **no pierdes el entrenamiento** si se va la cobertura a mitad de sesión; la app
solo necesita red para abrirse desde cero hasta que se active HTTPS.

## 3. Comprobación de que el flujo completo funciona

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

## 4. Qué pasa cuando se active HTTPS

Comprobado con este mismo build servido por HTTPS (certificado de pruebas): contexto
seguro, service worker activo controlando la página, Chrome la considera instalable y,
**con la red apagada, la app arranca igual** desde la caché del service worker. Captura:
`docs/capturas-movil/https-arranque-sin-cobertura.png`; datos:
`docs/capturas-movil/informe-https.json`.

Eso es exactamente lo que tendrá el móvil cuando el certificado lo emita Tailscale; lo
único que falta es el interruptor de §5.

## 5. Activar HTTPS en el tailnet (pasos exactos)

Solo puede hacerlo David, con su cuenta de Tailscale. Son dos minutos:

1. Entrar en **<https://login.tailscale.com/admin/dns>** (menú **DNS**).
2. Bajar a la sección **HTTPS Certificates** y pulsar **Enable HTTPS…** (Activar HTTPS).
3. Confirmar en el diálogo. MagicDNS ya está encendido en este tailnet, que es el
   requisito previo.
4. En el servidor, servir la app por HTTPS dentro del tailnet:
   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:8010
   ```
5. Abrir en el móvil **`https://servidor.tail4263a0.ts.net`** y pulsar **Instalar app**
   (Android) o **Añadir a pantalla de inicio** (iPhone).

Comprobar que ha funcionado:

```bash
# en el servidor
tailscale cert servidor.tail4263a0.ts.net   # debe emitir el certificado, no dar error
tailscale serve status                       # debe mostrar https://... → 127.0.0.1:8010
```

Hoy la API responde `500 Internal Server Error: your Tailscale account does not support
getting TLS certs`, que es justo lo que cambia ese interruptor. Documentación oficial:
[Enabling HTTPS](https://tailscale.com/docs/how-to/set-up-https-certificates).

## 6. Lo que falta de verdad

- **Prueba física del Forerunner 255** (lo único que depende de David): reloj cargado y
  emparejado, 2FA de Garmin delante, «Enviar al reloj», comprobar el peso de cada serie en
  el reloj, hacer una serie y contar las reps reales. Pasos en
  `PENDIENTE-PRUEBA-RELOJ.md` §7. La tarjeta «Reloj real» de la app recuerda los tres
  primeros.
- **Interruptor HTTPS del tailnet** (§5), si quiere PWA instalable y arranque sin
  cobertura. La app funciona igual sin él.

## 7. Notas

- La puerta de la LAN está abierta en la red de casa y pide usuario y contraseña; la de
  fuera solo existe dentro del tailnet. No hay puertos abiertos en el router.
- La sesión dura 30 días; si cambia `SECRET_KEY` en el servidor, hay que volver a entrar
  en todos los dispositivos.
- El servidor tiene que estar encendido: la app vive ahí, no en el móvil.
