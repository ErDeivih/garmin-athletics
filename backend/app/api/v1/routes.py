"""Rutas planificadas: guardar, generar, exportar a GPX y preparar para el reloj."""
import math
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.db.models import Route, Activity, User
from app.api.deps import require_current_user
from app.services import track_service as tsvc

router = APIRouter(prefix="/routes", tags=["Planned Routes"])


def _routes_dir(user_id: str) -> str:
    folder = os.path.join(settings.TRACKS_DIR, "routes", user_id)
    os.makedirs(folder, exist_ok=True)
    return folder


class RouteCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    sport: str = Field("cycling", pattern="^(cycling|running|hiking)$")
    lat: List[float] = Field(..., min_length=2)
    lon: List[float] = Field(..., min_length=2)
    ele: Optional[List[Optional[float]]] = None


class RoutePoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    ele: Optional[float] = None


class RouteGenerate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    sport: str = Field("running", pattern="^(cycling|running|hiking)$")
    start: RoutePoint
    checkpoints: List[RoutePoint] = Field(..., min_length=1, max_length=12)
    distance_km: float = Field(8, ge=1, le=200)
    effort: str = Field("moderate", pattern="^(easy|moderate|hard)$")
    loop: bool = False


def _distance_m(points: List[RoutePoint]) -> float:
    return sum(tsvc._haversine_m(points[i - 1].lat, points[i - 1].lon,
                                 points[i].lat, points[i].lon)
               for i in range(1, len(points)))


def _smooth_route(points: List[RoutePoint], per_segment: int = 45) -> List[Dict[str, float]]:
    """Interpola los checkpoints con una curva suave y determinista."""
    out: List[Dict[str, float]] = []
    for index in range(1, len(points)):
        a, b = points[index - 1], points[index]
        dlat, dlon = b.lat - a.lat, b.lon - a.lon
        length = math.hypot(dlat, dlon) or 1.0
        # Separación perpendicular pequeña: la ruta no es una línea recta.
        off_lat = -dlon / length * 0.0009
        off_lon = dlat / length * 0.0009
        for step in range(per_segment):
            t = step / per_segment
            bend = math.sin(math.pi * t) * (0.35 + 0.25 * index)
            out.append({
                "lat": a.lat + dlat * t + off_lat * bend,
                "lon": a.lon + dlon * t + off_lon * bend,
            })
    out.append({"lat": points[-1].lat, "lon": points[-1].lon})
    return out


def _elevations(points: List[Dict[str, float]], checkpoints: List[RoutePoint]) -> List[float]:
    known = [p.ele for p in checkpoints if p.ele is not None]
    base = known[0] if known else 120.0
    span = max(known) - min(known) if len(known) > 1 else 60.0
    out = []
    for index, _ in enumerate(points):
        progress = index / max(1, len(points) - 1)
        if known and len(known) >= 2:
            out.append(round(known[0] + span * math.sin(math.pi * progress) * 0.8, 1))
        else:
            out.append(round(base + 25 * math.sin(progress * math.pi * 2) + 14 * math.sin(progress * math.pi * 5), 1))
    return out


def _splits(points: List[Dict[str, float]], ele: List[float], sport: str, effort: str) -> List[Dict[str, Any]]:
    speed_kmh = {"easy": 9.0, "moderate": 11.0, "hard": 13.0}[effort]
    if sport == "cycling":
        speed_kmh = {"easy": 22.0, "moderate": 26.0, "hard": 31.0}[effort]
    splits = []
    total = 0.0
    km = 1
    start_index = 0
    for index in range(1, len(points)):
        total += tsvc._haversine_m(points[index - 1]["lat"], points[index - 1]["lon"],
                                   points[index]["lat"], points[index]["lon"])
        if total >= km * 1000 or index == len(points) - 1:
            distance = total - (km - 1) * 1000
            seg_ele = ele[start_index:index + 1]
            gain, _ = tsvc.gain_loss(seg_ele)
            pace_s = (distance / 1000) / speed_kmh * 3600 if sport != "cycling" else 0
            speed = speed_kmh
            duration_s = round(pace_s) if sport != "cycling" else round(distance / 1000 / speed_kmh * 3600)
            splits.append({
                "km": km,
                "distance_m": round(distance),
                "gain_m": gain,
                "pace": f"{int(pace_s // 60)}:{int(pace_s % 60):02d} /km" if sport != "cycling" else None,
                "speed_kmh": round(speed, 1),
                "duration_s": duration_s,
            })
            km += 1
            start_index = index
    return splits


