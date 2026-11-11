"""Exportación del historial de fuerza: JSON plano, cronológico y filtrable.

Cubre el contrato de `GET /strength/export`:
- `{exported_at, sessions}` solo con las sesiones del usuario autenticado;
- `sessions` de más antigua a más reciente, para que el CSV salga cronológico;
- cada sesión con `date`, `started_at`, `finished_at`, `duration_min`,
  `total_tonnage_kg` (sin calentamientos), `template_id`, `sets_count` y
  `exercises_count`;
- cada ejercicio con `exercise_id`, `exercise_name`, `muscle_group` y sus series
  (`set_number`, `weight_kg`, `reps`, `rpe`, `is_warmup`, `set_type`,
  `rest_seconds`, `completed_at`) más el plan por serie: `planned_weight_kg` y
  `planned_reps` (objetivo de la plantilla para ese `set_number`, `null` cuando
  no hay plan; el detalle de sesión devuelve los mismos valores);
- filtros `from`/`to` sobre `started_at`; rango inválido -> 422;
- otro usuario no ve las sesiones y sin datos la lista sale vacía con 200;
- una sesión que apunta a una plantilla que ya no existe no rompe: sus series
  salen con el plan a `null`.

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
    "rest_seconds", "completed_at", "planned_weight_kg", "planned_reps",
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


def _plan(series: list) -> list:
    """Pares (planned_weight_kg, planned_reps) en orden: el plan que exporta cada serie."""
    return [(s["planned_weight_kg"], s["planned_reps"]) for s in series]


def _serie(set_number: int, weight: float, reps: int, rpe, rest, completed: str,
           planned_weight, planned_reps, **extra) -> dict:
    serie = {
        "set_number": set_number, "weight_kg": weight, "reps": reps, "rpe": rpe,
        "is_warmup": False, "set_type": "normal", "rest_seconds": rest,
        "completed_at": completed,
        "planned_weight_kg": planned_weight, "planned_reps": planned_reps,
    }
    serie.update(extra)
    return serie


# ---------------------------------------------------------------------------
# Caso completo
# ---------------------------------------------------------------------------

def run():
    with client:  # dispara el arranque: init_db + semilla del catálogo
        pass
    h = _register("export@example.com")
    bench = _pick(BENCH)
    row = _pick(ROW)

    # Plantilla con plan por serie (60/65/70 × 8 en banca) y, a propósito, menos
    # objetivos que series en el remo (1 objetivo): así se comprueba el `null`
    # de la serie que el plan no cubre.
    res = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Banca 5x5", "focus": "empuje",
        "exercises": [
            {"exercise_id": bench["id"], "sets": 3, "reps": 5, "weight_kg": 80,
             "set_targets": [
                 {"weight_kg": 60, "reps": 8},
                 {"weight_kg": 65, "reps": 8},
                 {"weight_kg": 70, "reps": 8},
             ]},
            {"exercise_id": row["id"], "sets": 1, "reps": 10, "weight_kg": 50},
        ]})
    assert res.status_code == 201, res.text
    plantilla = res.json()
    # La plantilla normaliza los objetivos por `set_number` (1..3).
    assert [t["set_number"] for t in plantilla["exercises"][0]["set_targets"]] == [1, 2, 3], \
        plantilla["exercises"][0]["set_targets"]

    # --- Dos sesiones en fechas distintas, creadas de la nueva a la vieja ----
    # Con plantilla: la banca tiene plan para sus 3 series; el remo solo para la 1ª.
    s2 = _session(h, {
        "name": "Empuje B", "template_id": plantilla["id"],
        "started_at": "2026-11-05T07:30:00",
        "finished_at": "2026-11-05T08:00:00",
        "sets": [
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 80, "reps": 5,
             "rpe": 9, "rest_seconds": 180, "completed_at": "2026-11-05T07:33:00"},
            {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 82.5, "reps": 3,
             "rpe": 10, "rest_seconds": 180, "completed_at": "2026-11-05T07:36:00"},
            {"exercise_id": bench["id"], "set_number": 3, "weight_kg": 85, "reps": 2,
             "rpe": 10, "rest_seconds": 180, "completed_at": "2026-11-05T07:40:00"},
            {"exercise_id": row["id"], "set_number": 1, "weight_kg": 50, "reps": 10,
             "rpe": 8, "rest_seconds": 90, "completed_at": "2026-11-05T07:50:00"},
            {"exercise_id": row["id"], "set_number": 2, "weight_kg": 47.5, "reps": 8,
             "rpe": 9, "rest_seconds": 90, "completed_at": "2026-11-05T07:55:00"},
        ]})
    # Sin plantilla: no hay plan que exportar, todas las series a `null`.
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

    # Sesión sin plantilla: el plan de cada serie es `null` (no se inventa).
    assert _plan(banca["sets"]) == [(None, None), (None, None)], banca["sets"]

    calentamiento, trabajo = banca["sets"]
    assert set(calentamiento) == CLAVES_SERIE, calentamiento
    assert calentamiento["is_warmup"] is True, calentamiento
    assert calentamiento["set_type"] == "warmup", calentamiento
    assert calentamiento["weight_kg"] == 40.0 and calentamiento["reps"] == 10, calentamiento
    assert calentamiento["set_number"] == 1, calentamiento
    assert calentamiento["rpe"] is None and calentamiento["rest_seconds"] is None, calentamiento
    assert calentamiento["completed_at"] == "2026-11-03T18:03:00", calentamiento

    assert set(trabajo) == CLAVES_SERIE, trabajo
    assert trabajo == _serie(2, 60.0, 8, 8, 150, "2026-11-03T18:10:00", None, None), trabajo
    # El calentamiento y el trabajo sin plan también van con las claves nuevas.
    assert calentamiento == _serie(
        1, 40.0, 10, None, None, "2026-11-03T18:03:00", None, None,
        is_warmup=True, set_type="warmup"), calentamiento

    assert set(remo) == CLAVES_EJERCICIO, remo
    assert remo["exercise_id"] == row["id"], remo
    assert remo["exercise_name"] == ROW, remo
    assert remo["muscle_group"] == row["muscle_group"], remo
    assert remo["sets"] == [_serie(
        1, 50.0, 10, 7, 90, "2026-11-03T18:20:00", None, None)], remo["sets"]

    # --- 2. Segunda sesión: plan por serie, duración, tonelaje y plantilla ---
    segunda = sesiones[1]
    assert set(segunda) == CLAVES_SESION, segunda
    assert segunda["name"] == "Empuje B", segunda["name"]
    assert segunda["date"] == "2026-11-05", segunda["date"]
    assert segunda["started_at"] == "2026-11-05T07:30:00", segunda["started_at"]
    assert segunda["finished_at"] == "2026-11-05T08:00:00", segunda["finished_at"]
    assert segunda["duration_min"] == 30.0, segunda["duration_min"]
    # 80×5 + 82.5×3 + 85×2 + 50×10 + 47.5×8 = 1697.5 kg.
    assert segunda["total_tonnage_kg"] == 1697.5, segunda["total_tonnage_kg"]
    assert segunda["template_id"] == plantilla["id"], segunda["template_id"]
    assert segunda["sets_count"] == 5, segunda["sets_count"]
    assert segunda["exercises_count"] == 2, segunda["exercises_count"]

    banca_b, remo_b = segunda["exercises"]
    series_b = banca_b["sets"]
    assert [s["set_number"] for s in series_b] == [1, 2, 3], series_b
    # Plan de la banca: objetivos 60/65/70 × 8 emparejados por `set_number`.
    assert _plan(series_b) == [(60.0, 8), (65.0, 8), (70.0, 8)], series_b
    assert isinstance(series_b[0]["planned_weight_kg"], float), series_b[0]
    assert isinstance(series_b[0]["planned_reps"], int), series_b[0]
    assert series_b == [
        _serie(1, 80.0, 5, 9, 180, "2026-11-05T07:33:00", 60.0, 8),
        _serie(2, 82.5, 3, 10, 180, "2026-11-05T07:36:00", 65.0, 8),
        _serie(3, 85.0, 2, 10, 180, "2026-11-05T07:40:00", 70.0, 8),
    ], series_b
    assert all(set(s) == CLAVES_SERIE for s in series_b), series_b

    # El plan del remo solo fija la 1ª serie: la 2ª no tiene objetivo -> null.
    assert _plan(remo_b["sets"]) == [(50.0, 10), (None, None)], remo_b["sets"]
    assert remo_b["sets"] == [
        _serie(1, 50.0, 10, 8, 90, "2026-11-05T07:50:00", 50.0, 10),
        _serie(2, 47.5, 8, 9, 90, "2026-11-05T07:55:00", None, None),
    ], remo_b["sets"]

    # El detalle de sesión ya calculaba el plan: la exportación no puede divergir.
    detalle = client.get(f"{API}/strength/sessions/{s2['id']}", headers=h)
    assert detalle.status_code == 200, detalle.text
    detalle_series = [s for ex in detalle.json()["exercises"] for s in ex["sets"]]
    assert _plan(detalle_series) == _plan(series_b) + _plan(remo_b["sets"]), detalle_series

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

    # --- 5. Sesión que apunta a una plantilla que ya no existe --------------
    # No debe romper la exportación: el plan de sus series es `null`.
    huerfana = _session(h, {
        "name": "Huérfana",
        "template_id": "00000000-0000-0000-0000-000000000000",
        "started_at": "2026-11-07T10:00:00",
        "finished_at": "2026-11-07T10:20:00",
        "sets": [
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 70, "reps": 8,
             "rpe": 8, "rest_seconds": 120,
             "completed_at": "2026-11-07T10:05:00"},
        ]})
    huerfana_exp = _export(h, **{"from": "2026-11-07", "to": "2026-11-07"})["sessions"]
    assert [s["id"] for s in huerfana_exp] == [huerfana["id"]], huerfana_exp
    assert huerfana_exp[0]["template_id"] == "00000000-0000-0000-0000-000000000000", \
        huerfana_exp[0]["template_id"]
    assert _plan(huerfana_exp[0]["exercises"][0]["sets"]) == [(None, None)], \
        huerfana_exp[0]["exercises"][0]["sets"]

    print("SUCCESS: exportación cronológica con dos sesiones (980 y 1697.5 kg), plan "
          "por serie desde la plantilla (banca 60/65/70×8, remo con la 2ª serie sin "
          "objetivo), `null` en la sesión sin plantilla y en la que apunta a una "
          "plantilla borrada, mismo plan que el detalle de sesión, calentamiento "
          "excluido del tonelaje, series con peso/reps/set_number, ejercicio y grupo "
          "muscular, template_id, filtros from/to, 422 en rango inválido y lista "
          "vacía para usuario ajeno y sin datos.")


if __name__ == "__main__":
    run()
