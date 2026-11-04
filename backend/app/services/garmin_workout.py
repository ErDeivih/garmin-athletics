"""Construcción de entrenamientos de fuerza para Garmin Connect (T-31).

Usa los modelos **tipados** de `garminconnect.workout` en lugar de fabricar el
JSON a mano: el servidor de Garmin valida la estructura (sportType 5, bloques
de repeticiones con descanso, unidades de peso) y la librería ya la genera.

No se inventa el mapeo: si un ejercicio no está en el catálogo oficial, se
devuelve en `unmapped` y **no** se envía. Antes de enviar de verdad hay que
probar un entrenamiento en el reloj de David (Nivel 3).
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from garminconnect.exercises import EXERCISES
from garminconnect.workout import (
    StrengthWorkout, WorkoutSegment, create_strength_set,
)

# El catálogo de la librería tiene 1.527 ejercicios con (categoría, ejercicio).
# Nuestro mapa de nombres usa algunos enums que Garmin nombra distinto; aquí se
# resuelven explícitamente para no caer en un ejercicio genérico silencioso.
_CATALOG_BY_EXERCISE: Dict[str, Dict[str, str]] = {
    item["exercise"]: item for item in EXERCISES
}
_ALIASES: Dict[str, Tuple[str, str]] = {
    "BARBELL_BENT_OVER_ROW": ("ROW", "BENT_OVER_ROW_WITH_BARBELL"),
    "BARBELL_CURL": ("CURL", "BARBELL_BICEPS_CURL"),
    "BARBELL_OVERHEAD_PRESS": ("SHOULDER_PRESS", "BARBELL_SHOULDER_PRESS"),
    "BARBELL_SQUAT": ("SQUAT", "BARBELL_BACK_SQUAT"),
    "BULGARIAN_SPLIT_SQUAT": ("LUNGE", "BARBELL_BULGARIAN_SPLIT_SQUAT"),
    "CABLE_FACE_PULL": ("ROW", "FACE_PULL"),
    "CABLE_SEATED_ROW": ("ROW", "SEATED_CABLE_ROW"),
    "CABLE_TRICEPS_PUSHDOWN": ("TRICEPS_EXTENSION", "TRICEPS_PRESSDOWN"),
    "DUMBBELL_BENT_OVER_ROW": ("ROW", "BENT_OVER_ROW_WITH_DUMBELL"),
    "DUMBBELL_INCLINE_BENCH_PRESS": ("BENCH_PRESS", "INCLINE_DUMBBELL_BENCH_PRESS"),
    "LYING_LEG_CURL": ("LEG_CURL", "LEG_CURL"),
}

DEFAULT_REST_SECONDS = 120
GARMIN_CATALOG_SIZE = len(EXERCISES)


def resolve_garmin_exercise(enum: Optional[str]) -> Optional[Tuple[str, str]]:
    """Devuelve (categoría, ejercicio) del catálogo Garmin, o None si no existe."""
    if not enum:
        return None
    if enum in _ALIASES:
        return _ALIASES[enum]
    item = _CATALOG_BY_EXERCISE.get(enum)
    if item:
        return item["category"], item["exercise"]
    return None


@dataclass
class BuiltStrengthWorkout:
    workout: StrengthWorkout
    unmapped: List[str] = field(default_factory=list)
    blocks: int = 0
    estimated_seconds: int = 0
    mapping: List[Dict[str, str]] = field(default_factory=list)

    @property
    def has_unmapped(self) -> bool:
        return len(self.unmapped) > 0


def build_strength_workout(
    routine_name: str,
    exercises: List[Dict[str, Any]],
    exercise_map: Dict[str, str],
) -> BuiltStrengthWorkout:
    """Construye un `StrengthWorkout` tipado.

    `exercise_map` es el mapa nombre normalizado → enum de Garmin (el que ya
    usa el backend). Los ejercicios sin resolver se excluyen y se listan: nunca
    se sustituyen por un ejercicio genérico que el atleta no ha pedido.
    """
    sport_type = {"sportTypeId": 5, "sportTypeKey": "strength_training", "displayOrder": 5}
    steps = []
    unmapped: List[str] = []
    mapping: List[Dict[str, str]] = []
    order = 1
    total_seconds = 0

    for exercise in exercises:
        name = str(exercise.get("name", "Ejercicio"))
        normalized = _normalize(name)
        enum = exercise_map.get(normalized)
        resolved = resolve_garmin_exercise(enum)
        if resolved is None:
            unmapped.append(name)
            continue
        category, exercise_name = resolved
        sets = int(exercise.get("sets", 3) or 3)
        reps = int(exercise.get("reps", 10) or 10)
        weight = float(exercise.get("weight_kg", 0) or 0)
        rest = int(exercise.get("rest_seconds", DEFAULT_REST_SECONDS) or DEFAULT_REST_SECONDS)
        block = create_strength_set(
            category,
            step_order=order,
            sets=sets,
            reps=reps,
            rest_seconds=rest,
            exercise_name=exercise_name,
            weight_kg=weight if weight > 0 else None,
        )
        steps.append(block)
        mapping.append({
            "name": name,
            "enum": enum or "",
            "category": category,
            "exercise": exercise_name,
        })
        order += 3
        total_seconds += sets * (reps * 3 + rest)

    workout = StrengthWorkout(
        workoutName=routine_name[:60],
        estimatedDurationInSecs=max(60, total_seconds),
        workoutSegments=[
            WorkoutSegment(
                segmentOrder=1,
                sportType=sport_type,
                workoutSteps=steps,
            )
        ],
    )
    return BuiltStrengthWorkout(
        workout=workout,
        unmapped=unmapped,
        blocks=len(steps),
        estimated_seconds=total_seconds,
        mapping=mapping,
    )


def _normalize(name: str) -> str:
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", name.strip().lower())
    return "".join(char for char in nfkd if not unicodedata.combining(char))
