import logging
import mimetypes
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.sync import router as sync_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.activities import router as activities_router
from app.api.v1.strength import router as strength_router
from app.api.v1.gym import router as gym_router
from app.api.v1.motion import router as motion_router
from app.api.v1.watch import router as watch_router
from app.api.v1.social_auth import router as auth_router
from app.api.v1.friends import router as friends_router
from app.api.v1.social import router as social_router
from app.api.v1.routes import router as routes_router
from app.api.v1.privacy import router as privacy_router
from app.api.v1.performance import router as performance_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.alerts import router as alerts_router
from app.db.session import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# En Windows el registro puede mapear .js a text/plain y el navegador
# rechaza los <script type="module">. Forzar los MIME correctos.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configuración de CORS (orígenes explícitos: '*' es incompatible con allow_credentials).
# En el despliegue de un solo origen la app llama a su propio host y CORS no
# interviene; ALLOWED_ORIGINS sirve para pruebas y para un frontend aparte.
_origins = [origen.strip() for origen in settings.ALLOWED_ORIGINS.split(",") if origen.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers de API v1
app.include_router(sync_router, prefix=settings.API_V1_STR)
app.include_router(metrics_router, prefix=settings.API_V1_STR)
app.include_router(activities_router, prefix=settings.API_V1_STR)
app.include_router(strength_router, prefix=settings.API_V1_STR)
# El router del gimnasio v2 va DESPUÉS del viejo a propósito: así `/strength/exercises/prs`
# (ruta exacta ya existente) gana a `/strength/exercises/{exercise_id}`.
app.include_router(gym_router, prefix=settings.API_V1_STR)
app.include_router(motion_router, prefix=settings.API_V1_STR)
app.include_router(watch_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(friends_router, prefix=settings.API_V1_STR)
app.include_router(social_router, prefix=settings.API_V1_STR)
app.include_router(routes_router, prefix=settings.API_V1_STR)
app.include_router(privacy_router, prefix=settings.API_V1_STR)
app.include_router(performance_router, prefix=settings.API_V1_STR)
app.include_router(calendar_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def on_startup():
    await init_db()
    # Catálogo de ejercicios: idempotente, solo inserta los que falten (DECISIONES.md D-04).
    from app.db.session import AsyncSessionLocal
    from app.services.gym_seed import seed_exercise_catalog
    try:
        async with AsyncSessionLocal() as session:
            added = await seed_exercise_catalog(session)
            if added:
                logging.getLogger("startup").info(f"Catálogo de ejercicios: +{added} ejercicios de semilla")
    except Exception as exc:  # no impedir el arranque de la API por la semilla
        logging.getLogger("startup").warning(f"No se pudo sembrar el catálogo de ejercicios: {exc}")
    from app.scheduler.scheduler import start_scheduler
    start_scheduler()


@app.get("/healthz", summary="Healthcheck para Docker/CI")
def healthz():
    return {"status": "ok"}


from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

# Servir el build del frontend en el mismo origen que la API: el móvil necesita
# una sola URL y el service worker un único origen que cachear. En desarrollo se
# usa Vite con su proxy y esto no interviene.
mimetypes.add_type("application/manifest+json", ".webmanifest")

BASE_DIR = Path(__file__).resolve().parent


def _resolve_dist_dir() -> Path:
    """Build a servir: `FRONTEND_DIST_DIR` si se define; si no, el más nuevo."""
    configured = settings.FRONTEND_DIST_DIR.strip()
    if configured:
        return Path(configured).expanduser().resolve()
    for candidate in (BASE_DIR.parent / "frontend-nuevo" / "dist", BASE_DIR.parent / "frontend" / "dist"):
        if (candidate / "index.html").is_file():
            return candidate.resolve()
    return (BASE_DIR.parent / "frontend-nuevo" / "dist").resolve()


DIST_DIR = _resolve_dist_dir()

# Rutas que nunca deben devolver el shell HTML: la API y la documentación.
_API_PREFIXES = ("/api/", "/docs", "/redoc", "/openapi.json")


def _index_response() -> FileResponse:
    # Sin caché: el shell HTML debe ser siempre fresco; los bundles llevan hash
    # en el nombre y se cachean sin problema.
    return FileResponse(
        DIST_DIR / "index.html",
        media_type="text/html",
        headers={"Cache-Control": "no-cache"},
    )


@app.api_route("/", methods=["GET", "HEAD"], summary="Aplicación web de Lyfta")
def root():
    if (DIST_DIR / "index.html").is_file():
        return _index_response()
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "frontend": None,
    }


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def frontend_files(full_path: str):
    """Ficheros del build y *fallback* SPA para las rutas profundas.

    `/gimnasio` o `/gimnasio/sesiones/{id}` no son ficheros: el móvil los abre
    (recarga, Atrás, icono de la pantalla de inicio) y deben devolver el shell.
    Un asset inexistente, en cambio, es un 404 seco: nada de disfrazarlo de HTML.
    """
    # Starlette entrega el comodín sin la barra inicial.
    path = "/" + full_path
    if path.startswith(_API_PREFIXES):
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    index = DIST_DIR / "index.html"
    if not index.is_file():
        return JSONResponse(
            {"detail": "El frontend no está compilado en este servidor."},
            status_code=404,
        )

    try:
        target = (DIST_DIR / full_path).resolve()
    except (OSError, ValueError):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    # Sin salir del directorio del build (path traversal).
    if target != DIST_DIR and DIST_DIR not in target.parents:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    if target.is_file():
        headers = {}
        if full_path in ("sw.js", "manifest.webmanifest"):
            # El service worker y el manifiesto no pueden quedarse pegados en caché.
            headers["Cache-Control"] = "no-cache"
        elif full_path.startswith("assets/"):
            # Los bundles llevan hash en el nombre: se pueden cachear para siempre.
            headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            headers["Cache-Control"] = "no-cache"
        return FileResponse(target, headers=headers)

    # Ruta de navegación (sin extensión) o la raíz: el shell de la SPA.
    if target.suffix == "":
        return _index_response()
    return JSONResponse({"detail": "Not Found"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
