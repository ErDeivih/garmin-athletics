import math
import logging
from datetime import date, timedelta
from typing import Dict, List, Any, Optional

logger = logging.getLogger("fatigue_engine")

class FatigueEngine:
    # Constantes del modelo de Banister (días de decaimiento exponencial)
    DAYS_ATL = 7.0
    DAYS_CTL = 42.0

    @staticmethod
    def calculate_foster_tss(duration_minutes: float, rpe: float) -> float:
        """
        Calcula la carga TRIMP / Foster para sesiones de fútbol o deportes sin GPS:
        Carga = Duración (min) * RPE (1-10) * 1.5
        """
        rpe_clamped = max(1.0, min(10.0, float(rpe)))
        return round(duration_minutes * rpe_clamped * 1.5, 2)

    FOCUS_TSS_FACTOR = {
        "legs": 0.03, "push": 0.02, "pull": 0.02,
        "full body": 0.025, "full": 0.025, "core": 0.015,
    }

    @staticmethod
    def calculate_strength_tss(total_tonnage_kg: float, focus: str = "") -> float:
        """
        Calcula el equivalente TSS para sesiones de fuerza.
        Factor por grupo muscular (default 0.02 por compatibilidad histórica):
        Legs 0.03, Push/Pull 0.02, Full 0.025, Core 0.015.
        Ejemplo: 3,000 kg de empuje -> 60 TSS
        """
        factor = FatigueEngine.FOCUS_TSS_FACTOR.get((focus or "").strip().lower(), 0.02)
        return round(total_tonnage_kg * factor, 2)

    @staticmethod
    def calculate_garmin_tss(duration_seconds: int, epoc: Optional[float] = None, avg_hr: Optional[int] = None) -> float:
        """
        Calcula el TSS para actividades de resistencia (Carrera, Bici, Natación).
        Si Garmin proporciona EPOC/Training Effect (0.0 - 5.0), lo escala a TSS (~25-150).
        """
        if epoc is not None and epoc > 0:
            # Garmin Training Effect (1.0 - 5.0) -> TSS aproximado (20 - 150)
            return round(epoc * 28.0, 2)
        
        # Fallback TRIMP simplificado si solo hay pulsaciones y tiempo
        duration_minutes = duration_seconds / 60.0
        if avg_hr and avg_hr > 0:
            hr_intensity_factor = max(0.5, min(1.0, avg_hr / 185.0))
            return round(duration_minutes * (hr_intensity_factor ** 2) * 1.2, 2)
        
        # Fallback por tiempo genérico (ritmo moderado ~50 TSS/hora)
        return round(duration_minutes * 0.8, 2)

    @classmethod
    def compute_daily_banister(
        cls, 
        daily_tss_history: Dict[date, float], 
        start_date: date, 
        end_date: date
    ) -> Dict[date, Dict[str, float]]:
        """
        Aplica la fórmula de Banister Impulse-Response sobre una serie temporal continua.
        Retorna un diccionario {fecha: {ATL, CTL, TSB}}.
        """
        atl_decay = math.exp(-1.0 / cls.DAYS_ATL) # ~0.8669
        ctl_decay = math.exp(-1.0 / cls.DAYS_CTL) # ~0.9764

        atl = 0.0
        ctl = 0.0
        results = {}

        current = start_date
        while current <= end_date:
            tss = daily_tss_history.get(current, 0.0)
            
            # TSB es el balance de frescura AL INICIO del día (basado en la forma y fatiga acumulada de ayer)
            tsb = ctl - atl

            # Actualización exponencial acumulativa de Banister
            atl = (atl * atl_decay) + (tss * (1.0 - atl_decay))
            ctl = (ctl * ctl_decay) + (tss * (1.0 - ctl_decay))

            results[current] = {
                "atl": round(atl, 2),
                "ctl": round(ctl, 2),
                "tsb": round(tsb, 2),
                "tss_today": round(tss, 2)
            }
            current += timedelta(days=1)

        return results

    @staticmethod
    def calculate_readiness_score(
        sleep_score: Optional[int], 
        hrv_overnight: Optional[float], 
        hrv_weekly_avg: Optional[float], 
        tsb: float
    ) -> Dict[str, Any]:
        """
        Calcula el Readiness Score (0 - 100) y clasifica el estado en Verde/Amarillo/Rojo:
        - 35% Calidad de Sueño
        - 40% Estado de HRV (Relación Noche actual vs Media 7 días)
        - 25% TSB (Frescura/Disposición Fisiológica)
        """
        # 1. Puntuación de Sueño (default 70 si es Nulo)
        s_score = sleep_score if sleep_score is not None else 70

        # 2. Factor HRV (100% si está en la media, penaliza bajadas bruscas)
        if hrv_overnight and hrv_weekly_avg and hrv_weekly_avg > 0:
            ratio = hrv_overnight / hrv_weekly_avg
            # Rango 0.8 (80%) a 1.2 (120%)
            hrv_score = max(30.0, min(100.0, ratio * 100.0))
        else:
            hrv_score = 75.0

        # 3. Factor TSB (-30 fatiga extrema = 20 pts, 0 neutro = 75 pts, +15 fresco = 95 pts)
        tsb_clamped = max(-40.0, min(20.0, tsb))
        tsb_score = max(20.0, min(100.0, 75.0 + (tsb_clamped * 1.25)))

        # Ponderación Final
        final_score = int(round((s_score * 0.35) + (hrv_score * 0.40) + (tsb_score * 0.25)))
        final_score = max(0, min(100, final_score))

        # Semáforo de Disposición
        if final_score >= 75:
            status = "VERDE"
            message = "Excelente disposición para entrenar. Tu cuerpo está recuperado para alta intensidad."
        elif final_score >= 50:
            status = "AMARILLO"
            message = "Recuperación moderada. Prioriza intensidad media o reduce volumen."
        else:
            status = "ROJO"
            message = "Alta fatiga acumulada o HRV bajo. Recomendado descanso activo o sesión suave."

        return {
            "score": final_score,
            "status": status,
            "message": message,
            "components": {
                "sleep_contribution": round(s_score * 0.35, 1),
                "hrv_contribution": round(hrv_score * 0.40, 1),
                "tsb_contribution": round(tsb_score * 0.25, 1)
            }
        }
