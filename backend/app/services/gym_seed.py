"""Semilla del catálogo de ejercicios (DECISIONES.md D-04).

Catálogo propio en español, construido a partir de lo que YA existía hardcodeado en el
backend (`GARMIN_EXERCISE_MAP` en `api/v1/strength.py` y `EXERCISE_POOLS` en
`services/gym_advisor.py`). El `garmin_enum` solo se rellena cuando se conocía con certeza:
inventarlo haría que `push-to-garmin` enviara un entono que Garmin rechaza.

La semilla es idempotente: se compara por `slug` y solo se insertan los que faltan.
"""
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Exercise


def normalize_search(text: str) -> str:
    """Minúsculas y sin tildes: así "biceps" encuentra "bíceps" y "jalon" encuentra "Jalón"."""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", (text or "").strip().lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))

# Valores permitidos. El frontend los usa para los filtros; el backend para validar.
MUSCLE_GROUPS = (
    "pecho", "espalda", "hombro", "biceps", "triceps", "cuadriceps",
    "isquios", "gluteo", "gemelo", "core", "cuerpo_completo",
)

EQUIPMENT = (
    "barra", "mancuerna", "maquina", "polea", "peso_corporal", "banda",
    "kettlebell", "otro",
)

MUSCLE_GROUP_LABELS = {
    "pecho": "Pecho", "espalda": "Espalda", "hombro": "Hombro",
    "biceps": "Bíceps", "triceps": "Tríceps", "cuadriceps": "Cuádriceps",
    "isquios": "Isquiotibiales", "gluteo": "Glúteo", "gemelo": "Gemelo",
    "core": "Core", "cuerpo_completo": "Cuerpo completo",
}

EQUIPMENT_LABELS = {
    "barra": "Barra", "mancuerna": "Mancuerna", "maquina": "Máquina",
    "polea": "Polea", "peso_corporal": "Peso corporal", "banda": "Banda",
    "kettlebell": "Kettlebell", "otro": "Otro",
}


def _e(name, slug, group, equipment, secondary=None, unilateral=False,
       timed=False, notes=None, garmin_enum=None) -> Dict[str, Any]:
    return {
        "name": name, "slug": slug, "muscle_group": group, "equipment": equipment,
        "secondary_muscles": secondary or [], "is_unilateral": unilateral,
        "is_timed": timed, "notes": notes, "garmin_enum": garmin_enum,
        "search_text": normalize_search(name),
    }


