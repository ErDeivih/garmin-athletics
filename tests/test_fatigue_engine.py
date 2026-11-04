import sys
from pathlib import Path
from datetime import date, timedelta

# Añadir backend al sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.fatigue_engine import FatigueEngine

def test_foster_tss():
    tss = FatigueEngine.calculate_foster_tss(duration_minutes=90, rpe=8)
    assert tss == 1080.0, f"Esperado 1080.0, obtenido {tss}"

def test_strength_tss():
    tss = FatigueEngine.calculate_strength_tss(total_tonnage_kg=3000.0)
    assert tss == 60.0, f"Esperado 60.0, obtenido {tss}"

def test_banister_decay():
    start = date(2026, 8, 1)
    end = date(2026, 8, 7)
    history = {date(2026, 8, 1): 100.0}
    
    res = FatigueEngine.compute_daily_banister(history, start, end)
    assert len(res) == 7
    assert res[start]["atl"] > 0
    assert res[end]["atl"] < res[start]["atl"] # Comprobar decaimiento exponencial

def test_readiness_score():
    score_green = FatigueEngine.calculate_readiness_score(sleep_score=85, hrv_overnight=55.0, hrv_weekly_avg=52.0, tsb=5.0)
    assert score_green["status"] == "VERDE"
    assert score_green["score"] >= 75

    score_red = FatigueEngine.calculate_readiness_score(sleep_score=40, hrv_overnight=30.0, hrv_weekly_avg=55.0, tsb=-35.0)
    assert score_red["status"] == "ROJO"
    assert score_red["score"] < 50

if __name__ == "__main__":
    test_foster_tss()
    test_strength_tss()
    test_banister_decay()
    test_readiness_score()
    print("SUCCESS: Todas las pruebas unitarias de FatigueEngine han pasado correctamente.")
