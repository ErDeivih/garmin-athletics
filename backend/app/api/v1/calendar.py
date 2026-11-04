"""Calendario: eventos planificados + recurrentes semanales + vista unificada."""
import uuid
from datetime import date, datetime, time, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import CalendarEvent, Activity, DailyBiometrics, User
from app.api.deps import require_current_user
from app.services.fatigue_engine import FatigueEngine

router = APIRouter(prefix="/calendar", tags=["Calendar"])


class EventCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, example="Partido fútbol 7")
    event_type: str = Field("soccer", pattern="^(soccer|planned_workout|race|rest|strength)$")
    start_local: datetime = Field(..., description="Fecha y hora local")
    duration_min: int = Field(60, ge=15, le=600)
    weekday: Optional[int] = Field(None, ge=0, le=6, description="0=lunes..6=domingo: lo hace recurrente semanal")
    is_immovable: bool = Field(False, description="El GymAdvisor lo respeta (sin pierna 48h alrededor)")
    notes: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    event_type: Optional[str] = Field(None, pattern="^(soccer|planned_workout|race|rest|strength)$")
    start_local: Optional[datetime] = None
    duration_min: Optional[int] = Field(None, ge=15, le=600)
    weekday: Optional[int] = Field(None, ge=0, le=6)
    is_immovable: Optional[bool] = None
    notes: Optional[str] = None


def _serialize(ev: CalendarEvent) -> Dict[str, Any]:
    return {"id": ev.id, "title": ev.title, "event_type": ev.event_type,
            "start": ev.start_local.isoformat(), "duration_min": ev.duration_min,
            "weekday": ev.weekday, "is_immovable": ev.is_immovable,
            "notes": ev.notes}


def _occurrences(ev: CalendarEvent, start_d: date, end_d: date) -> List[Dict[str, Any]]:
    """Expande eventos recurrentes semanales en el rango (solo lectura)."""
    if ev.weekday is None:
        return [_serialize(ev)] if start_d <= ev.start_local.date() <= end_d else []
    out = []
    day = start_d
    while day <= end_d:
        if day.weekday() == ev.weekday:
            occ = datetime.combine(day, ev.start_local.time())
            out.append({"id": ev.id, "title": ev.title, "event_type": ev.event_type,
                        "start": occ.isoformat(), "duration_min": ev.duration_min,
                        "weekday": ev.weekday, "is_immovable": ev.is_immovable,
                        "notes": ev.notes, "recurring": True})
        day += timedelta(days=1)
    return out


@router.get("/", summary="Vista calendario: eventos + actividades + readiness por día")
async def get_calendar(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    if (to_date - from_date).days > 120:
        raise HTTPException(status_code=400, detail="Rango máximo 120 días.")
    ev_res = await db.execute(select(CalendarEvent).where(CalendarEvent.user_id == user.id))
    events = ev_res.scalars().all()

    act_res = await db.execute(select(Activity).where(
        Activity.user_id == user.id,
        Activity.start_time >= datetime.combine(from_date, time.min),
        Activity.start_time < datetime.combine(to_date + timedelta(days=1), time.min)))
    acts = act_res.scalars().all()

    bio_res = await db.execute(select(DailyBiometrics).where(
        DailyBiometrics.user_id == user.id,
        DailyBiometrics.date >= from_date, DailyBiometrics.date <= to_date))
    bio_map = {b.date: b for b in bio_res.scalars().all()}

    days = []
    day = from_date
    while day <= to_date:
        day_events = []
        for ev in events:
            day_events.extend([o for o in _occurrences(ev, day, day)])
        day_acts = [{
            "id": a.id, "name": a.activity_name, "type": a.activity_type,
            "start": a.start_time.isoformat(),
            "duration_min": round((a.duration_seconds or 0) / 60, 1),
            "tss": a.training_load_tss} for a in acts if a.start_time.date() == day]
        bio = bio_map.get(day)
        readiness = None
        if bio and bio.readiness_score is not None:
            readiness = {"score": bio.readiness_score,
                         "status": ("VERDE" if bio.readiness_score >= 75
                                    else "AMARILLO" if bio.readiness_score >= 50 else "ROJO")}
        days.append({"date": day.isoformat(), "events": day_events,
                     "activities": day_acts, "readiness": readiness})
        day += timedelta(days=1)
    return {"from": from_date.isoformat(), "to": to_date.isoformat(), "days": days}


@router.post("/events", status_code=status.HTTP_201_CREATED, summary="Crear evento")
async def create_event(
    payload: EventCreate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    ev = CalendarEvent(id=str(uuid.uuid4()), user_id=user.id,
                       title=payload.title.strip(), event_type=payload.event_type,
                       start_local=payload.start_local,
                       duration_min=payload.duration_min,
                       weekday=payload.weekday,
                       is_immovable=payload.is_immovable, notes=payload.notes)
    db.add(ev)
    await db.commit()
    return {"status": "created", "id": ev.id}


@router.put("/events/{event_id}", summary="Editar evento")
async def update_event(
    event_id: str,
    payload: EventUpdate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(CalendarEvent).where(
        CalendarEvent.id == event_id, CalendarEvent.user_id == user.id))
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"]:
        data["title"] = data["title"].strip()
    for k, v in data.items():
        setattr(ev, k, v)
    await db.commit()
    return {"status": "updated", "id": ev.id}


@router.delete("/events/{event_id}", summary="Borrar evento")
async def delete_event(
    event_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(CalendarEvent).where(
        CalendarEvent.id == event_id, CalendarEvent.user_id == user.id))
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    await db.delete(ev)
    await db.commit()
    return {"status": "removed"}


def upcoming_immovable(db_events: List[CalendarEvent], ref: datetime,
                       hours: int = 48) -> List[CalendarEvent]:
    """Eventos inamovibles en ±hours alrededor de ref (para GymAdvisor/avisos)."""
    out = []
    for ev in db_events:
        if not ev.is_immovable:
            continue
        if ev.weekday is not None:
            # Próxima ocurrencia semanal
            days_ahead = (ev.weekday - ref.weekday()) % 7
            occ = datetime.combine(ref.date(), time.min) + timedelta(days=days_ahead)
            occ = occ.replace(hour=ev.start_local.hour, minute=ev.start_local.minute)
            if abs((occ - ref).total_seconds()) <= hours * 3600:
                out.append(ev)
        elif abs((ev.start_local - ref).total_seconds()) <= hours * 3600:
            out.append(ev)
    return out
