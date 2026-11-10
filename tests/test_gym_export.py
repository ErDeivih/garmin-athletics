"""Exportación del historial de fuerza: JSON plano, cronológico y filtrable.

Cubre el contrato de `GET /strength/export`:
- `{exported_at, sessions}` solo con las sesiones del usuario autenticado;
- `sessions` de más antigua a más reciente, para que el CSV salga cronológico;
- cada sesión con `date`, `started_at`, `finished_at`, `duration_min`,
  `total_tonnage_kg` (sin calentamientos), `template_id`, `sets_count` y
  `exercises_count`;
- cada ejercicio con `exercise_id`, `exercise_name`, `muscle_group` y sus series
  (`set_number`, `weight_kg`, `reps`, `rpe`, `is_warmup`, `set_type`,
  `rest_seconds`, `completed_at`);
- filtros `from`/`to` sobre `started_at`; rango inválido -> 422;
- otro usuario no ve las sesiones y sin datos la lista sale vacía con 200.

Script standalone, como el resto de `tests/`: BD SQLite efímera con TestClient,
sin tocar la base real ni Garmin. Ejecutar:
    .\\venv\\Scripts\\python.exe tests\\test_gym_export.py
"""
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_gym_export.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"

BENCH = "Press de banca con barra"
ROW = "Remo con barra"

CLAVES_RESPUESTA = {"exported_at", "sessions"}
CLAVES_SESION = {
    "id", "name", "date", "started_at", "finished_at", "duration_min",
    "total_tonnage_kg", "template_id", "sets_count", "exercises_count", "exercises",
}
CLAVES_EJERCICIO = {"exercise_id", "exercise_name", "muscle_group", "sets"}
CLAVES_SERIE = {
    "set_number", "weight_kg", "reps", "rpe", "is_warmup", "set_type",
    "rest_seconds", "completed_at",
}


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _register(email: str) -> dict:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": email.split("@")[0],
        "display_name": "Exportación", "password": "password_segura_123"})
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


