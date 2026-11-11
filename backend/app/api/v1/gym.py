"""Gimnasio v2: catálogo de ejercicios, plantillas y sesiones con series individuales.

Amplía el router viejo (`api/v1/strength.py`) sin romperlo: `POST /strength/log` sigue
existiendo y con el mismo contrato. Este módulo añade lo que la especificación pide y
hoy no existía (ver `INVESTIGACION.md` §4.5, huecos H1-H7):

- Catálogo propio (`exercises`) con búsqueda y filtros.
- Plantillas reutilizables (`workout_templates` + `template_exercises`).
- Sesiones con series individuales (`workout_sessions` + `session_sets`), que es lo que
  permite marcar una serie y corregir su peso sin tocar las demás.

Decisiones de diseño: `DECISIONES.md` D-01, D-02 y D-04.
"""
import re
import unicodedata
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_current_user
from app.db.models import (
    Activity, Exercise, GarminCredential, SessionSet, TemplateExercise, User,
    WorkoutSession, WorkoutTemplate,
)
from app.db.session import get_db
from app.services.fatigue_engine import FatigueEngine
from app.services.garmin_import import import_exercise_sets
from app.services.gym_seed import (
    EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS, normalize_search,
)

router = APIRouter(prefix="/strength", tags=["Gym — catálogo y sesiones"])

SET_TYPES = ("normal", "warmup", "drop", "failure")

# Clasificación documentada para el ratio empuje/tirón de T-26: se atribuye por
# el grupo muscular PRINCIPAL del ejercicio. Es una estimación del reparto de
# trabajo, no una medida anatómica: las piernas y el core quedan fuera del ratio.
PUSH_MUSCLES = frozenset({"pecho", "hombro", "triceps"})
PULL_MUSCLES = frozenset({"espalda", "biceps"})


# ---------------------------------------------------------------------------
# Esquemas de entrada
# ---------------------------------------------------------------------------

class ExerciseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, examples=["Press de banca inclinado"])
    muscle_group: str = Field("pecho", examples=list(MUSCLE_GROUPS))
    equipment: str = Field("otro", examples=list(EQUIPMENT))
    secondary_muscles: List[str] = Field(default_factory=list)
    is_unilateral: bool = False
    is_timed: bool = False
    notes: Optional[str] = None
    garmin_enum: Optional[str] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    muscle_group: Optional[str] = None
    equipment: Optional[str] = None
    secondary_muscles: Optional[List[str]] = None
    is_unilateral: Optional[bool] = None
    is_timed: Optional[bool] = None
    notes: Optional[str] = None
    garmin_enum: Optional[str] = None


class TemplateExerciseIn(BaseModel):
    exercise_id: str
    sets: int = Field(3, ge=1, le=20)
    reps: int = Field(10, ge=0, le=500)
    weight_kg: float = Field(0.0, ge=0, le=2000)
    rest_seconds: int = Field(120, ge=0, le=1800)
    notes: Optional[str] = None
    set_targets: Optional[List[Dict[str, Any]]] = None


class TemplateIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    weekday: Optional[int] = Field(None, ge=0, le=6, description="0=lunes .. 6=domingo")
    focus: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    exercises: List[TemplateExerciseIn] = Field(default_factory=list)


class SetIn(BaseModel):
    exercise_id: str
    set_number: int = Field(1, ge=1, le=100)
    weight_kg: float = Field(0.0, ge=0, le=2000)
    reps: int = Field(0, ge=0, le=1000)
    rir: Optional[int] = Field(None, ge=0, le=10)
    rpe: Optional[int] = Field(None, ge=0, le=10)
    is_warmup: bool = False
    set_type: str = "normal"
    rest_seconds: Optional[int] = Field(None, ge=0, le=3600)
    completed_at: Optional[datetime] = None
    needs_review: bool = False


class SessionIn(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    template_id: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    notes: Optional[str] = None
    sets: List[SetIn] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.strip().lower())
    plain = "".join(c for c in nfkd if not unicodedata.combining(c))
    slug = re.sub(r"[^a-z0-9]+", "-", plain).strip("-")
    return slug[:150] or "ejercicio"


def _validate_enum(value: str, allowed, field: str) -> str:
    v = (value or "").strip().lower()
    if v not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} no válido: '{value}'. Permitidos: {', '.join(allowed)}.",
        )
    return v


def _exercise_brief(ex: Optional[Exercise]) -> Optional[Dict[str, Any]]:
    if ex is None:
        return None
    return {
        "id": ex.id,
        "name": ex.name,
        "slug": ex.slug,
        "muscle_group": ex.muscle_group,
        "equipment": ex.equipment,
        "is_timed": bool(ex.is_timed),
        "is_unilateral": bool(ex.is_unilateral),
    }


def _exercise_out(ex: Exercise) -> Dict[str, Any]:
    return {
        **_exercise_brief(ex),
        "secondary_muscles": ex.secondary_muscles or [],
        "muscle_group_label": MUSCLE_GROUP_LABELS.get(ex.muscle_group, ex.muscle_group),
        "equipment_label": EQUIPMENT_LABELS.get(ex.equipment, ex.equipment),
        "notes": ex.notes,
        "source": ex.source,
        "garmin_enum": ex.garmin_enum,
        "is_custom": ex.user_id is not None,
    }


def _visible_exercises(user: Optional[User]):
    """Catálogo global (semilla) + los ejercicios propios del atleta."""
    if user is not None:
        return or_(Exercise.user_id.is_(None), Exercise.user_id == user.id)
    return Exercise.user_id.is_(None)


def _set_out(s: SessionSet) -> Dict[str, Any]:
    return {
        "id": s.id,
        "exercise_id": s.exercise_id,
        "set_number": s.set_number,
        "weight_kg": s.weight_kg,
        "reps": s.reps,
        "rir": s.rir,
        "rpe": s.rpe,
        "is_warmup": bool(s.is_warmup),
        "set_type": s.set_type,
        "rest_seconds": s.rest_seconds,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "needs_review": bool(s.needs_review),
    }


def _tonnage(sets: List[SessionSet]) -> float:
    """Volumen de trabajo: peso × reps. Las series de calentamiento no cuentan."""
    return round(sum((s.weight_kg or 0) * (s.reps or 0) for s in sets if not s.is_warmup), 2)


