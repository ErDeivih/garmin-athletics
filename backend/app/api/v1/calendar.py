"""Calendario: eventos planificados + recurrentes semanales + vista unificada."""
import uuid
from datetime import date, datetime, time, timedelta
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import (
    CalendarEvent, Activity, DailyBiometrics, Exercise, User, WorkoutTemplate, TemplateExercise,
)
from app.api.deps import require_current_user
from app.services.fatigue_engine import FatigueEngine

router = APIRouter(prefix="/calendar", tags=["Calendar"])


class EventCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, example="Partido fútbol 7")
    event_type: str = Field("soccer", pattern="^(soccer|planned_workout|race|rest|strength)$")
    start_local: datetime = Field(..., description="Fecha y hora local")
    duration_min: int = Field(60, ge=15, le=600)
    weekday: Optional[int] = Field(None, ge=0, le=6, description="0=lunes..6=domingo: lo hace recurrente semanal")
    template_id: Optional[str] = Field(None, description="Plantilla de gimnasio que se cargará en el reloj")
    is_immovable: bool = Field(False, description="El GymAdvisor lo respeta (sin pierna 48h alrededor)")
    notes: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    event_type: Optional[str] = Field(None, pattern="^(soccer|planned_workout|race|rest|strength)$")
    start_local: Optional[datetime] = None
    duration_min: Optional[int] = Field(None, ge=15, le=600)
    weekday: Optional[int] = Field(None, ge=0, le=6)
    template_id: Optional[str] = None
    is_immovable: Optional[bool] = None
    notes: Optional[str] = None


def _serialize(ev: CalendarEvent) -> Dict[str, Any]:
    return {"id": ev.id, "title": ev.title, "event_type": ev.event_type,
            "start": ev.start_local.isoformat(), "duration_min": ev.duration_min,
            "weekday": ev.weekday, "template_id": ev.template_id,
            "is_immovable": ev.is_immovable,
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
                        "weekday": ev.weekday, "template_id": ev.template_id,
                        "is_immovable": ev.is_immovable,
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
                       template_id=payload.template_id,
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


# --- Envío de la plantilla del día al reloj ---------------------------------

async def _build_event_workout(db: AsyncSession, user: User, event: CalendarEvent):
    if not event.template_id:
        raise HTTPException(status_code=400, detail="Este evento no tiene una plantilla de gimnasio.")
    template = (await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == event.template_id, WorkoutTemplate.user_id == user.id))).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=404, detail="La plantilla del evento ya no existe.")
    rows = (await db.execute(select(TemplateExercise).where(
        TemplateExercise.template_id == template.id).order_by(TemplateExercise.position))).scalars().all()
    exercise_ids = [row.exercise_id for row in rows]
    exercises = (await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))).scalars().all() if exercise_ids else []
    by_id = {exercise.id: exercise for exercise in exercises}
    from app.api.v1.strength import GARMIN_EXERCISE_MAP
    from app.services.garmin_workout import build_strength_workout
    items = []
    for row in rows:
        exercise = by_id.get(row.exercise_id)
        if exercise is None:
            continue
        items.append({
            "name": exercise.name,
            "sets": row.sets,
            "reps": row.reps,
            "weight_kg": row.weight_kg,
            "rest_seconds": row.rest_seconds,
        })
    return build_strength_workout(template.name, items, GARMIN_EXERCISE_MAP)


def _next_occurrence(event: CalendarEvent, ref: date) -> date:
    if event.weekday is None:
        return event.start_local.date()
    delta = (event.weekday - ref.weekday()) % 7
    return ref + timedelta(days=delta)


def _preview_payload(built, event: CalendarEvent) -> Dict[str, Any]:
    return {
        "status": "preview",
        "event_id": event.id,
        "title": event.title,
        "unmapped_exercises": built.unmapped,
        "blocks": built.blocks,
        "estimated_seconds": built.estimated_seconds,
        "workout_json": built.workout.to_dict(),
        "target_date": _next_occurrence(event, date.today()).isoformat(),
    }


async def _garmin_service_for(db: AsyncSession, user: User):
    from app.core.config import settings as _settings
    from app.db.models import GarminCredential
    from app.services.garmin_service import GarminService
    cred = (await db.execute(select(GarminCredential).where(
        GarminCredential.user_id == user.id))).scalar_one_or_none()
    if cred is None:
        raise HTTPException(status_code=400, detail="Vincula tu cuenta para enviar entrenamientos.")
    svc = GarminService(email=cred.garmin_email, password=None,
                        token_dir=f"{_settings.GARMIN_TOKENS_DIR}_{user.id}", use_env_fallback=False)
    svc.authenticate()
    return svc


@router.post("/events/{event_id}/preview", summary="Previsualizar el entreno de un evento sin enviarlo")
async def preview_event_workout(
    event_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    event = (await db.execute(select(CalendarEvent).where(
        CalendarEvent.id == event_id, CalendarEvent.user_id == user.id))).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    built = await _build_event_workout(db, user, event)
    return _preview_payload(built, event)


@router.post("/events/{event_id}/send", summary="Subir y programar en el reloj el entreno de un evento")
async def send_event_workout(
    event_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    event = (await db.execute(select(CalendarEvent).where(
        CalendarEvent.id == event_id, CalendarEvent.user_id == user.id))).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    built = await _build_event_workout(db, user, event)
    if built.has_unmapped:
        raise HTTPException(status_code=400, detail={
            "status": "unmapped",
            "unmapped": built.unmapped,
            "message": "Hay ejercicios que no se pueden enviar.",
        })
    target = _next_occurrence(event, date.today())
    try:
        svc = await _garmin_service_for(db, user)
        sent = svc.client.upload_strength_workout(built.workout)
        workout_id = sent.get("workoutId") if isinstance(sent, dict) else None
        scheduled = None
        if workout_id is not None:
            scheduled = svc.client.schedule_workout(workout_id, target.isoformat())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo enviar: {exc}")
    event.garmin_workout_id = str(workout_id) if workout_id is not None else None
    event.last_scheduled_date = target
    await db.commit()
    return {
        "status": "sent",
        "event_id": event.id,
        "target_date": target.isoformat(),
        "garmin_response": sent,
        "scheduled": scheduled,
    }


@router.post("/sync-today", summary="Programar en el reloj los entrenos de hoy")
async def sync_today_workouts(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    today = date.today()
    events = (await db.execute(select(CalendarEvent).where(
        CalendarEvent.user_id == user.id,
        CalendarEvent.template_id.is_not(None)))).scalars().all()
    due = [event for event in events if _next_occurrence(event, today) == today]
    if not due:
        return {"status": "nothing", "sent": 0, "message": "No hay entrenamientos para hoy."}
    svc = await _garmin_service_for(db, user)
    results = []
    for event in due:
        built = await _build_event_workout(db, user, event)
        if built.has_unmapped:
            results.append({"event_id": event.id, "status": "unmapped", "unmapped": built.unmapped})
            continue
        try:
            sent = svc.client.upload_strength_workout(built.workout)
            workout_id = sent.get("workoutId") if isinstance(sent, dict) else None
            if workout_id is not None:
                svc.client.schedule_workout(workout_id, today.isoformat())
            event.garmin_workout_id = str(workout_id) if workout_id is not None else None
            event.last_scheduled_date = today
            results.append({"event_id": event.id, "status": "sent", "workout_id": workout_id})
        except Exception as exc:
            results.append({"event_id": event.id, "status": "error", "message": str(exc)})
    await db.commit()
    return {"status": "done", "sent": sum(1 for item in results if item["status"] == "sent"), "results": results}


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