def _session(headers: dict, payload: dict) -> dict:
    res = client.post(f"{API}/strength/sessions", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    return res.json()


def _export(headers: dict, **params) -> dict:
    res = client.get(f"{API}/strength/export", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Caso completo
# ---------------------------------------------------------------------------

def run():
    with client:  # dispara el arranque: init_db + semilla del catálogo
        pass
    h = _register("export@example.com")
    bench = _pick(BENCH)
    row = _pick(ROW)

    # Plantilla para comprobar que `template_id` viaja en la exportación.
    res = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Banca 5x5", "focus": "empuje",
        "exercises": [{"exercise_id": bench["id"], "sets": 2, "reps": 5,
                       "weight_kg": 80}]})
    assert res.status_code == 201, res.text
    plantilla = res.json()

    # --- Dos sesiones en fechas distintas, creadas de la nueva a la vieja ----
    s2 = _session(h, {
        "name": "Empuje B", "template_id": plantilla["id"],
        "started_at": "2026-11-05T07:30:00",
        "finished_at": "2026-11-05T08:00:00",
        "sets": [
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 80, "reps": 5,
             "rpe": 9, "rest_seconds": 180, "completed_at": "2026-11-05T07:33:00"},
            {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 82.5, "reps": 3,
             "rpe": 10, "rest_seconds": 180, "completed_at": "2026-11-05T07:36:00"},
        ]})
    s1 = _session(h, {
        "name": "Empuje A",
        "started_at": "2026-11-03T18:00:00",
        "finished_at": "2026-11-03T19:00:00",
        "sets": [
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 40, "reps": 10,
             "is_warmup": True, "set_type": "warmup",
             "completed_at": "2026-11-03T18:03:00"},
            {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 60, "reps": 8,
             "rpe": 8, "rest_seconds": 150, "completed_at": "2026-11-03T18:10:00"},
            {"exercise_id": row["id"], "set_number": 1, "weight_kg": 50, "reps": 10,
             "rpe": 7, "rest_seconds": 90, "completed_at": "2026-11-03T18:20:00"},
        ]})

    # --- 1. Estructura, orden cronológico y campos de la primera sesión -------
    data = _export(h)
    assert set(data) == CLAVES_RESPUESTA, data
    assert isinstance(data["exported_at"], str) and len(data["exported_at"]) == 19, \
        data["exported_at"]
    assert abs((datetime.now()
                - datetime.fromisoformat(data["exported_at"])).total_seconds()) < 300, \
        data["exported_at"]

    sesiones = data["sessions"]
    # Se crearon al revés a propósito: la exportación ordena por `started_at`.
    assert [s["id"] for s in sesiones] == [s1["id"], s2["id"]], \
        [s["id"] for s in sesiones]

    primera = sesiones[0]
    assert set(primera) == CLAVES_SESION, primera
    assert primera["name"] == "Empuje A", primera["name"]
    assert primera["date"] == "2026-11-03", primera["date"]
    assert primera["started_at"] == "2026-11-03T18:00:00", primera["started_at"]
    assert primera["finished_at"] == "2026-11-03T19:00:00", primera["finished_at"]
    assert primera["duration_min"] == 60.0, primera["duration_min"]
    # 60×8 + 50×10 = 980 kg: el calentamiento de 40×10 no suma tonelaje.
    assert primera["total_tonnage_kg"] == 980.0, primera["total_tonnage_kg"]
    assert primera["template_id"] is None, primera["template_id"]
    assert primera["sets_count"] == 3, primera["sets_count"]
    assert primera["exercises_count"] == 2, primera["exercises_count"]

    # Ejercicios en el orden de la sesión (posición), no alfabético.
    banca, remo = primera["exercises"]
    assert set(banca) == CLAVES_EJERCICIO, banca
    assert banca["exercise_id"] == bench["id"], banca
    assert banca["exercise_name"] == BENCH, banca
    assert banca["muscle_group"] == bench["muscle_group"], banca

    calentamiento, trabajo = banca["sets"]
    assert set(calentamiento) == CLAVES_SERIE, calentamiento
    assert calentamiento["is_warmup"] is True, calentamiento
    assert calentamiento["set_type"] == "warmup", calentamiento
    assert calentamiento["weight_kg"] == 40.0 and calentamiento["reps"] == 10, calentamiento
    assert calentamiento["set_number"] == 1, calentamiento
    assert calentamiento["rpe"] is None and calentamiento["rest_seconds"] is None, calentamiento
    assert calentamiento["completed_at"] == "2026-11-03T18:03:00", calentamiento

    assert set(trabajo) == CLAVES_SERIE, trabajo
    assert trabajo == {
        "set_number": 2, "weight_kg": 60.0, "reps": 8, "rpe": 8,
        "is_warmup": False, "set_type": "normal", "rest_seconds": 150,
        "completed_at": "2026-11-03T18:10:00",
    }, trabajo

    assert set(remo) == CLAVES_EJERCICIO, remo
    assert remo["exercise_id"] == row["id"], remo
    assert remo["exercise_name"] == ROW, remo
    assert remo["muscle_group"] == row["muscle_group"], remo
    assert remo["sets"] == [{
        "set_number": 1, "weight_kg": 50.0, "reps": 10, "rpe": 7,
        "is_warmup": False, "set_type": "normal", "rest_seconds": 90,
        "completed_at": "2026-11-03T18:20:00",
    }], remo["sets"]

    # --- 2. Segunda sesión: duración, tonelaje, plantilla y series ----------
    segunda = sesiones[1]
    assert set(segunda) == CLAVES_SESION, segunda
    assert segunda["name"] == "Empuje B", segunda["name"]
    assert segunda["date"] == "2026-11-05", segunda["date"]
    assert segunda["started_at"] == "2026-11-05T07:30:00", segunda["started_at"]
    assert segunda["finished_at"] == "2026-11-05T08:00:00", segunda["finished_at"]
    assert segunda["duration_min"] == 30.0, segunda["duration_min"]
    # 80×5 + 82.5×3 = 647.5 kg.
    assert segunda["total_tonnage_kg"] == 647.5, segunda["total_tonnage_kg"]
    assert segunda["template_id"] == plantilla["id"], segunda["template_id"]
    assert segunda["sets_count"] == 2, segunda["sets_count"]
    assert segunda["exercises_count"] == 1, segunda["exercises_count"]

    series_b = segunda["exercises"][0]["sets"]
    assert [s["set_number"] for s in series_b] == [1, 2], series_b
    assert [s["weight_kg"] for s in series_b] == [80.0, 82.5], series_b
    assert [s["reps"] for s in series_b] == [5, 3], series_b
    assert [s["completed_at"] for s in series_b] == [
        "2026-11-05T07:33:00", "2026-11-05T07:36:00"], series_b

    # --- 3. Filtros from/to sobre `started_at` ------------------------------
    assert [s["id"] for s in _export(h, **{"from": "2026-11-04"})["sessions"]] == \
        [s2["id"]]
    assert [s["id"] for s in _export(h, to="2026-11-04")["sessions"]] == [s1["id"]]
    assert [s["id"] for s in _export(
        h, **{"from": "2026-11-03", "to": "2026-11-03"})["sessions"]] == [s1["id"]]
    assert [s["id"] for s in _export(
        h, **{"from": "2026-11-03", "to": "2026-11-05"})["sessions"]] == \
        [s1["id"], s2["id"]]
    # Un rango sin sesiones devuelve lista vacía, no error.
    assert _export(h, **{"from": "2026-12-01"})["sessions"] == []
    # Rango inválido: 422, igual que /stats.
    invalido = client.get(f"{API}/strength/export", headers=h,
                          params={"from": "2026-11-05", "to": "2026-11-03"})
    assert invalido.status_code == 422, invalido.text

    # --- 4. Usuario ajeno, usuario sin datos y sin autenticación -----------
    h_ajeno = _register("export_ajeno@example.com")
    ajeno = _export(h_ajeno)
    assert set(ajeno) == CLAVES_RESPUESTA, ajeno
    assert ajeno["sessions"] == [], ajeno["sessions"]

    h_vacio = _register("export_vacio@example.com")
    vacio = _export(h_vacio)
    assert set(vacio) == CLAVES_RESPUESTA, vacio
    assert vacio["sessions"] == [], vacio["sessions"]

    assert client.get(f"{API}/strength/export").status_code == 401

    print("SUCCESS: exportación cronológica con dos sesiones (980 y 647.5 kg), "
          "calentamiento excluido del tonelaje, series con peso/reps/set_number, "
          "ejercicio y grupo muscular, template_id, filtros from/to, 422 en rango "
          "inválido y lista vacía para usuario ajeno y sin datos.")


if __name__ == "__main__":
    run()
