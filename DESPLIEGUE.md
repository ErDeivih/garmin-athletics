# Despliegue de Lyfta para el móvil

La app vive en el **servidor de casa** y se abre desde el móvil **en la red de casa o en
cualquier sitio** (Tailscale). Una sola URL sirve la interfaz y la API: no hay dos
orígenes que cuadrar. Desde el 2026-11-10 hay **HTTPS con certificado válido**, y la PWA
se puede instalar.

## Direcciones

| Desde | URL | Cuándo usarla |
|---|---|---|
| **Cualquier sitio (con Tailscale)** | **`https://servidor.tail4263a0.ts.net`** | **La buena: PWA instalable y arranque sin cobertura** |
| Casa, misma wifi | `http://192.168.1.139:8010` | Sin Tailscale; abrir y usar, sin service worker |
| Móvil, en cualquier red | `http://100.117.58.93:8010` | Alternativa sin HTTPS (sin PWA instalable) |
| El propio servidor | `http://127.0.0.1:8010` | Comprobaciones y `curl` internos |

Salud del servicio: `https://servidor.tail4263a0.ts.net/healthz` → `{"status":"ok"}`.

## Qué hay montado

```
móvil ─┬─ wifi de casa ───────────────▶ servidor (Debian 12, 192.168.1.139)
       └─ Tailscale/WireGuard (cifrado) ┘
                       └─ contenedor `lyfta` (FastAPI + build de Vite)
                            ├─ /               → app (SPA, fallback de rutas)
                            ├─ /api/v1/...     → API JSON
                            └─ /var/lib/lyfta  → volumen: BD, tokens de Garmin, tracks
```

- Imagen `lyfta:local`, construida desde `deploy/Dockerfile` (dos etapas: Vite y
  FastAPI). El frontend compilado va dentro de la imagen: no hay Nginx ni `node` en
  el servidor.
- El puerto se publica en **dos direcciones concretas**, nunca en `0.0.0.0`:
  `192.168.1.139:8010` (red de casa) y `100.117.58.93:8010` (tailnet). Nada de la app
  queda expuesto a Internet: fuera de casa solo se entra por Tailscale.
- Estado persistente en `/home/david/lyfta/deploy/var`:
  - `lyfta.db` — base SQLite con las 46 actividades, la plantilla, los pesos y la
    credencial de Garmin.
  - `garmin_tokens/` y `garmin_tokens_<user_id>/` — sesión de Garmin (equivale a una
    contraseña: no se copia al repositorio).
  - `data/tracks`, `data/routes` — recorridos GPS y rutas generadas.
- Configuración: `/home/david/lyfta/deploy/.env` (permisos 600).
  `LYFTA_LAN_BIND`, `LYFTA_TS_BIND` y `LYFTA_PORT` deciden dónde escucha; `SECRET_KEY`
  firma las sesiones (la misma que en local: los tokens ya emitidos siguen valiendo).

## El túnel: Tailscale + HTTPS (y por qué no Cloudflare)

| Opción | Estado |
|---|---|
| **Tailscale** (WireGuard) | ✅ En uso. Cifrado extremo a extremo, sin abrir puertos en el router, sin dominio |
| **HTTPS del tailnet** (Tailscale Serve) | ✅ **Activo desde el 2026-11-10**: `https://servidor.tail4263a0.ts.net` con certificado válido. Verificado: `ssl_verify_result=0`, PWA instalable y arranque sin cobertura |
| Cloudflare Tunnel | ❌ No usado: `cloudflared` no está instalado, hace falta cuenta/dominio y el servidor no resuelve nombres |

El móvil de David (`poco-x4-pro-5g`) ya está dado de alta en el tailnet, pero el
2026-11-09 aparecía **offline desde hacía 10 días**: hay que abrir Tailscale en el móvil
para la puerta de «cualquier sitio». La de casa no necesita nada.


## Primera vez en el móvil

1. **Con Tailscale encendido (o en casa por la LAN)**: abrir
   **`https://servidor.tail4263a0.ts.net`** — la puerta buena, con HTTPS. En casa, sin
   Tailscale, sigue valiendo `http://192.168.1.139:8010`.
2. Entrar con la cuenta de Lyfta (la misma de siempre). Ojo: la sesión guardada en la
   puerta `http://` no se traslada; hay que entrar una vez en la nueva.
3. **Instalarla**: Android → menú ⋮ → **«Instalar app»**; iPhone → Compartir →
   «Añadir a pantalla de inicio».
