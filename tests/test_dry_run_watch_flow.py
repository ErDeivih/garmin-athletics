"""Prueba en seco del flujo móvil → plan → reloj → series → registro.

No toca Garmin: el envío se valida con dry_run y la watch-app se simula con
las llamadas HTTP que haría. La base de datos es SQLite efímera.
"""
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_dry_run.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def run():
    with client:
        pass
    res = client.post(f"{API}/auth/register", json={
        "email": "dryrun@example.com", "username": "dryrun",
        "display_name": "Dry Run", "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    user = res.json()
    h = {"Authorization": f"Bearer {user['access_token']}"}
    exercise = client.get(f"{API}/strength/exercises?q=press de banca", headers=h).json()["items"][0]

    targets = [
        {"set_number": 1, "reps": 8, "weight_kg": 60},
        {"set_number": 2, "reps": 8, "weight_kg": 65},
        {"set_number": 3, "reps": 6, "weight_kg": 70},
    ]
    template = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Empuje seco", "weekday": date.today().weekday(),
        "exercises": [{
            "exercise_id": exercise["id"], "sets": 3, "reps": 8,
            "weight_kg": 60, "rest_seconds": 120, "set_targets": targets,
        }],
    })
    assert template.status_code == 201, template.text
    plan = template.json()
    assert plan["exercises"][0]["set_targets"] == targets

    # El móvil pide el envío: dry_run para no tocar Garmin.
    sent = client.post(f"{API}/strength/push-to-garmin", headers=h, json={
        "routine_name": plan["name"],
        "exercises": [{
            "name": exercise["name"], "sets": 3, "reps": 8,
            "weight_kg": 60, "rest_seconds": 120, "set_targets": targets,
        }],
        "dry_run": True,
    })
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "dry_run"
    assert sent.json()["unmapped_exercises"] == []

    # El reloj recibe el entreno y sus objetivos por serie.
    today = client.get(f"{API}/watch/today", headers=h)
    assert today.status_code == 200, today.text
    body = today.json()
    assert body["exercises"][0]["targets"] == targets

    # El reloj devuelve las series (simuladas) y el móvil las guarda.
    session_id = None
    for target in targets:
        response = client.post(f"{API}/watch/sets", headers=h, json={
            "client_set_id": f"dry-set-{target['set_number']}",
            "workout_id": body["workout_id"],
            "exercise_id": exercise["id"],
            "set_number": target["set_number"],
            "weight_kg": target["weight_kg"],
            "reps": target["reps"],
            "completed_at": f"{date.today().isoformat()}T18:0{target['set_number']}:00",
            "needs_review": False,
        })
        assert response.status_code == 200, response.text
        session_id = response.json()["session_id"]
    detail = client.get(f"{API}/strength/sessions/{session_id}", headers=h)
    assert detail.status_code == 200, detail.text
    saved = [s for e in detail.json()["exercises"] for s in e["sets"]]
    assert [s["weight_kg"] for s in saved] == [60.0, 65.0, 70.0]
    assert [s["reps"] for s in saved] == [8, 8, 6]
    print("SUCCESS: plan móvil -> dry-run -> reloj -> 3 series -> sesión guardada con 60/65/70 kg.")


if __name__ == "__main__":
    run()
