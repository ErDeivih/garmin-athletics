"""Zonas de privacidad GPS: recortan inicio/fin de tracks y exports."""
import uuid
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import PrivacyZone, User
from app.api.deps import require_current_user

router = APIRouter(prefix="/privacy-zones", tags=["Privacy Zones"])


class ZoneCreate(BaseModel):
    label: str = Field("Casa", min_length=1, max_length=100)
    center_lat: float = Field(..., ge=-90, le=90)
    center_lon: float = Field(..., ge=-180, le=180)
    radius_m: int = Field(200, ge=50, le=5000)


@router.get("/", summary="Listar mis zonas de privacidad")
async def list_zones(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    res = await db.execute(select(PrivacyZone).where(PrivacyZone.user_id == user.id))
    return [{"id": z.id, "label": z.label, "center_lat": z.center_lat,
             "center_lon": z.center_lon, "radius_m": z.radius_m}
            for z in res.scalars().all()]


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Crear zona de privacidad")
async def create_zone(
    payload: ZoneCreate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    zone = PrivacyZone(id=str(uuid.uuid4()), user_id=user.id,
                       label=payload.label.strip(),
                       center_lat=payload.center_lat,
                       center_lon=payload.center_lon,
                       radius_m=payload.radius_m)
    db.add(zone)
    await db.commit()
    return {"status": "created", "id": zone.id}


@router.delete("/{zone_id}", summary="Borrar zona de privacidad")
async def delete_zone(
    zone_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(PrivacyZone).where(
        PrivacyZone.id == zone_id, PrivacyZone.user_id == user.id))
    zone = res.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zona no encontrada.")
    await db.delete(zone)
    await db.commit()
    return {"status": "removed"}


async def get_user_zones(db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
    res = await db.execute(select(PrivacyZone).where(PrivacyZone.user_id == user_id))
    return [{"center_lat": z.center_lat, "center_lon": z.center_lon,
             "radius_m": z.radius_m} for z in res.scalars().all()]
