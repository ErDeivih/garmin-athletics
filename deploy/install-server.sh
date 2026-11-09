#!/usr/bin/env bash
# Instala o actualiza Lyfta en el servidor.
#
#   ./install-server.sh            # usa ~/deploy-bundle.tgz y ~/deploy-state.tgz
#   ./install-server.sh b.tgz e.tgz
#
# Idempotente: el código se reemplaza, pero la base de datos, los tokens de
# Garmin y los tracks que ya están en deploy/var/ NO se pisan.
set -euo pipefail

ROOT="${LYFTA_ROOT:-$HOME/lyfta}"
BUNDLE="${1:-$HOME/deploy-bundle.tgz}"
STATE="${2:-$HOME/deploy-state.tgz}"

echo "==> Destino: $ROOT"
mkdir -p "$ROOT"
tar -xzf "$BUNDLE" -C "$ROOT"

mkdir -p "$ROOT/deploy/var/garmin_tokens" "$ROOT/deploy/var/data"

# --- Estado: solo se siembra la primera vez ---
STAGE="$(mktemp -d)"
tar -xzf "$STATE" -C "$STAGE"

if [ ! -f "$ROOT/deploy/var/lyfta.db" ]; then
  install -m 600 "$STAGE/garmin_athletics.db" "$ROOT/deploy/var/lyfta.db"
  echo "==> Base de datos sembrada ($(du -h "$ROOT/deploy/var/lyfta.db" | cut -f1))"
else
  echo "==> Base de datos existente: no se toca"
fi

# Tokens de Garmin: `garmin_tokens/` (legado) y `garmin_tokens_<user_id>/`.
cp -a -n "$STAGE"/backend/garmin_tokens/. "$ROOT/deploy/var/garmin_tokens/" 2>/dev/null || true
for dir in "$STAGE"/backend/garmin_tokens_*/; do
  [ -d "$dir" ] || continue
  base="$(basename "$dir")"
  if [ ! -d "$ROOT/deploy/var/$base" ]; then
    cp -a "$dir" "$ROOT/deploy/var/$base"
    echo "==> Tokens de Garmin sembrados: $base"
  fi
done

# Tracks GPS y rutas generadas.
cp -a -n "$STAGE"/data/. "$ROOT/deploy/var/data/" 2>/dev/null || true
rm -rf "$STAGE"

# --- Configuración: solo la primera vez ---
if [ ! -f "$ROOT/deploy/.env" ]; then
  install -m 600 "$HOME/lyfta-env.tmp" "$ROOT/deploy/.env"
  {
    echo ""
    echo "# --- despliegue (install-server.sh) ---"
    echo "LYFTA_LAN_BIND=${LYFTA_LAN_BIND:-192.168.1.139}"
    echo "LYFTA_TS_BIND=${LYFTA_TS_BIND:-100.117.58.93}"
    echo "LYFTA_PORT=${LYFTA_PORT:-8010}"
  } >> "$ROOT/deploy/.env"
  echo "==> deploy/.env creado (revisar LYFTA_BIND / LYFTA_PORT)"
else
  echo "==> deploy/.env existente: no se toca"
fi
rm -f "$HOME/lyfta-env.tmp"

chmod 700 "$ROOT/deploy/var"
find "$ROOT/deploy/var" -maxdepth 1 -type d -exec chmod 700 {} \; 2>/dev/null || true

echo "==> Listo. Construir y arrancar:"
echo "    cd $ROOT/deploy && docker compose up -d --build"