def _planned_target(target: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Objetivo de una serie según la plantilla, para comparar planificado con real.

    Devuelve `None` en cada campo cuando no hay plantilla o la plantilla no fija
    ese objetivo: no se inventa un plan que no existe.
    """
    weight = (target or {}).get("weight_kg")
    reps = (target or {}).get("reps")
    return {
        "planned_weight_kg": float(weight) if weight is not None else None,
        "planned_reps": int(reps) if reps is not None else None,
    }


def _normalize_set_targets(raw, sets: int, reps: int, weight_kg: float) -> List[Dict[str, Any]]:
    """Objetivo por serie. Si falta, usa el peso/reps de la plantilla o la última marca."""
    count = max(1, int(sets or 1))
    items = raw if isinstance(raw, list) else []
    targets: List[Dict[str, Any]] = []
    for index in range(count):
        item = items[index] if index < len(items) and isinstance(items[index], dict) else {}
        target_weight = item.get("weight_kg", weight_kg)
        target_reps = item.get("reps", reps)
        targets.append({
            "set_number": index + 1,
            "weight_kg": max(0.0, float(target_weight or 0)),
            "reps": max(0, int(target_reps or 0)),
        })
    return targets


async def _last_weight_for_exercise(db: AsyncSession, user_id: Optional[str],
                                    exercise_id: str) -> Optional[float]:
    """Última serie registrada de ese ejercicio, para no pedir pesos si no hay objetivo."""
    if not user_id:
        return None
    result = await db.execute(
        select(SessionSet.weight_kg)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .where(WorkoutSession.user_id == user_id,
               SessionSet.exercise_id == exercise_id,
               SessionSet.weight_kg > 0)
        .order_by(WorkoutSession.started_at.desc(), SessionSet.set_number.desc())
        .limit(1)
    )
    weight = result.scalar_one_or_none()
    return float(weight) if weight is not None else None


async def _load_accessible_exercises(db: AsyncSession, user: Optional[User],
                                     ids: List[str]) -> Dict[str, Exercise]:
    """Devuelve {id: Exercise} y falla con 404 nombrando los que no existen o no son visibles."""
    wanted = list(dict.fromkeys(i for i in ids if i))
    if not wanted:
        return {}
    res = await db.execute(
        select(Exercise).where(Exercise.id.in_(wanted), _visible_exercises(user))
    )
    found = {e.id: e for e in res.scalars().all()}
    missing = [i for i in wanted if i not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ejercicio(s) no encontrado(s): {', '.join(missing)}.",
        )
    return found


async def _load_exercises_by_id(db: AsyncSession, ids: List[str]) -> Dict[str, Exercise]:
    """Carga por id sin filtrar visibilidad (para pintar plantillas/sesiones ya validadas)."""
    wanted = list(dict.fromkeys(i for i in ids if i))
    if not wanted:
        return {}
    res = await db.execute(select(Exercise).where(Exercise.id.in_(wanted)))
    return {e.id: e for e in res.scalars().all()}


async def _template_out(db: AsyncSession, tpl: WorkoutTemplate) -> Dict[str, Any]:
    res = await db.execute(
        select(TemplateExercise)
        .where(TemplateExercise.template_id == tpl.id)
        .order_by(TemplateExercise.position, TemplateExercise.id)
    )
    rows = res.scalars().all()
    ex_map = await _load_exercises_by_id(db, [r.exercise_id for r in rows])
    items = []
    total_sets = 0
    tonnage = 0.0
    for r in rows:
        ex = ex_map.get(r.exercise_id)
        total_sets += r.sets
        targets = _normalize_set_targets(r.set_targets, r.sets, r.reps, r.weight_kg)
        if any(t["weight_kg"] <= 0 for t in targets):
            last_weight = await _last_weight_for_exercise(db, tpl.user_id, r.exercise_id)
            if last_weight is not None:
                for target in targets:
                    if target["weight_kg"] <= 0:
                        target["weight_kg"] = last_weight
        tonnage += sum(t["weight_kg"] * t["reps"] for t in targets)
        items.append({
            "id": r.id,
            "position": r.position,
            "exercise": _exercise_brief(ex),
            "sets": r.sets,
            "reps": r.reps,
            "weight_kg": r.weight_kg,
            "rest_seconds": r.rest_seconds,
            "notes": r.notes,
            "set_targets": targets,
        })
    return {
        "id": tpl.id,
        "name": tpl.name,
        "weekday": tpl.weekday,
        "weekday_label": ("Lunes", "Martes", "Miércoles", "Jueves", "Viernes",
                          "Sábado", "Domingo")[tpl.weekday] if tpl.weekday is not None else None,
        "focus": tpl.focus,
        "notes": tpl.notes,
        "exercises": items,
        "total_sets": total_sets,
        "estimated_tonnage_kg": round(tonnage, 2),
        "created_at": tpl.created_at.isoformat() if tpl.created_at else None,
        "updated_at": tpl.updated_at.isoformat() if tpl.updated_at else None,
    }


async def _load_planned_targets(
        db: AsyncSession, sessions: List[WorkoutSession]
) -> Dict[str, Dict[str, Dict[int, Dict[str, Any]]]]:
    """Objetivo por serie de la plantilla de cada sesión, para comparar planificado y real.

    Devuelve `{template_id: {exercise_id: {set_number: target}}}` con los
    `set_targets` tal cual los guardó la plantilla (misma fuente y mismo
    emparejamiento por ejercicio + `set_number` que usa el detalle de sesión).
    Una sesión sin plantilla, cuya plantilla ya no existe o cuya plantilla es de
    otro atleta no aparece en el mapa: sus series quedan con el plan a `null`.

    Se resuelve en una sola consulta para no hacer N+1 al exportar el historial.
    """
    template_ids = {s.template_id for s in sessions if s.template_id}
    if not template_ids:
        return {}
    user_ids = {s.user_id for s in sessions}
    # Solo la plantilla del propio atleta: una sesión que apunte a un
    # `template_id` ajeno no debe enseñar el plan de otra persona.
    tpl_rows = (await db.execute(
        select(TemplateExercise)
        .join(WorkoutTemplate, TemplateExercise.template_id == WorkoutTemplate.id)
        .where(TemplateExercise.template_id.in_(template_ids),
               WorkoutTemplate.user_id.in_(user_ids))
    )).scalars().all()
    planned: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]] = {}
    for row in tpl_rows:
        por_serie = planned.setdefault(row.template_id, {}).setdefault(
            row.exercise_id, {})
        for target in (row.set_targets or []):
            if not isinstance(target, dict) or target.get("set_number") is None:
                continue
            por_serie[int(target["set_number"])] = target
    return planned


async def _session_out(db: AsyncSession, sess: WorkoutSession) -> Dict[str, Any]:
    res = await db.execute(
        select(SessionSet).where(SessionSet.session_id == sess.id)
    )
    sets = res.scalars().all()
    ex_map = await _load_exercises_by_id(db, [s.exercise_id for s in sets])

    # Plan por serie: se lee de la plantilla de la sesión y se empareja por
    # ejercicio + número de serie. Sin plantilla no hay plan que comparar.
    planned = (await _load_planned_targets(db, [sess])).get(sess.template_id, {})

    grouped: Dict[str, List[SessionSet]] = {}
    for s in sets:
        grouped.setdefault(s.exercise_id, []).append(s)

    exercises = []
    for ex_id, ss in grouped.items():
        ss.sort(key=lambda x: (x.set_number, x.id))
        ordered = sorted(ss, key=lambda x: (x.position, x.set_number))
        sets_out = []
        plan_ejercicio = planned.get(ex_id, {})
        for x in ordered:
            serie = _set_out(x)
            serie.update(_planned_target(plan_ejercicio.get(int(x.set_number))))
            sets_out.append(serie)
        exercises.append({
            "exercise": _exercise_brief(ex_map.get(ex_id)),
            "position": min(x.position for x in ss),
            "sets": sets_out,
            "tonnage_kg": round(sum((x.weight_kg or 0) * (x.reps or 0)
                                    for x in ss if not x.is_warmup), 2),
        })
    exercises.sort(key=lambda e: e["position"])

    duration_min = None
    if sess.started_at and sess.finished_at:
        duration_min = round((sess.finished_at - sess.started_at).total_seconds() / 60.0, 1)
    return {
        "id": sess.id,
        "name": sess.name,
        "template_id": sess.template_id,
        "started_at": sess.started_at.isoformat() if sess.started_at else None,
        "finished_at": sess.finished_at.isoformat() if sess.finished_at else None,
        "date": sess.started_at.date().isoformat() if sess.started_at else None,
        "duration_min": duration_min,
        "status": sess.status,
        "notes": sess.notes,
        "total_tonnage_kg": sess.total_tonnage_kg,
        "computed_tss": sess.computed_tss,
        "activity_id": sess.activity_id,
        "sets_count": len(sets),
        "exercises_count": len(exercises),
        "exercises": exercises,
    }


def _session_summary(sess: WorkoutSession, sets_count: int, exercises_count: int) -> Dict[str, Any]:
    return {
        "id": sess.id,
        "name": sess.name,
        "template_id": sess.template_id,
        "date": sess.started_at.date().isoformat() if sess.started_at else None,
        "started_at": sess.started_at.isoformat() if sess.started_at else None,
        "finished_at": sess.finished_at.isoformat() if sess.finished_at else None,
        "duration_min": round((sess.finished_at - sess.started_at).total_seconds() / 60.0, 1)
        if sess.started_at and sess.finished_at else None,
        "total_tonnage_kg": sess.total_tonnage_kg,
        "computed_tss": sess.computed_tss,
        "sets_count": sets_count,
        "exercises_count": exercises_count,
        "notes": sess.notes,
    }


# ---------------------------------------------------------------------------
# Catálogo de ejercicios
# ---------------------------------------------------------------------------

@router.get("/exercises", summary="Catálogo de ejercicios (búsqueda + filtros)")
async def list_exercises(
    q: Optional[str] = Query(None, description="Texto libre en el nombre"),
    muscle_group: Optional[str] = Query(None, description="pecho|espalda|hombro|..."),
    equipment: Optional[str] = Query(None, description="barra|mancuerna|maquina|..."),
    only_custom: bool = Query(False, description="Solo los ejercicios creados por mí"),
    limit: int = Query(200, ge=1, le=300),
    offset: int = Query(0, ge=0),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    conditions = [_visible_exercises(user)]
    if only_custom:
        if user is None:
            return {"total": 0, "items": [], "muscle_groups": [], "equipment": []}
        conditions.append(Exercise.user_id == user.id)
    if muscle_group:
        conditions.append(Exercise.muscle_group == _validate_enum(muscle_group, MUSCLE_GROUPS, "muscle_group"))
    if equipment:
        conditions.append(Exercise.equipment == _validate_enum(equipment, EQUIPMENT, "equipment"))
    if q and q.strip():
        needs = normalize_search(q)
        if needs:
            conditions.append(Exercise.search_text.ilike(f"%{needs}%"))

    total = (await db.execute(select(func.count()).select_from(Exercise).where(*conditions))).scalar() or 0
    res = await db.execute(
        select(Exercise).where(*conditions)
        .order_by(Exercise.muscle_group, Exercise.name)
        .limit(limit).offset(offset)
    )
    return {
        "total": total,
        "items": [_exercise_out(e) for e in res.scalars().all()],
        "muscle_groups": [{"value": g, "label": MUSCLE_GROUP_LABELS[g]} for g in MUSCLE_GROUPS],
        "equipment": [{"value": e, "label": EQUIPMENT_LABELS[e]} for e in EQUIPMENT],
    }


@router.post("/exercises", status_code=status.HTTP_201_CREATED,
             summary="Crear un ejercicio propio")
async def create_exercise(
    payload: ExerciseCreate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    group = _validate_enum(payload.muscle_group, MUSCLE_GROUPS, "muscle_group")
    equip = _validate_enum(payload.equipment, EQUIPMENT, "equipment")
    secondaries = [_validate_enum(m, MUSCLE_GROUPS, "secondary_muscles") for m in payload.secondary_muscles]
    slug = _slugify(payload.name)

    clash = await db.execute(
        select(Exercise).where(Exercise.slug == slug, _visible_exercises(user))
    )
    if clash.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Ya existe un ejercicio con ese nombre ('{payload.name}').")

    ex = Exercise(
        id=str(uuid.uuid4()), user_id=user.id, name=payload.name.strip(), slug=slug,
        search_text=normalize_search(payload.name),
        muscle_group=group, equipment=equip, secondary_muscles=secondaries,
        is_unilateral=payload.is_unilateral, is_timed=payload.is_timed,
        notes=payload.notes, source="custom", garmin_enum=payload.garmin_enum,
    )
    db.add(ex)
    await db.commit()
    await db.refresh(ex)
    return _exercise_out(ex)


@router.get("/exercises/{exercise_id}", summary="Ficha de un ejercicio con su última marca y su PR")
async def get_exercise(
    exercise_id: str,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id, _visible_exercises(user)))
    ex = res.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")

    last = None
    pr = None
    sessions_count = 0
    if user is not None:
        sets_res = await db.execute(
            select(SessionSet, WorkoutSession.started_at)
            .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
            .where(SessionSet.exercise_id == exercise_id,
                   WorkoutSession.user_id == user.id)
            .order_by(WorkoutSession.started_at.desc(), SessionSet.set_number)
        )
        rows = sets_res.all()
        sessions_count = len({s.session_id for s, _ in rows})
        working = [(s, d) for s, d in rows if not s.is_warmup]
        if working:
            s0, d0 = working[0]
            last = {"date": d0.date().isoformat() if d0 else None,
                    "weight_kg": s0.weight_kg, "reps": s0.reps, "set_number": s0.set_number}
            best = max(working, key=lambda p: ((p[0].weight_kg or 0), (p[0].reps or 0)))
            pr = {"date": best[1].date().isoformat() if best[1] else None,
                  "weight_kg": best[0].weight_kg, "reps": best[0].reps}
    return {"exercise": _exercise_out(ex), "last": last, "pr": pr,
            "sessions_count": sessions_count}


@router.put("/exercises/{exercise_id}", summary="Editar un ejercicio propio")
async def update_exercise(
    exercise_id: str,
    payload: ExerciseUpdate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(Exercise).where(
        Exercise.id == exercise_id, Exercise.user_id == user.id))
    ex = res.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404,
                            detail="Ejercicio no encontrado o no es tuyo (la semilla no se edita).")
    data = payload.model_dump(exclude_unset=True)
    if "muscle_group" in data and data["muscle_group"]:
        data["muscle_group"] = _validate_enum(data["muscle_group"], MUSCLE_GROUPS, "muscle_group")
    if "equipment" in data and data["equipment"]:
        data["equipment"] = _validate_enum(data["equipment"], EQUIPMENT, "equipment")
    if "secondary_muscles" in data and data["secondary_muscles"] is not None:
        data["secondary_muscles"] = [
            _validate_enum(m, MUSCLE_GROUPS, "secondary_muscles") for m in data["secondary_muscles"]]
    if "name" in data and data["name"]:
        data["name"] = data["name"].strip()
        data["slug"] = _slugify(data["name"])
        data["search_text"] = normalize_search(data["name"])
    for k, v in data.items():
        setattr(ex, k, v)
    await db.commit()
    await db.refresh(ex)
    return _exercise_out(ex)


@router.delete("/exercises/{exercise_id}", summary="Borrar un ejercicio propio")
async def delete_exercise(
    exercise_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(Exercise).where(
        Exercise.id == exercise_id, Exercise.user_id == user.id))
    ex = res.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404,
                            detail="Ejercicio no encontrado o no es tuyo (la semilla no se borra).")
    in_tpl = (await db.execute(select(func.count()).select_from(TemplateExercise).where(
        TemplateExercise.exercise_id == exercise_id))).scalar() or 0
    in_sets = (await db.execute(select(func.count()).select_from(SessionSet).where(
        SessionSet.exercise_id == exercise_id))).scalar() or 0
    if in_tpl or in_sets:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede borrar: {in_tpl} uso(s) en plantillas y {in_sets} serie(s) "
                   "registradas. El historial no debe quedar con huecos.",
        )
    await db.delete(ex)
    await db.commit()
    return {"status": "removed", "id": exercise_id}


@router.get("/exercises/{exercise_id}/history",
            summary="Historial de un ejercicio: últimas sesiones, PR y evolución")
async def exercise_history(
    exercise_id: str,
    limit: int = Query(10, ge=1, le=100),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id, _visible_exercises(user)))
    ex = res.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")

    rows = (await db.execute(
        select(SessionSet, WorkoutSession)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .where(SessionSet.exercise_id == exercise_id, WorkoutSession.user_id == user.id)
        .order_by(WorkoutSession.started_at.desc(), SessionSet.set_number)
    )).all()

    by_session: Dict[str, List[SessionSet]] = {}
    sess_map: Dict[str, WorkoutSession] = {}
    for s, sess in rows:
        by_session.setdefault(sess.id, []).append(s)
        sess_map[sess.id] = sess

    sessions = []
    series = []
    pr = None
    for sid, ss in list(by_session.items())[:limit]:
        sess = sess_map[sid]
        working = [x for x in ss if not x.is_warmup] or ss
        best = max(working, key=lambda x: ((x.weight_kg or 0), (x.reps or 0)))
        tonnage = round(sum((x.weight_kg or 0) * (x.reps or 0) for x in working), 2)
        sessions.append({
            "session_id": sid,
            "session_name": sess.name,
            "date": sess.started_at.date().isoformat() if sess.started_at else None,
            "sets": [_set_out(x) for x in sorted(ss, key=lambda y: (y.set_number, y.id))],
            "best_set": {"weight_kg": best.weight_kg, "reps": best.reps},
            "tonnage_kg": tonnage,
        })
        series.append({
            "date": sess.started_at.date().isoformat() if sess.started_at else None,
            "max_weight_kg": max((x.weight_kg or 0) for x in working),
            "best_reps": max((x.reps or 0) for x in working),
            "tonnage_kg": tonnage,
        })
        if pr is None or ((best.weight_kg or 0), (best.reps or 0)) > (
                (pr["weight_kg"] or 0), (pr["reps"] or 0)):
            pr = {"weight_kg": best.weight_kg, "reps": best.reps,
                  "date": sess.started_at.date().isoformat() if sess.started_at else None}

    series.reverse()   # cronológico para el gráfico
    return {"exercise": _exercise_out(ex), "pr": pr,
            "sessions": sessions, "series": series}


def _week_start(day: date) -> date:
    """Lunes de la semana de `day` (las semanas del panel empiezan en lunes)."""
    return day - timedelta(days=day.weekday())


@router.get("/stats", summary="Estadísticas agregadas del gimnasio: volumen, series, 1RM y empuje/tirón")
async def gym_stats(
    from_date: Optional[date] = Query(None, alias="from", description="Fecha inicial (YYYY-MM-DD)."),
    to_date: Optional[date] = Query(None, alias="to", description="Fecha final (YYYY-MM-DD)."),
    days: int = Query(90, ge=7, le=365, description="Días hacia atrás si no se pasan from/to."),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Agrega las series guardadas por músculo, semana y ejercicio.

    Reglas de honestidad: el tonelaje y las series de trabajo excluyen los
    calentamientos; el 1RM es una **estimación de Epley** y solo se calcula con
    series de 1 a 12 repeticiones; el reparto empuje/tirón se estima por el
    grupo muscular principal y se dice cuánto queda sin clasificar.
    """
    end = to_date or date.today()
    start = from_date or (end - timedelta(days=days - 1))
    if start > end:
        raise HTTPException(status_code=422, detail="'from' no puede ser posterior a 'to'.")

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end + timedelta(days=1), time.min)

    rows = (await db.execute(
        select(SessionSet, WorkoutSession, Exercise)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .outerjoin(Exercise, SessionSet.exercise_id == Exercise.id)
        .where(WorkoutSession.user_id == user.id,
               WorkoutSession.started_at >= start_dt,
               WorkoutSession.started_at < end_dt)
    )).all()

    sessions = (await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.started_at >= start_dt,
            WorkoutSession.started_at < end_dt,
        )
    )).scalars().all()

    total_sets = 0
    working_sets = 0
    total_tonnage = 0.0
    total_reps = 0
    muscle_stats: Dict[str, Dict[str, Any]] = {}
    exercise_stats: Dict[str, Dict[str, Any]] = {}
    week_stats: Dict[date, Dict[str, Any]] = {}

    for item, session, exercise in rows:
        day = session.started_at.date() if session.started_at else start
        week = _week_start(day)
        group = exercise.muscle_group if exercise else "sin_clasificar"
        weight = float(item.weight_kg or 0)
        reps = int(item.reps or 0)
        is_working = (not item.is_warmup) and weight > 0 and reps > 0
        tonnage = round(weight * reps, 2) if is_working else 0.0

        total_sets += 1
        total_reps += reps
        if is_working:
            working_sets += 1
            total_tonnage += tonnage

        m = muscle_stats.setdefault(group, {
            "muscle_group": group,
            "label": MUSCLE_GROUP_LABELS.get(group, "Sin clasificar"),
            "sets": 0, "working_sets": 0, "tonnage_kg": 0.0, "exercises": set(),
        })
        m["sets"] += 1
        if is_working:
            m["working_sets"] += 1
            m["tonnage_kg"] = round(m["tonnage_kg"] + tonnage, 2)
        if exercise is not None:
            m["exercises"].add(exercise.id)

        ex_id = item.exercise_id
        e = exercise_stats.setdefault(ex_id, {
            "exercise_id": ex_id,
            "name": exercise.name if exercise else "Ejercicio ya borrado",
            "muscle_group": group,
            "sets": 0, "working_sets": 0, "tonnage_kg": 0.0,
            "max_weight_kg": 0.0, "estimated_1rm_kg": None,
        })
        e["sets"] += 1
        if is_working:
            e["working_sets"] += 1
            e["tonnage_kg"] = round(e["tonnage_kg"] + tonnage, 2)
            e["max_weight_kg"] = max(e["max_weight_kg"], weight)
            if 1 <= reps <= 12:
                # Epley: estimación, no medición. Se etiqueta en la respuesta y en la UI.
                epley = round(weight * (1 + reps / 30.0), 1)
                e["estimated_1rm_kg"] = max(e["estimated_1rm_kg"] or 0.0, epley)

        w = week_stats.setdefault(week, {
            "week_start": week.isoformat(),
            "sessions": set(), "sets": 0, "working_sets": 0, "tonnage_kg": 0.0,
        })
        w["sessions"].add(session.id)
        w["sets"] += 1
        if is_working:
            w["working_sets"] += 1
            w["tonnage_kg"] = round(w["tonnage_kg"] + tonnage, 2)

    duration_min = round(sum(
        (s.finished_at - s.started_at).total_seconds() / 60.0
        for s in sessions if s.started_at and s.finished_at
    ), 1)

    by_muscle = []
    for value in muscle_stats.values():
        value["exercises"] = len(value["exercises"])
        by_muscle.append(value)
    by_muscle.sort(key=lambda row: (-row["tonnage_kg"], row["label"]))

    by_exercise = list(exercise_stats.values())
    by_exercise.sort(key=lambda row: (-row["tonnage_kg"], row["name"]))

    by_week = []
    for value in sorted(week_stats.values(), key=lambda row: row["week_start"]):
        value["sessions"] = len(value["sessions"])
        by_week.append(value)

    push = round(sum(row["tonnage_kg"] for row in by_muscle if row["muscle_group"] in PUSH_MUSCLES), 2)
    pull = round(sum(row["tonnage_kg"] for row in by_muscle if row["muscle_group"] in PULL_MUSCLES), 2)
    unclassified = round(total_tonnage - push - pull, 2)

    # Muestra de series para el gráfico de dispersión peso/reps (T-27). Es una
    # muestra acotada, no la fuente de los totales: los totales salen de la
    # agregación completa de arriba.
    scatter_sets = []
    for item, session, exercise in rows:
        if item.is_warmup or not item.weight_kg or not item.reps:
            continue
        scatter_sets.append({
            "date": session.started_at.date().isoformat() if session.started_at else None,
            "exercise": exercise.name if exercise else "Ejercicio ya borrado",
            "muscle_group": exercise.muscle_group if exercise else "sin_clasificar",
            "weight_kg": item.weight_kg,
            "reps": item.reps,
        })
    scatter_sets = scatter_sets[-300:]

    # Comparativa con la ventana inmediatamente anterior de la misma duración.
    span_days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=span_days - 1)
    prev_rows = (await db.execute(
        select(SessionSet, WorkoutSession)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .where(WorkoutSession.user_id == user.id,
               WorkoutSession.started_at >= datetime.combine(prev_start, time.min),
               WorkoutSession.started_at < datetime.combine(prev_end + timedelta(days=1), time.min))
    )).all()
    prev_sessions = {sess.id for _, sess in prev_rows}
    prev_tonnage = round(sum(
        (item.weight_kg or 0) * (item.reps or 0)
        for item, _ in prev_rows if not item.is_warmup
    ), 2)
    prev_working = sum(1 for item, _ in prev_rows if not item.is_warmup and item.weight_kg and item.reps)
    previous = {
        "from": prev_start.isoformat(),
        "to": prev_end.isoformat(),
        "sessions": len(prev_sessions),
        "tonnage_kg": prev_tonnage,
        "working_sets": prev_working,
    }

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "days": (end - start).days + 1,
        "totals": {
            "sessions": len(sessions),
            "sets": total_sets,
            "working_sets": working_sets,
            "tonnage_kg": round(total_tonnage, 2),
            "reps": total_reps,
            "duration_min": duration_min,
        },
        "by_muscle": by_muscle,
        "by_week": by_week,
        "by_exercise": by_exercise,
        "sets_sample": scatter_sets,
        "previous": previous,
        "push_pull": {
            "push_tonnage_kg": push,
            "pull_tonnage_kg": pull,
            "ratio": round(push / pull, 2) if pull > 0 else None,
            "classified_tonnage_kg": round(push + pull, 2),
            "unclassified_tonnage_kg": unclassified,
            "note": "Estimado por grupo muscular principal (pecho/hombro/tríceps frente a "
                    "espalda/bíceps); piernas y core no entran en el ratio.",
        },
        "e1rm_note": "1RM estimado con Epley sobre series de 1 a 12 repeticiones; no es una medición.",
    }