4. Abrirla desde el icono: pantalla completa y **arranca sin cobertura**.
5. Probar **Gimnasio → Enviar al reloj** con el móvil delante: el servidor es quien habla
   con Garmin Cloud.

## PWA y HTTPS

| Pieza | Estado |
|---|---|
| Manifiesto, iconos 192/512/maskable, `apple-touch-icon` | ✅ servidos y enlazados |
| Service worker (arranque sin cobertura y assets en caché) | ✅ activo por HTTPS |
| Instalación como app real en Android | ✅ Chrome la considera instalable (`inspector CDP`: solo queda el aviso `in-incognito` del navegador de pruebas) |
| Instalación en iPhone | ✅ «Añadir a pantalla de inicio», a pantalla completa |

Cómo está montado: `tailscaled` termina el TLS y hace de proxy a la app. El certificado lo
emite y renueva Tailscale; no hay certificados dentro del contenedor.

```bash
sudo tailscale serve --bg --https=443 http://100.117.58.93:8010
sudo tailscale serve status        # https://servidor.tail4263a0.ts.net → 100.117.58.93:8010
sudo tailscale serve --https=443 off   # apagarlo
```

Certificado a fichero (opcional; los flags van **antes** del dominio y con `=`, si no
Tailscale los lee como argumentos y falla con «Usage: tailscale cert»):

```bash
sudo tailscale cert --cert-file=/tmp/lyfta.crt --key-file=/tmp/lyfta.key servidor.tail4263a0.ts.net
```

Solo accesible **dentro del tailnet** (no es Tailscale Funnel): no se publica en Internet
ni se abre ningún puerto en el router.

**Nombre del tailnet.** El servidor anuncia `servidor.tail4263a0.ts.net`
(`CurrentTailnet.MagicDNSSuffix: tail4263a0.ts.net`, también tras reiniciar `tailscaled`).
El nombre `ta4283ad.ts.net` que muestra el panel no resuelve desde los dispositivos y la
API de certificados lo rechaza con «For domain, use "servidor.tail4263a0.ts.net"». Si el
tailnet se ha renombrado, el sufijo nuevo tiene que llegar a los dispositivos; cuando
llegue, la URL será `https://servidor.ta4283ad.ts.net` y el proxy seguirá igual (el
certificado se emite para el nombre nuevo). Comprobar con:

```bash
sudo tailscale status --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["Self"]["DNSName"])'
```


## Operación

```bash
cd /home/david/lyfta/deploy

docker compose ps                 # estado y salud
docker compose logs -f --tail=100 # registros en vivo
docker compose restart            # reiniciar
docker compose down               # parar
```

El contenedor arranca solo tras un reinicio del servidor (`restart: unless-stopped`
+ Docker habilitado al inicio). El `HEALTHCHECK` pega a `/healthz` cada 30 s.

## Probar el flujo entero sin tocar los datos de David

`deploy/instancia-verificacion.sh` levanta una **copia desechable** del despliegue en el
puerto 8011: copia la base, le quita la credencial de Garmin y los eventos de calendario
(así ningún envío puede salir hacia el reloj) y arranca la misma imagen.

```bash
# en el servidor
~/lyfta/deploy/instancia-verificacion.sh up    # copia en el puerto 8011
~/lyfta/deploy/instancia-verificacion.sh down  # la retira y borra la copia
```

Y el recorrido automático contra esa instancia, con capturas a 390 px:

```powershell
cd frontend-nuevo
node scripts/flujo-movil-desplegado.mjs http://192.168.1.139:8011
```

Recorre planificar pesos por serie → editar → enviar al reloj → entrenar → sesión
guardada, y escribe `docs/capturas-movil/informe-flujo.json`. Resultado del 2026-11-09:
todo OK menos un hallazgo real (la sesión guarda 60/60/60 en vez de 60/65/70), detallado
en `docs/revision-interfaz-movil.md`.

Al terminar, `down`. **Nunca se deja la instancia de verificación abierta**: no forma
parte de la app y su base es una copia.

La regresión visual se puede lanzar contra esa copia (no contra la app real: crea una
cuenta y una sesión de prueba, y en la base de David dejaría basura):

```powershell
cd frontend-nuevo
node scripts/visual-regression.mjs http://192.168.1.139:8011 http://192.168.1.139:8011
```

## Actualizar la app

