import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Activity
from app.api.deps import get_current_user
from app.db.models import User
from app.services.fatigue_engine import FatigueEngine

router = APIRouter(prefix="/activities", tags=["Activities & Workout Logging"])
class ManualActivityCreate(BaseModel):
    activity_type: str = Field(..., example="soccer", description="Tipo de actividad ('soccer', 'running', 'strength')")
    activity_name: str = Field(..., example="Partido de Fútbol 7", description="Nombre descriptivo")
    start_time: datetime = Field(default_factory=datetime.utcnow, description="Fecha y hora")
    duration_minutes: float = Field(..., ge=5, le=300, example=90, description="Duración en minutos")
    rpe: Optional[int] = Field(None, ge=1, le=10, example=8, description="Esfuerzo percibido (1 a 10)")
    distance_meters: Optional[float] = Field(0.0, description="Distancia estimada en metros")
    notes: Optional[str] = None

@router.post("/manual", summary="Registrar una actividad manual (Fútbol / Gimnasio sin GPS)")
async def create_manual_activity(
    payload: ManualActivityCreate,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    # 1. Calcular TSS según el deporte
    if payload.activity_type.lower() == "soccer" or payload.rpe is not None:
        rpe_val = payload.rpe or 7
        tss = FatigueEngine.calculate_foster_tss(payload.duration_minutes, rpe_val)
    else:
        tss = FatigueEngine.calculate_garmin_tss(int(payload.duration_minutes * 60))

    new_act = Activity(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        source="manual",
        activity_type=payload.activity_type.lower(),
        activity_name=payload.activity_name,
        start_time=payload.start_time,
        duration_seconds=int(payload.duration_minutes * 60),
        distance_meters=payload.distance_meters or 0.0,
        rpe=payload.rpe,
        training_load_tss=tss
    )

    db.add(new_act)
    await db.commit()
    await db.refresh(new_act)

    return {
        "status": "created",
        "activity_id": new_act.id,
        "calculated_tss": tss,
        "activity": {
            "name": new_act.activity_name,
            "type": new_act.activity_type,
            "duration_min": payload.duration_minutes,
            "tss": tss
        }
    }

@router.get("/", summary="Listar actividades (filtros + paginación)")
async def list_activities(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    sport: Optional[str] = Query(default=None, description="running|cycling|swimming|soccer|strength"),
    from_date: Optional[date] = Query(default=None, alias="from"),
    to_date: Optional[date] = Query(default=None, alias="to"),
    q: Optional[str] = Query(default=None, description="Texto en el nombre"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> List[Dict[str, Any]]:
    from datetime import timedelta as _td
    query = select(Activity)
    if user:
        # Datos propios + registros legacy sin propietario (compatibilidad single-user)
        query = query.where(or_(Activity.user_id == user.id, Activity.user_id.is_(None)))
    else:
        query = query.where(Activity.user_id.is_(None))
    if from_date:
        query = query.where(Activity.start_time >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.where(Activity.start_time < datetime.combine(to_date + _td(days=1), datetime.min.time()))
    result = await db.execute(query.order_by(Activity.start_time.desc()).limit(2000))
    activities = result.scalars().all()

    needle = (q or "").strip().lower()
    patterns = {
        "running": ("run", "trail", "treadmill"),
        "cycling": ("cycl", "bik", "mtb"),
        "swimming": ("swim",),
        "soccer": ("soccer", "futbol", "fútbol"),
        "strength": ("strength", "gym"),
    }
    filtered = []
    for act in activities:
        t = (act.activity_type or "").lower()
        if sport and sport != "all":
            if not any(p in t for p in patterns.get(sport, (sport,))):
                continue
        if needle and needle not in (act.activity_name or "").lower():
            continue
        filtered.append(act)

    if response is not None:
        response.headers["X-Total-Count"] = str(len(filtered))
    page = filtered[offset:offset + limit]
    return [
        {
            "id": act.id,
            "source": act.source,
            "type": act.activity_type,
            "name": act.activity_name,
            "start_time": act.start_time.isoformat(),
            "duration_min": round(act.duration_seconds / 60.0, 1),
            "distance_m": act.distance_meters,
            "avg_hr": act.avg_hr,
            "max_hr": act.max_hr,
            "gain_m": act.elevation_gain_m,
            "has_track": bool(act.has_track),
            "tss": act.training_load_tss,
            "rpe": act.rpe
        }
        for act in page
    ]


def _act_scope(user: Optional[User]):
    if user:
        return or_(Activity.user_id == user.id, Activity.user_id.is_(None))
    return Activity.user_id.is_(None)


async def _enrich_from_garmin(act: Activity, user: Optional[User], force: bool = False) -> Dict[str, Any]:
    """Descarga detalle de Garmin y lo cachea en BD + disco. Nunca lanza."""
    from app.core.config import settings as _settings
    from app.services.garmin_service import GarminService as _GSvc
    from app.services import track_service as _tsvc

    # Solo actividades Garmin con id numérico se pueden enriquecer
    laps: List[Dict[str, Any]] = []
    if act.source != "garmin" or not str(act.id).isdigit():
        return {"laps": laps, "track_ready": False}

    if act.detail_fetched_at and not force:
        return {"laps": [], "track_ready": bool(act.has_track)}

    try:
        if user:
            svc = _GSvc(email=None, password=None,
                        token_dir=f"{_settings.GARMIN_TOKENS_DIR}_{user.id}",
                        use_env_fallback=False)
        else:
            svc = _GSvc()
        full = svc.get_activity_full(str(act.id))

        laps = _tsvc.normalize_laps(full.get("splits"))
        zones = _tsvc.normalize_hr_zones(full.get("hr_zones"))
        weather = _tsvc.normalize_weather(full.get("weather"))

        # Agregados desde las vueltas (más fiables que la lista básica)
        if laps:
            total_gain = sum(l.get("gain_m") or 0 for l in laps)
            total_loss = sum(l.get("loss_m") or 0 for l in laps)
            hrs = [l["avg_hr"] for l in laps if l.get("avg_hr")]
            if total_gain:
                act.elevation_gain_m = round(total_gain, 1)
            if total_loss:
                act.elevation_loss_m = round(total_loss, 1)
            if hrs:
                act.avg_hr = int(sum(hrs) / len(hrs))
            cals = sum(l.get("calories") or 0 for l in laps)
            if cals:
                act.calories = round(cals, 1)

        track = _tsvc.build_track(full.get("details") or {})
        if track:
            track["laps"] = laps  # las vueltas viajan en el fichero (no hay columna)
            path = _tsvc.save_track(
                f"{_settings.TRACKS_DIR}/tracks", act.user_id, str(act.id), track)
            act.has_track = True
            act.track_path = path
            if track.get("bbox"):
                (act.bbox_min_lat, act.bbox_min_lon,
                 act.bbox_max_lat, act.bbox_max_lon) = track["bbox"]
            if track.get("gain_m") and not act.elevation_gain_m:
                act.elevation_gain_m = track["gain_m"]
                act.elevation_loss_m = track["loss_m"]

        if zones:
            act.hr_zones = zones
        if weather:
            act.weather = weather
        from datetime import datetime as _dt
        act.detail_fetched_at = _dt.utcnow()
        return {"laps": laps, "track_ready": bool(track)}
    except Exception as e:
        import logging as _logging
        _logging.getLogger("activities").warning(f"Enriquecido falló para {act.id}: {e}")
        return {"laps": laps, "track_ready": bool(act.has_track)}


@router.get("/{activity_id}", summary="Detalle completo de una actividad")
async def activity_detail(
    activity_id: str,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    fresh = await _enrich_from_garmin(act, user)
    await db.commit()

    laps = fresh["laps"]
    if not laps and act.has_track:        # Vueltas cacheadas en el fichero del track
        from app.core.config import settings as _settings2
        from app.services import track_service as _tsvc2
        cached = _tsvc2.load_track(f"{_settings2.TRACKS_DIR}/tracks", act.user_id, str(act.id))
        if cached:
            laps = cached.get("laps", [])

    min_alt = max_alt = None
    avg_speed = act.avg_speed_kmh
    if avg_speed is None and act.distance_meters and act.duration_seconds:
        avg_speed = round((act.distance_meters / 1000) / (act.duration_seconds / 3600), 1)
    if act.has_track:
        try:
            from app.core.config import settings as _settings3
            from app.services import track_service as _tsvc3
            _cached = _tsvc3.load_track(f"{_settings3.TRACKS_DIR}/tracks", act.user_id, str(act.id))
            _eles = [e for e in ((_cached or {}).get("points", {}).get("ele", [])) if e is not None]
            if _eles:
                min_alt, max_alt = round(min(_eles), 1), round(max(_eles), 1)
        except Exception:
            pass
    return {
        "id": act.id,
        "source": act.source,
        "type": act.activity_type,
        "name": act.activity_name,
        "start_time": act.start_time.isoformat(),
        "duration_min": round(act.duration_seconds / 60.0, 1),
        "distance_m": act.distance_meters,
        "avg_hr": act.avg_hr,
        "max_hr": act.max_hr,
        "avg_cadence": act.avg_cadence,
        "avg_power": act.avg_power,
        "avg_speed_kmh": avg_speed,
        "calories": act.calories,
        "gain_m": act.elevation_gain_m,
        "loss_m": act.elevation_loss_m,
        "min_alt": min_alt,
        "max_alt": max_alt,
        "tss": act.training_load_tss,
        "rpe": act.rpe,
        "has_track": bool(act.has_track),
        "bbox": ([act.bbox_min_lat, act.bbox_min_lon, act.bbox_max_lat, act.bbox_max_lon]
                 if act.bbox_min_lat is not None else None),
        "hr_zones": act.hr_zones,
        "weather": act.weather,
        "laps": laps,
    }


@router.get("/{activity_id}/track", summary="Track GPS simplificado + streams")
async def activity_track(
    activity_id: str,
    max_points: int = 2000,
    crop: bool = Query(default=True, description="Aplicar zonas de privacidad"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    from app.core.config import settings as _settings
    from app.services import track_service as _tsvc

    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    if not act.has_track:
        await _enrich_from_garmin(act, user)
        await db.commit()
    track = _tsvc.load_track(f"{_settings.TRACKS_DIR}/tracks", act.user_id, str(act.id))
    if not track:
        raise HTTPException(status_code=404, detail="Esta actividad no tiene track GPS.")
    pts = await _cropped_points(track, user, db, crop)
    n = len(pts.get("lat", []))
    if n > max_points:
        # Douglas-Peucker primero (conserva la forma), uniforme después
        coords = list(zip(pts["lat"], pts["lon"]))
        keep = _tsvc.douglas_peucker(coords, _tsvc.DP_EPSILON)
        if len(keep) > max_points:
            step = len(keep) / max_points
            keep = sorted({keep[int(i * step)] for i in range(max_points)})
        pts = {k: [v[i] for i in keep] for k, v in pts.items()}
    return {
        "activity_id": act.id,
        "point_count": track.get("point_count"),
        "distance_m": track.get("distance_m"),
        "gain_m": track.get("gain_m"),
        "loss_m": track.get("loss_m"),
        "bbox": track.get("bbox"),
        "privacy_cropped": crop,
        "points": pts,
    }


@router.post("/{activity_id}/refresh", summary="Forzar re-descarga del detalle desde Garmin")
async def activity_refresh(
    activity_id: str,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    fresh = await _enrich_from_garmin(act, user, force=True)
    await db.commit()
    return {"status": "ok", "track_ready": fresh["track_ready"], "laps": len(fresh["laps"])}


async def _load_track_or_404(act: Activity, user: Optional[User],
                             db: AsyncSession, fill_ele: bool = False) -> Dict[str, Any]:
    from app.core.config import settings as _settings
    from app.services import track_service as _tsvc
    if not act.has_track:
        await _enrich_from_garmin(act, user)
        await db.commit()
    base = f"{_settings.TRACKS_DIR}/tracks"
    if fill_ele:
        track = _tsvc.ensure_track_elevation(base, act.user_id, str(act.id))
    else:
        track = _tsvc.load_track(base, act.user_id, str(act.id))
    if not track:
        raise HTTPException(status_code=404, detail="Esta actividad no tiene track GPS.")
    # Sincroniza desnivel a la fila si el fichero ya lo tiene y la fila no
    try:
        if track.get("gain_m") and not act.elevation_gain_m:
            act.elevation_gain_m = track["gain_m"]
            act.elevation_loss_m = track["loss_m"]
            await db.commit()
    except Exception:
        pass
    return track


async def _cropped_points(track: Dict[str, Any], user: Optional[User],
                          db: AsyncSession, crop: bool) -> Dict[str, Any]:
    """Aplica zonas de privacidad al track (recorte inicio/fin)."""
    from app.services import track_service as _tsvc
    pts = track.get("points", {})
    if not crop or user is None:
        return pts
    from app.api.v1.privacy import get_user_zones
    zones = await get_user_zones(db, user.id)
    if not zones:
        return pts
    keep = _tsvc.crop_privacy(pts.get("lat", []), pts.get("lon", []), zones)
    if len(keep) < 2:
        raise HTTPException(status_code=404,
                            detail="El track queda vacío tras aplicar tus zonas de privacidad.")
    return {k: [v[i] for i in keep] for k, v in pts.items()}


@router.get("/{activity_id}/streams", summary="Series temporales (FC, ritmo, altitud, velocidad)")
async def activity_streams(
    activity_id: str,
    max_points: int = Query(default=500, ge=10, le=2000),
    crop: bool = Query(default=True, description="Aplicar zonas de privacidad"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    from app.services import track_service as _tsvc
    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    track = await _load_track_or_404(act, user, db)
    pts = await _cropped_points(track, user, db, crop)
    return {"activity_id": act.id, **_tsvc.build_streams({**track, "points": pts}, max_points)}


@router.get("/{activity_id}/splits", summary="Parciales por kilómetro calculados del track")
async def activity_splits(
    activity_id: str,
    crop: bool = Query(default=True),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    from app.services import track_service as _tsvc
    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    track = await _load_track_or_404(act, user, db)
    pts = await _cropped_points(track, user, db, crop)
    return {"activity_id": act.id, "splits": _tsvc.build_km_splits({**track, "points": pts})}


@router.get("/{activity_id}/export", summary="Descargar la actividad en GPX")
async def activity_export(
    activity_id: str,
    crop: bool = Query(default=True, description="Aplicar zonas de privacidad"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response as _Response
    from app.services import track_service as _tsvc
    res = await db.execute(
        select(Activity).where(Activity.id == activity_id, _act_scope(user)))
    act = res.scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")
    track = await _load_track_or_404(act, user, db)
    pts = await _cropped_points(track, user, db, crop)
    gpx = _tsvc.build_gpx(act.activity_name or "actividad",
                          pts.get("lat", []), pts.get("lon", []), pts.get("ele"))
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in (act.activity_name or "actividad"))[:60]
    return _Response(content=gpx, media_type="application/gpx+xml",
                     headers={"Content-Disposition": f"attachment; filename=\"{safe}.gpx\""})
