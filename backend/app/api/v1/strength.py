import uuid
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from datetime import date, datetime, time, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.models import StrengthLog, Activity, DailyBiometrics, FatigueMetric
from app.api.deps import get_current_user
from app.db.models import User
from app.services.gym_advisor import GymAdvisorService, GymRoutineResponse
from app.services.fatigue_engine import FatigueEngine
from app.services.garmin_workout import GARMIN_CATALOG_SIZE, build_strength_workout

router = APIRouter(prefix="/strength", tags=["Strength & Gym Assistant"])

class ExerciseLogItem(BaseModel):
    name: str = Field(..., example="Press de Banca")
    sets: int = Field(..., ge=1, example=4)
    reps: int = Field(..., ge=1, example=10)
    weight_kg: float = Field(..., ge=0.0, example=80.0)
    rir: Optional[int] = Field(2, ge=0, le=5)
    rest_seconds: int = Field(120, ge=0, le=1800)
    set_targets: Optional[List[Dict[str, Any]]] = None

class SaveStrengthLogRequest(BaseModel):
    workout_date: date = Field(default_factory=date.today)
    routine_name: str = Field(..., example="Rutina Empuje A")
    target_focus: str = Field(..., example="Push")
    exercises: List[ExerciseLogItem]
    ai_generated: bool = Field(False)
    notes: Optional[str] = None

# Mapeo nombre (ES, minúsculas, sin tildes) -> enum de ejercicio de Garmin Connect.
# Experimental: Garmin rechaza enums desconocidos; el dry_run avisa de no mapeados.
GARMIN_EXERCISE_MAP = {
    "press de banca con barra": "BARBELL_BENCH_PRESS",
    "press de banca": "BARBELL_BENCH_PRESS",
    "press inclinado con mancuernas": "DUMBBELL_INCLINE_BENCH_PRESS",
    "press con mancuernas": "DUMBBELL_BENCH_PRESS",
    "press militar con mancuernas": "DUMBBELL_SHOULDER_PRESS",
    "press militar": "BARBELL_OVERHEAD_PRESS",
    "remo con barra": "BARBELL_BENT_OVER_ROW",
    "jalon al pecho": "LAT_PULLDOWN",
    "jalón al pecho": "LAT_PULLDOWN",
    "fondos en paralelas": "DIP",
    "fondos": "DIP",
    "curl de biceps": "BARBELL_CURL",
    "curl de bíceps": "BARBELL_CURL",
    "curl de biceps con barra": "BARBELL_CURL",
    "curl de bíceps con barra": "BARBELL_CURL",
    "press militar con barra": "BARBELL_OVERHEAD_PRESS",
    "press militar con mancuernas": "DUMBBELL_SHOULDER_PRESS",
    "sentadilla con barra": "BARBELL_SQUAT",
    "peso muerto convencional": "BARBELL_DEADLIFT",
    "remo en polea baja": "CABLE_SEATED_ROW",
    "curl femoral tumbado": "LYING_LEG_CURL",
    "extension de triceps en polea": "CABLE_TRICEPS_PUSHDOWN",
    "extensión de tríceps en polea": "CABLE_TRICEPS_PUSHDOWN",
    "fondos en banco": "DIP",
    "triceps polea": "CABLE_TRICEPS_PUSHDOWN",
    "tríceps polea": "CABLE_TRICEPS_PUSHDOWN",
    "elevaciones laterales": "DUMBBELL_LATERAL_RAISE",
    "sentadilla": "BARBELL_SQUAT",
    "sentadillas": "BARBELL_SQUAT",
    "peso muerto": "BARBELL_DEADLIFT",
    "puente de gluteo": "GLUTE_BRIDGE",
    "puente de glúteo": "GLUTE_BRIDGE",
    "plancha abdominal": "PLANK",
    "plancha": "PLANK",
    "flexiones": "PUSH_UP",
    "dominadas": "PULL_UP",
    "zancadas": "LUNGE",
    "prensa": "LEG_PRESS",
    "remo con mancuerna": "DUMBBELL_BENT_OVER_ROW",
    "curl martillo": "DUMBBELL_HAMMER_CURL",
    "gemelos de pie": "CALF_RAISE",
    "curl femoral": "LYING_LEG_CURL",
    "sentadilla bulgara": "BULGARIAN_SPLIT_SQUAT",
    "sentadilla búlgara": "BULGARIAN_SPLIT_SQUAT",
    "face pull": "CABLE_FACE_PULL",
    "remo en polea": "CABLE_SEATED_ROW",
    "press militar": "BARBELL_OVERHEAD_PRESS",
}