SEED_EXERCISES: List[Dict[str, Any]] = [
    # --- Pecho ---
    _e("Press de banca con barra", "press-banca-barra", "pecho", "barra",
       ["triceps", "hombro"], notes="Codos a unos 45° del torso; la barra baja a la línea del pecho.",
       garmin_enum="BARBELL_BENCH_PRESS"),
    _e("Press inclinado con mancuernas", "press-inclinado-mancuernas", "pecho", "mancuerna",
       ["hombro", "triceps"], notes="Banco a 30-45°; no juntes las mancuernas arriba.",
       garmin_enum="DUMBBELL_INCLINE_BENCH_PRESS"),
    _e("Press con mancuernas", "press-mancuernas", "pecho", "mancuerna",
       ["triceps"], garmin_enum="DUMBBELL_BENCH_PRESS"),
    _e("Press en máquina", "press-maquina", "pecho", "maquina", ["triceps"]),
    _e("Aperturas con mancuernas", "aperturas-mancuernas", "pecho", "mancuerna",
       ["hombro"], notes="Codo casi recto; abre hasta notar estiramiento, sin dolor."),
    _e("Fondos en paralelas", "fondos-paralelas", "pecho", "peso_corporal",
       ["triceps", "hombro"], notes="Inclina el torso hacia delante para cargar más pecho.",
       garmin_enum="DIP"),
    _e("Flexiones", "flexiones", "pecho", "peso_corporal", ["triceps", "core"],
       garmin_enum="PUSH_UP"),
    # --- Espalda ---
    _e("Remo con barra", "remo-barra", "espalda", "barra", ["biceps"],
       notes="Torso a 45°, lleva la barra al ombligo, no al pecho.",
       garmin_enum="BARBELL_BENT_OVER_ROW"),
    _e("Remo con mancuerna", "remo-mancuerna", "espalda", "mancuerna",
       ["biceps"], unilateral=True, garmin_enum="DUMBBELL_BENT_OVER_ROW"),
    _e("Remo en polea baja", "remo-polea-baja", "espalda", "polea", ["biceps"],
       garmin_enum="CABLE_SEATED_ROW"),
    _e("Jalón al pecho", "jalon-al-pecho", "espalda", "polea", ["biceps"],
       notes="Codos hacia abajo y atrás; no lleves la barra a la nuca.",
       garmin_enum="LAT_PULLDOWN"),
    _e("Dominadas", "dominadas", "espalda", "peso_corporal", ["biceps", "core"],
       notes="Si no llegas, usa banda o máquina asistida.", garmin_enum="PULL_UP"),
    _e("Face pull", "face-pull", "espalda", "polea", ["hombro"],
       notes="Cuerda a la cara, abre codos. Salud del hombro.", garmin_enum="CABLE_FACE_PULL"),
    _e("Remo en máquina", "remo-maquina", "espalda", "maquina", ["biceps"]),
    _e("Encogimientos de hombros", "encogimientos", "espalda", "barra", ["hombro"],
       notes="Sube el hombro, no rotes el brazo."),
    # --- Hombro ---
    _e("Press militar con barra", "press-militar-barra", "hombro", "barra",
       ["triceps"], notes="Aprieta glúteos y core; no arquees la lumbar.",
       garmin_enum="BARBELL_OVERHEAD_PRESS"),
    _e("Press militar con mancuernas", "press-militar-mancuernas", "hombro",
       "mancuerna", ["triceps"], garmin_enum="DUMBBELL_SHOULDER_PRESS"),
    _e("Elevaciones laterales", "elevaciones-laterales", "hombro", "mancuerna",
       notes="Codo ligeramente flexionado; sube hasta la altura del hombro.",
       garmin_enum="DUMBBELL_LATERAL_RAISE"),
    _e("Elevaciones frontales", "elevaciones-frontales", "hombro", "mancuerna"),
    _e("Pájaros (deltoide posterior)", "pajaros", "hombro", "mancuerna",
       ["espalda"], notes="Torso inclinado; abre con codos casi rectos."),
    _e("Press Arnold", "press-arnold", "hombro", "mancuerna", ["triceps"]),
    # --- Bíceps ---
    _e("Curl de bíceps con barra", "curl-biceps-barra", "biceps", "barra",
       garmin_enum="BARBELL_CURL"),
    _e("Curl martillo", "curl-martillo", "biceps", "mancuerna",
       garmin_enum="DUMBBELL_HAMMER_CURL"),
    _e("Curl en polea", "curl-polea", "biceps", "polea"),
    _e("Curl predicador", "curl-predicador", "biceps", "maquina"),
    # --- Tríceps ---
    _e("Extensión de tríceps en polea", "triceps-polea", "triceps", "polea",
       notes="Codos pegados al cuerpo; estira del todo abajo.",
       garmin_enum="CABLE_TRICEPS_PUSHDOWN"),
    _e("Extensión sobre la cabeza", "triceps-sobre-cabeza", "triceps", "polea",
       notes="Codos apuntando arriba; el rango largo es lo que trabaja."),
    _e("Fondos en banco", "fondos-banco", "triceps", "peso_corporal", ["pecho"]),
    _e("Patada de tríceps", "patada-triceps", "triceps", "mancuerna"),
    # --- Cuádriceps ---
    _e("Sentadilla con barra", "sentadilla-barra", "cuadriceps", "barra",
       ["gluteo", "isquios"], notes="Rodillas en línea con los pies; baja hasta paralelo o algo más.",
       garmin_enum="BARBELL_SQUAT"),
    _e("Sentadilla frontal", "sentadilla-frontal", "cuadriceps", "barra",
       ["gluteo"], notes="Codos altos; más cuádriceps y más exigencia de core."),
    _e("Sentadilla búlgara", "sentadilla-bulgara", "cuadriceps", "mancuerna",
       ["gluteo"], unilateral=True, garmin_enum="BULGARIAN_SPLIT_SQUAT"),
    _e("Prensa de piernas", "prensa-piernas", "cuadriceps", "maquina",
       ["gluteo"], garmin_enum="LEG_PRESS"),
    _e("Zancadas", "zancadas", "cuadriceps", "mancuerna", ["gluteo"],
       unilateral=True, garmin_enum="LUNGE"),
    _e("Extensión de cuádriceps", "extension-cuadriceps", "cuadriceps", "maquina"),
    # --- Isquiotibiales ---
    _e("Peso muerto convencional", "peso-muerto", "isquios", "barra",
       ["espalda", "gluteo"], notes="Barra pegada a la pierna; empuja el suelo con los pies.",
       garmin_enum="BARBELL_DEADLIFT"),
    _e("Peso muerto rumano", "peso-muerto-rumano", "isquios", "barra",
       ["gluteo"], notes="Piernas casi rectas; baja la barra por delante de la pierna."),
    _e("Peso muerto rumano con mancuernas", "peso-muerto-rumano-mancuernas",
       "isquios", "mancuerna", ["gluteo"]),
    _e("Curl femoral tumbado", "curl-femoral-tumbado", "isquios", "maquina",
       garmin_enum="LYING_LEG_CURL"),
    # --- Glúteo ---
    _e("Puente de glúteo", "puente-gluteo", "gluteo", "peso_corporal", ["isquios"],
       garmin_enum="GLUTE_BRIDGE"),
    _e("Hip thrust con barra", "hip-thrust", "gluteo", "barra", ["isquios"],
       notes="Espalda apoyada en el banco; aprieta el glúteo arriba."),
    _e("Patada de glúteo en polea", "patada-gluteo-polea", "gluteo", "polea",
       unilateral=True),
    # --- Gemelo ---
    _e("Gemelos de pie", "gemelos-pie", "gemelo", "maquina", garmin_enum="CALF_RAISE"),
    _e("Gemelos sentado", "gemelos-sentado", "gemelo", "maquina"),
    # --- Core ---
    _e("Plancha abdominal", "plancha", "core", "peso_corporal", ["hombro"],
       timed=True, notes="Se mide en segundos, no en repeticiones.",
       garmin_enum="PLANK"),
    _e("Plancha lateral", "plancha-lateral", "core", "peso_corporal",
       unilateral=True, timed=True),
    _e("Crunch en polea", "crunch-polea", "core", "polea"),
    _e("Elevación de piernas colgado", "elevacion-piernas", "core", "peso_corporal"),
    _e("Rueda abdominal", "rueda-abdominal", "core", "otro", ["hombro"]),
    _e("Russian twist", "russian-twist", "core", "otro"),
    # --- Cuerpo completo ---
    _e("Burpee", "burpee", "cuerpo_completo", "peso_corporal"),
    _e("Kettlebell swing", "kettlebell-swing", "cuerpo_completo", "kettlebell",
       ["gluteo", "isquios"], notes="El movimiento sale de la cadera, no de los brazos."),
]


