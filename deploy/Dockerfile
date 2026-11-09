# Imagen de Lyfta: una sola URL sirve la app y la API.
#
# Etapa 1 compila el frontend (React + Vite) y etapa 2 monta la API de FastAPI
# con ese build al lado, para que el móvil hable con un único origen.

# ---------- Etapa 1: build del frontend ----------
FROM node:22-slim AS frontend

WORKDIR /build

# Primero solo el manifiesto de dependencias: si no cambia, Docker reutiliza la
# capa de `npm ci` y el build baja de minutos a segundos.
COPY frontend-nuevo/package.json frontend-nuevo/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend-nuevo/ ./
RUN npm run build


# ---------- Etapa 2: API + estáticos ----------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Europe/Madrid

# tzdata: el planificador semanal usa horas locales (6:00, 7:00, 18–22 h).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /build/dist ./frontend-nuevo/dist

# El proceso corre con el uid de David en el servidor (1000) para poder escribir
# la base de datos y los tokens de Garmin del volumen.
RUN mkdir -p /var/lib/lyfta/data /var/lib/lyfta/garmin_tokens
ENV PYTHONPATH=/app/backend \
    FRONTEND_DIST_DIR=/app/frontend-nuevo/dist \
    GARMIN_TOKENS_DIR=/var/lib/lyfta/garmin_tokens \
    TRACKS_DIR=/var/lib/lyfta/data \
    DATABASE_URL=sqlite+aiosqlite:////var/lib/lyfta/lyfta.db \
    HOME=/tmp

WORKDIR /app/backend
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')"

USER 1000:1000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