@router.post("/generate", summary="Generar una ruta con checkpoints, desnivel y parciales")
async def generate_route(
    payload: RouteGenerate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    waypoints = [payload.start] + payload.checkpoints
    if payload.loop:
        waypoints.append(payload.start)
    if len(waypoints) < 2:
        raise HTTPException(status_code=400, detail="Añade al menos un punto de paso.")
    points = _smooth_route(waypoints)
    current = sum(tsvc._haversine_m(points[i - 1]["lat"], points[i - 1]["lon"],
                                    points[i]["lat"], points[i]["lon"]) for i in range(1, len(points)))
    target_m = payload.distance_km * 1000
    if current > 50 and target_m > 0:
        # Ajusta la escala alrededor del inicio para que la distancia pedida sea
        # la de verdad; los puntos de paso se mueven con la ruta.
        factor = max(0.25, min(6.0, target_m / current))
        origin = waypoints[0]
        points = [{"lat": origin.lat + (point["lat"] - origin.lat) * factor,
                   "lon": origin.lon + (point["lon"] - origin.lon) * factor} for point in points]
        waypoints = [RoutePoint(lat=origin.lat + (p.lat - origin.lat) * factor,
                                lon=origin.lon + (p.lon - origin.lon) * factor,
                                ele=p.ele) for p in waypoints]
    ele = _elevations(points, waypoints)
    dist = sum(tsvc._haversine_m(points[i - 1]["lat"], points[i - 1]["lon"],
                                 points[i]["lat"], points[i]["lon"]) for i in range(1, len(points)))
    gain, loss = tsvc.gain_loss(ele)
    splits = _splits(points, ele, payload.sport, payload.effort)
    rid = str(uuid.uuid4())
    path = os.path.join(_routes_dir(user.id), f"{rid}.json")
    route_payload = {
        "lat": [round(p["lat"], 6) for p in points],
        "lon": [round(p["lon"], 6) for p in points],
        "ele": ele,
        "splits": splits,
        "effort": payload.effort,
        "estimated_duration_s": sum(item["duration_s"] for item in splits),
        "checkpoints": [p.model_dump() for p in waypoints],
    }
    import json as _json
    with open(path, "w", encoding="utf-8") as f:
        _json.dump(route_payload, f)
    route = Route(id=rid, user_id=user.id, name=payload.name.strip(), sport=payload.sport,
                  distance_meters=round(dist, 1), gain_m=gain, point_count=len(points), file_path=path)
    db.add(route)
    await db.commit()
    return {
        "status": "generated",
        "id": rid,
        "name": route.name,
        "sport": route.sport,
        "distance_m": round(dist, 1),
        "gain_m": gain,
        "loss_m": loss,
        "effort": payload.effort,
        "lat": route_payload["lat"],
        "lon": route_payload["lon"],
        "ele": route_payload["ele"],
        "splits": splits,
        "checkpoints": route_payload["checkpoints"],
        "estimated_duration_s": route_payload["estimated_duration_s"],
    }


def _gpx(name: str, lat: List[float], lon: List[float], ele: Optional[List]) -> str:
    pts = []
    for i, (la, lo) in enumerate(zip(lat, lon)):
        e = (ele or [None] * len(lat))[i] if ele else None
        el = f"<ele>{e:.1f}</ele>" if e is not None else ""
        pts.append(f"<trkpt lat=\"{la:.6f}\" lon=\"{lo:.6f}\">{el}</trkpt>")
    return ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<gpx version=\"1.1\" creator=\"PULSO\">"
            f"<trk><name>{name}</name><trkseg>{''.join(pts)}</trkseg></trk></gpx>")