class PushWorkoutRequest(BaseModel):
    routine_name: str = Field(..., example="Rutina Empuje A")
    exercises: List[ExerciseLogItem] = Field(..., min_length=1)
    dry_run: bool = Field(True, description="True = solo devuelve el JSON sin enviar nada a Garmin")
    push_to_device: bool = Field(True, description="Si el envío real debe empujar el entreno al reloj")


@router.post("/push-to-garmin", summary="[Experimental] Enviar rutina de fuerza al reloj Garmin")
async def push_workout_to_garmin(
    payload: PushWorkoutRequest,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Construye un workout tipado de Garmin. Con dry_run=true no toca la cuenta.

    El envío real es experimental: requiere la cuenta vinculada y se debe probar
    en el reloj del atleta antes de considerarlo validado (T-31, Nivel 3).
    """
    built = build_strength_workout(
        payload.routine_name,
        [exercise.model_dump() for exercise in payload.exercises],
        GARMIN_EXERCISE_MAP,
    )
    if payload.dry_run:
        return {
            "status": "dry_run",
            "unmapped_exercises": built.unmapped,
            "workout_json": built.workout.to_dict(),
            "builder": "garminconnect.workout.StrengthWorkout",
            "garmin_catalog_exercises": GARMIN_CATALOG_SIZE,
            "blocks": built.blocks,
            "estimated_seconds": built.estimated_seconds,
            "push_to_device": payload.push_to_device,
            "mapping": built.mapping,
            "note": "Estructura tipada (sportType 5 y repeat groups). Revisa "
                    "'unmapped_exercises'; no se envía nada con dry_run.",
        }
    if user is None:
        raise HTTPException(status_code=401, detail="Autenticación requerida.")
    from app.core.config import settings as _settings
    from app.services.garmin_service import GarminService as _GSvc
    from app.db.models import GarminCredential as _GCred
    cred_res = await db.execute(select(_GCred).where(_GCred.user_id == user.id))
    cred = cred_res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=400, detail="Vincula tu Garmin primero.")
    if built.has_unmapped:
        raise HTTPException(
            status_code=400,
            detail=f"Ejercicios sin mapeo Garmin: {', '.join(built.unmapped)}. "
                   "Corrige el catálogo antes de enviar.",
        )
    svc = _GSvc(email=cred.garmin_email, password=None,
                token_dir=f"{_settings.GARMIN_TOKENS_DIR}_{user.id}", use_env_fallback=False)
    try:
        svc.authenticate()
        sent = svc.client.upload_strength_workout(built.workout)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Garmin rechazó el entreno: {exc}")

    workout_id = sent.get("workoutId") if isinstance(sent, dict) else None
    pushed = None
    if payload.push_to_device and workout_id is not None:
        try:
            pushed = svc.client.push_workout_to_device(workout_id=workout_id)
        except Exception as exc:  # el workout ya está subido; el push se puede reintentar
            pushed = {"error": str(exc)}
    return {
        "status": "sent",
        "unmapped_exercises": built.unmapped,
        "garmin_response": sent,
        "pushed_to_device": pushed,
        "note": "Enviado. Falta validarlo en el reloj real antes de darlo por bueno.",
    }

@router.get("/suggest", summary="Obtener sugerencia adaptativa de rutina de gimnasio por IA")
async def suggest_gym_routine(
    focus: str = Query(default="Push", description="Enfoque de la rutina ('Push', 'Pull', 'Legs', 'Full Body')"),
    intensity: str = Query(default="auto", description="'suave' | 'auto' | 'intenso' (auto = según readiness)"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GymRoutineResponse:
    today = date.today()
    
    # 1. Consultar Readiness de hoy (propios o legacy)
    bio_query = select(DailyBiometrics).where(DailyBiometrics.date == today)
    if user:
        bio_query = bio_query.where(
            or_(DailyBiometrics.user_id == user.id, DailyBiometrics.user_id.is_(None))
        ).order_by(DailyBiometrics.user_id.is_(None))
    else:
        bio_query = bio_query.where(DailyBiometrics.user_id.is_(None))
    bio_res = await db.execute(bio_query)
    bio = bio_res.scalars().first()

    fat_query = select(FatigueMetric).where(FatigueMetric.date == today)
    if user:
        fat_query = fat_query.where(
            or_(FatigueMetric.user_id == user.id, FatigueMetric.user_id.is_(None))
        ).order_by(FatigueMetric.user_id.is_(None))
    else:
        fat_query = fat_query.where(FatigueMetric.user_id.is_(None))
    fat_res = await db.execute(fat_query)
    fat = fat_res.scalars().first()
    tsb_val = fat.tsb if fat else 0.0

    readiness = FatigueEngine.calculate_readiness_score(
        sleep_score=bio.sleep_score if bio else None,
        hrv_overnight=bio.hrv_overnight_avg if bio else None,
        hrv_weekly_avg=bio.hrv_weekly_avg if bio else None,
        tsb=tsb_val
    )

    # 2. Comprobar si hubo fútbol reciente (<48h)
    two_days_ago = datetime.combine(today - timedelta(days=2), time.min)
    act_query = select(Activity).where(
        Activity.activity_type == "soccer",
        Activity.start_time >= two_days_ago
    )
    if user:
        act_query = act_query.where(or_(Activity.user_id == user.id, Activity.user_id.is_(None)))
    else:
        act_query = act_query.where(Activity.user_id.is_(None))
    act_res = await db.execute(act_query)
    recent_soccer = len(act_res.scalars().all()) > 0

    # 3. Invocar IA para la sugerencia
    routine = await GymAdvisorService.generate_routine(
        readiness_score=readiness["score"],
        readiness_status=readiness["status"],
        hrv_status="Excelente" if readiness["score"] > 75 else "Bajo",
        sleep_score=bio.sleep_score if bio else None,
        recent_soccer_match=recent_soccer,
        requested_focus=focus,
        intensity=intensity,
    )

    # 4. Contexto de calendario: eventos inamovibles en ±48h
    try:
        from datetime import datetime as _dt
        from app.db.models import CalendarEvent as _CE
        from app.api.v1.calendar import upcoming_immovable as _imm
        ev_res = await db.execute(select(_CE).where(
            _CE.user_id == user.id) if user else select(_CE).where(_CE.user_id.is_(None)))
        imm = _imm(list(ev_res.scalars().all()), _dt.utcnow(), 48)
        if imm:
            titles = ", ".join(e.title for e in imm[:2])
            routine.calendar_warning = (
                f"Ojo: {titles} en menos de 48h (inamovible). "
                "Evita pierna pesada y prioriza tren superior o descarga.")
    except Exception:
        pass

    return routine

@router.post("/log", summary="Guardar sesión de gimnasio realizada")
async def save_strength_log(
    payload: SaveStrengthLogRequest,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    # 1. Calcular tonelaje total (kg levantados)
    total_tonnage = sum(
        item.sets * item.reps * item.weight_kg for item in payload.exercises
    )

    # 2. Calcular TSS equivalente (factor por foco muscular)
    computed_tss = FatigueEngine.calculate_strength_tss(total_tonnage, payload.target_focus)

    # Convertir ejercicios a dict para JSON
    exercises_data = [item.model_dump() for item in payload.exercises]

    log_entry = StrengthLog(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        workout_date=payload.workout_date,
        routine_name=payload.routine_name,
        target_focus=payload.target_focus,
        exercises=exercises_data,
        total_tonnage_kg=total_tonnage,
        computed_tss=computed_tss,
        ai_generated=payload.ai_generated,
        notes=payload.notes
    )

    db.add(log_entry)

    # También registrar como actividad global para sumar a la fatiga
    act_entry = Activity(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        source="manual",
        activity_type="strength",
        activity_name=payload.routine_name,
        start_time=datetime.combine(payload.workout_date, time(18, 0)),
        duration_seconds=2700, # ~45 min
        training_load_tss=computed_tss
    )
    db.add(act_entry)

    await db.commit()

    return {
        "status": "success",
        "log_id": log_entry.id,
        "total_tonnage_kg": total_tonnage,
        "computed_tss": computed_tss
    }

@router.get("/history", summary="Historial de sesiones de gimnasio")
async def get_strength_history(
    limit: int = Query(default=10, ge=1, le=100),
    exercise: Optional[str] = Query(default=None, description="Filtrar por nombre de ejercicio"),
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    query = select(StrengthLog)
    if user:
        query = query.where(or_(StrengthLog.user_id == user.id, StrengthLog.user_id.is_(None)))
    else:
        query = query.where(StrengthLog.user_id.is_(None))
    result = await db.execute(query.order_by(StrengthLog.workout_date.desc()).limit(200))
    logs = result.scalars().all()

    needle = (exercise or "").strip().lower()
    out = []
    for item in logs:
        exs = item.exercises or []
        if needle:
            exs = [e for e in exs if needle in str(e.get("name", "")).lower()]
            if not exs:
                continue
        out.append({
            "id": item.id,
            "date": item.workout_date.isoformat(),
            "routine_name": item.routine_name,
            "target_focus": item.target_focus,
            "total_tonnage_kg": item.total_tonnage_kg,
            "computed_tss": item.computed_tss,
            "exercises_count": len(item.exercises or []),
            "exercises": exs if needle else item.exercises,
        })
        if len(out) >= limit:
            break
    return out


@router.get("/exercises/prs", summary="Mejor marca por ejercicio (peso máx. y mejor volumen)")
async def get_exercise_prs(
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Recorre el historial y devuelve por ejercicio: peso máximo usado y
    mejor marca estimada (peso×reps), con fecha."""
    query = select(StrengthLog)
    if user:
        query = query.where(or_(StrengthLog.user_id == user.id, StrengthLog.user_id.is_(None)))
    else:
        query = query.where(StrengthLog.user_id.is_(None))
    result = await db.execute(query.order_by(StrengthLog.workout_date.desc()).limit(500))
    prs: Dict[str, Dict[str, Any]] = {}
    for item in result.scalars().all():
        for e in item.exercises or []:
            name = str(e.get("name", "Ejercicio")).strip()
            key = name.lower()
            w = float(e.get("weight_kg") or 0)
            vol = int(e.get("sets") or 0) * int(e.get("reps") or 0) * w
            cur = prs.get(key)
            if not cur or w > cur["max_weight_kg"] or vol > cur["best_volume_kg"]:
                prs[key] = {
                    "name": name,
                    "max_weight_kg": max(w, (cur or {}).get("max_weight_kg", 0)),
                    "best_volume_kg": max(vol, (cur or {}).get("best_volume_kg", 0)),
                    "date": item.workout_date.isoformat(),
                }
    return sorted(prs.values(), key=lambda x: x["name"].lower())
