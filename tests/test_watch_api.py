"""API de la watch-app: entreno de hoy y series idempotentes (T-32)."""
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_watch.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _register():
    res = client.post(f"{API}/auth/register", json={
        "email": "watch@example.com", "username": "watch",
        "display_name": "Watch", "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()


def run():
    with client:
        pass
    user = _register()
    h = {"Authorization": f"Bearer {user['access_token']}"}
    exercise = client.get(f"{API}/strength/exercises?q=press de banca", headers=h).json()["items"][0]
    template = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Empuje reloj", "weekday": date.today().weekday(),
        "exercises": [{"exercise_id": exercise["id"], "sets": 3, "reps": 8,
                       "weight_kg": 60, "rest_seconds": 120}]}).json()
    assert template["id"]

    today = client.get(f"{API}/watch/today", headers=h)
    assert today.status_code == 200, today.text
    body = today.json()
    assert body["name"] == "Empuje reloj"
    assert body["workout_id"].startswith("template:") or body["workout_id"].startswith("event:")
    assert body["exercises"][0]["sets"] == 3 and body["exercises"][0]["weight_kg"] == 60
    targets = body["exercises"][0]["targets"]
    assert len(targets) == 3 and all(t["weight_kg"] == 60 and t["reps"] == 8 for t in targets)

    payload = {
        "client_set_id": "set-watch-0001",
        "workout_id": body["workout_id"],
        "exercise_id": exercise["id"],
        "set_number": 1,
        "weight_kg": 60,
        "reps": 8,
        "completed_at": f"{date.today().isoformat()}T18:05:00",
    }
    first = client.post(f"{API}/watch/sets", headers=h, json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["duplicate"] is False
    same = client.post(f"{API}/watch/sets", headers=h, json=payload)
    assert same.status_code == 200 and same.json()["duplicate"] is True

    detail = client.get(f"{API}/strength/sessions/{first.json()['session_id']}", headers=h)
    assert detail.status_code == 200
    sets = [s for e in detail.json()["exercises"] for s in e["sets"]]
    assert len(sets) == 1 and sets[0]["weight_kg"] == 60

    assert client.get(f"{API}/watch/today").status_code == 401
    print("SUCCESS: API de la watch-app OK (entreno de hoy y series sin duplicar).")


if __name__ == "__main__":
    run()
