"""API de la watch-app propia de Lyfta (T-32).

La app Connect IQ pide el entreno del día y manda las series hechas. Esta
versión usa Bearer normal; el emparejamiento por código/token de dispositivo
es la evolución natural para no teclear credenciales en el reloj.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.models import (
    CalendarEvent, Exercise, SessionSet, TemplateExercise, User, WorkoutSession, WorkoutTemplate,
)
from app.db.session import get_db

router = APIRouter(prefix="/watch", tags=["Watch app"])


def _today_event(events: List[CalendarEvent], today: date) -> Optional[CalendarEvent]:
    for event in events:
        if not event.template_id:
            continue
        if event.weekday is None and event.start_local.date() == today:
            return event
        if event.weekday is not None and event.weekday == today.weekday():
            return event
    return None


async def _template_payload(db: AsyncSession, template: WorkoutTemplate) -> Dict[str, Any]:
    rows = (await db.execute(select(TemplateExercise).where(
        TemplateExercise.template_id == template.id).order_by(TemplateExercise.position))).scalars().all()
    exercises = (await db.execute(select(Exercise).where(
        Exercise.id.in_([row.exercise_id for row in rows])))).scalars().all() if rows else []
    by_id = {exercise.id: exercise for exercise in exercises}
    return {
        "workout_id": f"template:{template.id}",
        "name": template.name,
        "exercises": [
            {
                "exercise_id": row.exercise_id,
                "name": by_id[row.exercise_id].name if row.exercise_id in by_id else "Ejercicio",
                "position": row.position,
                "sets": row.sets,
                "reps": row.reps,
                "weight_kg": row.weight_kg,
                "rest_seconds": row.rest_seconds,
                "targets": row.set_targets if row.set_targets else [
                    {"set_number": index + 1, "reps": row.reps, "weight_kg": row.weight_kg}
                    for index in range(row.sets)
                ],
            }
            for row in rows
        ],
    }


@router.get("/today", summary="Entreno de hoy para la watch-app")
async def watch_today(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    today = date.today()
    events = (await db.execute(select(CalendarEvent).where(
        CalendarEvent.user_id == user.id,
        CalendarEvent.template_id.is_not(None),
    ))).scalars().all()
    event = _today_event(events, today)
    if event is not None:
        template = (await db.execute(select(WorkoutTemplate).where(
            WorkoutTemplate.id == event.template_id,
            WorkoutTemplate.user_id == user.id,
        ))).scalar_one_or_none()
        if template is not None:
            payload = await _template_payload(db, template)
            payload["workout_id"] = f"event:{event.id}"
            return payload

    template = (await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.user_id == user.id,
        WorkoutTemplate.weekday == today.weekday(),
    ).order_by(WorkoutTemplate.updated_at.desc()))).scalars().first()
    if template is None:
        return {"status": "no_workout", "name": None, "exercises": []}
    return await _template_payload(db, template)


@router.get("/ack", summary="Acuse de recibo del reloj: últimas series recibidas hoy")
async def watch_ack(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Confirma solo con evidencia: el reloj ha enviado series hoy.

    Sin series recibidas no hay confirmación; la app no debe mostrar «Recibido».
    """
    from app.db.models import SessionSet, WorkoutSession

    marker = f"watch:{date.today().isoformat()}"
    session = (await db.execute(select(WorkoutSession).where(
        WorkoutSession.user_id == user.id,
        WorkoutSession.activity_id == marker,
    ))).scalar_one_or_none()
    if session is None:
        return {"confirmed": False, "sets_count": 0, "last_set_at": None, "workout_id": None}

    sets = (await db.execute(select(SessionSet).where(
        SessionSet.session_id == session.id,
    ).order_by(SessionSet.set_number, SessionSet.id))).scalars().all()
    ultima = sets[-1] if sets else None
    workout_id = None
    if session.notes and " · " in session.notes:
        workout_id = session.notes.split(" · ", 1)[1] or None
    return {
        "confirmed": bool(sets),
        "sets_count": len(sets),
        "last_set_at": ultima.completed_at.isoformat() if ultima and ultima.completed_at else None,
        "workout_id": workout_id,
    }


class WatchSetIn(BaseModel):
    client_set_id: str = Field(..., min_length=8, max_length=64)
    workout_id: str = Field(..., min_length=1, max_length=120)
    exercise_id: str = Field(..., min_length=1)
    set_number: int = Field(..., ge=1, le=50)
    weight_kg: float = Field(..., ge=0, le=1000)
    reps: int = Field(..., ge=0, le=200)
    completed_at: Optional[datetime] = None
    detected_reps: Optional[int] = Field(None, ge=0, le=200)
    velocity_mps: Optional[float] = Field(None, ge=0, le=10)
    estimated_force_n: Optional[float] = Field(None, ge=0, le=10000)
    estimated_1rm_kg: Optional[float] = Field(None, ge=0, le=1000)
    needs_review: bool = False


@router.post("/sets", summary="Guardar una serie hecha en el reloj (idempotente)")
async def watch_save_set(
    payload: WatchSetIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    exercise = (await db.execute(select(Exercise).where(Exercise.id == payload.exercise_id))).scalar_one_or_none()
    if exercise is None:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")
    if exercise.user_id not in (None, user.id):
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")

    today = date.today()
    marker = f"watch:{today.isoformat()}"
    session = (await db.execute(select(WorkoutSession).where(
        WorkoutSession.user_id == user.id,
        WorkoutSession.activity_id == marker,
    ))).scalar_one_or_none()
    if session is None:
        session = WorkoutSession(
            user_id=user.id,
            name="Entrenamiento en el reloj",
            started_at=payload.completed_at or datetime.utcnow(),
            finished_at=payload.completed_at or datetime.utcnow(),
            status="done",
            activity_id=marker,
            notes=f"Series marcadas desde la watch-app · {payload.workout_id}",
            computed_tss=0.0,
        )
        db.add(session)
        await db.flush()

    existing = (await db.execute(select(SessionSet).where(
        SessionSet.session_id == session.id,
        SessionSet.client_set_id == payload.client_set_id,
    ))).scalar_one_or_none()
    if existing is not None:
        return {"status": "accepted", "duplicate": True, "session_id": session.id, "set_id": existing.id}

    row = SessionSet(
        session_id=session.id,
        exercise_id=payload.exercise_id,
        position=0,
        set_number=payload.set_number,
        weight_kg=payload.weight_kg,
        reps=payload.reps,
        set_type="normal",
        completed_at=payload.completed_at,
        client_set_id=payload.client_set_id,
        detected_reps=payload.detected_reps,
        velocity_mps=payload.velocity_mps,
        estimated_force_n=payload.estimated_force_n,
        estimated_1rm_kg=payload.estimated_1rm_kg,
        needs_review=payload.needs_review,
    )
    db.add(row)
    session.total_tonnage_kg = round((session.total_tonnage_kg or 0) + payload.weight_kg * payload.reps, 2)
    await db.commit()
    return {
        "status": "accepted",
        "duplicate": False,
        "session_id": session.id,
        "set_id": row.id,
        "total_tonnage_kg": session.total_tonnage_kg,
    }