@router.get("/", summary="Listar mis rutas planificadas")
async def list_routes(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    res = await db.execute(
        select(Route).where(or_(Route.user_id == user.id, Route.user_id.is_(None)))
        .order_by(Route.created_at.desc()))
    return [{
        "id": r.id, "name": r.name, "sport": r.sport,
        "distance_m": r.distance_meters, "gain_m": r.gain_m,
        "points": r.point_count,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in res.scalars().all()]


@router.post("/", summary="Guardar una ruta planificada (puntos del mapa)")
async def create_route(
    payload: RouteCreate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    if len(payload.lat) != len(payload.lon):
        raise HTTPException(status_code=400, detail="lat y lon deben tener igual longitud.")
    dist = sum(tsvc._haversine_m(payload.lat[i - 1], payload.lon[i - 1], payload.lat[i], payload.lon[i])
               for i in range(1, len(payload.lat)))
    gain, _ = tsvc.gain_loss([e for e in (payload.ele or []) if e is not None]) if payload.ele else (0.0, 0.0)
    rid = str(uuid.uuid4())
    path = os.path.join(_routes_dir(user.id), f"{rid}.json")
    import json as _json
    with open(path, "w", encoding="utf-8") as f:
        _json.dump({"lat": payload.lat, "lon": payload.lon, "ele": payload.ele}, f)
    route = Route(id=rid, user_id=user.id, name=payload.name.strip(), sport=payload.sport,
                  distance_meters=round(dist, 1), gain_m=gain,
                  point_count=len(payload.lat), file_path=path)
    db.add(route)
    await db.commit()
    return {"status": "saved", "id": rid, "distance_m": round(dist, 1), "gain_m": gain}


def _load_route_file(route: Route) -> Dict[str, Any]:
    import json as _json
    with open(route.file_path, encoding="utf-8") as f:
        return _json.load(f)


@router.get("/{route_id}", summary="Obtener una ruta con sus puntos")
async def get_route(
    route_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(Route).where(
        Route.id == route_id, or_(Route.user_id == user.id, Route.user_id.is_(None))))
    route = res.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada.")
    try:
        pts = _load_route_file(route)
    except Exception:
        raise HTTPException(status_code=500, detail="Fichero de ruta ilegible.")
    return {"id": route.id, "name": route.name, "sport": route.sport,
            "distance_m": route.distance_meters, "gain_m": route.gain_m, **pts}


@router.get("/{route_id}/export", summary="Descargar la ruta en GPX (para el reloj/Garmin Connect)")
async def export_route(
    route_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Route).where(
        Route.id == route_id, or_(Route.user_id == user.id, Route.user_id.is_(None))))
    route = res.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada.")
    try:
        pts = _load_route_file(route)
    except Exception:
        raise HTTPException(status_code=500, detail="Fichero de ruta ilegible.")
    gpx = _gpx(route.name, pts["lat"], pts["lon"], pts.get("ele"))
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in route.name)[:60]
    return Response(content=gpx, media_type="application/gpx+xml",
                    headers={"Content-Disposition": f"attachment; filename=\"{safe}.gpx\""})


@router.delete("/{route_id}", summary="Borrar una ruta")
async def delete_route(
    route_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(Route).where(
        Route.id == route_id, or_(Route.user_id == user.id, Route.user_id.is_(None))))
    route = res.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada.")
    try:
        if route.file_path and os.path.exists(route.file_path):
            os.remove(route.file_path)
    except Exception:
        pass
    await db.delete(route)
    await db.commit()
    return {"status": "removed"}


@router.post("/from-activity/{activity_id}", summary="Guardar el track de una actividad como ruta")
async def route_from_activity(
    activity_id: str,
    name: Optional[str] = Query(default=None),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(Activity).where(
        Activity.id == activity_id,
        or_(Activity.user_id == user.id, Activity.user_id.is_(None))))
    act = res.scalar_one_or_none()
    if not act or not act.has_track:
        raise HTTPException(status_code=404, detail="Actividad sin track GPS.")
    track = tsvc.load_track(f"{settings.TRACKS_DIR}/tracks", act.user_id, str(act.id))
    if not track:
        raise HTTPException(status_code=404, detail="Track ilegible.")
    pts = track.get("points", {})
    rid = str(uuid.uuid4())
    path = os.path.join(_routes_dir(user.id), f"{rid}.json")
    import json as _json
    with open(path, "w", encoding="utf-8") as f:
        _json.dump({"lat": pts.get("lat"), "lon": pts.get("lon"), "ele": pts.get("ele")}, f)
    sport = "running" if "run" in (act.activity_type or "") else "cycling"
    route = Route(id=rid, user_id=user.id, name=(name or act.activity_name or "Ruta")[:150],
                  sport=sport, distance_meters=track.get("distance_m"),
                  gain_m=track.get("gain_m"), point_count=len(pts.get("lat", [])),
                  file_path=path)
    db.add(route)
    await db.commit()
    return {"status": "saved", "id": rid}


def _parse_gpx_points(data: bytes, limit: int = 5000) -> Dict[str, list]:
    """Parsea trkpt/rtept de un GPX (con o sin namespace)."""
    import xml.etree.ElementTree as _ET
    try:
        root = _ET.fromstring(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GPX inválido: {e}")
    lat, lon, ele = [], [], []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag in ("trkpt", "rtept"):
            try:
                la, lo = float(el.attrib["lat"]), float(el.attrib["lon"])
            except (KeyError, ValueError):
                continue
            e = None
            for child in el:
                if child.tag.split("}")[-1] == "ele":
                    try:
                        e = float(child.text)
                    except (TypeError, ValueError):
                        pass
            lat.append(la)
            lon.append(lo)
            ele.append(e)
            if len(lat) >= limit:
                break
    if len(lat) < 2:
        raise HTTPException(status_code=400, detail="El GPX no contiene una ruta válida (mínimo 2 puntos).")
    return {"lat": lat, "lon": lon, "ele": ele}


@router.post("/import", summary="Importar una ruta desde un fichero GPX")
async def import_route(
    file: UploadFile = File(...),
    name: Optional[str] = Query(default=None),
    sport: str = Query(default="cycling", pattern="^(cycling|running|hiking)$"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichero demasiado grande (máx 5 MB).")
    pts = _parse_gpx_points(data)
    dist = sum(tsvc._haversine_m(pts["lat"][i - 1], pts["lon"][i - 1], pts["lat"][i], pts["lon"][i])
               for i in range(1, len(pts["lat"])))
    gain, _ = tsvc.gain_loss([e for e in pts["ele"] if e is not None])
    rid = str(uuid.uuid4())
    path = os.path.join(_routes_dir(user.id), f"{rid}.json")
    import json as _json
    with open(path, "w", encoding="utf-8") as f:
        _json.dump(pts, f)
    base = name or (file.filename or "Ruta importada")
    route = Route(id=rid, user_id=user.id, name=base[:150], sport=sport,
                  distance_meters=round(dist, 1), gain_m=gain,
                  point_count=len(pts["lat"]), file_path=path)
    db.add(route)
    await db.commit()
    return {"status": "saved", "id": rid, "distance_m": round(dist, 1),
            "gain_m": gain, "points": len(pts["lat"])}
