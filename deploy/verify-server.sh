#!/usr/bin/env bash
# Comprueba que Lyfta estÃ¡ sirviendo de verdad en el servidor.
#   ./verify-server.sh [http://127.0.0.1:8010]
# Sale con cÃ³digo 1 si algo no cuadra.
set -uo pipefail

BASE="${1:-http://100.117.58.93:8010}"
ROOT="${LYFTA_ROOT:-$HOME/lyfta}"
fallos=0

check() { # check <ruta> <cÃ³digo esperado> <descripciÃ³n>
  local code
  code="$(curl -s -o /dev/null -m 6 -w '%{http_code}' "$BASE$1")"
  if [ "$code" = "$2" ]; then
    printf '  ok   %-34s %s\n' "$1" "$code"
  else
    printf '  FALLO %-33s %s (esperado %s)  %s\n' "$1" "$code" "$2" "$3"
    fallos=$((fallos + 1))
  fi
}

echo "==> Servicio (${BASE})"
docker ps --filter name=lyfta --format '  contenedor: {{.Names}} {{.Status}} {{.Ports}}' || true
echo "==> Salud"
salud="$(curl -s -m 6 "$BASE/healthz" || true)"
if [ "$salud" = '{"status":"ok"}' ]; then
  echo "  ok   /healthz"
else
  echo "  FALLO /healthz -> ${salud:-sin respuesta}"
  fallos=$((fallos + 1))
fi

echo "==> Rutas"
check /                    200 "portada"
check /gimnasio            200 "ruta profunda (fallback SPA)"
check /gimnasio/sesiones/x 200 "ruta profunda con id"
check /sw.js               200 "service worker"
check /manifest.webmanifest 200 "manifiesto PWA"
check /icons/icon-512.png  200 "icono 512"
check /api/v1/no-existe    404 "la API no se disfraza de HTML"
check /no-existe.png       404 "asset inexistente"

echo "==> Cabeceras"
ct="$(curl -s -o /dev/null -D - -m 6 "$BASE/sw.js" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}')"
cc="$(curl -s -o /dev/null -D - -m 6 "$BASE/sw.js" | tr -d '\r' | awk -F': ' 'tolower($1)=="cache-control"{print $2}')"
case "$ct" in *javascript*) echo "  ok   sw.js content-type: $ct";; *) echo "  FALLO sw.js content-type: $ct"; fallos=$((fallos+1));; esac
case "$cc" in *no-cache*|*no-store*) echo "  ok   sw.js cache-control: $cc";; *) echo "  FALLO sw.js cache-control: $cc"; fallos=$((fallos+1));; esac

echo "==> Datos"
docker exec -i lyfta python - <<'PY'
import sqlite3
c = sqlite3.connect('/var/lib/lyfta/lyfta.db')
tablas = ('users', 'activities', 'workout_templates', 'template_exercises', 'garmin_credentials')
print('  ' + '  '.join(f'{t}={c.execute("select count(*) from " + t).fetchone()[0]}' for t in tablas))
PY
docker exec lyfta sh -c 'ls /var/lib/lyfta | tr "\n" " "; echo'

echo "==> ConfiguraciÃ³n"
[ -f "$ROOT/deploy/.env" ] && echo "  ok   deploy/.env existe ($(stat -c '%a' "$ROOT/deploy/.env"))" \
  || { echo "  FALLO falta deploy/.env"; fallos=$((fallos+1)); }

if [ "$fallos" -gt 0 ]; then
  echo "==> $fallos fallo(s)"
  exit 1
fi
echo "==> Todo correcto"
