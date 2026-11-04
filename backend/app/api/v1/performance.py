"""Rendimiento por deporte: resumen, zonas FC y marcas personales."""
from datetime import date, datetime, time, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Activity, PersonalRecord, User
from app.api.deps import require_current_user

router = APIRouter(prefix="/performance", tags=["Performance"])

SPORT_PATTERNS = {
    "running": ("run", "trail", "treadmill"),
    "cycling": ("cycl", "bik", "mtb"),
    "swimming": ("swim",),
}


def _match_sport(activity_type: str, sport: str) -> bool:
    t = (activity_type or "").lower()
    return any(p in t for p in SPORT_PATTERNS.get(sport, (sport,)))


@router.get("/summary", summary="Resumen por deporte en un periodo + comparativa previa")
async def performance_summary(
    sport: str = Query(default="running", pattern="^(running|cycling|swimming)$"),
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    end = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())
    start = end - timedelta(days=days)
    prev_start = start - timedelta(days=days)

    res = await db.execute(select(Activity).where(
        Activity.user_id == user.id,
        Activity.start_time >= prev_start, Activity.start_time < end))
    acts = [a for a in res.scalars().all() if _match_sport(a.activity_type, sport)]

    def agg(items):
        dist = sum(a.distance_meters or 0 for a in items)
        secs = sum(a.duration_seconds or 0 for a in items)
        tss = sum(a.training_load_tss or 0 for a in items)
        gain = sum(a.elevation_gain_m or 0 for a in items)
        hrs = [a.avg_hr for a in items if a.avg_hr]
        return {"sessions": len(items), "hours": round(secs / 3600, 1),
                "km": round(dist / 1000, 1), "tss": round(tss, 1),
                "gain_m": round(gain, 1),
                "avg_hr": round(sum(hrs) / len(hrs)) if hrs else None}

    cur = [a for a in acts if a.start_time >= start]
    prev = [a for a in acts if a.start_time < start]
    out = {"sport": sport, "days": days, "current": agg(cur), "previous": agg(prev)}

    # Mejor ritmo medio (run) / velocidad (bike) del periodo
    best = None
    for a in cur:
        if not (a.distance_meters and a.duration_seconds):
            continue
        if sport == "running":
            val = a.duration_seconds / (a.distance_meters / 1000)  # seg/km
            if best is None or val < best[0]:
                best = (val, a.id)
        elif sport == "cycling":
            val = (a.distance_meters / 1000) / (a.duration_seconds / 3600)
            if best is None or val > best[0]:
                best = (val, a.id)
    out["best_effort"] = {"value": round(best[0], 1), "activity_id": best[1]} if best else None
    return out


@router.get("/zones", summary="Tiempo en zonas FC del periodo (suma de actividades)")
async def performance_zones(
    sport: str = Query(default="running", pattern="^(running|cycling|swimming|all)$"),
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    start = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    res = await db.execute(select(Activity).where(
        Activity.user_id == user.id, Activity.start_time >= start))
    totals = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for a in res.scalars().all():
        if sport != "all" and not _match_sport(a.activity_type, sport):
            continue
        for z in a.hr_zones or []:
            zn = z.get("zone")
            if zn in totals:
                totals[zn] += z.get("secs") or 0
    total = sum(totals.values())
    return {"sport": sport, "days": days, "total_secs": total,
            "zones": [{"zone": z, "secs": totals[z],
                       "pct": round(totals[z] / total * 100, 1) if total else 0}
                      for z in range(1, 6)]}


@router.get("/prs", summary="Marcas personales detectadas")
async def performance_prs(
    sport: Optional[str] = Query(default=None, pattern="^(running|cycling|swimming)$"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    q = select(PersonalRecord).where(PersonalRecord.user_id == user.id)
    if sport:
        q = q.where(PersonalRecord.sport == sport)
    res = await db.execute(q.order_by(PersonalRecord.created_at.desc()))
    out = []
    for pr in res.scalars().all():
        val = pr.value
        display = None
        if pr.unit == "sec_per_km":
            display = f"{int(val // 60)}:{int(val % 60):02d} /km"
        elif pr.unit == "kmh":
            display = f"{val:.1f} km/h"
        elif pr.unit == "meters":
            display = f"{val / 1000:.2f} km"
        out.append({"sport": pr.sport, "label": pr.label, "value": val,
                    "unit": pr.unit, "display": display,
                    "activity_id": pr.activity_id,
                    "achieved_at": pr.achieved_at.isoformat() if pr.achieved_at else None})
    return out
