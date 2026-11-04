import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from app.core.config import settings

logger = logging.getLogger("gym_advisor")

class ExerciseSuggestion(BaseModel):
    name: str = Field(..., example="Press Banca con Barra")
    sets: int = Field(..., ge=1, le=10, example=4)
    reps: int = Field(..., ge=1, le=300, example=10)  # hasta 300: planchas/ej. por tiempo usan segs
    target_rir: int = Field(..., ge=0, le=5, example=2, description="Reps in Reserve (RIR)")
    notes: Optional[str] = None

class GymRoutineResponse(BaseModel):
    routine_name: str = Field(..., example="Empuje Adaptativo (Torso Prioritario)")
    target_focus: str = Field(..., example="Push")
    readiness_context: str = Field(..., example="Recuperación moderada. Se reduce volumen de piernas por partido de fútbol reciente.")
    exercises: List[ExerciseSuggestion]
    estimated_duration_min: int = Field(..., example=45)
    estimated_tss: float = Field(..., example=45.0)
    calendar_warning: Optional[str] = Field(None, description="Aviso si hay evento inamovible en ±48h")


# Bancos de ejercicios por foco (nombres en ES, compatibles con el mapeo Garmin).
# El fallback rota cada día para dar variedad sin IA.
EXERCISE_POOLS: Dict[str, List[Dict[str, Any]]] = {
    "push": [
        {"name": "Press de Banca con Barra", "sets": 4, "reps": 8, "rir": 2},
        {"name": "Press Inclinado con Mancuernas", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Press Militar con Mancuernas", "sets": 3, "reps": 10, "rir": 2},
        {"name": "FONDOS en Paralelas", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Press con Mancuernas", "sets": 3, "reps": 12, "rir": 3},
        {"name": "Elevaciones Laterales", "sets": 4, "reps": 12, "rir": 1},
        {"name": "Tríceps Polea", "sets": 3, "reps": 12, "rir": 1},
        {"name": "Flexiones", "sets": 3, "reps": 15, "rir": 2},
    ],
    "pull": [
        {"name": "Remo con Barra", "sets": 4, "reps": 10, "rir": 2},
        {"name": "Jalón al Pecho", "sets": 3, "reps": 12, "rir": 2},
        {"name": "Remo en Polea", "sets": 3, "reps": 12, "rir": 2},
        {"name": "Curl de Bíceps", "sets": 3, "reps": 12, "rir": 1},
        {"name": "Dominadas", "sets": 4, "reps": 6, "rir": 1},
        {"name": "Face Pull", "sets": 3, "reps": 15, "rir": 2},
        {"name": "Remo con Mancuerna", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Curl Martillo", "sets": 3, "reps": 12, "rir": 2},
    ],
    "legs": [
        {"name": "Sentadilla", "sets": 4, "reps": 8, "rir": 2},
        {"name": "Peso Muerto", "sets": 3, "reps": 6, "rir": 2},
        {"name": "Zancadas", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Prensa", "sets": 3, "reps": 12, "rir": 2},
        {"name": "Puente de Glúteo", "sets": 3, "reps": 15, "rir": 2},
        {"name": "Gemelos de Pie", "sets": 4, "reps": 15, "rir": 1},
        {"name": "Curl Femoral", "sets": 3, "reps": 12, "rir": 2},
        {"name": "Sentadilla Búlgara", "sets": 3, "reps": 8, "rir": 2},
    ],
    "full": [
        {"name": "Press de Banca", "sets": 3, "reps": 8, "rir": 2},
        {"name": "Remo con Barra", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Sentadilla", "sets": 3, "reps": 8, "rir": 2},
        {"name": "Press Militar", "sets": 3, "reps": 10, "rir": 2},
        {"name": "Peso Muerto", "sets": 2, "reps": 6, "rir": 2},
        {"name": "Plancha", "sets": 3, "reps": 45, "rir": 3},
        {"name": "Dominadas", "sets": 3, "reps": 6, "rir": 2},
        {"name": "FONDOS en Paralelas", "sets": 3, "reps": 10, "rir": 2},
    ],
}

class GymAdvisorService:
    @staticmethod
    def _build_context_prompt(
        readiness_score: int,
        readiness_status: str,
        hrv_status: str,
        sleep_score: Optional[int],
        recent_soccer_match: bool,
        requested_focus: str
    ) -> str:
        return f"""Eres un entrenador personal de élite experto en entrenamiento de fuerza y fisiología deportiva.
Genera una rutina de gimnasio personalizada en formato JSON estricto basada en el contexto biométrico actual del usuario:

CONTEXTO BIOMÉTRICO DEL DÍA:
- Puntuación de Disposición (Readiness): {readiness_score}/100 ({readiness_status})
- Estado de HRV: {hrv_status}
- Puntuación de Sueño: {sleep_score if sleep_score else 'N/D'}/100
- Partido de Fútbol Reciente (<48h): {'SÍ (Fatiga neuromuscular alta en piernas/cuádriceps/isquios)' if recent_soccer_match else 'NO'}
- Enfoque Solicitado: {requested_focus}

REGLAS DE SEGURIDAD Y ADAPTACIÓN:
1. Si hubo partido de fútbol reciente O la disposición es AMARILLO/ROJO, EVITA sentadillas pesadas, peso muerto máximo o trabajo explosivo de piernas. Prioriza tren superior o ejercicios de prevención sin carga axil.
2. Si la disposición es VERDE y no hay fútbol reciente, puedes sugerir cargas principales a RIR 1-2.
3. Responde EXCLUSIVAMENTE con una estructura JSON válida que coincida con este esquema:

{{
  "routine_name": "Nombre descriptivo de la rutina",
  "target_focus": "{requested_focus}",
  "readiness_context": "Breve explicación fisiológica de por qué se sugieren estos ejercicios y volúmenes",
  "estimated_duration_min": 45,
  "estimated_tss": 40.0,
  "exercises": [
    {{
      "name": "Nombre del Ejercicio",
      "sets": 3,
      "reps": 10,
      "target_rir": 2,
      "notes": "Indicaciones técnicas o de seguridad"
    }}
  ]
}}
"""

    @classmethod
    async def generate_routine(
        cls,
        readiness_score: int = 75,
        readiness_status: str = "VERDE",
        hrv_status: str = "Normal",
        sleep_score: Optional[int] = 80,
        recent_soccer_match: bool = False,
        requested_focus: str = "Push",
        intensity: str = "auto",
    ) -> GymRoutineResponse:
        api_key = os.getenv("LLM_API_KEY")
        
        # 1. Si hay API Key de DeepSeek u OpenAI, invocamos el modelo
        if api_key and len(api_key) > 5:
            try:
                prompt = cls._build_context_prompt(
                    readiness_score, readiness_status, hrv_status, sleep_score, recent_soccer_match, requested_focus
                )
                if intensity in ("suave", "intenso"):
                    prompt += f"\nINTENSIDAD PEDIDA POR EL USUARIO: {intensity.upper()}. Ajusta volumen y RIR en consecuencia."
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                # Soporte para DeepSeek API o OpenAI compatible
                url = os.getenv("LLM_API_URL", "https://api.deepseek.com/v1/chat/completions")
                payload = {
                    "model": os.getenv("LLM_MODEL", "deepseek-chat"),
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"}
                }
                
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed_json = json.loads(content)
                        return GymRoutineResponse(**parsed_json)
                    else:
                        logger.warning(f"Error llamando a LLM API ({resp.status_code}). Usando motor adaptativo local...")
            except Exception as e:
                logger.error(f"Fallo al invocar motor LLM remoto: {e}. Usando fallback local...")

        # 2. Motor Adaptativo Estático (Fallback sin API Key)
        return cls._generate_fallback_routine(readiness_score, recent_soccer_match, requested_focus, intensity)

    @classmethod
    def _generate_fallback_routine(
        cls,
        readiness_score: int,
        recent_soccer: bool,
        focus: str,
        intensity: str = "auto",
    ) -> GymRoutineResponse:
        from datetime import date as _date
        # Banco según foco + rotación diaria (variedad sin IA)
        pool = EXERCISE_POOLS.get((focus or "").strip().lower(), EXERCISE_POOLS["full"])
        if not pool:
            pool = EXERCISE_POOLS["full"]
        rot = _date.today().toordinal() % len(pool)
        rotated = pool[rot:] + pool[:rot]

        def _pick(n: int, soft: bool = False) -> List[ExerciseSuggestion]:
            out = []
            for e in rotated[:n]:
                sets, reps, rir = e["sets"], e["reps"], e["rir"]
                if soft:
                    sets, rir = max(2, sets - 1), min(4, rir + 1)
                out.append(ExerciseSuggestion(name=e["name"], sets=sets, reps=reps,
                                              target_rir=rir, notes="Bombeo" if soft else None))
            return out

        # La intensidad manual manda sobre el readiness (suave/intenso),
        # 'auto' usa el score como antes. El fútbol reciente protege piernas
        # salvo que se pida 'intenso' explícitamente.
        if recent_soccer and intensity != "intenso":
            context_msg = "Se ha detectado partido de fútbol reciente. Las piernas quedan en descanso activo/recuperación."
            # Tren superior del banco push+pull rotado
            upper = (EXERCISE_POOLS["push"] + EXERCISE_POOLS["pull"])
            rot2 = _date.today().toordinal() % len(upper)
            exercises = [ExerciseSuggestion(name=e["name"], sets=e["sets"], reps=e["reps"],
                                            target_rir=e["rir"])
                         for e in (upper[rot2:] + upper[:rot2])[:4]]
            exercises.append(ExerciseSuggestion(name="Puente de Glúteo", sets=2, reps=15,
                                                target_rir=3, notes="Activación isquios suave"))
        elif intensity == "suave":
            context_msg = "Sesión suave a petición: técnica y bombeo, RIR alto."
            exercises = _pick(4, soft=True)
        elif intensity == "intenso" or readiness_score >= 75:
            context_msg = "Recuperación óptima (o intensidad pedida). Puedes entrenar con alta intensidad a RIR 1-2."
            picked = _pick(4)
            exercises = [ExerciseSuggestion(name=e.name, sets=e.sets, reps=e.reps,
                                            target_rir=max(1, e.target_rir - 1),
                                            notes=e.notes) for e in picked]
        else:
            context_msg = "Fatiga acumulada moderada. Reducción de volumen y cargas conservadoras."
            exercises = _pick(3, soft=True)

        return GymRoutineResponse(
            routine_name=f"Rutina Adaptativa de {focus}",
            target_focus=focus,
            readiness_context=context_msg,
            estimated_duration_min=45,
            estimated_tss=45.0,
            exercises=exercises
        )
