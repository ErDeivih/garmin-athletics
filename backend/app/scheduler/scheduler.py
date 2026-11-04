import asyncio
import logging
import random
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models import GarminCredential, User
from app.core.config import settings

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()


async def _sync_all_users_async() -> None:
    """Sincroniza (y PERSISTE) la cuenta Garmin de cada usuario vinculado."""
    from app.services.sync_service import run_user_sync

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(GarminCredential))
        credentials = result.scalars().all()
        users = {c.user_id: c for c in credentials}
        if users:
            ures = await db.execute(select(User).where(User.id.in_(list(users))))
            user_map = {u.id: u for u in ures.scalars().all()}
        else:
            user_map = {}

    for user_id, cred in users.items():
        user = user_map.get(user_id)
        if not user:
            continue
        try:
            # Jitter para no golpear la API todos a la vez
            await asyncio.sleep(random.uniform(0, 5))
            async with AsyncSessionLocal() as db:
                data = await run_user_sync(db, user)
            logger.info(
                f"✅ Sync Garmin OK para usuario {user_id}: "
                f"{data['activities_inserted']} nuevas, "
                f"Readiness={data['readiness']['score']}"
            )
        except Exception as e:
            msg = str(e).lower()
            if "401" in msg or "auth" in msg or "login" in msg or "token" in msg:
                async with AsyncSessionLocal() as db:
                    try:
                        row = await db.get(GarminCredential, user_id)
                        if row:
                            row.needs_reauth = True
                            await db.commit()
                    except Exception:
                        pass
                logger.warning(f"⚠️ Tokens caducados del usuario {user_id}: hay que re-vincular.")
            else:
                logger.error(f"❌ Error sincronizando Garmin del usuario {user_id}: {e}")

    # Fallback legacy: si nadie tiene credenciales propias, usar las globales del .env
    if not credentials and settings.GARMIN_EMAIL and settings.GARMIN_PASSWORD:
        await _sync_global_legacy()


async def _sync_global_legacy() -> None:
    from app.services.garmin_service import GarminService

    try:
        service = GarminService()
        biometrics = service.get_daily_biometrics()
        logger.info(f"✅ Sincronización global (legacy) completada: {biometrics.get('sleep_score')}")
    except Exception as e:
        logger.error(f"❌ Error en la sincronización global de Garmin: {e}")


def scheduled_garmin_sync():
    """Tarea programada desatendida: sincroniza todos los usuarios con Garmin vinculado."""
    logger.info("⏰ Ejecutando sincronización desatendida programada de Garmin...")
    try:
        asyncio.run(_sync_all_users_async())
    except Exception as e:
        logger.error(f"❌ Error fatal en el job de sincronización: {e}")


def start_scheduler():
    """
    Inicia el planificador de tareas:
    - 07:00 AM todos los días (ingesta matutina de sueño/HRV)
    - Cada 15 minutos entre las 18:00 y las 22:00 (ingesta de entrenamientos vespertinos)
    """
    if scheduler.running:
        return

    # Job matutino 07:00 AM
    scheduler.add_job(
        scheduled_garmin_sync,
        trigger="cron",
        hour=7,
        minute=0,
        id="garmin_morning_sync",
        replace_existing=True
    )

    # Job vespertino (fútbol / entrenamientos) cada 15 min entre 18:00 y 22:00
    scheduler.add_job(
        scheduled_garmin_sync,
        trigger="cron",
        hour="18-22",
        minute="*/15",
        id="garmin_evening_sync",
        replace_existing=True
    )

    scheduler.start()
    logger.info("🚀 APScheduler iniciado: Ingesta automática de Garmin programada.")
