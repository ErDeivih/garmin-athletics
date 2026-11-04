"""Rutas planificadas (Fase 7): guardar, listar, exportar a GPX."""
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


def _gpx(name: str, lat: List[float], lon: List[float], ele: Optional[List]) -> str:
    pts = []
    for i, (la, lo) in enumerate(zip(lat, lon)):
        e = (ele or [None] * len(lat))[i] if ele else None
        el = f"<ele>{e:.1f}</ele>" if e is not None else ""
        pts.append(f"<trkpt lat=\"{la:.6f}\" lon=\"{lo:.6f}\">{el}</trkpt>")
    return ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<gpx version=\"1.1\" creator=\"GarminAthletics\">"
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
