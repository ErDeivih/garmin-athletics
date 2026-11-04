"""Métricas derivadas (T-26): agregados del gimnasio y carga semanal.

Comprueba con datos reales de una sesión guardada:
- `/strength/stats`: totales, volumen por músculo, por semana, por ejercicio,
  empuje/tirón y 1RM estimado (Epley), excluyendo calentamientos.
- `/metrics/load-summary`: semanas, monotonía/tensión de Foster y ACWR.
- Sin datos: vacío y totales a cero, sin inventar.

Se ejecuta como script:
    .\\venv\\Scripts\\python.exe tests\\test_metrics_stats.py
"""
import os
import sys
import tempfile
from datetime import date, datetime, time, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_metrics_stats.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _setup():
    with client:
        pass


def _register(email: str, username: str) -> str:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _exercise(token: str, query: str) -> dict:
    res = client.get(f"{API}/strength/exercises", params={"q": query}, headers=_h(token))
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert items, f"el catálogo no tiene '{query}'"
    return items[0]


def _session(token: str, day: datetime, exercises: list) -> dict:
    res = client.post(f"{API}/strength/sessions", headers=_h(token), json={
        "name": f"Sesión {day.date().isoformat()}",
        "started_at": day.isoformat(),
        "finished_at": (day + timedelta(hours=1)).isoformat(),
        "sets": exercises,
    })
    assert res.status_code == 201, res.text
    return res.json()


def run():
    _setup()
    token = _register("stats@example.com", "stats")
    empty = _register("vacio@example.com", "vacio")

    bench = _exercise(token, "Press de banca con barra")
    curl = _exercise(token, "Curl de bíceps")
    assert bench["muscle_group"] == "pecho", bench
    assert curl["muscle_group"] == "biceps", curl

    today = date.today()
    # Sesión A: hace 10 días (semana completa). Press de banca con calentamiento
    # y curl; así hay empuje y tirón.
    day_a = datetime.combine(today - timedelta(days=10), time(18, 0))
    session_a = _session(token, day_a, [
        {"exercise_id": bench["id"], "weight_kg": 40, "reps": 10, "is_warmup": True, "set_type": "warmup"},
        {"exercise_id": bench["id"], "weight_kg": 80, "reps": 8, "rpe": 8},
        {"exercise_id": bench["id"], "weight_kg": 60, "reps": 10},
        {"exercise_id": curl["id"], "weight_kg": 30, "reps": 12},
        {"exercise_id": curl["id"], "weight_kg": 30, "reps": 12},
    ])
    # RPE por serie (T-29): se guarda y se devuelve en el detalle.
    bench_sets = next(
        exercise["sets"] for exercise in session_a["exercises"]
        if exercise["exercise"]["id"] == bench["id"])
    assert any(item["rpe"] == 8 for item in bench_sets), bench_sets
    # Sesión B: hace 3 días (misma semana que A si cae en la misma, o distinta).
    day_b = datetime.combine(today - timedelta(days=3), time(19, 0))
    _session(token, day_b, [
        {"exercise_id": bench["id"], "weight_kg": 82.5, "reps": 6},
    ])

    # --- /strength/stats ---
    res = client.get(f"{API}/strength/stats", headers=_h(token), params={
        "from": (today - timedelta(days=20)).isoformat(), "to": today.isoformat()})
    assert res.status_code == 200, res.text
    stats = res.json()
    totals = stats["totals"]
    assert totals["sessions"] == 2, totals
    assert totals["sets"] == 6, totals
    assert totals["working_sets"] == 5, totals  # el calentamiento no cuenta
    # tonelaje: 80*8 + 60*10 + 30*12 + 30*12 + 82,5*6 = 640+600+360+360+495 = 2455
    assert abs(totals["tonnage_kg"] - 2455.0) < 0.01, totals

    muscle = {row["muscle_group"]: row for row in stats["by_muscle"]}
    assert muscle["pecho"]["tonnage_kg"] == 1735.0, muscle["pecho"]
    assert muscle["biceps"]["tonnage_kg"] == 720.0, muscle["biceps"]
    assert muscle["pecho"]["working_sets"] == 3

    push_pull = stats["push_pull"]
    assert push_pull["push_tonnage_kg"] == 1735.0
    assert push_pull["pull_tonnage_kg"] == 720.0
    assert push_pull["ratio"] == round(1735.0 / 720.0, 2)
    assert push_pull["unclassified_tonnage_kg"] == 0.0

    bench_stats = next(row for row in stats["by_exercise"] if row["exercise_id"] == bench["id"])
    assert bench_stats["sets"] == 4 and bench_stats["working_sets"] == 3
    # Epley con 82,5 × 6 = 82,5 * (1 + 6/30) = 99,0; con 80 × 8 = 101,3.
    assert bench_stats["estimated_1rm_kg"] == 101.3, bench_stats
    assert bench_stats["max_weight_kg"] == 82.5

    assert len(stats["by_week"]) >= 1
    assert all(row["sessions"] >= 1 for row in stats["by_week"])
    assert "Epley" in stats["e1rm_note"]

    # Filtro de fechas: una ventana sin sesiones devuelve totales a cero.
    empty_window = client.get(f"{API}/strength/stats", headers=_h(token), params={
        "from": today.isoformat(), "to": today.isoformat()}).json()
    assert empty_window["totals"]["sets"] == 0
    assert empty_window["by_muscle"] == []

    # Otro usuario no ve estas sesiones.
    other = client.get(f"{API}/strength/stats", headers=_h(empty)).json()
    assert other["totals"]["sessions"] == 0 and other["by_muscle"] == []

    # Sin token no hay datos.
    assert client.get(f"{API}/strength/stats").status_code == 401

    # --- /metrics/load-summary ---
    res = client.get(f"{API}/metrics/load-summary", headers=_h(token), params={"days": 28})
    assert res.status_code == 200, res.text
    summary = res.json()
    assert summary["latest"]["date"] == today.isoformat()
    assert summary["latest"]["atl"] is not None and summary["latest"]["ctl"] is not None
    weeks = summary["weeks"]
    assert weeks, "no hay semanas"
    with_load = [row for row in weeks if row["tss"] > 0]
    assert with_load, "la carga de las sesiones no aparece en la serie"
    # La semana cerrada con datos debe tener monotonía definida (variación entre días).
    complete_with_load = [row for row in with_load if row["complete"]]
    assert complete_with_load, "no hay ninguna semana completa con carga"
    assert any(row["monotony"] is not None for row in complete_with_load), complete_with_load
    assert any(row["strain"] is not None for row in complete_with_load)
    assert "Foster" in summary["method"]
    # La semana en curso no se compara con una cerrada.
    current = [row for row in weeks if not row["complete"]]
    for row in current:
        assert row["monotony"] is None and row["strain"] is None, row

    # Usuario sin datos: serie de ceros, sin monotonía inventada.
    empty_summary = client.get(f"{API}/metrics/load-summary", headers=_h(empty),
                               params={"days": 7}).json()
    assert all(row["monotony"] is None for row in empty_summary["weeks"])
    assert empty_summary["latest"]["ctl"] == 0.0

    print("SUCCESS: métricas derivadas OK (gimnasio agregado + monotonía/tensión de Foster).")


if __name__ == "__main__":
    run()
