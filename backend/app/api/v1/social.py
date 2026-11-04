from datetime import date, timedelta
from typing import Dict, Any, List
import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, Activity, DailyBiometrics, FatigueMetric
from app.api.deps import require_current_user
from app.services.fatigue_engine import FatigueEngine

router = APIRouter(prefix="/social", tags=["Social & Comparisons"])


async def _athlete_snapshot(db: AsyncSession, athlete: User, days: int) -> Dict[str, Any]:
    """Métricas agregadas y privadas de un atleta: solo valores comparativos, sin datos crudos."""
    today = date.today()
    start_d = today - timedelta(days=days)

    # 1. TSS acumulado del periodo + serie para Banister (necesita 42 días extra de contexto)
    banister_start = start_d - timedelta(days=42)
    act_result = await db.execute(
        select(Activity).where(
            Activity.user_id == athlete.id,
            Activity.start_time >= banister_start,
        )
    )
    daily_tss: Dict[date, float] = {}
    weekly_tss = 0.0
    activity_count = 0
    for act in act_result.scalars().all():
        act_date = act.start_time.date()
        daily_tss[act_date] = daily_tss.get(act_date, 0.0) + act.training_load_tss
        if act_date >= start_d:
            weekly_tss += act.training_load_tss
            activity_count += 1

    # 2. Banister para CTL/ATL/TSB de hoy
    series = FatigueEngine.compute_daily_banister(daily_tss, banister_start, today)
    today_metrics = series.get(today, {"atl": 0.0, "ctl": 0.0, "tsb": 0.0})

    # 3. Readiness de hoy
    bio_res = await db.execute(
        select(DailyBiometrics).where(DailyBiometrics.user_id == athlete.id, DailyBiometrics.date == today)
    )
    bio = bio_res.scalar_one_or_none()
    fat_res = await db.execute(
        select(FatigueMetric).where(FatigueMetric.user_id == athlete.id, FatigueMetric.date == today)
    )
    fat = fat_res.scalar_one_or_none()
    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio.sleep_score if bio else None,
        hrv_overnight=bio.hrv_overnight_avg if bio else None,
        hrv_weekly_avg=bio.hrv_weekly_avg if bio else None,
        tsb=fat.tsb if fat else today_metrics["tsb"],
    )

    return {
        "athlete": {
            "id": athlete.id,
            "username": athlete.username,
            "display_name": athlete.display_name,
        },
        "weekly_tss": round(weekly_tss, 1),
        "activity_count": activity_count,
        "ctl": today_metrics["ctl"],
        "tsb": today_metrics["tsb"],
        "readiness_score": readiness["score"],
        "readiness_status": readiness["status"],
    }


@router.get("/leaderboard", summary="Comparativa de esfuerzo entre tú y tus amigos")
async def get_leaderboard(
    days: int = Query(default=7, ge=1, le=90, description="Ventana de días para el TSS acumulado"),
    order_by: str = Query(default="weekly_tss", pattern="^(weekly_tss|ctl|readiness_score)$"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    from app.api.v1.friends import get_accepted_friends

    friends = await get_accepted_friends(db, user.id)
    athletes: List[User] = [user] + friends

    # En paralelo con sesión propia por atleta (una AsyncSession no admite
    # operaciones concurrentes). Antes: 3 queries en serie por atleta (N+1).
    from app.db.session import AsyncSessionLocal

    async def _one(athlete: User) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            return await _athlete_snapshot(session, athlete, days)

    entries = list(await asyncio.gather(*[_one(a) for a in athletes]))
    entries.sort(key=lambda e: e[order_by], reverse=True)

    return {
        "period_days": days,
        "order_by": order_by,
        "ranking": entries,
        "note": "Solo se comparten métricas agregadas (TSS, CTL/TSB, Readiness). Los datos crudos permanecen privados.",
    }


@router.get("/friends/{user_id}/summary", summary="Resumen comparativo de un amigo concreto")
async def get_friend_summary(
    user_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.api.v1.friends import get_accepted_friends

    friends = await get_accepted_friends(db, user.id)
    friend = next((f for f in friends if f.id == user_id), None)
    if not friend:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="No eres amigo de este atleta o la amistad no está aceptada.")
    return await _athlete_snapshot(db, friend, days=7)
