"""Auto-carga del entrenamiento del día en el reloj (CAL-2).

La app programa entrenamientos semanales (CalendarEvent con `template_id`). Este
servicio construye el workout tipado, lo sube a Garmin Connect y lo agenda para
la fecha de hoy. Es idempotente: si el evento ya se agendó hoy, no lo repite.

Se ejecuta desde el planificador (06:30) y también se puede lanzar a mano con
`POST /calendar/sync-today`. No se ha probado contra la cuenta real de David:
eso es Nivel 3.
"""
import logging
import unicodedata
from datetime import date
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CalendarEvent, Exercise, GarminCredential, TemplateExercise, User, WorkoutTemplate,
)

logger = logging.getLogger("calendar_auto")


def _normalize(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name.strip().lower())
    return "".join(char for char in nfkd if not unicodedata.combining(char))


def _due_today(event: CalendarEvent, today: date) -> bool:
    if event.weekday is None:
        return event.start_local.date() == today
    return event.weekday == today.weekday()


async def _build_workout(db: AsyncSession, user: User, event: CalendarEvent):
    from app.api.v1.strength import GARMIN_EXERCISE_MAP
    from app.services.garmin_workout import build_strength_workout

    template = (await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == event.template_id,
        WorkoutTemplate.user_id == user.id,
    ))).scalar_one_or_none()
    if template is None:
        return None, "template_missing"
    rows = (await db.execute(select(TemplateExercise).where(
        TemplateExercise.template_id == template.id).order_by(TemplateExercise.position))).scalars().all()
    exercises = (await db.execute(select(Exercise).where(
        Exercise.id.in_([row.exercise_id for row in rows])))).scalars().all() if rows else []
    by_id = {exercise.id: exercise for exercise in exercises}
    mapping = dict(GARMIN_EXERCISE_MAP)
    items = []
    for row in rows:
        exercise = by_id.get(row.exercise_id)
        if exercise is None:
            continue
        if exercise.garmin_enum:
            mapping[_normalize(exercise.name)] = exercise.garmin_enum
        items.append({
            "name": exercise.name,
            "sets": row.sets,
            "reps": row.reps,
            "weight_kg": row.weight_kg,
            "rest_seconds": row.rest_seconds,
        })
    built = build_strength_workout(template.name, items, mapping)
    return built, None


async def auto_push_today_for_user(db: AsyncSession, user: User) -> Dict[str, Any]:
    """Agenda hoy los entrenos del usuario. Idempotente por evento/día."""
    credential = (await db.execute(select(GarminCredential).where(
        GarminCredential.user_id == user.id))).scalar_one_or_none()
    if credential is None:
        return {"status": "not_linked", "sent": 0, "events": []}

    today = date.today()
    events = (await db.execute(select(CalendarEvent).where(
        CalendarEvent.user_id == user.id,
        CalendarEvent.template_id.is_not(None),
    ))).scalars().all()
    due = [
        event for event in events
        if _due_today(event, today) and event.last_scheduled_date != today
    ]
    if not due:
        return {"status": "nothing", "sent": 0, "events": []}

    from app.core.config import settings
    from app.services.garmin_service import GarminService

    service = GarminService(
        email=credential.garmin_email,
        password=None,
        token_dir=f"{settings.GARMIN_TOKENS_DIR}_{user.id}",
        use_env_fallback=False,
    )
    service.authenticate()

    results: List[Dict[str, Any]] = []
    for event in due:
        built, error = await _build_workout(db, user, event)
        if error or built is None:
            results.append({"event_id": event.id, "status": error or "no_template"})
            continue
        if built.has_unmapped:
            results.append({"event_id": event.id, "status": "unmapped",
                            "unmapped": built.unmapped})
            continue
        try:
            sent = service.client.upload_strength_workout(built.workout)
            workout_id = sent.get("workoutId") if isinstance(sent, dict) else None
            if workout_id is None:
                results.append({"event_id": event.id, "status": "no_workout_id"})
                continue
            service.client.schedule_workout(workout_id, today.isoformat())
            event.garmin_workout_id = str(workout_id)
            event.last_scheduled_date = today
            results.append({"event_id": event.id, "status": "sent", "workout_id": workout_id})
        except Exception as exc:
            logger.warning("No se pudo agendar el evento %s: %s", event.id, exc)
            results.append({"event_id": event.id, "status": "error", "message": str(exc)})
    await db.commit()
    return {
        "status": "done",
        "sent": sum(1 for item in results if item["status"] == "sent"),
        "events": results,
    }


async def auto_push_today_all() -> Dict[str, Any]:
    """Recorre todos los usuarios vinculados. Un fallo no tumba a los demás."""
    from app.db.session import AsyncSessionLocal
    from app.db.models import User as UserModel

    async with AsyncSessionLocal() as db:
        credentials = (await db.execute(select(GarminCredential))).scalars().all()
        user_ids = [cred.user_id for cred in credentials]
        users = (await db.execute(select(UserModel).where(UserModel.id.in_(user_ids)))).scalars().all() if user_ids else []
        summary = {"users": len(users), "sent": 0, "results": []}
        for user in users:
            try:
                result = await auto_push_today_for_user(db, user)
                summary["sent"] += result.get("sent", 0)
                summary["results"].append({"user_id": user.id, **result})
            except Exception as exc:
                logger.warning("Auto-carga falló para el usuario %s: %s", user.id, exc)
                summary["results"].append({"user_id": user.id, "status": "error", "message": str(exc)})
        return summary