async def seed_exercise_catalog(session: AsyncSession) -> int:
    """Inserta los ejercicios de semilla que falten. Devuelve cuántos ha añadido."""
    result = await session.execute(
        select(Exercise.slug).where(Exercise.user_id.is_(None))
    )
    existing = {row[0] for row in result.all()}
    added = 0
    for item in SEED_EXERCISES:
        if item["slug"] in existing:
            continue
        session.add(Exercise(
            user_id=None,
            source="seed",
            name=item["name"],
            slug=item["slug"],
            search_text=item["search_text"],
            muscle_group=item["muscle_group"],
            secondary_muscles=item["secondary_muscles"],
            equipment=item["equipment"],
            is_unilateral=item["is_unilateral"],
            is_timed=item["is_timed"],
            notes=item["notes"],
            garmin_enum=item["garmin_enum"],
        ))
        added += 1
    if added:
        await session.commit()

    # Autorreparación: si una semilla antigua no tiene search_text, se rellena.
    stale = await session.execute(
        select(Exercise).where(Exercise.user_id.is_(None), Exercise.search_text.is_(None))
    )
    fixed = 0
    for ex in stale.scalars().all():
        ex.search_text = normalize_search(ex.name)
        fixed += 1
    if fixed:
        await session.commit()
    return added
