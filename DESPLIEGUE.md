# Despliegue de Lyfta para el móvil

La app vive en el **servidor de casa** y se abre desde el móvil en cualquier sitio con
Tailscale. Una sola URL sirve la interfaz y la API: no hay dos orígenes que cuadrar.

## Direcciones

| Desde | URL | Cuándo usarla |
|---|---|---|
| Móvil, en cualquier red (con Tailscale) | `http://100.117.58.93:8010` | El caso normal: gimnasio, calle, viaje |
| Casa, misma wifi | `http://192.168.1.139:8010` | Si el móvil no tiene Tailscale encendido |
| El propio servidor | `http://127.0.0.1:8010` | Comprobaciones y `curl` |
| Navegador de este PC (tailnet) | `http://100.117.58.93:8010` | Revisar sin coger el móvil |

Salud del servicio: `http://100.117.58.93:8010/healthz` → `{"status":"ok"}`.

## Qué hay montado

```
móvil ──Tailscale──▶ servidor (Debian 12, 192.168.1.139)
                       └─ contenedor `lyfta` (FastAPI + build de Vite)
                            ├─ /               → app (SPA, fallback de rutas)
                            ├─ /api/v1/...     → API JSON
                            └─ /var/lib/lyfta  → volumen: BD, tokens de Garmin, tracks
```

- Imagen `lyfta:local`, construida desde `deploy/Dockerfile` (dos etapas: Vite y
  FastAPI). El frontend compilado va dentro de la imagen: no hay Nginx ni `node` en
  el servidor.
- El puerto se publica **solo en la IP del tailnet** (`100.117.58.93:8010`), no en
  `0.0.0.0`. Nada de la app queda expuesto a Internet.
- Estado persistente en `/home/david/lyfta/deploy/var`:
  - `lyfta.db` — base SQLite con las 46 actividades, la plantilla, los pesos y la
    credencial de Garmin.
  - `garmin_tokens/` y `garmin_tokens_<user_id>/` — sesión de Garmin (equivale a una
    contraseña: no se copia al repositorio).
  - `data/tracks`, `data/routes` — recorridos GPS y rutas generadas.
- Configuración: `/home/david/lyfta/deploy/.env` (permisos 600).
  `LYFTA_BIND` y `LYFTA_PORT` deciden dónde escucha; `SECRET_KEY` firma las sesiones
  (la misma que en local: los tokens ya emitidos siguen valiendo).

## Primera vez en el móvil

1. Instalar **Tailscale** en el móvil y entrar con la cuenta de David (`davidpeve01@`).
   El móvil ya estaba dado de alta en el tailnet como `poco-x4-pro-5g`; solo hay que
   encenderlo.
2. Abrir `http://100.117.58.93:8010` en el navegador.
3. Entrar con la cuenta de Lyfta (la misma de siempre).
4. **Añadir a la pantalla de inicio**:
   - iOS/Safari: compartir → «Añadir a pantalla de inicio».
   - Android/Chrome: menú → «Añadir a pantalla de inicio». El icono ya tiene el
     manifiesto, los colores y el nombre «Lyfta».
5. Probar **Gimnasio → Enviar al reloj** con el móvil delante: el servidor es ahora
   quien habla con Garmin Cloud.

## PWA: qué funciona y qué no

| Pieza | Estado |
|---|---|
| Manifiesto, iconos 192/512/maskable, `apple-touch-icon` | ✅ servidos y enlazados |
| Abrir desde el icono, pantalla completa (`standalone`) | ✅ con «Añadir a pantalla de inicio» |
| Service worker (arranque sin cobertura y assets en caché) | ⚠️ necesita contexto seguro: **no** se registra por `http://` sobre una IP |
| Instalación como app real en Android | ⚠️ Chrome exige HTTPS |

Para tener PWA completa falta servir por HTTPS. La vía barata es Tailscale, pero hoy
**no está disponible**: probado el 2026-11-09, el tailnet responde

```text
500 Internal Server Error: your Tailscale account does not support getting TLS certs
```

Es un interruptor del panel de Tailscale (*DNS → HTTPS Certificates*), no algo que se
pueda activar desde el servidor. Cuando David lo encienda:

```bash
# en el servidor
tailscale serve --bg --https=443 http://127.0.0.1:8010
```

Eso da `https://servidor.tail4263a0.ts.net`: contexto seguro, service worker y botón
«Instalar app». Mientras tanto la app se usa igual desde el icono de la pantalla de
inicio: solo se pierde el arranque sin cobertura y la instalación «rica» de Android.

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

Resultado del despliegue del **2026-11-09 17:24**:

```text
contenedor: lyfta Up (healthy) 100.117.58.93:8010->8000/tcp
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

Y desde fuera del servidor (este PC, otro nodo del tailnet, lo mismo que hará el móvil):

```text
http://100.117.58.93:8010/healthz          200
http://100.117.58.93:8010/gimnasio         200
POST /api/v1/auth/login (mal)              401 {"detail":"Credenciales inválidas."}
```

Captura del móvil (390 × 844) contra la URL desplegada, sin errores de consola:
`frontend-nuevo/screenshots/30-despliegue-login.png`.

