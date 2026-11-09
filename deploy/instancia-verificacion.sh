#!/usr/bin/env bash
# Instancia desechable para probar el móvil contra el despliegue real.
#
#   ./instancia-verificacion.sh up     # copia la BD, quita credenciales Garmin y arranca
#   ./instancia-verificacion.sh down   # la retira y borra la copia
#
# Sirve para recorrer el flujo completo con datos reales sin tocar la base de
# David ni la cuenta de Garmin: la copia arranca sin credencial Garmin y sin
# eventos de calendario, así que ningún envío puede salir hacia Garmin.
set -euo pipefail

ROOT="${LYFTA_ROOT:-$HOME/lyfta}"
NAME="lyfta-verif"
PORT="${LYFTA_VERIF_PORT:-8011}"
LAN="${LYFTA_LAN_BIND:-192.168.1.139}"
TS="${LYFTA_TS_BIND:-100.117.58.93}"
DIR="/tmp/lyfta-verif"
IMAGE="${LYFTA_IMAGE:-lyfta:local}"

case "${1:-up}" in
  up)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    rm -rf "$DIR"
    mkdir -p "$DIR"
    cp "$ROOT/deploy/var/lyfta.db" "$DIR/lyfta.db"

    docker run --rm -v "$DIR:/var/lib/lyfta" "$IMAGE" python - <<'PY'
import sqlite3
c = sqlite3.connect('/var/lib/lyfta/lyfta.db')
borradas = c.execute('delete from garmin_credentials').rowcount
eventos = c.execute('delete from calendar_events').rowcount
c.commit()
print(f'copia de verificacion: {borradas} credencial(es) Garmin y {eventos} evento(s) borrados')
PY

    docker run -d --name "$NAME" --restart no \
      -p "$LAN:$PORT:8000" -p "$TS:$PORT:8000" \
      -v "$DIR:/var/lib/lyfta" "$IMAGE" >/dev/null

    for _ in $(seq 1 25); do
      if curl -sf -m 2 "http://$LAN:$PORT/healthz" >/dev/null 2>&1; then break; fi
      sleep 1
    done
    echo "==> Verificación: http://$LAN:$PORT (red de casa) · http://$TS:$PORT (tailnet)"
    echo "    Es una copia: lo que se cree aquí no queda en la app de David."
    ;;
  down)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    rm -rf "$DIR"
    echo "==> Instancia de verificación retirada y copia borrada."
    ;;
  *)
    echo "Uso: $0 [up|down]"
    exit 2
    ;;
esac
