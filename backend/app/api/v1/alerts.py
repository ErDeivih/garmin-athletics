"""Avisos de entrenamiento: HRV bajo, riesgo TSB, sin sync, poco sueño."""
from datetime import date, datetime, timedelta
from typing import Dict, Any, List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import DailyBiometrics, FatigueMetric, GarminCredential, Activity, User
from app.api.deps import require_current_user

router = APIRouter(prefix="/alerts", tags=["Training Alerts"])


@router.get("/", summary="Avisos activos (reglas sobre tus últimos datos)")
async def get_alerts(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    today = date.today()
    alerts: List[Dict[str, Any]] = []

    bio_res = await db.execute(select(DailyBiometrics).where(
        DailyBiometrics.user_id == user.id,
        DailyBiometrics.date >= today - timedelta(days=7),
        DailyBiometrics.date <= today).order_by(DailyBiometrics.date.desc()))
    bios = list(bio_res.scalars().all())
    by_date = {b.date: b for b in bios}
    latest = by_date.get(today)

    # 1. HRV cae >15% bajo la media semanal
    if latest and latest.hrv_overnight_avg and latest.hrv_weekly_avg:
        if latest.hrv_overnight_avg < latest.hrv_weekly_avg * 0.85:
            alerts.append({"type": "hrv_drop", "severity": "warn",
                           "message": f"HRV bajo hoy ({latest.hrv_overnight_avg} vs media {latest.hrv_weekly_avg}). Mejor intensidad suave."})

    # 2. TSB < -20 tres días seguidos → riesgo sobreentreno
    fat_res = await db.execute(select(FatigueMetric).where(
        FatigueMetric.user_id == user.id,
        FatigueMetric.date >= today - timedelta(days=2),
        FatigueMetric.date <= today))
    tsbs = [f.tsb for f in fat_res.scalars().all() if f.tsb is not None]
    if len(tsbs) >= 3 and all(t < -20 for t in tsbs[-3:]):
        alerts.append({"type": "tsb_risk", "severity": "high",
                       "message": "Frescura muy negativa 3 días seguidos. Toca descargar o descansar."})

    # 3. Sin sincronizar 24h+
    cred_res = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id))
    cred = cred_res.scalar_one_or_none()
    if cred and not cred.needs_reauth:
        last = cred.last_sync_at
        stale = ((datetime.utcnow() - last).total_seconds() > 26 * 3600
                 if last else True)
        if stale:
            alerts.append({"type": "no_sync", "severity": "info",
                           "message": "Llevas más de un día sin sincronizar con Garmin."})
    if cred and cred.needs_reauth:
        alerts.append({"type": "reauth", "severity": "high",
                       "message": "Tu sesión de Garmin caducó. Re-vincula tu cuenta."})

    # 4. Sueño <6h dos días seguidos
    short = [b for b in bios[:2] if b.sleep_seconds and b.sleep_seconds < 6 * 3600]
    if len(short) >= 2:
        alerts.append({"type": "low_sleep", "severity": "warn",
                       "message": "Dos noches seguidas por debajo de 6h. El readiness lo notará."})

    # 5. RHR elevado (+5 sobre media 7d)
    rhrs = [b.resting_hr for b in bios if b.resting_hr]
    if latest and latest.resting_hr and len(rhrs) >= 3:
        avg = sum(rhrs) / len(rhrs)
        if latest.resting_hr >= avg + 5:
            alerts.append({"type": "rhr_high", "severity": "warn",
                           "message": f"Pulso en reposo alto ({latest.resting_hr} vs media {avg:.0f}). Posible fatiga o resfriado."})

    # 6. Partido inamovible en 48h → recordatorio piernas
    try:
        from app.db.models import CalendarEvent
        from app.api.v1.calendar import upcoming_immovable
        ev_res = await db.execute(select(CalendarEvent).where(
            CalendarEvent.user_id == user.id))
        imm = upcoming_immovable(list(ev_res.scalars().all()), datetime.utcnow(), 48)
        if imm:
            alerts.append({"type": "match_soon", "severity": "info",
                           "message": f"{imm[0].title} en <48h: evita pierna pesada."})
    except Exception:
        pass

    # 7. Actividad sin HR (posible olvido de banda/reloj mal puesto)
    act_res = await db.execute(select(Activity).where(
        Activity.user_id == user.id,
        Activity.start_time >= datetime.combine(today - timedelta(days=7), datetime.min.time())))
    no_hr = [a for a in act_res.scalars().all()
             if (a.activity_type or "") in ("running", "cycling") and not a.avg_hr]
    if no_hr:
        alerts.append({"type": "no_hr", "severity": "info",
                       "message": f"{len(no_hr)} sesión(es) sin pulso esta semana. Revisa la banda o el ajuste del reloj."})

    return {"date": today.isoformat(), "count": len(alerts), "alerts": alerts}
