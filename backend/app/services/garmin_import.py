"""Importación de series de fuerza desde Garmin Connect (T-30).

La API no oficial devuelve `get_activity_exercise_sets(activity_id)` con la
forma documentada por la librería: `exerciseSets[].exercises[].category` (padre)
y `.name` (subcategoría), `repetitionCount` y `weight` en **gramos**. El parser
es tolerante a variantes de nombre, pero no inventa: si un ejercicio no está en
nuestro catálogo con `garmin_enum`, se devuelve en `unmapped` y no se guarda.

No se ha podido validar contra una cuenta real todavía; el endpoint está
protegido y devuelve el detalle de lo importado para revisarlo.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Exercise, SessionSet, User, WorkoutSession


@dataclass
class ParsedSet:
    category: str
    exercise_name: str
    set_number: int
    weight_kg: float
    reps: int
    set_type: str
    started_at: Optional[datetime] = None


@dataclass
class ImportResult:
    status: str
    session_id: Optional[str] = None
    sets_imported: int = 0
    exercises: List[Dict[str, Any]] = field(default_factory=list)
    unmapped: List[str] = field(default_factory=list)
    weight_unit: str = "g"


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_exercise_sets(payload: Dict[str, Any]) -> List[ParsedSet]:
    """Extrae las series de trabajo del JSON de Garmin.

    Se aceptan `exerciseSets` o `sets`; las series de descanso (`REST`) se
    ignoran. El peso se interpreta en gramos (convención de la librería).
    """
    raw_sets = payload.get("exerciseSets") or payload.get("sets") or []
    parsed: List[ParsedSet] = []
    counters: Dict[str, int] = {}
    for raw in raw_sets:
        if not isinstance(raw, dict):
            continue
        set_type = str(raw.get("setType") or raw.get("set_type") or "ACTIVE").upper()
        if set_type in ("REST", "RECOVERY"):
            continue
        exercises = raw.get("exercises") or []
        first = exercises[0] if exercises and isinstance(exercises[0], dict) else {}
        category = str(first.get("category") or raw.get("category") or "")
        name = str(first.get("name") or first.get("exerciseName") or raw.get("exerciseName") or "")
        reps = _as_int(raw.get("repetitionCount") or raw.get("reps"))
        weight_g = _as_float(raw.get("weight") or raw.get("weightValue"))
        if not category and not name:
            continue
        key = f"{category}/{name}"
        counters[key] = counters.get(key, 0) + 1
        parsed.append(ParsedSet(
            category=category,
            exercise_name=name,
            set_number=_as_int(raw.get("setIndex")) or counters[key],
            weight_kg=round(weight_g / 1000.0, 3),
            reps=reps,
            set_type="normal",
            started_at=_parse_dt(raw.get("startTime") or raw.get("start_time")),
        ))
    return parsed


async def import_exercise_sets(
    db: AsyncSession,
    user: User,
    activity_id: str,
    payload: Dict[str, Any],
    activity_name: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> ImportResult:
    """Guarda las series de una actividad de Garmin como sesión propia.

    Deduplica por `activity_id`: si la actividad ya se importó, no crea otra
    sesión. El TSS de la sesión queda en 0 porque la actividad ya está en la
    carga de Garmin (`Activity`); así no se cuenta dos veces.
    """
    existing = (await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.activity_id == activity_id,
        )
    )).scalar_one_or_none()
    if existing is not None:
        return ImportResult(status="already_imported", session_id=existing.id)

    parsed = parse_exercise_sets(payload)
    if not parsed:
        return ImportResult(status="no_sets")

    catalog = (await db.execute(
        select(Exercise).where(
            Exercise.garmin_enum.is_not(None),
            (Exercise.user_id == user.id) | (Exercise.user_id.is_(None)),
        )
    )).scalars().all()
    by_variant: Dict[str, Exercise] = {}
    for exercise in catalog:
        if exercise.garmin_enum:
            by_variant[exercise.garmin_enum] = exercise

    selected: List[tuple[ParsedSet, Exercise]] = []
    unmapped: List[str] = []
    for item in parsed:
        # `name` es la variante concreta (BARBELL_BENCH_PRESS); `category` el
        # padre (BENCH_PRESS). El catálogo guarda la variante en garmin_enum.
        exercise = by_variant.get(item.exercise_name) or by_variant.get(item.category)
        if exercise is None:
            label = item.exercise_name or item.category
            if label and label not in unmapped:
                unmapped.append(label)
            continue
        selected.append((item, exercise))

    if not selected:
        return ImportResult(status="no_mapped_exercises", unmapped=unmapped)

    session = WorkoutSession(
        user_id=user.id,
        name=activity_name or f"Garmin fuerza {activity_id}",
        started_at=started_at or datetime.utcnow(),
        finished_at=finished_at or datetime.utcnow(),
        status="done",
        notes="Importado de una actividad de fuerza de Garmin Connect.",
        activity_id=str(activity_id),
        computed_tss=0.0,
    )
    db.add(session)
    await db.flush()

    position_by_exercise: Dict[str, int] = {}
    totals_by_exercise: Dict[str, Dict[str, Any]] = {}
    for item, exercise in selected:
        position = position_by_exercise.setdefault(exercise.id, len(position_by_exercise))
        db.add(SessionSet(
            session_id=session.id,
            exercise_id=exercise.id,
            position=position,
            set_number=item.set_number,
            weight_kg=item.weight_kg,
            reps=item.reps,
            is_warmup=False,
            set_type="normal",
            completed_at=item.started_at,
        ))
        entry = totals_by_exercise.setdefault(exercise.id, {
            "exercise_id": exercise.id,
            "name": exercise.name,
            "sets": 0,
            "tonnage_kg": 0.0,
        })
        entry["sets"] += 1
        entry["tonnage_kg"] = round(entry["tonnage_kg"] + item.weight_kg * item.reps, 2)

    session.total_tonnage_kg = round(sum(entry["tonnage_kg"] for entry in totals_by_exercise.values()), 2)
    await db.commit()
    await db.refresh(session)
    return ImportResult(
        status="imported",
        session_id=session.id,
        sets_imported=len(selected),
        exercises=list(totals_by_exercise.values()),
        unmapped=unmapped,
    )
