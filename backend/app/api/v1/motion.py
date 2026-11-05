"""API de perfiles de movimiento por ejercicio (IMU-1/IMU-2).

Permite guardar un perfil versionado y probar el detector en seco con muestras
JSON. No promete conteo en el reloj: eso es el POC IMU-5/6 y Nivel 3.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.models import Exercise, ExerciseMotionProfile, User
from app.db.session import get_db
from app.services import motion_detection

router = APIRouter(prefix="/strength", tags=["Gym — detección IMU"])

VALID_STATUS = ("draft", "active", "retired")
VALID_AXES = ("x", "y", "z")


class MotionSample(BaseModel):
    t_ms: float = 0
    x: float
    y: float
    z: float


class CalibrationRequest(BaseModel):
    samples: List[MotionSample] = Field(..., min_length=25, max_length=2500)
    sample_rate_hz: float = Field(25, gt=0, le=100)
    reps_labeled: Optional[int] = Field(None, ge=1, le=30)
    save_draft: bool = False


class DetectRequest(BaseModel):
    samples: List[MotionSample] = Field(..., min_length=25, max_length=2500)
    profile: Dict[str, Any]
    sample_rate_hz: Optional[float] = Field(None, gt=0, le=100)


class ProfileIn(BaseModel):
    profile: Dict[str, Any]
    status: str = Field("draft", pattern="^(draft|active|retired)$")
    calibration: Optional[Dict[str, Any]] = None


def _validate_profile(profile: Dict[str, Any]) -> None:
    if profile.get("schema_version") != 1:
        raise HTTPException(status_code=422, detail="schema_version debe ser 1.")
    axis = profile.get("axis", {}).get("name")
    if axis is not None and axis not in VALID_AXES:
        raise HTTPException(status_code=422, detail="axis.name debe ser x, y o z.")
    rep = profile.get("rep", {})
    expected = rep.get("expected_duration_s")
    if expected is not None and not (0.3 <= float(expected) <= 12):
        raise HTTPException(status_code=422, detail="rep.expected_duration_s fuera de rango.")
    min_d = rep.get("min_duration_s")
    max_d = rep.get("max_duration_s")
    if min_d is not None and max_d is not None and float(min_d) >= float(max_d):
        raise HTTPException(status_code=422, detail="min_duration_s debe ser menor que max_duration_s.")
    if "confidence" in profile and not isinstance(profile["confidence"], dict):
        raise HTTPException(status_code=422, detail="confidence debe ser un objeto.")


async def _owned_exercise(db: AsyncSession, user: User, exercise_id: str) -> Exercise:
    exercise = (await db.execute(select(Exercise).where(Exercise.id == exercise_id))).scalar_one_or_none()
    if exercise is None:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")
    if exercise.user_id not in (None, user.id):
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado.")
    return exercise


@router.get("/exercises/{exercise_id}/motion-profile", summary="Perfil de detección activo")
async def get_motion_profile(
    exercise_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _owned_exercise(db, user, exercise_id)
    rows = (await db.execute(select(ExerciseMotionProfile).where(
        ExerciseMotionProfile.exercise_id == exercise_id,
        ExerciseMotionProfile.status == "active",
    ).order_by(ExerciseMotionProfile.version.desc()))).scalars().all()
    mine = next((row for row in rows if row.user_id == user.id), None)
    default = next((row for row in rows if row.user_id is None), None)
    chosen = mine or default
    if chosen is None:
        return {"configured": False, "profile": None, "status": None,
                "hint": "Sin perfil de movimiento; el conteo automático no está disponible."}
    return {
        "configured": True,
        "id": chosen.id,
        "version": chosen.version,
        "status": chosen.status,
        "profile": chosen.profile,
        "calibration": chosen.calibration,
        "source": "user" if chosen.user_id else "catalog",
    }


@router.put("/exercises/{exercise_id}/motion-profile", summary="Guardar una versión del perfil")
async def save_motion_profile(
    exercise_id: str,
    payload: ProfileIn,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _owned_exercise(db, user, exercise_id)
    _validate_profile(payload.profile)
    current = (await db.execute(select(ExerciseMotionProfile).where(
        ExerciseMotionProfile.exercise_id == exercise_id,
        ExerciseMotionProfile.user_id == user.id,
        ExerciseMotionProfile.status == "active",
    ))).scalars().all()
    if payload.status == "active":
        for row in current:
            row.status = "retired"
    previous = (await db.execute(select(ExerciseMotionProfile).where(
        ExerciseMotionProfile.exercise_id == exercise_id,
        ExerciseMotionProfile.user_id == user.id,
    ).order_by(ExerciseMotionProfile.version.desc()))).scalars().first()
    version = (previous.version + 1) if previous else 1
    row = ExerciseMotionProfile(
        exercise_id=exercise_id, user_id=user.id, version=version,
        status=payload.status, profile=payload.profile, calibration=payload.calibration,
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    await db.commit()
    return {"status": "saved", "id": row.id, "version": version, "profile_status": row.status}


@router.get("/exercises/{exercise_id}/motion-profile/versions", summary="Historial de perfiles")
async def list_motion_versions(
    exercise_id: str,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _owned_exercise(db, user, exercise_id)
    rows = (await db.execute(select(ExerciseMotionProfile).where(
        ExerciseMotionProfile.exercise_id == exercise_id,
        (ExerciseMotionProfile.user_id == user.id) | (ExerciseMotionProfile.user_id.is_(None)),
    ).order_by(ExerciseMotionProfile.version.desc()))).scalars().all()
    return {"items": [{
        "id": row.id, "version": row.version, "status": row.status,
        "user_id": row.user_id, "created_at": row.created_at.isoformat() if row.created_at else None,
    } for row in rows]}


@router.post("/exercises/{exercise_id}/motion-profile/calibrate", summary="Calibrar en seco (sin reloj)")
async def calibrate_motion_profile(
    exercise_id: str,
    payload: CalibrationRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _owned_exercise(db, user, exercise_id)
    try:
        result = motion_detection.calibrate(
            [sample.model_dump() for sample in payload.samples],
            payload.sample_rate_hz, payload.reps_labeled)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    saved = None
    if payload.save_draft:
        _validate_profile(result["profile"])
        row = ExerciseMotionProfile(
            exercise_id=exercise_id, user_id=user.id, version=1, status="draft",
            profile=result["profile"], calibration=result,
        )
        db.add(row)
        await db.commit()
        saved = row.id
    result["saved_draft_id"] = saved
    return result


@router.post("/exercises/{exercise_id}/motion-profile/detect", summary="Probar el detector en seco")
async def detect_motion_reps(
    exercise_id: str,
    payload: DetectRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    await _owned_exercise(db, user, exercise_id)
    _validate_profile(payload.profile)
    try:
        return motion_detection.detect(
            [sample.model_dump() for sample in payload.samples],
            payload.profile, payload.sample_rate_hz)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
