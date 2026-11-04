from fastapi import APIRouter, Depends, Query
from datetime import date, datetime, time, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from app.db.session import get_db
from app.db.models import DailyBiometrics, DailyStat, Activity, FatigueMetric
from app.api.deps import get_current_user
from app.db.models import User
from app.services.fatigue_engine import FatigueEngine

router = APIRouter(prefix="/metrics", tags=["Physiological Metrics & Fatigue"])


def _bio_scope(query, user: Optional[User]):
    """Filtra biometría propia + legacy (compat single-user)."""
    if user:
        return query.where(
            or_(DailyBiometrics.user_id == user.id, DailyBiometrics.user_id.is_(None))
        ).order_by(DailyBiometrics.user_id.is_(None))
    return query.where(DailyBiometrics.user_id.is_(None))


def _fat_scope(query, user: Optional[User]):
    if user:
        return query.where(
            or_(FatigueMetric.user_id == user.id, FatigueMetric.user_id.is_(None))
        ).order_by(FatigueMetric.user_id.is_(None))
    return query.where(FatigueMetric.user_id.is_(None))


def _hrv_status(overnight: Optional[float], weekly: Optional[float]) -> str:
    if not overnight or not weekly:
        return "unknown"
    ratio = overnight / weekly
    if ratio < 0.85:
        return "low"
    if ratio > 1.15:
        return "high"
    return "normal"

@router.get("/readiness", summary="Obtener el Readiness Score de hoy (Verde/Amarillo/Rojo)")
async def get_today_readiness(
    target_date: Optional[date] = Query(default=None, description="Fecha (YYYY-MM-DD). Default hoy."),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    req_date = target_date or date.today()
    
    # 1. Consultar biometría guardada (propietario autenticado o datos legacy)
    bio_query = select(DailyBiometrics).where(DailyBiometrics.date == req_date)
    if user:
        bio_query = bio_query.where(
            or_(DailyBiometrics.user_id == user.id, DailyBiometrics.user_id.is_(None))
        )
        bio_query = bio_query.order_by(DailyBiometrics.user_id.is_(None))
    else:
        bio_query = bio_query.where(DailyBiometrics.user_id.is_(None))
    result = await db.execute(bio_query)
    bio = result.scalars().first()
    
    # 2. Consultar fatiga guardada (TSB)
    fat_query = select(FatigueMetric).where(FatigueMetric.date == req_date)
    if user:
        fat_query = fat_query.where(
            or_(FatigueMetric.user_id == user.id, FatigueMetric.user_id.is_(None))
        )
        fat_query = fat_query.order_by(FatigueMetric.user_id.is_(None))
    else:
        fat_query = fat_query.where(FatigueMetric.user_id.is_(None))
    fat_result = await db.execute(fat_query)
    fat = fat_result.scalars().first()
    tsb_val = fat.tsb if fat else 0.0

    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio.sleep_score if bio else None,
        hrv_overnight=bio.hrv_overnight_avg if bio else None,
        hrv_weekly_avg=bio.hrv_weekly_avg if bio else None,
        tsb=tsb_val
    )

    return {
        "date": req_date.isoformat(),
        "readiness": readiness,
        "biometrics_available": bio is not None
    }

