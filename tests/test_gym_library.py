"""Biblioteca de rutinas: filtros, duplicar plan y planificado frente a real.

Cubre el contrato de la biblioteca de planes:
- `GET /strength/templates` filtra por nombre (`q`, contiene, sin mayúsculas),
  por foco (`focus`, igualdad sin mayúsculas) y por rango de `updated_at`
  (`from`/`to`), manteniendo `{total, items}`.
- `POST /strength/templates/{id}/duplicate` copia en profundidad la plantilla
  (nombre «<original> (copia)», mismo weekday/focus/notes y mismos `set_targets`).
- `GET /strength/sessions/{id}` añade `planned_weight_kg`/`planned_reps` a cada
  serie, emparejando la plantilla de la sesión por ejercicio + número de serie;
  sin plantilla o sin objetivo de esa serie, `null`.
- `GET /strength/sessions` trae fecha, duración, tonelaje total y número de series.

Script standalone, como el resto de `tests/`: BD SQLite efímera con TestClient,
sin tocar la base real ni Garmin. Ejecutar:
    .\\venv\\Scripts\\python.exe tests\\test_gym_library.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_gym_library.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"

BENCH = "Press de banca con barra"
ROW = "Remo con barra"


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _register(email: str) -> dict:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": email.split("@")[0],
        "display_name": "Biblioteca", "password": "password_segura_123"})
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


def _templates(headers: dict, **params) -> dict:
    res = client.get(f"{API}/strength/templates", headers=headers, params=params)
    assert res.status_code == 200, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Caso completo
# ---------------------------------------------------------------------------

def run():
    with client:  # dispara el arranque: init_db + semilla del catálogo
        pass
    h = _register("biblioteca@example.com")
    bench = _pick(BENCH)
    row = _pick(ROW)

    # --- 1. Dos plantillas con nombre y foco distintos --------------------
    empuje = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Empuje biblioteca", "weekday": 0, "focus": "Push",
        "notes": "Pecho y remo.",
        "exercises": [
            {"exercise_id": bench["id"], "sets": 3, "reps": 8, "weight_kg": 60,
             "rest_seconds": 120,
             "set_targets": [
                 {"set_number": 1, "weight_kg": 60, "reps": 8},
                 {"set_number": 2, "weight_kg": 65, "reps": 8},
                 {"set_number": 3, "weight_kg": 70, "reps": 6},
             ]},
            {"exercise_id": row["id"], "sets": 2, "reps": 10, "weight_kg": 50},
        ],
    })
    assert empuje.status_code == 201, empuje.text
    empuje = empuje.json()

    tiron = client.post(f"{API}/strength/templates", headers=h, json={
        "name": "Tirón biblioteca", "weekday": 2, "focus": "Pull",
        "exercises": [{"exercise_id": row["id"], "sets": 3, "reps": 12, "weight_kg": 55}],
    })
    assert tiron.status_code == 201, tiron.text
    tiron = tiron.json()
    assert _templates(h)["total"] == 2

    # --- 2. Filtros: q contiene y sin distinguir mayúsculas ---------------
    solo_empuje = _templates(h, q="EMPUJE")
    assert solo_empuje["total"] == 1, solo_empuje["total"]
    assert solo_empuje["items"][0]["id"] == empuje["id"]
    assert _templates(h, q="tir")["items"][0]["id"] == tiron["id"]

    # focus es igualdad (sin mayúsculas), no subcadena
    solo_push = _templates(h, focus="push")
    assert solo_push["total"] == 1, solo_push["total"]
    assert solo_push["items"][0]["focus"] == "Push"
    assert _templates(h, focus="Pus")["total"] == 0, "focus debe ser igualdad, no subcadena"
    assert _templates(h, focus="Legs")["total"] == 0

    # --- 3. Filtros: rango de actualización (from/to) ---------------------
    # `updated_at` se guarda en UTC (datetime.utcnow); la ventana local ±1 día
    # cubre cualquier huso razonable sin depender de la hora exacta del run.
    hoy = date.today()
    ayer = (hoy - timedelta(days=1)).isoformat()
    manana_mas = (hoy + timedelta(days=2)).isoformat()
    ventana = _templates(h, **{"from": ayer, "to": manana_mas})
    assert ventana["total"] == 2, ventana["total"]
    assert _templates(h, **{"from": (hoy + timedelta(days=2)).isoformat()})["total"] == 0
    assert _templates(h, **{"to": (hoy - timedelta(days=2)).isoformat()})["total"] == 0
    combinado = _templates(h, q="empuje", focus="push", **{"from": ayer})
    assert combinado["total"] == 1, combinado["total"]

    # --- 4. Duplicar: copia profunda con objetivos idénticos --------------
    copia_res = client.post(f"{API}/strength/templates/{empuje['id']}/duplicate", headers=h)
    assert copia_res.status_code == 201, copia_res.text
    copia = copia_res.json()
    assert copia["id"] and copia["id"] != empuje["id"]
    assert copia["name"] == "Empuje biblioteca (copia)", copia["name"]
    assert copia["weekday"] == 0 and copia["focus"] == "Push"
    assert copia["notes"] == "Pecho y remo."

    original = client.get(f"{API}/strength/templates/{empuje['id']}", headers=h).json()
    assert len(copia["exercises"]) == len(original["exercises"]) == 2
    for nueva, vieja in zip(copia["exercises"], original["exercises"]):
        assert nueva["exercise"]["id"] == vieja["exercise"]["id"]
        assert nueva["sets"] == vieja["sets"] and nueva["reps"] == vieja["reps"]
        assert nueva["set_targets"] == vieja["set_targets"], (
            f"los objetivos no se copiaron: {nueva['set_targets']} != {vieja['set_targets']}")
    # Persistida, listada y los objetivos guardados siguen intactos.
    detalle_copia = client.get(f"{API}/strength/templates/{copia['id']}", headers=h)
    assert detalle_copia.status_code == 200 and detalle_copia.json()["id"] == copia["id"]
    assert detalle_copia.json()["exercises"][0]["set_targets"] == (
        original["exercises"][0]["set_targets"])
    assert _templates(h)["total"] == 3

    # 404 si no existe o es de otro usuario.
    assert client.post(f"{API}/strength/templates/no-existe/duplicate",
                       headers=h).status_code == 404
    h2 = _register("biblioteca_otro@example.com")
    assert client.post(f"{API}/strength/templates/{empuje['id']}/duplicate",
                       headers=h2).status_code == 404

    # --- 5. Planificado vs real en el detalle de la sesión ----------------
    sesion = client.post(f"{API}/strength/sessions", headers=h, json={
        "template_id": empuje["id"],
        "started_at": "2026-11-09T18:00:00",
        "finished_at": "2026-11-09T18:40:00",
        "sets": [
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 62.5, "reps": 8},
            {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 65, "reps": 8},
            {"exercise_id": bench["id"], "set_number": 3, "weight_kg": 70, "reps": 6},
            # La plantilla solo prescribe 3 series: esta cuarta no tiene plan.
            {"exercise_id": bench["id"], "set_number": 4, "weight_kg": 60, "reps": 12},
            {"exercise_id": row["id"], "set_number": 1, "weight_kg": 52.5, "reps": 10},
            {"exercise_id": row["id"], "set_number": 2, "weight_kg": 52.5, "reps": 10},
        ],
    })
    assert sesion.status_code == 201, sesion.text
    sesion = sesion.json()

    detalle = client.get(f"{API}/strength/sessions/{sesion['id']}", headers=h).json()
    plan = {(e["exercise"]["id"], s["set_number"]):
            (s["planned_weight_kg"], s["planned_reps"])
            for e in detalle["exercises"] for s in e["sets"]}
    assert plan[(bench["id"], 1)] == (60.0, 8), plan
    assert plan[(bench["id"], 2)] == (65.0, 8), plan
    assert plan[(bench["id"], 3)] == (70.0, 6), plan
    assert plan[(bench["id"], 4)] == (None, None), plan
    assert plan[(row["id"], 1)] == (50.0, 10), plan
    assert plan[(row["id"], 2)] == (50.0, 10), plan
    # Los campos existen siempre, también cuando valen null.
    for ejercicio in detalle["exercises"]:
        for serie in ejercicio["sets"]:
            assert "planned_weight_kg" in serie and "planned_reps" in serie, serie

    # Sesión sin plantilla: no hay plan que enseñar.
    libre = client.post(f"{API}/strength/sessions", headers=h, json={
        "started_at": "2026-11-10T19:00:00",
        "finished_at": "2026-11-10T19:30:00",
        "sets": [{"exercise_id": bench["id"], "set_number": 1,
                  "weight_kg": 60, "reps": 10}],
    })
    assert libre.status_code == 201, libre.text
    detalle_libre = client.get(f"{API}/strength/sessions/{libre.json()['id']}",
                               headers=h).json()
    sueltas = [s for e in detalle_libre["exercises"] for s in e["sets"]]
    assert sueltas and all(s["planned_weight_kg"] is None and s["planned_reps"] is None
                           for s in sueltas), sueltas

    # --- 6. La lista del historial trae lo que pinta la pantalla ----------
    lista = client.get(f"{API}/strength/sessions", headers=h,
                       params={"limit": 10}).json()
    fila = next(i for i in lista["items"] if i["id"] == sesion["id"])
    for clave in ("started_at", "date", "duration_min", "total_tonnage_kg", "sets_count"):
        assert clave in fila, f"la lista de sesiones no trae '{clave}'"
    assert fila["date"] == "2026-11-09", fila["date"]
    assert fila["duration_min"] == 40.0, fila["duration_min"]
    assert fila["sets_count"] == 6, fila["sets_count"]
    assert fila["total_tonnage_kg"] == sesion["total_tonnage_kg"]

    print("SUCCESS: biblioteca filtrada (q/focus/from/to), duplicado con set_targets "
          "idénticos y planificado vs real (60/65/70 kg; serie sobrante y sesión "
          "libre a null).")


if __name__ == "__main__":
    run()
