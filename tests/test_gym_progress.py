"""Progreso por ejercicio y semana: ventana, tonelaje y mejor serie.

Cubre el contrato de `GET /strength/progress`:
- ventana de `weeks` semanas contada desde el lunes de la semana en curso
  (12 por defecto, mínimo 4), con todas las semanas, también vacías;
- solo series de trabajo: fuera calentamientos, peso <= 0 y reps <= 0;
- `best_set` = más weight×reps y, en empate, la de más peso;
- `exercises` ordena por tonelaje descendente y alimenta el selector;
- sin `exercise_id` se elige el ejercicio con más volumen de la ventana;
- sin datos, `exercise: null`, la ventana a cero y `exercises: []`.

Script standalone, como el resto de `tests/`: BD SQLite efímera con TestClient,
sin tocar la base real ni Garmin. Ejecutar:
    .\\venv\\Scripts\\python.exe tests\\test_gym_progress.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_gym_progress.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"

BENCH = "Press de banca con barra"
ROW = "Remo con barra"

CLAVES_SEMANA = {"week_start", "tonnage_kg", "sets", "sessions", "best_set"}
CLAVES_RESPUESTA = {"exercise", "weeks", "totals", "exercises"}


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _register(email: str) -> dict:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": email.split("@")[0],
        "display_name": "Progreso", "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _pick(name: str) -> dict:
    """Ejercicio del catálogo sembrado por nombre exacto."""
    res = client.get(f"{API}/strength/exercises", params={"q": name})
    assert res.status_code == 200, res.text
    for item in res.json()["items"]:
        if item["name"] == name:
            return item
    raise AssertionError(f"El catálogo no tiene '{name}'")


def _session(headers: dict, day: date, sets: list, hour: int = 18) -> dict:
    """Guarda una sesión de una hora en `day` a partir de `hour`."""
    res = client.post(f"{API}/strength/sessions", headers=headers, json={
        "started_at": f"{day.isoformat()}T{hour:02d}:00:00",
        "finished_at": f"{day.isoformat()}T{hour + 1:02d}:00:00",
        "sets": sets,
    })
    assert res.status_code == 201, res.text
    return res.json()


def _progress(headers: dict, **params) -> dict:
    res = client.get(f"{API}/strength/progress", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return res.json()


def _assert_semana_vacia(semana: dict, week_start: date) -> None:
    assert set(semana) == CLAVES_SEMANA, semana
    assert semana["week_start"] == week_start.isoformat(), semana
    assert semana["tonnage_kg"] == 0.0, semana
    assert semana["sets"] == 0 and semana["sessions"] == 0, semana
    assert semana["best_set"] is None, semana


def _assert_best(best: dict, weight: float, reps: int) -> None:
    assert set(best) == {"weight_kg", "reps", "tonnage_kg"}, best
    assert best["weight_kg"] == weight, best
    assert best["reps"] == reps, best
    assert best["tonnage_kg"] == round(weight * reps, 2), best


# ---------------------------------------------------------------------------
# Caso completo
# ---------------------------------------------------------------------------

def run():
    with client:  # dispara el arranque: init_db + semilla del catálogo
        pass
    h = _register("progreso@example.com")
    bench = _pick(BENCH)
    row = _pick(ROW)

    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    w4 = lunes - timedelta(weeks=4)   # fuera de la ventana de 4 semanas
    w3 = lunes - timedelta(weeks=3)   # semana más antigua de la ventana: vacía
    w2 = lunes - timedelta(weeks=2)
    w1 = lunes - timedelta(weeks=1)
    actual = lunes

    # --- Sesiones de banca -------------------------------------------------
    # w4: solo entra con la ventana por defecto (12 semanas), sirve de límite.
    _session(h, w4 + timedelta(days=1), [
        {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 100, "reps": 5},
    ])
    # w2: el calentamiento no cuenta y 60×7 empata con 70×6 en tonelaje.
    _session(h, w2 + timedelta(days=1), [
        {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 40, "reps": 10,
         "is_warmup": True},
        {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 60, "reps": 7},
        {"exercise_id": bench["id"], "set_number": 3, "weight_kg": 70, "reps": 6},
    ])
    # w1: dos sesiones; peso 0 y reps 0 quedan fuera por no ser series de trabajo.
    _session(h, w1 + timedelta(days=2), [
        {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 75, "reps": 5},
        {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 80, "reps": 3},
        {"exercise_id": bench["id"], "set_number": 3, "weight_kg": 0, "reps": 10},
        {"exercise_id": bench["id"], "set_number": 4, "weight_kg": 50, "reps": 0},
    ])
    _session(h, w1 + timedelta(days=4), [
        {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 82.5, "reps": 2},
    ])
    # Semana actual: remo, con menos volumen que la banca (no es el defecto).
    _session(h, actual + timedelta(days=1), [
        {"exercise_id": row["id"], "set_number": 1, "weight_kg": 50, "reps": 10},
        {"exercise_id": row["id"], "set_number": 2, "weight_kg": 55, "reps": 4},
    ])

    # --- 1. Sin exercise_id: el de más volumen y ventana de 4 semanas ------
    data = _progress(h, weeks=4)
    assert set(data) == CLAVES_RESPUESTA, data
    assert data["exercise"]["id"] == bench["id"], data["exercise"]
    assert data["exercise"]["name"] == BENCH, data["exercise"]
    assert data["exercise"]["muscle_group"] == bench["muscle_group"], data["exercise"]
    assert [w["week_start"] for w in data["weeks"]] == [
        w3.isoformat(), w2.isoformat(), w1.isoformat(), actual.isoformat()], data["weeks"]

    _assert_semana_vacia(data["weeks"][0], w3)

    semana_w2 = data["weeks"][1]
    assert set(semana_w2) == CLAVES_SEMANA, semana_w2
    assert semana_w2["tonnage_kg"] == 840.0, semana_w2       # 60×7 + 70×6
    assert semana_w2["sets"] == 2 and semana_w2["sessions"] == 1, semana_w2
    _assert_best(semana_w2["best_set"], 70.0, 6)              # empate: más peso

    semana_w1 = data["weeks"][2]
    assert semana_w1["tonnage_kg"] == 780.0, semana_w1        # 375 + 240 + 165
    assert semana_w1["sets"] == 3 and semana_w1["sessions"] == 2, semana_w1
    _assert_best(semana_w1["best_set"], 75.0, 5)

    _assert_semana_vacia(data["weeks"][3], actual)

    assert set(data["totals"]) == {"tonnage_kg", "sets", "best_set"}, data["totals"]
    assert data["totals"]["tonnage_kg"] == 1620.0, data["totals"]
    assert data["totals"]["sets"] == 5, data["totals"]
    _assert_best(data["totals"]["best_set"], 70.0, 6)
    # w4 queda fuera de la ventana de 4 semanas: no suma 500 kg.
    assert data["totals"]["tonnage_kg"] != 2120.0, data["totals"]

    # `exercises`: solo ejercicios con series de trabajo, de más a menos volumen.
    assert data["exercises"] == [
        {"id": bench["id"], "name": BENCH, "tonnage_kg": 1620.0},
        {"id": row["id"], "name": ROW, "tonnage_kg": 720.0},
    ], data["exercises"]

    # --- 2. Ejercicio explícito: el remo trae su propia serie --------------
    solo_remo = _progress(h, exercise_id=row["id"], weeks=4)
    assert set(solo_remo) == CLAVES_RESPUESTA, solo_remo
    assert solo_remo["exercise"]["id"] == row["id"], solo_remo["exercise"]
    assert solo_remo["exercise"]["name"] == ROW, solo_remo["exercise"]
    assert solo_remo["exercise"]["muscle_group"] == row["muscle_group"], solo_remo["exercise"]
    for semana, week_start in zip(solo_remo["weeks"], (w3, w2, w1)):
        _assert_semana_vacia(semana, week_start)
    semana_actual = solo_remo["weeks"][3]
    assert semana_actual["week_start"] == actual.isoformat(), semana_actual
    assert semana_actual["tonnage_kg"] == 720.0, semana_actual   # 500 + 220
    assert semana_actual["sets"] == 2 and semana_actual["sessions"] == 1, semana_actual
    _assert_best(semana_actual["best_set"], 50.0, 10)
    assert solo_remo["totals"]["tonnage_kg"] == 720.0, solo_remo["totals"]
    assert solo_remo["totals"]["sets"] == 2, solo_remo["totals"]
    _assert_best(solo_remo["totals"]["best_set"], 50.0, 10)
    # El selector no depende del ejercicio elegido.
    assert solo_remo["exercises"] == data["exercises"], solo_remo["exercises"]

    # Pedir explícitamente el mismo ejercicio que el defecto da el mismo panel.
    explicito_banca = _progress(h, exercise_id=bench["id"], weeks=4)
    assert explicito_banca == data, "el ejercicio por defecto no coincide con la banca"

    # --- 3. Defecto de 12 semanas y límite de la ventana -------------------
    largo = _progress(h)
    assert set(largo) == CLAVES_RESPUESTA, largo
    assert len(largo["weeks"]) == 12, len(largo["weeks"])
    assert largo["weeks"][-1]["week_start"] == actual.isoformat(), largo["weeks"][-1]
    assert largo["weeks"][0]["week_start"] == (actual - timedelta(weeks=11)).isoformat(), largo["weeks"][0]
    # La sesión de w4 (100×5) ya entra en 12 semanas: 1620 + 500.
    semana_w4 = largo["weeks"][7]   # índice 11 - 4 desde la semana más antigua
    assert semana_w4["week_start"] == w4.isoformat(), semana_w4
    assert semana_w4["tonnage_kg"] == 500.0 and semana_w4["sets"] == 1, semana_w4
    assert semana_w4["sessions"] == 1, semana_w4
    _assert_best(semana_w4["best_set"], 100.0, 5)
    assert largo["totals"]["tonnage_kg"] == 2120.0, largo["totals"]
    assert largo["totals"]["sets"] == 6, largo["totals"]
    _assert_best(largo["totals"]["best_set"], 100.0, 5)
    assert largo["exercises"] == [
        {"id": bench["id"], "name": BENCH, "tonnage_kg": 2120.0},
        {"id": row["id"], "name": ROW, "tonnage_kg": 720.0},
    ], largo["exercises"]

    # --- 4. Validación de parámetros --------------------------------------
    assert client.get(f"{API}/strength/progress", headers=h,
                      params={"weeks": 3}).status_code == 422
    assert client.get(f"{API}/strength/progress", headers=h,
                      params={"weeks": 53}).status_code == 422
    assert client.get(f"{API}/strength/progress", headers=h,
                      params={"exercise_id": "no-existe"}).status_code == 404
    # Sin autenticación no hay datos que enseñar.
    assert client.get(f"{API}/strength/progress").status_code == 401

    # --- 5. Sin datos: exercise null, ventana vacía, exercises [] ---------
    h_vacio = _register("progreso_vacio@example.com")
    vacio = _progress(h_vacio)
    assert set(vacio) == CLAVES_RESPUESTA, vacio
    assert vacio["exercise"] is None, vacio["exercise"]
    assert len(vacio["weeks"]) == 12, len(vacio["weeks"])
    for offset, semana in enumerate(vacio["weeks"]):
        _assert_semana_vacia(semana, actual - timedelta(weeks=11 - offset))
    assert vacio["totals"] == {"tonnage_kg": 0.0, "sets": 0, "best_set": None}, vacio["totals"]
    assert vacio["exercises"] == [], vacio["exercises"]

    # El otro usuario no ve las series del primero.
    assert _progress(h_vacio, weeks=4)["totals"]["tonnage_kg"] == 0.0
    assert _progress(h_vacio, weeks=4)["exercises"] == []

    print("SUCCESS: progreso semanal con ventana de 4/12 semanas, calentamiento y "
          "series no válidas excluidas, best_set 70×6 (desempate por peso), totales "
          "1620/5, orden de exercises y ejercicio por defecto; sin datos a null/0/[].")


if __name__ == "__main__":
    run()
