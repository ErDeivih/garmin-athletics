"""Pesos por serie: la sesión los guarda y se pueden corregir después.

Camino real (HTTP, no dobles): crear plantilla con objetivos 60/65/70 → guardar la
sesión con esos pesos → corregir uno con PUT → volver a leer y comprobar que el peso
corregido persiste y que el tonelaje se recalcula.

El fallo que cubre esta prueba estaba en la pantalla de entrenar, que rellenaba las
tres series con el mismo peso; el contrato del backend ya aceptaba pesos por serie.
"""
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_pesos.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _register(email: str) -> dict:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": email.split("@")[0],
        "display_name": "Pesos", "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def run():
    with client:
        pass
    h = _register("pesos@example.com")
    ejercicio = client.get(f"{API}/strength/exercises?q=press de banca", headers=h).json()["items"][0]

    # 1. Plan con un objetivo distinto por serie.
    plantilla = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Empuje pesos", "weekday": 0,
        "exercises": [{
            "exercise_id": ejercicio["id"], "sets": 3, "reps": 8,
            "weight_kg": 60, "rest_seconds": 120,
            "set_targets": [
                {"weight_kg": 60, "reps": 8},
                {"weight_kg": 65, "reps": 8},
                {"weight_kg": 70, "reps": 6},
            ],
        }],
    })
    assert plantilla.status_code == 201, plantilla.text
    destinos = [t["weight_kg"] for t in plantilla.json()["exercises"][0]["set_targets"]]
    assert destinos == [60, 65, 70], destinos

    # 2. La sesión se guarda con los pesos de cada serie (lo que envía el móvil).
    sesion = client.post(f"{API}/strength/sessions", headers=h, json={
        "template_id": plantilla.json()["id"],
        "started_at": "2026-11-09T18:00:00",
        "finished_at": "2026-11-09T18:20:00",
        "sets": [
            {"exercise_id": ejercicio["id"], "set_number": 1, "weight_kg": 60, "reps": 8},
            {"exercise_id": ejercicio["id"], "set_number": 2, "weight_kg": 65, "reps": 8},
            {"exercise_id": ejercicio["id"], "set_number": 3, "weight_kg": 70, "reps": 6},
        ],
    })
    assert sesion.status_code in (200, 201), sesion.text
    session_id = sesion.json()["id"]

    detalle = client.get(f"{API}/strength/sessions/{session_id}", headers=h).json()
    pesos = [s["weight_kg"] for e in detalle["exercises"] for s in e["sets"]]
    assert pesos == [60, 65, 70], f"la sesión no guardó los pesos por serie: {pesos}"
    assert detalle["total_tonnage_kg"] == 1420, detalle["total_tonnage_kg"]

    # 3. Corregir un peso después de entrenar (lo que hace «Editar pesos reales»).
    correccion = client.put(f"{API}/strength/sessions/{session_id}", headers=h, json={
        "sets": [
            {"exercise_id": ejercicio["id"], "set_number": 1, "weight_kg": 62.5, "reps": 8},
            {"exercise_id": ejercicio["id"], "set_number": 2, "weight_kg": 67.5, "reps": 8},
            {"exercise_id": ejercicio["id"], "set_number": 3, "weight_kg": 72.5, "reps": 6},
        ],
    })
    assert correccion.status_code == 200, correccion.text

    corregido = client.get(f"{API}/strength/sessions/{session_id}", headers=h).json()
    pesos_corregidos = [s["weight_kg"] for e in corregido["exercises"] for s in e["sets"]]
    assert pesos_corregidos == [62.5, 67.5, 72.5], f"la corrección no persistió: {pesos_corregidos}"
    assert corregido["total_tonnage_kg"] == 1475, corregido["total_tonnage_kg"]

    # 4. La corrección no duplica series ni sesiones.
    sesiones = client.get(f"{API}/strength/sessions?limit=10", headers=h).json()
    filas = sesiones["items"] if isinstance(sesiones, dict) else sesiones
    assert len(filas) == 1, f"la corrección duplicó sesiones: {len(filas)}"

    print("SUCCESS: pesos por serie guardados (60/65/70), corregidos (62,5/67,5/72,5) "
          "y tonelaje recalculado (1420 -> 1475).")


if __name__ == "__main__":
    run()
