"""Calendario: repetición semanal, una ocurrencia concreta y quitar desde fecha."""
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_calendar_recurrence.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"
TODAY = date.today()
WEEKDAY = TODAY.weekday()


def run():
    with client:
        pass
    user = client.post(f"{API}/auth/register", json={
        "email": "calendar@example.com", "username": "calendar",
        "display_name": "Calendario", "password": "password_segura_123"}).json()
    h = {"Authorization": f"Bearer {user['access_token']}"}
    ex = client.get(f"{API}/strength/exercises?q=press de banca", headers=h).json()["items"][0]
    tpl = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Semanal", "weekday": WEEKDAY,
        "exercises": [{"exercise_id": ex["id"], "sets": 3, "reps": 8,
                       "weight_kg": 50, "rest_seconds": 90}]}).json()

    ev = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Semanal", "event_type": "strength",
        "start_local": f"{TODAY.isoformat()}T18:00:00",
        "duration_min": 60, "weekday": WEEKDAY, "template_id": tpl["id"],
        "recurrence_until": (TODAY + timedelta(days=21)).isoformat()}).json()
    rng = f"from={TODAY.isoformat()}&to={(TODAY + timedelta(days=28)).isoformat()}"
    cal = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    notes = [d for d in cal["days"] if any(e["title"] == "Semanal" for e in d["events"])]
    assert len(notes) == 4, len(notes)

    trim = (TODAY + timedelta(days=14)).isoformat()
    res = client.delete(f"{API}/calendar/events/{ev['id']}?from={trim}", headers=h)
    assert res.status_code == 200 and res.json()["status"] == "trimmed"
    cal2 = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    notes2 = [d for d in cal2["days"] if any(e["title"] == "Semanal" for e in d["events"])]
    assert len(notes2) == 2, len(notes2)

    one_day = (TODAY + timedelta(days=2)).isoformat()
    created = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Solo ese día", "event_type": "strength",
        "start_local": f"{one_day}T19:00:00", "duration_min": 45,
        "weekday": None, "template_id": tpl["id"]}).json()
    assert created["status"] == "created"
    cal3 = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    target = next(d for d in cal3["days"] if d["date"] == one_day)
    assert any(e["title"] == "Solo ese día" for e in target["events"])
    print("SUCCESS: calendario recurrente, día concreto y recorte desde fecha OK.")


if __name__ == "__main__":
    run()
