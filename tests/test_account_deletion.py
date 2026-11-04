"""Borrado de cuenta (T-22): GDPR y gimnasio completo.

Comprueba que `DELETE /auth/account` borra las cinco tablas del gimnasio
(ejercicios propios, plantillas, ejercicios de plantilla, sesiones y series),
las actividades espejo y el usuario, sin tocar los datos de otra cuenta.

Se ejecuta como script, igual que el resto:
    .\\venv\\Scripts\\python.exe tests\\test_account_deletion.py
"""
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
DB_PATH = f"{_tmp}/test_account_deletion.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _setup():
    with client:
        pass


def _register(email: str, username: str) -> tuple[str, str]:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    body = res.json()
    return body["access_token"], body["user_id"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _seed_exercise_id() -> str:
    res = client.get(f"{API}/strength/exercises", params={"q": "press de banca"})
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert items, "la semilla no tiene Press de banca"
    return items[0]["id"]


def _delete_account(token: str):
    return client.delete(f"{API}/auth/account", headers=_h(token))


def run():
    _setup()

    token_a, user_a = _register("borrar@example.com", "borrar")
    token_b, user_b = _register("queda@example.com", "queda")
    seed_id = _seed_exercise_id()

    # A: ejercicio propio, plantilla y sesión con dos series.
    exercise = client.post(f"{API}/strength/exercises", headers=_h(token_a), json={
        "name": "Ejercicio solo de A", "muscle_group": "pecho", "equipment": "mancuerna"})
    assert exercise.status_code == 201, exercise.text
    exercise_a = exercise.json()["id"]

    template = client.post(f"{API}/strength/templates", headers=_h(token_a), json={
        "name": "Plantilla de A", "weekday": 0, "focus": "push",
        "exercises": [{"exercise_id": exercise_a, "sets": 2, "reps": 8,
                       "weight_kg": 20, "rest_seconds": 90}]})
    assert template.status_code == 201, template.text
    template_a = template.json()["id"]

    session = client.post(f"{API}/strength/sessions", headers=_h(token_a), json={
        "name": "Sesión de A", "template_id": template_a,
        "sets": [
            {"exercise_id": exercise_a, "weight_kg": 20, "reps": 8},
            {"exercise_id": exercise_a, "weight_kg": 22.5, "reps": 6},
        ]})
    assert session.status_code == 201, session.text
    assert session.json()["sets_count"] == 2

    # B: datos propios que deben sobrevivir.
    template_b_res = client.post(f"{API}/strength/templates", headers=_h(token_b), json={
        "name": "Plantilla de B", "weekday": 1, "focus": "pull",
        "exercises": [{"exercise_id": seed_id, "sets": 3, "reps": 10,
                       "weight_kg": 40, "rest_seconds": 120}]})
    assert template_b_res.status_code == 201, template_b_res.text
    template_b = template_b_res.json()["id"]
    session_b = client.post(f"{API}/strength/sessions", headers=_h(token_b), json={
        "name": "Sesión de B", "template_id": template_b,
        "sets": [{"exercise_id": seed_id, "weight_kg": 40, "reps": 10}]})
    assert session_b.status_code == 201, session_b.text

    assert client.get(f"{API}/strength/templates", headers=_h(token_a)).json()["total"] == 1
    assert client.get(f"{API}/strength/sessions", headers=_h(token_a)).json()["total"] == 1
    assert client.get(f"{API}/strength/exercises", headers=_h(token_a),
                      params={"only_custom": True}).json()["total"] == 1

    # --- borrar la cuenta de A ---
    removed = _delete_account(token_a)
    assert removed.status_code == 200, removed.text
    assert removed.json()["status"] == "deleted"

    assert client.get(f"{API}/auth/me", headers=_h(token_a)).status_code == 401
    relogin = client.post(f"{API}/auth/login", json={
        "email": "borrar@example.com", "password": "password_segura_123"})
    assert relogin.status_code == 401, relogin.text

    # --- comprobación directa en SQLite: no queda nada de A en el gimnasio ---
    conn = sqlite3.connect(DB_PATH)
    try:
        def count(sql: str, params: tuple = ()) -> int:
            return conn.execute(sql, params).fetchone()[0]

        assert count("SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?", (user_a,)) == 0
        assert count("SELECT COUNT(*) FROM workout_templates WHERE user_id = ?", (user_a,)) == 0
        assert count("SELECT COUNT(*) FROM exercises WHERE user_id = ?", (user_a,)) == 0
        assert count("SELECT COUNT(*) FROM activities WHERE user_id = ?", (user_a,)) == 0
        # Sin series huérfanas ni ejercicios de plantilla huérfanos.
        assert count("SELECT COUNT(*) FROM session_sets WHERE session_id NOT IN "
                     "(SELECT id FROM workout_sessions)") == 0
        assert count("SELECT COUNT(*) FROM template_exercises WHERE template_id NOT IN "
                     "(SELECT id FROM workout_templates)") == 0
        # B sigue con lo suyo.
        assert count("SELECT COUNT(*) FROM workout_sessions WHERE user_id = ?", (user_b,)) == 1
        assert count("SELECT COUNT(*) FROM workout_templates WHERE user_id = ?", (user_b,)) == 1
    finally:
        conn.close()

    me_b = client.get(f"{API}/auth/me", headers=_h(token_b))
    assert me_b.status_code == 200 and me_b.json()["id"] == user_b
    assert client.get(f"{API}/strength/templates", headers=_h(token_b)).json()["total"] == 1
    assert client.get(f"{API}/strength/sessions", headers=_h(token_b)).json()["total"] == 1

    print("SUCCESS: borrado de cuenta completo (gimnasio incluido) y B intacto.")


if __name__ == "__main__":
    run()