**La imagen se construye en el PC y se envía hecha** porque el servidor no resuelve
nombres: `/etc/resolv.conf` apunta a los DNS de Tailscale (`100.100.1.1`,
`100.90.1.1`) y esos no contestan consultas públicas. La salida a Internet sí
funciona — `ping 1.1.1.1` responde y `curl --resolve pypi.org:443:151.101.0.223
https://pypi.org/` devuelve 200 —, así que es solo DNS. Comprobado el 2026-11-09:

```powershell
# en F:\Proyectos\garmin
.\deploy\ship-image.ps1
```

El guion hace: `docker build` → `docker save` → comprime → `scp` → `docker load` →
`docker compose up -d --no-build`. Tarda unos minutos: casi todo es el envío de la
imagen (~150 MB) por la red local.

Si algún día se arregla el DNS del servidor, el camino corto es:

```bash
cd /home/david/lyfta/deploy && docker compose up -d --build
```

Arreglar el DNS es una línea, pero **afecta a todos los servicios del servidor**, así
que la decide David:

```bash
sudo tailscale set --accept-dns=false   # Tailscale deja de tocar resolv.conf
# o bien añadir un resolutor público en /etc/resolv.conf (NetworkManager lo pisa)
```

No es necesario para usar la app: el móvil llega por IP.

### Desplegar código nuevo sin tocar datos

`deploy/install-server.sh` (en el servidor) extrae los paquetes `deploy-bundle.tgz`
(código) y `deploy-state.tgz` (BD, tokens, tracks) **solo siembra lo que falta**: si
`deploy/var/lyfta.db` ya existe, no lo pisa. Para reenviar código:

```powershell
tar -czf deploy-bundle.tgz --exclude=node_modules --exclude=dist --exclude=screenshots backend frontend-nuevo requirements.txt .dockerignore deploy
scp deploy-bundle.tgz servidor:~/
ssh servidor "~/install-server.sh && cd ~/lyfta/deploy && docker compose up -d --no-build"
```

## Copia de seguridad

Todo lo que no se puede perder está en una carpeta:

```bash
tar -czf ~/lyfta-$(date +%F).tgz -C ~/lyfta/deploy var
```

Restaurar: parar el contenedor, descomprimir sobre `deploy/var` y arrancar.

## Reglas que el despliegue impone

1. **Un solo backend por cuenta de Garmin.** Los tokens se renuevan al usarlos; si el
   backend del PC y el del servidor van a la vez, uno invalida al otro. Tras desplegar,
   el backend del PC se queda para pruebas con base efímera, nunca con los tokens reales.
2. **Los pesos y las series viven en la base del servidor.** Editar desde el móvil y
   mirar desde el PC es la misma base; ya no hay dos copias.
3. **El reloj necesita la URL nueva.** La watch-app (cuando se instale) apunta al
   backend del servidor, y el móvil debe tener Tailscale para que el reloj lo alcance.

## Comprobación

Automatizada, en el servidor (`deploy/verify-server.sh`, la llama `ship-image.ps1`):

```bash
~/lyfta/deploy/verify-server.sh          # exit 0 = todo bien
```

Resultado del despliegue del **2026-11-09 18:40** (dos puertas abiertas):

```text
contenedor: lyfta Up (healthy)
  100.117.58.93:8010->8000/tcp, 192.168.1.139:8010->8000/tcp
/healthz                 ok   {"status":"ok"}
/                        ok   200
/gimnasio                ok   200      (ruta profunda: fallback de la SPA)
/gimnasio/sesiones/x     ok   200
/sw.js                   ok   200      application/javascript, no-cache
/manifest.webmanifest    ok   200
/icons/icon-512.png      ok   200
/api/v1/no-existe        ok   404      (la API no se disfraza de HTML)
/no-existe.png           ok   404
usuarios=1  actividades=46  plantillas=1  ejercicios de plantilla=3  credencial Garmin=1
```

Y desde fuera del servidor (este PC, que no usa ninguna de las dos IPs de servicio):

```text
http://192.168.1.139:8010/healthz   200   (red de casa)
http://192.168.1.139:8010/gimnasio  200
http://100.117.58.93:8010/healthz   200   (tailnet: el camino de fuera de casa)
http://100.117.58.93:8010/gimnasio  200
POST /api/v1/auth/login (mal)       401 {"detail":"Credenciales inválidas."}
```

Capturas a 390 × 844 contra la URL desplegada, sin errores de consola:
`docs/capturas-movil/00-login-tailnet.png`, `01-login-movil.png` y el recorrido completo
del flujo en `docs/capturas-movil/`.