# ---------------------------------------------------------------------------
# Progreso por ejercicio y semana
# ---------------------------------------------------------------------------

def _pick_best_set(best: Optional[tuple], weight: float, reps: int) -> tuple:
    """Elige la mejor serie de trabajo: más peso×reps y, en empate, la de más peso."""
    key = (round(weight * reps, 2), weight)
    if best is None or key > best[0]:
        return (key, (weight, reps))
    return best


def _best_set_out(best: Optional[tuple]) -> Optional[Dict[str, Any]]:
    """Serializa la mejor serie elegida por `_pick_best_set` (o `None` si no hay)."""
    if best is None:
        return None
    weight, reps = best[1]
    return {"weight_kg": weight, "reps": reps, "tonnage_kg": round(weight * reps, 2)}


@router.get("/progress",
            summary="Progreso de un ejercicio por semana (volumen, series y mejor serie)")
async def exercise_progress(
    exercise_id: Optional[str] = Query(
        None, description="Ejercicio a seguir; si falta, el de más volumen de la ventana."),
    weeks: int = Query(12, ge=4, le=52,
                       description="Semanas hacia atrás; la semana en curso es la última."),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Serie semanal de un ejercicio para el panel de progreso.

    La ventana son `weeks` semanas contadas hacia atrás desde el lunes de esta
    semana (la actual incluida, aunque aún no tenga sesiones). Solo cuentan las
    series de trabajo —`is_warmup` falso, peso > 0 y reps > 0—, así que un
    calentamiento no infla el progreso.

    Devuelve siempre las cuatro claves del panel (`exercise` puede ser `null`) y
    la ventana completa de semanas, también las vacías, de la más antigua a la
    más reciente. `exercises` alimenta el selector de ejercicio de la UI.
    """
    current_week = _week_start(date.today())
    week_starts = [current_week - timedelta(weeks=offset)
                   for offset in range(weeks - 1, -1, -1)]
    window_start = week_starts[0]
    window_end = current_week + timedelta(days=7)

    rows = (await db.execute(
        select(SessionSet, WorkoutSession, Exercise)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .join(Exercise, SessionSet.exercise_id == Exercise.id)
        .where(WorkoutSession.user_id == user.id,
               WorkoutSession.started_at >= datetime.combine(window_start, time.min),
               WorkoutSession.started_at < datetime.combine(window_end, time.min),
               _visible_exercises(user))
    )).all()

    # Agregados por ejercicio (selector) y por (ejercicio, semana) (serie del
    # ejercicio elegido). El filtro de trabajo se aplica en Python, igual que en
    # `/stats`, para no repartir la misma regla entre consultas y código.
    per_exercise: Dict[str, Dict[str, Any]] = {}
    per_week: Dict[tuple, Dict[str, Any]] = {}
    for item, session, exercise in rows:
        weight = float(item.weight_kg or 0)
        reps = int(item.reps or 0)
        if item.is_warmup or weight <= 0 or reps <= 0:
            continue
        week = _week_start(session.started_at.date())
        tonnage = round(weight * reps, 2)

        total = per_exercise.setdefault(exercise.id, {
            "exercise": exercise, "tonnage_kg": 0.0, "sets": 0,
            "sessions": set(), "best": None,
        })
        total["tonnage_kg"] = round(total["tonnage_kg"] + tonnage, 2)
        total["sets"] += 1
        total["sessions"].add(session.id)
        total["best"] = _pick_best_set(total["best"], weight, reps)

        bucket = per_week.setdefault((exercise.id, week), {
            "tonnage_kg": 0.0, "sets": 0, "sessions": set(), "best": None,
        })
        bucket["tonnage_kg"] = round(bucket["tonnage_kg"] + tonnage, 2)
        bucket["sets"] += 1
        bucket["sessions"].add(session.id)
        bucket["best"] = _pick_best_set(bucket["best"], weight, reps)

    exercises = [
        {"id": total["exercise"].id, "name": total["exercise"].name,
         "tonnage_kg": total["tonnage_kg"]}
        for total in per_exercise.values()
    ]
    exercises.sort(key=lambda row: (-row["tonnage_kg"], row["name"]))

    selected: Optional[Exercise] = None
    if exercise_id:
        selected = (await db.execute(select(Exercise).where(
            Exercise.id == exercise_id, _visible_exercises(user)
        ))).scalar_one_or_none()
        if selected is None:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")
    elif exercises:
        # Sin elección explícita se abre el ejercicio que más volumen movió.
        selected = per_exercise[exercises[0]["id"]]["exercise"]

    weeks_out: List[Dict[str, Any]] = []
    for week in week_starts:
        bucket = per_week.get((selected.id, week)) if selected is not None else None
        if bucket is None:
            # Semana sin series de trabajo: se pinta igual, con los ceros.
            weeks_out.append({
                "week_start": week.isoformat(), "tonnage_kg": 0.0,
                "sets": 0, "sessions": 0, "best_set": None,
            })
            continue
        weeks_out.append({
            "week_start": week.isoformat(),
            "tonnage_kg": bucket["tonnage_kg"],
            "sets": bucket["sets"],
            "sessions": len(bucket["sessions"]),
            "best_set": _best_set_out(bucket["best"]),
        })

    if selected is None:
        return {
            "exercise": None,
            "weeks": weeks_out,
            "totals": {"tonnage_kg": 0.0, "sets": 0, "best_set": None},
            "exercises": exercises,
        }

    # Un ejercicio elegido a mano sin series en la ventana devuelve su ficha con
    # los totales a cero: el selector conserva la elección del atleta.
    total = per_exercise.get(selected.id, {"tonnage_kg": 0.0, "sets": 0, "best": None})
    return {
        "exercise": {"id": selected.id, "name": selected.name,
                     "muscle_group": selected.muscle_group},
        "weeks": weeks_out,
        "totals": {"tonnage_kg": total["tonnage_kg"], "sets": total["sets"],
                   "best_set": _best_set_out(total["best"])},
        "exercises": exercises,
    }


@router.post("/import-garmin/{activity_id}", summary="Importar las series de una actividad de fuerza de Garmin")
async def import_garmin_strength(
    activity_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Trae las series reales de una actividad de Garmin (T-30).

    Requiere la cuenta de Garmin vinculada. No crea una segunda `Activity`: el
    TSS de la sesión queda en 0 porque la actividad ya cuenta en la carga. Si un
    ejercicio no está en nuestro catálogo con su `garmin_enum`, se devuelve en
    `unmapped` y no se guarda a medias.
    """
    existing = (await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.activity_id == str(activity_id),
        )
    )).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"status": "already_imported", "session_id": existing.id,
                    "message": "Esa actividad ya se importó; no se duplica."},
        )

    cred = (await db.execute(
        select(GarminCredential).where(GarminCredential.user_id == user.id)
    )).scalar_one_or_none()
    if cred is None:
        raise HTTPException(status_code=400, detail="Vincula tu Garmin primero.")

    from app.core.config import settings as _settings
    from app.services.garmin_service import GarminService as _GSvc
    svc = _GSvc(email=cred.garmin_email, password=None,
                token_dir=f"{_settings.GARMIN_TOKENS_DIR}_{user.id}", use_env_fallback=False)
    try:
        svc.authenticate()
        payload = svc.client.get_activity_exercise_sets(activity_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Garmin no devolvió las series: {exc}")

    activity = (await db.execute(
        select(Activity).where(Activity.id == str(activity_id), Activity.user_id == user.id)
    )).scalar_one_or_none()
    started_at = activity.start_time if activity else None
    finished_at = None
    if activity and activity.start_time and activity.duration_seconds:
        finished_at = activity.start_time + timedelta(seconds=activity.duration_seconds)

    result = await import_exercise_sets(
        db, user, str(activity_id), payload,
        activity_name=activity.activity_name if activity else None,
        started_at=started_at, finished_at=finished_at,
    )
    if result.status == "no_sets":
        raise HTTPException(status_code=422, detail="La actividad no tiene series de fuerza que importar.")
    if result.status == "no_mapped_exercises":
        raise HTTPException(status_code=422, detail={
            "status": "no_mapped_exercises",
            "unmapped": result.unmapped,
            "message": "Ningún ejercicio de la actividad está en el catálogo con garmin_enum; "
                       "no se guarda nada. Añade el mapeo y reintenta.",
        })
    return {
        "status": result.status,
        "session_id": result.session_id,
        "sets_imported": result.sets_imported,
        "exercises": result.exercises,
        "unmapped": result.unmapped,
        "weight_unit": result.weight_unit,
        "note": "Importado y deduplicado por activity_id; pendiente de validar con la cuenta real.",
    }


@router.get("/last-marks", summary="Última marca de cada ejercicio (para precargar la sesión)")
async def last_marks(
    exercise_ids: str = Query(..., description="Ids separados por coma"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    ids = [i.strip() for i in exercise_ids.split(",") if i.strip()]
    if not ids:
        return {"marks": {}}
    rows = (await db.execute(
        select(SessionSet, WorkoutSession.started_at)
        .join(WorkoutSession, SessionSet.session_id == WorkoutSession.id)
        .where(SessionSet.exercise_id.in_(ids),
               WorkoutSession.user_id == user.id,
               SessionSet.is_warmup.is_(False))
        .order_by(WorkoutSession.started_at.desc(), SessionSet.set_number)
    )).all()
    marks: Dict[str, Any] = {}
    for s, started in rows:
        if s.exercise_id in marks:
            continue
        marks[s.exercise_id] = {
            "date": started.date().isoformat() if started else None,
            "weight_kg": s.weight_kg,
            "reps": s.reps,
            "set_number": s.set_number,
            "rest_seconds": s.rest_seconds,
        }
    return {"marks": marks}


# ---------------------------------------------------------------------------
# Plantillas
# ---------------------------------------------------------------------------

async def _validate_template_exercises(db: AsyncSession, user: User,
                                       items: List[TemplateExerciseIn]) -> None:
    await _load_accessible_exercises(db, user, [i.exercise_id for i in items])


async def _write_template_exercises(db: AsyncSession, template_id: str,
                                    items: List[TemplateExerciseIn]) -> None:
    for pos, item in enumerate(items):
        targets = _normalize_set_targets(item.set_targets, item.sets, item.reps, item.weight_kg)
        db.add(TemplateExercise(
            id=str(uuid.uuid4()), template_id=template_id, exercise_id=item.exercise_id,
            position=pos, sets=item.sets, reps=item.reps, weight_kg=item.weight_kg,
            rest_seconds=item.rest_seconds, notes=item.notes,
            set_targets=targets,
        ))


@router.get("/templates", summary="Mis plantillas de rutina (con filtros de biblioteca)")
async def list_templates(
    q: Optional[str] = Query(None, description="Texto libre: el nombre lo contiene"),
    focus: Optional[str] = Query(None, description="Foco exacto, sin distinguir mayúsculas"),
    from_date: Optional[date] = Query(None, alias="from",
                                      description="Actualizadas desde (YYYY-MM-DD)."),
    to_date: Optional[date] = Query(None, alias="to",
                                    description="Actualizadas hasta (YYYY-MM-DD)."),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    conditions = [WorkoutTemplate.user_id == user.id]
    if q and q.strip():
        conditions.append(WorkoutTemplate.name.ilike(f"%{q.strip()}%"))
    if focus and focus.strip():
        # Igualdad sin mayúsculas: `Push` debe encontrar `push`, pero `Pus` no.
        conditions.append(func.lower(WorkoutTemplate.focus) == focus.strip().lower())
    if from_date:
        conditions.append(WorkoutTemplate.updated_at >= datetime.combine(from_date, time.min))
    if to_date:
        conditions.append(WorkoutTemplate.updated_at <= datetime.combine(to_date, time.max))

    res = await db.execute(
        select(WorkoutTemplate).where(*conditions)
        .order_by(WorkoutTemplate.weekday.is_(None), WorkoutTemplate.weekday, WorkoutTemplate.name)
    )
    items = [await _template_out(db, t) for t in res.scalars().all()]
    return {"total": len(items), "items": items}


@router.post("/templates", status_code=status.HTTP_201_CREATED,
             summary="Crear una plantilla de rutina")
async def create_template(
    payload: TemplateIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _validate_template_exercises(db, user, payload.exercises)
    tpl = WorkoutTemplate(
        id=str(uuid.uuid4()), user_id=user.id, name=payload.name.strip(),
        weekday=payload.weekday, focus=payload.focus, notes=payload.notes,
    )
    db.add(tpl)
    await _write_template_exercises(db, tpl.id, payload.exercises)
    await db.commit()
    await db.refresh(tpl)
    return await _template_out(db, tpl)


@router.get("/templates/{template_id}", summary="Detalle de una plantilla")
async def get_template(
    template_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user.id))
    tpl = res.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
    return await _template_out(db, tpl)


@router.post("/templates/{template_id}/duplicate", status_code=status.HTTP_201_CREATED,
             summary="Duplicar una plantilla (copia profunda de sus objetivos)")
async def duplicate_template(
    template_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Copia la plantilla para reutilizarla como base de otro plan.

    Se copian weekday/focus/notes y todos los `template_exercises` con sus
    `set_targets` (copia profunda: editar la copia no toca el original).
    """
    res = await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user.id))
    tpl = res.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")

    rows = (await db.execute(
        select(TemplateExercise)
        .where(TemplateExercise.template_id == template_id)
        .order_by(TemplateExercise.position, TemplateExercise.id)
    )).scalars().all()

    copia = WorkoutTemplate(
        id=str(uuid.uuid4()), user_id=user.id,
        # El nombre del modelo admite 150: se trunca el conjunto, no solo el original.
        name=f"{tpl.name} (copia)"[:150],
        weekday=tpl.weekday, focus=tpl.focus, notes=tpl.notes,
    )
    db.add(copia)
    for row in rows:
        db.add(TemplateExercise(
            id=str(uuid.uuid4()), template_id=copia.id, exercise_id=row.exercise_id,
            position=row.position, sets=row.sets, reps=row.reps, weight_kg=row.weight_kg,
            rest_seconds=row.rest_seconds, notes=row.notes,
            # Copia profunda de los dicts: los objetivos no se comparten entre plantillas.
            set_targets=[dict(target) for target in (row.set_targets or [])
                         if isinstance(target, dict)],
        ))
    await db.commit()
    await db.refresh(copia)
    return await _template_out(db, copia)


@router.put("/templates/{template_id}", summary="Editar una plantilla (reemplaza sus ejercicios)")
async def update_template(
    template_id: str,
    payload: TemplateIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user.id))
    tpl = res.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
    await _validate_template_exercises(db, user, payload.exercises)
    tpl.name = payload.name.strip()
    tpl.weekday = payload.weekday
    tpl.focus = payload.focus
    tpl.notes = payload.notes
    await db.execute(sa_delete(TemplateExercise).where(
        TemplateExercise.template_id == template_id))
    await _write_template_exercises(db, template_id, payload.exercises)
    await db.commit()
    await db.refresh(tpl)
    return await _template_out(db, tpl)


@router.delete("/templates/{template_id}", summary="Borrar una plantilla")
async def delete_template(
    template_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutTemplate).where(
        WorkoutTemplate.id == template_id, WorkoutTemplate.user_id == user.id))
    tpl = res.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada.")
    await db.execute(sa_delete(TemplateExercise).where(
        TemplateExercise.template_id == template_id))
    # Las sesiones ya hechas conservan su nombre; solo pierden la referencia.
    sess_res = await db.execute(select(WorkoutSession).where(
        WorkoutSession.template_id == template_id))
    for s in sess_res.scalars().all():
        s.template_id = None
    await db.delete(tpl)
    await db.commit()
    return {"status": "removed", "id": template_id}


# ---------------------------------------------------------------------------
# Sesiones
# ---------------------------------------------------------------------------

async def _recompute_and_store(db: AsyncSession, sess: WorkoutSession,
                               sets: List[SessionSet], focus: Optional[str]) -> float:
    tonnage = _tonnage(sets)
    tss = FatigueEngine.calculate_strength_tss(tonnage, focus or "full")
    sess.total_tonnage_kg = tonnage
    sess.computed_tss = tss
    return tss


async def _mirror_activity(db: AsyncSession, sess: WorkoutSession, user_id: str) -> None:
    """Crea/actualiza la fila Activity que alimenta el modelo de fatiga."""
    started = sess.started_at or datetime.utcnow()
    finished = sess.finished_at or started
    duration = max(60, int((finished - started).total_seconds()))
    if sess.activity_id:
        res = await db.execute(select(Activity).where(Activity.id == sess.activity_id))
        act = res.scalar_one_or_none()
    else:
        act = None
    if act is None:
        act = Activity(
            id=str(uuid.uuid4()), user_id=user_id, source="manual",
            activity_type="strength", activity_name=sess.name,
            start_time=started, duration_seconds=duration, training_load_tss=0.0,
        )
        db.add(act)
        sess.activity_id = act.id
    act.activity_name = sess.name
    act.start_time = started
    act.duration_seconds = duration
    act.training_load_tss = sess.computed_tss


@router.post("/sessions", status_code=status.HTTP_201_CREATED,
             summary="Guardar una sesión terminada (con series individuales)")
async def create_session(
    payload: SessionIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """El borrador de la sesión vive en el navegador (DECISIONES.md D-02); aquí llega terminada."""
    focus = None
    template_name = None
    if payload.template_id:
        res = await db.execute(select(WorkoutTemplate).where(
            WorkoutTemplate.id == payload.template_id,
            WorkoutTemplate.user_id == user.id))
        tpl = res.scalar_one_or_none()
        if tpl:
            focus = tpl.focus
            template_name = tpl.name

    await _load_accessible_exercises(db, user, [s.exercise_id for s in payload.sets])

    started = payload.started_at or datetime.utcnow()
    finished = payload.finished_at or datetime.utcnow()
    if finished < started:
        raise HTTPException(status_code=422,
                            detail="finished_at no puede ser anterior a started_at.")

    name = (payload.name or template_name
            or f"Sesión de fuerza {started.date().isoformat()}").strip()[:150]
    sess = WorkoutSession(
        id=str(uuid.uuid4()), user_id=user.id, template_id=payload.template_id,
        name=name, started_at=started, finished_at=finished, status="done",
        notes=payload.notes, total_tonnage_kg=0.0, computed_tss=0.0,
    )
    db.add(sess)

    # posición del ejercicio = orden de primera aparición en la sesión
    positions: Dict[str, int] = {}
    counters: Dict[str, int] = {}
    sets: List[SessionSet] = []
    for item in payload.sets:
        if item.exercise_id not in positions:
            positions[item.exercise_id] = len(positions)
        counters[item.exercise_id] = counters.get(item.exercise_id, 0) + 1
        stype = item.set_type if item.set_type in SET_TYPES else "normal"
        row = SessionSet(
            id=str(uuid.uuid4()), session_id=sess.id, exercise_id=item.exercise_id,
            position=positions[item.exercise_id],
            set_number=item.set_number or counters[item.exercise_id],
            weight_kg=item.weight_kg, reps=item.reps, rir=item.rir,
            rpe=item.rpe,
            is_warmup=(item.is_warmup or stype == "warmup"), set_type=stype,
            rest_seconds=item.rest_seconds, completed_at=item.completed_at,
            needs_review=item.needs_review,
        )
        sets.append(row)
        db.add(row)

    await _recompute_and_store(db, sess, sets, focus)
    await _mirror_activity(db, sess, user.id)
    await db.commit()
    await db.refresh(sess)
    return await _session_out(db, sess)


@router.get("/sessions", summary="Historial de sesiones de fuerza (paginado)")
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    exercise_id: Optional[str] = Query(None, description="Solo sesiones con este ejercicio"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    base = select(WorkoutSession).where(WorkoutSession.user_id == user.id)
    if from_date:
        base = base.where(WorkoutSession.started_at >= datetime.combine(from_date, time.min))
    if to_date:
        base = base.where(WorkoutSession.started_at < datetime.combine(
            to_date, time.max))
    if exercise_id:
        base = base.where(WorkoutSession.id.in_(
            select(SessionSet.session_id).where(SessionSet.exercise_id == exercise_id)
        ))
    total = (await db.execute(
        select(func.count()).select_from(base.subquery()))).scalar() or 0
    res = await db.execute(
        base.order_by(WorkoutSession.started_at.desc()).limit(limit).offset(offset))
    sessions = res.scalars().all()

    stats = {}
    if sessions:
        ids = [s.id for s in sessions]
        sres = await db.execute(
            select(SessionSet.session_id, func.count(),
                   func.count(func.distinct(SessionSet.exercise_id)))
            .where(SessionSet.session_id.in_(ids))
            .group_by(SessionSet.session_id))
        stats = {sid: (n, nex) for sid, n, nex in sres.all()}
    items = [_session_summary(s, *stats.get(s.id, (0, 0))) for s in sessions]
    return {"total": total, "limit": limit, "offset": offset, "items": items}


# ---------------------------------------------------------------------------
# Exportación del historial
# ---------------------------------------------------------------------------

# Campos del contrato de exportación (historial plano pensado para CSV/backup).
# Se recortan de los helpers para no duplicar su formato: la sesión se pinta con
# `_session_summary`, la serie con `_set_out` y el ejercicio con `_exercise_brief`.
CAMPOS_SESION_EXPORT = (
    "id", "name", "date", "started_at", "finished_at", "duration_min",
    "total_tonnage_kg", "template_id", "sets_count", "exercises_count",
)
CAMPOS_SERIE_EXPORT = (
    "set_number", "weight_kg", "reps", "rpe", "is_warmup", "set_type",
    "rest_seconds", "completed_at",
)


def _export_set(serie: SessionSet,
                planned: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Serie con los campos del contrato, en el formato de `_set_out`, más su plan.

    El plan se pinta con `_planned_target`, el mismo helper del detalle de sesión:
    así el CSV «previsto vs real» no puede divergir de la ficha de la sesión.
    """
    completa = _set_out(serie)
    item = {campo: completa[campo] for campo in CAMPOS_SERIE_EXPORT}
    item.update(_planned_target(planned))
    return item


def _export_exercise(exercise_id: str, exercise: Optional[Exercise],
                     series: List[SessionSet],
                     planned: Optional[Dict[int, Dict[str, Any]]] = None,
                     ) -> Dict[str, Any]:
    """Ejercicio de la exportación: nombre y grupo planos, con sus series ordenadas."""
    brief = _exercise_brief(exercise) or {}
    programado = planned or {}
    return {
        "exercise_id": exercise_id,
        "exercise_name": brief.get("name") or "Ejercicio ya borrado",
        "muscle_group": brief.get("muscle_group") or "sin_clasificar",
        "sets": [_export_set(s, programado.get(int(s.set_number)))
                 for s in series],
    }


@router.get("/export", summary="Exportar el historial de fuerza completo (JSON plano)")
async def export_history(
    from_date: Optional[date] = Query(None, alias="from",
                                      description="Fecha inicial (YYYY-MM-DD)."),
    to_date: Optional[date] = Query(None, alias="to",
                                    description="Fecha final (YYYY-MM-DD)."),
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Historial completo del atleta, cronológico y con las series dentro de cada ejercicio.

    Es una foto plana para exportar (CSV/backup), no una vista de pantalla: no
    pagina y solo filtra por dueño de la sesión y por el rango de `started_at`.
    Cada serie lleva además `planned_weight_kg`/`planned_reps` (el objetivo de la
    plantilla para esa serie), para poder comparar previsto contra real.
    """
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422,
                            detail="'from' no puede ser posterior a 'to'.")

    consulta = select(WorkoutSession).where(WorkoutSession.user_id == user.id)
    if from_date:
        consulta = consulta.where(
            WorkoutSession.started_at >= datetime.combine(from_date, time.min))
    if to_date:
        # Mismo patrón que `list_sessions`: el día `to` entra entero.
        consulta = consulta.where(
            WorkoutSession.started_at < datetime.combine(to_date, time.max))
    # De más antigua a más reciente: el CSV se lee en orden cronológico.
    sesiones = (await db.execute(
        consulta.order_by(WorkoutSession.started_at.asc(), WorkoutSession.id.asc())
    )).scalars().all()

    # Todas las series en una sola consulta (sin N+1) y agrupadas en memoria.
    series_por_sesion: Dict[str, List[SessionSet]] = {}
    if sesiones:
        filas = (await db.execute(
            select(SessionSet).where(
                SessionSet.session_id.in_([s.id for s in sesiones]))
        )).scalars().all()
        for fila in filas:
            series_por_sesion.setdefault(fila.session_id, []).append(fila)

    exercises_by_id = await _load_exercises_by_id(
        db, [f.exercise_id for filas in series_por_sesion.values() for f in filas])

    # Plan por serie de todas las plantillas implicadas, en una sola consulta.
    planned_por_plantilla = await _load_planned_targets(db, sesiones)

    items = []
    for sesion in sesiones:
        series = series_por_sesion.get(sesion.id, [])
        # Sin plantilla (o con una plantilla borrada/ajena) no hay plan: series a null.
        plan_sesion = planned_por_plantilla.get(sesion.template_id, {})
        agrupadas: Dict[str, List[SessionSet]] = {}
        posiciones: Dict[str, int] = {}
        for serie in series:
            agrupadas.setdefault(serie.exercise_id, []).append(serie)
            posiciones[serie.exercise_id] = min(
                posiciones.get(serie.exercise_id, serie.position), serie.position)
        ejercicios = []
        for exercise_id, ss in agrupadas.items():
            ss.sort(key=lambda x: (x.position, x.set_number, x.id))
            ejercicios.append(
                _export_exercise(exercise_id, exercises_by_id.get(exercise_id), ss,
                                 plan_sesion.get(exercise_id)))
        # Mismo criterio que el detalle: orden de aparición del ejercicio en la sesión.
        ejercicios.sort(key=lambda e: (posiciones[e["exercise_id"]], e["exercise_id"]))
        resumen = _session_summary(sesion, len(series), len(ejercicios))
        item = {campo: resumen[campo] for campo in CAMPOS_SESION_EXPORT}
        item["exercises"] = ejercicios
        items.append(item)

    return {"exported_at": datetime.now().isoformat(timespec="seconds"),
            "sessions": items}


@router.get("/sessions/{session_id}", summary="Detalle de una sesión con todas sus series")
async def get_session(
    session_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutSession).where(
        WorkoutSession.id == session_id, WorkoutSession.user_id == user.id))
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    return await _session_out(db, sess)


@router.put("/sessions/{session_id}", summary="Corregir una sesión guardada (reemplaza sus series)")
async def update_session(
    session_id: str,
    payload: SessionIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutSession).where(
        WorkoutSession.id == session_id, WorkoutSession.user_id == user.id))
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    await _load_accessible_exercises(db, user, [s.exercise_id for s in payload.sets])

    focus = None
    if sess.template_id:
        tres = await db.execute(select(WorkoutTemplate).where(
            WorkoutTemplate.id == sess.template_id))
        tpl = tres.scalar_one_or_none()
        focus = tpl.focus if tpl else None

    if payload.name:
        sess.name = payload.name.strip()[:150]
    if payload.notes is not None:
        sess.notes = payload.notes
    if payload.started_at:
        sess.started_at = payload.started_at
    if payload.finished_at:
        sess.finished_at = payload.finished_at
    if sess.started_at and sess.finished_at and sess.finished_at < sess.started_at:
        raise HTTPException(status_code=422,
                            detail="finished_at no puede ser anterior a started_at.")

    await db.execute(sa_delete(SessionSet).where(SessionSet.session_id == session_id))
    positions: Dict[str, int] = {}
    counters: Dict[str, int] = {}
    new_sets: List[SessionSet] = []
    for item in payload.sets:
        if item.exercise_id not in positions:
            positions[item.exercise_id] = len(positions)
        counters[item.exercise_id] = counters.get(item.exercise_id, 0) + 1
        stype = item.set_type if item.set_type in SET_TYPES else "normal"
        row = SessionSet(
            id=str(uuid.uuid4()), session_id=session_id, exercise_id=item.exercise_id,
            position=positions[item.exercise_id],
            set_number=item.set_number or counters[item.exercise_id],
            weight_kg=item.weight_kg, reps=item.reps, rir=item.rir,
            rpe=item.rpe,
            is_warmup=(item.is_warmup or stype == "warmup"), set_type=stype,
            rest_seconds=item.rest_seconds, completed_at=item.completed_at,
            needs_review=item.needs_review,
        )
        new_sets.append(row)
        db.add(row)
    await _recompute_and_store(db, sess, new_sets, focus)
    await _mirror_activity(db, sess, user.id)
    await db.commit()
    await db.refresh(sess)
    return await _session_out(db, sess)


@router.delete("/sessions/{session_id}", summary="Borrar una sesión y su actividad espejo")
async def delete_session(
    session_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(WorkoutSession).where(
        WorkoutSession.id == session_id, WorkoutSession.user_id == user.id))
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    await db.execute(sa_delete(SessionSet).where(SessionSet.session_id == session_id))
    if sess.activity_id:
        await db.execute(sa_delete(Activity).where(Activity.id == sess.activity_id))
    await db.delete(sess)
    await db.commit()
    return {"status": "removed", "id": session_id}
