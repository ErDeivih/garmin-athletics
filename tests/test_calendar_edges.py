"""Calendario: casos raros (futuro, dos eventos el mismo día, día lleno)."""
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_calendar_edges.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"
TODAY = date.today()


def run():
    with client:
        pass
    user = client.post(f"{API}/auth/register", json={
        "email": "edges@example.com", "username": "edges",
        "display_name": "Casos", "password": "password_segura_123"}).json()
    h = {"Authorization": f"Bearer {user['access_token']}"}
    ex = client.get(f"{API}/strength/exercises?q=press de banca", headers=h).json()["items"][0]
    tpl = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Carga", "weekday": TODAY.weekday(),
        "exercises": [{"exercise_id": ex["id"], "sets": 3, "reps": 8,
                       "weight_kg": 50, "rest_seconds": 90}]}).json()

    # Un evento futuro no debe aparecer antes de su primera fecha.
    future = TODAY + timedelta(days=10)
    ev_future = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Futuro", "event_type": "strength",
        "start_local": f"{future.isoformat()}T18:00:00", "duration_min": 60,
        "weekday": future.weekday(), "template_id": tpl["id"]}).json()
    rng = f"from={TODAY.isoformat()}&to={(TODAY + timedelta(days=45)).isoformat()}"
    cal = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    future_events = [d for d in cal["days"] if any(e["id"] == ev_future["id"] for e in d["events"])]
    assert future_events and future_events[0]["date"] == future.isoformat(), future_events[0]["date"]

    # Dos entrenos el mismo día: se muestran los dos y se puede quitar uno.
    one = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Mañana", "event_type": "strength",
        "start_local": f"{TODAY.isoformat()}T09:00:00", "duration_min": 45,
        "weekday": None, "template_id": tpl["id"]}).json()
    two = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Tarde", "event_type": "strength",
        "start_local": f"{TODAY.isoformat()}T19:00:00", "duration_min": 45,
        "weekday": None, "template_id": tpl["id"]}).json()
    # Día sin hueco: tres eventos solapados en la misma franja.
    three = client.post(f"{API}/calendar/events", headers=h, json={
        "title": "Extra", "event_type": "strength",
        "start_local": f"{TODAY.isoformat()}T19:00:00", "duration_min": 45,
        "weekday": None, "template_id": tpl["id"]}).json()
    cal2 = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    today = next(d for d in cal2["days"] if d["date"] == TODAY.isoformat())
    assert {e["title"] for e in today["events"]} >= {"Mañana", "Tarde", "Extra"}
    assert len([e for e in today["events"] if e["title"] == "Extra"]) == 1
    assert client.delete(f"{API}/calendar/events/{one['id']}", headers=h).status_code == 200
    cal3 = client.get(f"{API}/calendar/?{rng}", headers=h).json()
    today3 = next(d for d in cal3["days"] if d["date"] == TODAY.isoformat())
    assert not any(e["id"] == one["id"] for e in today3["events"])
    assert any(e["id"] == two["id"] for e in today3["events"])
    print("SUCCESS: casos raros de calendario OK (futuro, dos el mismo día, quitar uno).")


if __name__ == "__main__":
    run()
