"""Auto-carga del entreno del día en el reloj (CAL-2), con doble de Garmin.

No toca la cuenta real: sustituye `GarminService` y comprueba que el evento que
toca hoy se construye, se sube, se agenda y no se duplica. La prueba real en el
fr255 queda para David (Nivel 3).

    .\\venv\\Scripts\\python.exe tests\\test_calendar_auto.py
"""
import asyncio
import os
import sqlite3
import sys
import tempfile
from datetime import date
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
DB_PATH = f"{_tmp}/test_calendar_auto.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.db.models import CalendarEvent, User  # noqa: E402
from sqlalchemy import select  # noqa: E402
import app.services.garmin_service as garmin_service  # noqa: E402

client = TestClient(app)
API = "/api/v1"


class FakeClient:
    uploads = 0
    schedules = []

    def upload_strength_workout(self, workout):
        FakeClient.uploads += 1
        assert workout is not None
        return {"workoutId": 4242}

    def schedule_workout(self, workout_id, date_str):
        FakeClient.schedules.append((str(workout_id), date_str))
        return {"ok": True}


class FakeService:
    def __init__(self, *args, **kwargs):
        self.client = FakeClient()

    def authenticate(self):
        return None


garmin_service.GarminService = FakeService


def _setup():
    with client:
        pass


def _register():
    response = client.post(f"{API}/auth/register", json={
        "email": "auto@example.com", "username": "auto",
        "display_name": "Auto", "password": "password_segura_123"})
    assert response.status_code == 201, response.text
    return response.json()


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _link(user_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO garmin_credentials (user_id, garmin_email, needs_reauth) VALUES (?,?,0)",
        (user_id, "atleta@example.com"))
    conn.commit()
    conn.close()


def run():
    _setup()
    user = _register()
    _link(user["user_id"])

    bench = client.get(f"{API}/strength/exercises?q=press de banca", headers=_h(user["access_token"])).json()["items"][0]
    template = client.post(f"{API}/strength/templates", headers=_h(user["access_token"]), json={
        "name": "Empuje auto", "weekday": date.today().weekday(),
        "exercises": [{"exercise_id": bench["id"], "sets": 3, "reps": 8,
                       "weight_kg": 60, "rest_seconds": 120}]}).json()
    event = client.post(f"{API}/calendar/events", headers=_h(user["access_token"]), json={
        "title": "Empuje auto", "event_type": "strength",
        "start_local": date.today().isoformat() + "T18:00:00",
        "duration_min": 60, "weekday": date.today().weekday(),
        "template_id": template["id"]}).json()
    assert event["status"] == "created"

    from app.services.calendar_auto import auto_push_today_for_user

    async def go():
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == user["user_id"]))).scalar_one()
            return await auto_push_today_for_user(db, db_user)

    first = asyncio.run(go())
    assert first["sent"] == 1, first
    assert FakeClient.uploads == 1
    assert FakeClient.schedules and FakeClient.schedules[0][1] == date.today().isoformat()

    async def read_event():
        async with AsyncSessionLocal() as db:
            return (await db.execute(select(CalendarEvent).where(
                CalendarEvent.id == event["id"]))).scalar_one()

    saved = asyncio.run(read_event())
    assert saved.last_scheduled_date == date.today()
    assert saved.garmin_workout_id == "4242"

    # Idempotente: una segunda ejecución el mismo día no vuelve a subirlo.
    second = asyncio.run(go())
    assert second["sent"] == 0, second
    assert FakeClient.uploads == 1

    # Un usuario sin cuenta vinculada no rompe y lo dice.
    other = client.post(f"{API}/auth/register", json={
        "email": "sinreloj@example.com", "username": "sinreloj",
        "display_name": "Sin reloj", "password": "password_segura_123"}).json()

    async def go_other():
        async with AsyncSessionLocal() as db:
            db_user = (await db.execute(select(User).where(User.id == other["user_id"]))).scalar_one()
            return await auto_push_today_for_user(db, db_user)

    assert asyncio.run(go_other())["status"] == "not_linked"

    print("SUCCESS: auto-carga de calendario OK (sube, agenda y no duplica).")


if __name__ == "__main__":
    run()
