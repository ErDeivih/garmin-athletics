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

# Configuración de CORS (orígenes explícitos: '*' es incompatible con allow_credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

# Servir el build del frontend (frontend/dist). En dev (vite) se usa el proxy.
BASE_DIR = os.path.dirname(__file__)
DIST_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
ASSETS_DIR = os.path.join(DIST_DIR, "assets")
if os.path.isdir(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

frontend_dir = DIST_DIR


@app.get("/", summary="Dashboard Principal UI")
def root():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        # Sin caché: el shell HTML debe ser siempre fresco; los bundles
        # llevan hash en el nombre y se cachean sin problema.
        return FileResponse(index_path, headers={"Cache-Control": "no-cache"})
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs"
    }


# Fallback SPA: sirve favicon.svg, icons.svg y cualquier ruta del frontend
# compilado. Va el último para no tapar /api/*, /docs ni /healthz.
if os.path.isdir(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