@router.get("/load", summary="Obtener la serie temporal de fatiga (ATL / CTL / TSB)")
async def get_load_history(
    days: int = Query(default=30, ge=7, le=365, description="Días de historial a calcular"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    display_start, end_d, chart_data = await _compute_load_series(user, db, days)
    return {
        "start_date": display_start.isoformat(),
        "end_date": end_d.isoformat(),
        "total_days": len(chart_data),
        "series": chart_data
    }


async def _compute_load_series(user: Optional[User], db: AsyncSession, days: int):
    """Serie Banister diaria (ATL/CTL/TSB/TSS). Compartida por /load y /load-summary."""
    end_d = date.today()
    start_d = end_d - timedelta(days=days + 42)  # 42 días extra para estabilizar CTL

    start_dt = datetime.combine(start_d, time.min)
    act_query = select(Activity).where(Activity.start_time >= start_dt)
    if user:
        act_query = act_query.where(or_(Activity.user_id == user.id, Activity.user_id.is_(None)))
    else:
        act_query = act_query.where(Activity.user_id.is_(None))
    activities = (await db.execute(act_query)).scalars().all()

    daily_tss: Dict[date, float] = {}
    for act in activities:
        act_date = act.start_time.date()
        daily_tss[act_date] = daily_tss.get(act_date, 0.0) + act.training_load_tss

    banister_series = FatigueEngine.compute_daily_banister(daily_tss, start_d, end_d)

    display_start = end_d - timedelta(days=days)
    chart_data = []
    current = display_start
    while current <= end_d:
        item = banister_series.get(current, {"atl": 0.0, "ctl": 0.0, "tsb": 0.0, "tss_today": 0.0})
        chart_data.append({
            "date": current.isoformat(),
            "atl": item["atl"],
            "ctl": item["ctl"],
            "tsb": item["tsb"],
            "tss": item["tss_today"]
        })
        current += timedelta(days=1)
    return display_start, end_d, chart_data


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


@router.get("/load-summary", summary="Carga semanal, monotonía y tensión (Foster) a partir de la serie diaria")
async def get_load_summary(
    days: int = Query(default=28, ge=7, le=365, description="Días de historial a calcular"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Monotonía = media(TSS diario)/desviación típica en una semana completa;
    tensión = TSS semanal × monotonía (Foster 1998). La semana en curso se
    devuelve marcada como incompleta y **sin** monotonía: no se compara una
    semana a medias con una cerrada. Si la desviación es 0, monotonía no existe.
    """
    _, end_d, series = await _compute_load_series(user, db, days)
    today = date.today()

    buckets: Dict[date, List[float]] = {}
    for point in series:
        day = date.fromisoformat(point["date"])
        buckets.setdefault(_week_start(day), []).append(float(point["tss"] or 0.0))

    weeks = []
    for week_start in sorted(buckets):
        values = buckets[week_start]
        week_end = week_start + timedelta(days=6)
        complete = week_end <= today
        week_tss = round(sum(values), 2)
        monotony = None
        strain = None
        note = None
        if not complete:
            note = "semana en curso: sin monotonía ni tensión"
        elif len(values) < 7:
            note = "faltan días en la semana"
        else:
            mean = week_tss / 7.0
            variance = sum((value - mean) ** 2 for value in values) / 7.0
            sd = variance ** 0.5
            if sd <= 0:
                note = "sin variación entre días: monotonía indefinida"
            else:
                monotony = round(mean / sd, 2)
                strain = round(week_tss * monotony, 1)
        weeks.append({
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "tss": week_tss,
            "days_with_load": sum(1 for value in values if value > 0),
            "complete": complete,
            "monotony": monotony,
            "strain": strain,
            "note": note,
        })

    latest = series[-1] if series else None
    acwr = None
    if latest and latest.get("ctl"):
        acwr = round(latest["atl"] / latest["ctl"], 2)

    return {
        "days": days,
        "end_date": end_d.isoformat(),
        "series": series,
        "weeks": weeks,
        "latest": {
            "date": latest["date"] if latest else None,
            "atl": latest["atl"] if latest else None,
            "ctl": latest["ctl"] if latest else None,
            "tsb": latest["tsb"] if latest else None,
            "acwr": acwr,
        },
        "method": "Monotonía = media(TSS 7 d)/SD(TSS 7 d); tensión = TSS semanal × monotonía (Foster, 1998).",
    }

@router.get("/daily", summary="Métricas completas de un día (el que alimenta los widgets)")
async def get_daily_metrics(
    target_date: Optional[date] = Query(default=None, description="Fecha (YYYY-MM-DD). Por defecto hoy."),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    req_date = target_date or date.today()

    bio_res = await db.execute(_bio_scope(
        select(DailyBiometrics).where(DailyBiometrics.date == req_date), user))
    bio = bio_res.scalars().first()

    fat_res = await db.execute(_fat_scope(
        select(FatigueMetric).where(FatigueMetric.date == req_date), user))
    fat = fat_res.scalar_one_or_none()
    tsb_val = fat.tsb if fat else 0.0

    # Medias de 7 días para deltas (excluye el propio día si aún está vacío)
    week_start = req_date - timedelta(days=7)
    week_res = await db.execute(_bio_scope(
        select(DailyBiometrics).where(
            DailyBiometrics.date >= week_start, DailyBiometrics.date < req_date), user))
    week = week_res.scalars().all()

    def _avg(vals: List[Optional[float]]) -> Optional[float]:
        clean = [v for v in vals if v is not None]
        return round(sum(clean) / len(clean), 1) if clean else None

    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio.sleep_score if bio else None,
        hrv_overnight=bio.hrv_overnight_avg if bio else None,
        hrv_weekly_avg=bio.hrv_weekly_avg if bio else None,
        tsb=tsb_val,
    )

    sleep_seconds = bio.sleep_seconds if bio else None
    return {
        "date": req_date.isoformat(),
        "biometrics_available": bio is not None,
        "sleep": {
            "score": bio.sleep_score if bio else None,
            "seconds": sleep_seconds,
            "hours": round(sleep_seconds / 3600, 1) if sleep_seconds else None,
            "avg_7d": _avg([b.sleep_score for b in week]),
            "deep_seconds": bio.sleep_deep_seconds if bio else None,
            "light_seconds": bio.sleep_light_seconds if bio else None,
            "rem_seconds": bio.sleep_rem_seconds if bio else None,
            "awake_seconds": bio.sleep_awake_seconds if bio else None,
            "time_in_bed_seconds": bio.time_in_bed_seconds if bio else None,
            "efficiency": bio.sleep_efficiency if bio else None,
            "bedtime": bio.bedtime_local.isoformat() if bio and bio.bedtime_local else None,
            "wakeup": bio.wakeup_local.isoformat() if bio and bio.wakeup_local else None,
        },
        "hrv": {
            "overnight": bio.hrv_overnight_avg if bio else None,
            "weekly_avg": bio.hrv_weekly_avg if bio else None,
            "status": (bio.hrv_status or _hrv_status(
                bio.hrv_overnight_avg if bio else None,
                bio.hrv_weekly_avg if bio else None)) if bio else "unknown",
            "avg_7d": _avg([b.hrv_overnight_avg for b in week]),
        },
        "resting_hr": bio.resting_hr if bio else None,
        "resting_hr_7d": _avg([b.resting_hr for b in week]),
        "body_battery": {
            "max": bio.body_battery_max if bio else None,
            "min": bio.body_battery_min if bio else None,
            "wake": bio.body_battery_wake if bio else None,
            "curve": bio.body_battery_curve if bio else None,
        },
        "stress_avg": bio.stress_avg if bio else None,
        "tsb": tsb_val,
        "atl": fat.atl if fat else 0.0,
        "ctl": fat.ctl if fat else 0.0,
        "readiness": readiness,
    }

@router.get("/sleep-phases", summary="Fases de sueño por noche (para el gráfico apilado de T-27)")
async def get_sleep_phases(
    days: int = Query(default=30, ge=7, le=365, description="Días de historial"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Devuelve las fases de cada noche en horas. Solo noches con dato: una noche
    sin biometría no se rellena con ceros, simplemente no aparece.
    """
    end_d = date.today()
    start_d = end_d - timedelta(days=days)
    query = select(DailyBiometrics).where(
        DailyBiometrics.date >= start_d, DailyBiometrics.date <= end_d)
    if user:
        query = query.where(or_(DailyBiometrics.user_id == user.id,
                                DailyBiometrics.user_id.is_(None)))
    else:
        query = query.where(DailyBiometrics.user_id.is_(None))
    rows = (await db.execute(query.order_by(DailyBiometrics.date))).scalars().all()

    by_date: Dict[date, DailyBiometrics] = {}
    for row in rows:
        # Si hay dato propio y legacy para el mismo día, gana el propio.
        if row.date not in by_date or row.user_id is not None:
            by_date[row.date] = row

    def hours(seconds: Optional[int]) -> Optional[float]:
        return round(seconds / 3600.0, 2) if seconds else None

    series = []
    for day in sorted(by_date):
        row = by_date[day]
        deep = hours(row.sleep_deep_seconds)
        light = hours(row.sleep_light_seconds)
        rem = hours(row.sleep_rem_seconds)
        awake = hours(row.sleep_awake_seconds)
        phases = [value for value in (deep, light, rem) if value is not None]
        if not phases:
            continue  # sin fases reales: no se inventa una noche plana
        in_bed = hours(row.time_in_bed_seconds)
        series.append({
            "date": day.isoformat(),
            "deep_hours": deep,
            "light_hours": light,
            "rem_hours": rem,
            "awake_hours": awake,
            "sleep_hours": hours(row.sleep_seconds),
            "in_bed_hours": in_bed,
            "sleep_score": row.sleep_score,
            "efficiency": row.sleep_efficiency,
        })
    return {"days": days, "series": series,
            "note": "Solo se devuelven noches con fases de sueño reales; el resto no se rellena."}


@router.get("/trends", summary="Serie temporal de una métrica para sparklines y tendencias")
async def get_metric_trends(
    metric: str = Query(..., pattern="^(sleep_score|sleep_hours|hrv|resting_hr|body_battery|readiness|stress)$"),
    days: int = Query(default=30, ge=7, le=365),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    end_d = date.today()
    start_d = end_d - timedelta(days=days)

    bio_res = await db.execute(_bio_scope(
        select(DailyBiometrics).where(
            DailyBiometrics.date >= start_d, DailyBiometrics.date <= end_d), user))
    bio_map = {b.date: b for b in bio_res.scalars().all()}

    tsb_map: Dict[date, float] = {}
    if metric == "readiness":
        start_dt = datetime.combine(start_d - timedelta(days=42), time.min)
        act_res = await db.execute(select(Activity).where(Activity.start_time >= start_dt))
        acts = act_res.scalars().all()
        if user:
            acts = [a for a in acts if a.user_id in (user.id, None)]
        else:
            acts = [a for a in acts if a.user_id is None]
        daily_tss: Dict[date, float] = {}
        for act in acts:
            d = act.start_time.date()
            daily_tss[d] = daily_tss.get(d, 0.0) + (act.training_load_tss or 0.0)
        series = FatigueEngine.compute_daily_banister(daily_tss, start_d - timedelta(days=42), end_d)
        tsb_map = {d: v["tsb"] for d, v in series.items()}

    points = []
    current = start_d
    while current <= end_d:
        b = bio_map.get(current)
        value: Optional[float] = None
        if metric == "sleep_score":
            value = b.sleep_score if b else None
        elif metric == "sleep_hours":
            value = round(b.sleep_seconds / 3600, 1) if b and b.sleep_seconds else None
        elif metric == "hrv":
            value = b.hrv_overnight_avg if b else None
        elif metric == "resting_hr":
            value = b.resting_hr if b else None
        elif metric == "body_battery":
            value = b.body_battery_max if b else None
        elif metric == "stress":
            value = b.stress_avg if b else None
        elif metric == "readiness":
            value = FatigueEngine.calculate_readiness_score(
                sleep_score=b.sleep_score if b else None,
                hrv_overnight=b.hrv_overnight_avg if b else None,
                hrv_weekly_avg=b.hrv_weekly_avg if b else None,
                tsb=tsb_map.get(current, 0.0),
            )["score"]
        points.append({"date": current.isoformat(), "value": value})
        current += timedelta(days=1)

    return {"metric": metric, "days": days, "series": points}

@router.get("/stats", summary="Movimiento diario: pasos, calorías, intensidad")
async def get_daily_stats(
    days: int = Query(default=30, ge=7, le=180),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    end_d = date.today()
    start_d = end_d - timedelta(days=days)
    q = select(DailyStat).where(DailyStat.date >= start_d, DailyStat.date <= end_d)
    if user:
        q = q.where(or_(DailyStat.user_id == user.id, DailyStat.user_id.is_(None)))
    else:
        q = q.where(DailyStat.user_id.is_(None))
    res = await db.execute(q.order_by(DailyStat.date))
    return {"days": days, "series": [{
        "date": r.date.isoformat(), "steps": r.steps, "step_goal": r.step_goal,
        "calories_total": r.calories_total, "calories_active": r.calories_active,
        "distance_m": r.distance_m, "intensity_minutes": r.intensity_minutes,
        "floors_m": r.floors_m} for r in res.scalars().all()]}


STATUS_LABELS = [
    ("RECOVERY", "Recuperación"), ("PEAK", "Pico de forma"),
    ("PRODUCTIVE", "Productivo"), ("MAINTAINING", "Mantenimiento"),
    ("STRAIN", "Sobrecarga"), ("OVERREACHING", "Sobrecarga"),
    ("DETRAINING", "Desentrenando"), ("UNPRODUCTIVE", "No productivo"),
    ("AEROBIC_LOW_SHORTAGE", "Te falta base aeróbica suave"),
]

BALANCE_LABELS = [
    ("AEROBIC_LOW_SHORTAGE", "Te falta base aeróbica suave"),
    ("ANAEROBIC_SHORTAGE", "Te falta chispa anaeróbica"),
    ("OPTIMAL", "Carga equilibrada"),
]


def _label(feedback: Optional[str], table) -> Optional[str]:
    if not feedback:
        return None
    up = str(feedback).upper()
    for key, label in table:
        if up.startswith(key):
            return label
    return None


@router.get("/training-status", summary="Lo que dice Garmin: VO2max, estado y predicciones")
async def get_training_status(
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Último snapshot oficial (se guarda en cada sync). La sugerencia diaria
    de entreno NO la expone Garmin por esta API de forma fiable."""
    q = select(DailyBiometrics).where(DailyBiometrics.training_snapshot.is_not(None))
    if user:
        q = q.where(or_(DailyBiometrics.user_id == user.id,
                        DailyBiometrics.user_id.is_(None)))
    else:
        q = q.where(DailyBiometrics.user_id.is_(None))
    res = await db.execute(q.order_by(DailyBiometrics.date.desc()).limit(1))
    bio = res.scalars().first()
    if not bio:
        return {"available": False,
                "note": "Sincroniza para traer el estado oficial de Garmin."}
    snap = bio.training_snapshot or {}
    return {
        "available": True,
        "date": bio.date.isoformat(),
        "vo2max": snap.get("vo2max"),
        "device": snap.get("device"),
        "status_feedback": snap.get("status_feedback"),
        "status_label": _label(snap.get("status_feedback"), STATUS_LABELS),
        "balance_label": _label((snap.get("balance") or {}).get("feedback"), BALANCE_LABELS),
        "acute": snap.get("acute"),
        "chronic": snap.get("chronic"),
        "acwr": snap.get("acwr"),
        "race": {
            "p5k": snap.get("race_5k_s"), "p10k": snap.get("race_10k_s"),
            "hm": snap.get("race_hm_s"), "mar": snap.get("race_mar_s"),
        },
    }
