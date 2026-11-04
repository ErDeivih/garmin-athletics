"""Importación de series de fuerza desde Garmin (T-30).

No llama a la cuenta real: sustituye `GarminService` por un doble con una
respuesta con la forma documentada de `get_activity_exercise_sets` y comprueba
el parser, el mapeo por `garmin_enum`, el guardado, la deduplicación y el caso
de ejercicio no mapeado. La validación con la cuenta real queda pendiente.

    .\\venv\\Scripts\\python.exe tests\\test_garmin_import.py
"""
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
DB_PATH = f"{_tmp}/test_garmin_import.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
import app.services.garmin_service as garmin_service_module  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _bench_payload(activity_id: str) -> dict:
    return {
        "activityId": activity_id,
        "exerciseSets": [
            {
                "setType": "ACTIVE",
                "exercises": [{"category": "BENCH_PRESS", "name": "BARBELL_BENCH_PRESS"}],
                "repetitionCount": 8,
                "weight": 80000,  # gramos
                "startTime": "2026-11-04T18:01:00.000Z",
            },
            {
                "setType": "ACTIVE",
                "exercises": [{"category": "BENCH_PRESS", "name": "BARBELL_BENCH_PRESS"}],
                "repetitionCount": 6,
                "weight": 82500,
                "startTime": "2026-11-04T18:05:00.000Z",
            },
            {
                "setType": "REST",
                "exercises": [{"category": "BENCH_PRESS", "name": "BARBELL_BENCH_PRESS"}],
                "repetitionCount": 0,
                "weight": 0,
                "startTime": "2026-11-04T18:04:00.000Z",
            },
        ],
    }


class FakeGarminClient:
    def get_activity_exercise_sets(self, activity_id):
        if str(activity_id) == "act-bench":
            return _bench_payload(str(activity_id))
        return {
            "exerciseSets": [{
                "setType": "ACTIVE",
                "exercises": [{"category": "MADE_UP_CATEGORY", "name": "MADE_UP_EXERCISE"}],
                "repetitionCount": 10,
                "weight": 20000,
            }]
        }


class FakeGarminService:
    def __init__(self, *args, **kwargs):
        self.client = FakeGarminClient()

    def authenticate(self):
        return None


garmin_service_module.GarminService = FakeGarminService


def _setup():
    with client:
        pass


def _register(email: str, username: str):
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _link_garmin(user_id: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT OR REPLACE INTO garmin_credentials (user_id, garmin_email, needs_reauth) "
            "VALUES (?, ?, 0)", (user_id, "atleta@example.com"))
        conn.commit()
    finally:
        conn.close()


def _bench_exercise_id() -> str:
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT id FROM exercises WHERE garmin_enum='BARBELL_BENCH_PRESS' LIMIT 1").fetchone()
    finally:
        conn.close()
    assert row, "la semilla no tiene BARBELL_BENCH_PRESS"
    return row[0]


def run():
    _setup()
    user = _register("import@example.com", "importador")
    empty = _register("sinimport@example.com", "sinimport")
    _link_garmin(user["user_id"])
    bench_id = _bench_exercise_id()

    # Sin token -> 401; sin Garmin -> 400.
    assert client.post(f"{API}/strength/import-garmin/act-bench").status_code == 401
    no_link = client.post(f"{API}/strength/import-garmin/act-bench", headers=_h(empty["access_token"]))
    assert no_link.status_code == 400, no_link.text

    # Importación feliz: dos series activas, la de descanso se ignora.
    res = client.post(f"{API}/strength/import-garmin/act-bench",
                      headers=_h(user["access_token"]))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "imported"
    assert body["sets_imported"] == 2, body
    assert body["unmapped"] == []
    session_id = body["session_id"]
    assert body["exercises"][0]["tonnage_kg"] == 1135.0  # 80*8 + 82.5*6

    detail = client.get(f"{API}/strength/sessions/{session_id}", headers=_h(user["access_token"]))
    assert detail.status_code == 200, detail.text
    sets = detail.json()["exercises"][0]["sets"]
    assert len(sets) == 2
    assert [s["weight_kg"] for s in sets] == [80.0, 82.5]
    assert [s["reps"] for s in sets] == [8, 6]
    assert detail.json()["activity_id"] == "act-bench"

    # Deduplicación: la misma actividad no se importa dos veces.
    again = client.post(f"{API}/strength/import-garmin/act-bench",
                        headers=_h(user["access_token"]))
    assert again.status_code == 409, again.text
    assert again.json()["detail"]["status"] == "already_imported"

    # Ejercicio no mapeado: no se guarda nada a medias y se dice cuál falla.
    unknown = client.post(f"{API}/strength/import-garmin/act-unknown",
                          headers=_h(user["access_token"]))
    assert unknown.status_code == 422, unknown.text
    assert "MADE_UP_EXERCISE" in str(unknown.json()["detail"])

    # El ejercicio importado es el de la semilla y la sesión aparece en el historial.
    history = client.get(f"{API}/strength/sessions", headers=_h(user["access_token"])).json()
    assert any(item["id"] == session_id for item in history["items"])
    conn = sqlite3.connect(DB_PATH)
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM session_sets WHERE session_id=?", (session_id,)).fetchone()[0]
        exercise = conn.execute(
            "SELECT id FROM exercises WHERE id=?", (sets[0]["exercise_id"],)).fetchone()
    finally:
        conn.close()
    assert count == 2 and exercise and exercise[0] == bench_id

    print("SUCCESS: importación de series de Garmin OK (parser, mapeo, dedupe y no mapeado).")


if __name__ == "__main__":
    run()
