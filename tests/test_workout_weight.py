"""El workout nativo debe llevar el peso objetivo de cada serie."""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.garmin_workout import build_strength_workout


def run():
    built = build_strength_workout(
        "Empuje A",
        [{"name": "Press de banca con barra", "sets": 4, "reps": 8,
          "weight_kg": 80, "rest_seconds": 150}],
        {"press de banca con barra": "BARBELL_BENCH_PRESS"},
    )
    assert not built.has_unmapped, built.unmapped
    group = built.workout.workoutSegments[0].workoutSteps[0]
    exercise = group.workoutSteps[0]
    assert exercise.weightValue == 80000.0
    assert exercise.endConditionValue == 8.0
    assert group.numberOfIterations == 4
    print("SUCCESS: el workout nativo lleva peso objetivo (80 kg) y reps (8) en cada serie.")


if __name__ == "__main__":
    run()
