"""Servicio de sincronización compartido (endpoint manual + scheduler).

`run_user_sync()` contiene TODA la lógica de ingesta; el endpoint y los jobs
son envoltorios finos. Así el scheduler persiste exactamente igual que el sync
manual (T-38).
"""
import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    User, GarminCredential, DailyBiometrics, DailyStat,
    Activity, FatigueMetric, PersonalRecord,
)
from app.services.garmin_service import GarminService
from app.services.fatigue_engine import FatigueEngine

logger = logging.getLogger("sync_service")


def _service_for_user_sync(user: User, db_session: Optional[AsyncSession] = None,
                           cred: Optional[GarminCredential] = None) -> GarminService:
    if cred:
        return GarminService(
            email=cred.garmin_email, password=None,
            token_dir=f"{settings.GARMIN_TOKENS_DIR}_{user.id}",
            use_env_fallback=False)
    return GarminService()


def _parse_start_time(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    text = str(raw).strip()
    for cand in (text, text.replace("Z", "+00:00")):
        try:
            return datetime.fromisoformat(cand)
        except ValueError:
            continue
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _parse_dt(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    try:
        if isinstance(raw, (int, float)):
            return datetime.fromtimestamp(int(raw) / 1000)
        return datetime.fromisoformat(str(raw))
    except Exception:
        return None


async def _detect_prs(db: AsyncSession, user: User, inserted: list) -> int:
    """Detecta marcas personales simples en las actividades recién insertadas."""
    updated = 0
    for act in inserted:
        cands = []
        dist = act.distance_meters or 0
        dur = act.duration_seconds or 0
        atype = (act.activity_type or "").lower()
        if "run" in atype and dist >= 990 and dur > 0:
            cands.append(("best_pace_1k", dur / (dist / 1000), "sec_per_km", True))
        if "run" in atype and dist > 0:
            cands.append(("longest_run", dist, "meters", False))
        if "cycl" in atype or "bik" in atype:
            if act.avg_hr and dur > 0 and dist > 0:
                kmh = (dist / 1000) / (dur / 3600)
                cands.append(("fastest_ride", kmh, "kmh", False))
        for label, value, unit, lower_is_better in cands:
            sport = "running" if "run" in atype else ("cycling" if ("cycl" in atype or "bik" in atype) else "other")
            res = await db.execute(select(PersonalRecord).where(
                PersonalRecord.user_id == user.id,
                PersonalRecord.sport == sport, PersonalRecord.label == label))
            pr = res.scalar_one_or_none()
            better = pr is None or (value < pr.value if lower_is_better else value > pr.value)
            if better:
                if not pr:
                    pr = PersonalRecord(user_id=user.id, sport=sport, label=label,
                                        unit=unit, value=value)
                    db.add(pr)
                else:
                    pr.value = value
                pr.activity_id = act.id
                pr.achieved_at = act.start_time
                updated += 1
    return updated


async def run_user_sync(db: AsyncSession, user: User,
                        target_date: Optional[date] = None) -> Dict[str, Any]:
    """Ejecuta la sincronización completa de un usuario. Persiste todo."""
    service = _service_for_user_sync(user)
    # Si el usuario tiene credenciales propias, usar sus tokens
    cred_res = await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id))
    cred = cred_res.scalar_one_or_none()
    if cred:
        service = _service_for_user_sync(user, cred=cred)

    req_date = target_date or date.today()

    # 0. Backfill: primera vez trae más historial para estabilizar el CTL
    count_res = await db.execute(
        select(Activity.id).where(Activity.user_id == user.id).limit(1))
    activity_limit = 100 if count_res.scalar_one_or_none() is None else 20

    # 1. Biometría (+ detalle sueño/HRV/BB)
    biometrics = service.get_daily_biometrics(req_date)
    bio_res = await db.execute(select(DailyBiometrics).where(
        DailyBiometrics.user_id == user.id, DailyBiometrics.date == req_date))
    bio_row = bio_res.scalar_one_or_none()
    if not bio_row:
        bio_row = DailyBiometrics(user_id=user.id, date=req_date)
        db.add(bio_row)
    for field in ("sleep_seconds", "sleep_score", "sleep_deep_seconds",
                  "sleep_light_seconds", "sleep_rem_seconds",
                  "sleep_awake_seconds", "time_in_bed_seconds",
                  "sleep_efficiency", "hrv_weekly_avg", "hrv_overnight_avg",
                  "hrv_status", "resting_hr", "body_battery_max",
                  "body_battery_min", "body_battery_wake",
                  "body_battery_curve", "stress_avg"):
        setattr(bio_row, field, biometrics.get(field))
    bio_row.bedtime_local = _parse_dt(biometrics.get("bedtime_local"))
    bio_row.wakeup_local = _parse_dt(biometrics.get("wakeup_local"))

    # 1b. Foto oficial Garmin (VO2max, estado, predicciones) — nunca rompe
    try:
        snap = service.get_training_snapshot(req_date)
        if snap:
            bio_row.training_snapshot = snap
    except Exception as e:
        logger.warning(f"Sin snapshot Garmin para {user.username}: {e}")

    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio_row.sleep_score,
        hrv_overnight=bio_row.hrv_overnight_avg,
        hrv_weekly_avg=bio_row.hrv_weekly_avg, tsb=0.0)
    bio_row.readiness_score = readiness["score"]

    # 1b. Stats diarias (pasos, calorías, intensidad) — nunca rompe el sync
    try:
        stats = service.client.get_stats(req_date.isoformat()) if service.client else None
        if stats:
            st_res = await db.execute(select(DailyStat).where(
                DailyStat.user_id == user.id, DailyStat.date == req_date))
            st_row = st_res.scalar_one_or_none()
            if not st_row:
                st_row = DailyStat(user_id=user.id, date=req_date)
                db.add(st_row)
            st_row.steps = stats.get("totalSteps")
            st_row.step_goal = stats.get("dailyStepGoal")
            st_row.calories_total = stats.get("totalKilocalories")
            st_row.calories_active = stats.get("activeKilocalories")
            st_row.distance_m = stats.get("totalDistanceMeters")
            st_row.intensity_minutes = (stats.get("moderateIntensityMinutes") or 0) + (stats.get("vigorousIntensityMinutes") or 0) * 2
            st_row.floors_m = stats.get("floorsAscendedInMeters")
            st_row.sedentary_seconds = stats.get("sedentarySeconds")
    except Exception as e:
        logger.warning(f"Sin daily stats para {user.username}: {e}")

    # 2. Actividades
    activities = service.get_activities(limit=activity_limit)
    inserted = 0
    for act in activities:
        start_time = _parse_start_time(act.get("start_time"))
        if start_time is None or not act.get("id"):
            continue
        existing = await db.execute(select(Activity.id).where(Activity.id == act["id"]))
        if existing.scalar_one_or_none():
            continue
        duration = int(act.get("duration_seconds") or 0)
        tss = FatigueEngine.calculate_garmin_tss(
            duration_seconds=duration, epoc=act.get("garmin_epoc"),
            avg_hr=act.get("avg_hr"))
        row = Activity(
            id=act["id"], user_id=user.id, source="garmin",
            activity_type=(act.get("activity_type") or "unknown").lower(),
            activity_name=act.get("activity_name"), start_time=start_time,
            duration_seconds=duration,
            distance_meters=float(act.get("distance_meters") or 0.0),
            avg_hr=act.get("avg_hr"), max_hr=act.get("max_hr"),
            training_load_tss=tss)
        db.add(row)
        inserted += 1

    # 2b. PRs sobre TODO el historial (barato a escala personal; así las
    # cuentas existentes también obtienen marcas sin re-sincronizar)
    prs_updated = 0
    try:
        all_res = await db.execute(select(Activity).where(Activity.user_id == user.id))
        prs_updated = await _detect_prs(db, user, list(all_res.scalars().all()))
    except Exception as e:
        logger.warning(f"PRs omitidos para {user.username}: {e}")

    # 2c. Enriquecer las GPS recientes sin detalle (máx 5 por sync para no
    # saturar a Garmin): así Zonas y Rendimiento se llenan solos.
    try:
        from app.api.v1.activities import _enrich_from_garmin as _enrich
        gap_res = await db.execute(select(Activity).where(
            Activity.user_id == user.id,
            Activity.source == "garmin",
            Activity.detail_fetched_at.is_(None),
        ).order_by(Activity.start_time.desc()).limit(5))
        for act in gap_res.scalars().all():
            try:
                await _enrich(act, user)
            except Exception as e:
                logger.warning(f"Enrich omitido para {act.id}: {e}")
    except Exception as e:
        logger.warning(f"Enriquecido auto omitido para {user.username}: {e}")

    # 3. Banister + readiness real
    banister_start = req_date - timedelta(days=42)
    banister_start_dt = datetime.combine(banister_start, datetime.min.time())
    acts_res = await db.execute(select(Activity).where(
        Activity.user_id == user.id, Activity.start_time >= banister_start_dt))
    daily_tss: Dict[Any, float] = {}
    for act in acts_res.scalars().all():
        d = act.start_time.date()
        daily_tss[d] = daily_tss.get(d, 0.0) + (act.training_load_tss or 0.0)
    series = FatigueEngine.compute_daily_banister(daily_tss, banister_start, req_date)
    today_m = series[req_date]

    fat_res = await db.execute(select(FatigueMetric).where(
        FatigueMetric.user_id == user.id, FatigueMetric.date == req_date))
    fat_row = fat_res.scalar_one_or_none()
    if not fat_row:
        fat_row = FatigueMetric(user_id=user.id, date=req_date)
        db.add(fat_row)
    fat_row.atl, fat_row.ctl, fat_row.tsb = today_m["atl"], today_m["ctl"], today_m["tsb"]

    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio_row.sleep_score, hrv_overnight=bio_row.hrv_overnight_avg,
        hrv_weekly_avg=bio_row.hrv_weekly_avg, tsb=today_m["tsb"])
    bio_row.readiness_score = readiness["score"]

    if cred:
        cred.last_sync_at = datetime.utcnow()
        cred.needs_reauth = False

    await db.commit()
    return {
        "biometrics": {k: v for k, v in biometrics.items() if k != "raw"},
        "activities_inserted": inserted,
        "prs_updated": prs_updated,
        "backfilled": activity_limit > 20,
        "readiness": readiness,
        "fatigue_today": today_m,
    }
