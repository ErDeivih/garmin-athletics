import logging
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, GarminCredential, Activity
from app.api.deps import require_current_user
from app.services.sync_service import run_user_sync

logger = logging.getLogger("sync")

router = APIRouter(prefix="/sync", tags=["Garmin Synchronization"])


@router.post("/garmin", summary="Sincronizar datos de Garmin bajo demanda (por usuario)")
async def sync_garmin_data(
    target_date: Optional[date] = Query(default=None, description="Fecha a sincronizar (YYYY-MM-DD). Por defecto hoy."),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Descarga métricas de salud y actividades del Garmin del usuario autenticado
    y las persiste en base de datos asociadas a su cuenta.
    """
    try:
        data = await run_user_sync(db, user, target_date)
        return {
            "status": "success",
            "message": f"Sincronización completada para {target_date or date.today()}",
            **data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en sincronización de Garmin para {user.username}: {e}")
        # Si los tokens caducaron/revocaron, marcar re-auth para avisar en la UI.
        msg = str(e).lower()
        if "401" in msg or "auth" in msg or "login" in msg or "token" in msg:
            try:
                cred_result = await db.execute(
                    select(GarminCredential).where(GarminCredential.user_id == user.id)
                )
                cred = cred_result.scalar_one_or_none()
                if cred:
                    cred.needs_reauth = True
                    await db.commit()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", summary="Estado de sincronización y salud de la conexión Garmin")
async def sync_status(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Lo que la UI necesita para el banner de estado: vinculado, última sync,
    actividades recientes y si el planificador está vivo."""
    from app.scheduler.scheduler import scheduler as _sched

    cred_res = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )
    cred = cred_res.scalar_one_or_none()

    week_ago = datetime.combine(date.today() - timedelta(days=7), datetime.min.time())
    acts_res = await db.execute(
        select(Activity).where(
            Activity.user_id == user.id, Activity.start_time >= week_ago
        )
    )
    recent = acts_res.scalars().all()
    return {
        "linked": cred is not None,
        "garmin_email": cred.garmin_email if cred else None,
        "needs_reauth": bool(cred.needs_reauth) if cred else False,
        "last_sync_at": cred.last_sync_at.isoformat() if cred and cred.last_sync_at else None,
        "activities_7d": len(recent),
        "tss_7d": round(sum(a.training_load_tss or 0 for a in recent), 1),
        "scheduler_running": bool(_sched.running),
    }
