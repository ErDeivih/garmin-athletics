"""Pruebas del gimnasio v2: catálogo, plantillas, sesiones con series y compatibilidad.

Se ejecuta como script (igual que el resto de pruebas del proyecto):
    .\\venv\\Scripts\\python.exe tests\\test_gym_v2.py

Usa BD SQLite efímera y no toca la base real ni Garmin.
"""
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_gym_v2.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _setup():
    """`with client:` dispara el arranque (init_db + semilla del catálogo)."""
    with client:
        pass


def _register(email: str, username: str) -> str:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _catalog() -> list:
    res = client.get(f"{API}/strength/exercises")
    assert res.status_code == 200, res.text
    return res.json()["items"]


def _pick(name: str) -> dict:
    for item in _catalog():
        if item["name"] == name:
            return item
    raise AssertionError(f"El catálogo no tiene '{name}'")


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------

def test_catalog_seeded_and_filters():
    _setup()
    res = client.get(f"{API}/strength/exercises")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total"] >= 40, f"semilla demasiado corta: {data['total']}"
    names = [i["name"] for i in data["items"]]
    assert "Press de banca con barra" in names
    assert "Peso muerto convencional" in names
    assert data["muscle_groups"] and data["equipment"]

    item = data["items"][0]
    for key in ("id", "name", "slug", "muscle_group", "equipment", "muscle_group_label",
                "equipment_label", "secondary_muscles", "source", "is_custom", "is_timed"):
        assert key in item, f"falta {key} en la ficha del ejercicio"

    # Búsqueda por texto
    res = client.get(f"{API}/strength/exercises", params={"q": "press"})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert all("press" in i["name"].lower() for i in body["items"])

    # Búsqueda sin tildes: "biceps" debe encontrar "bíceps" y "jalon" debe encontrar "Jalón"
    nombres = [i["name"] for i in client.get(
        f"{API}/strength/exercises", params={"q": "biceps"}).json()["items"]]
    assert any("bíceps" in n for n in nombres), nombres
    nombres = [i["name"] for i in client.get(
        f"{API}/strength/exercises", params={"q": "jalon"}).json()["items"]]
    assert any("Jalón" in n for n in nombres), nombres

    # Filtro por grupo muscular
    res = client.get(f"{API}/strength/exercises", params={"muscle_group": "pecho"})
    body = res.json()
    assert body["total"] >= 5
    assert all(i["muscle_group"] == "pecho" for i in body["items"])

    # Filtros combinados
    res = client.get(f"{API}/strength/exercises",
                     params={"muscle_group": "pecho", "equipment": "barra"})
    assert all(i["muscle_group"] == "pecho" and i["equipment"] == "barra"
               for i in res.json()["items"])

    # Valor no permitido
    assert client.get(f"{API}/strength/exercises",
                      params={"muscle_group": "alas"}).status_code == 422

    # Sin token solo se ve la semilla (nada propio)
    assert all(not i["is_custom"] for i in _catalog())


def test_seed_is_idempotent():
    _setup()
    before = client.get(f"{API}/strength/exercises").json()["total"]
    with client:  # segundo arranque: la semilla no debe duplicar
        pass
    after = client.get(f"{API}/strength/exercises").json()["total"]
    assert before == after, f"la semilla duplicó ejercicios: {before} -> {after}"


def test_custom_exercise_crud_and_protections():
    _setup()
    token = _register("gym_custom@test.com", "gym_custom")
    # Sin token no se puede crear
    assert client.post(f"{API}/strength/exercises", json={
        "name": "Press X", "muscle_group": "pecho"}).status_code == 401

    res = client.post(f"{API}/strength/exercises", headers=_h(token), json={
        "name": "Press banca con cadena", "muscle_group": "pecho", "equipment": "barra",
        "secondary_muscles": ["triceps"], "notes": "Lastre colgando de la barra."})
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["is_custom"] is True and created["source"] == "custom"
    assert created["secondary_muscles"] == ["triceps"]
    ex_id = created["id"]

    # Duplicado por nombre
    assert client.post(f"{API}/strength/exercises", headers=_h(token), json={
        "name": "Press banca con cadena", "muscle_group": "pecho",
        "equipment": "barra"}).status_code == 409

    # Ficha
    res = client.get(f"{API}/strength/exercises/{ex_id}", headers=_h(token))
    assert res.status_code == 200, res.text
    assert res.json()["exercise"]["name"] == "Press banca con cadena"
    assert res.json()["last"] is None and res.json()["pr"] is None

    # Editar
    res = client.put(f"{API}/strength/exercises/{ex_id}", headers=_h(token),
                     json={"notes": "Ojo con la cadena al bajar.", "equipment": "otro"})
    assert res.status_code == 200, res.text
    assert res.json()["equipment"] == "otro"

    # Otro usuario no puede editar lo mío
    token2 = _register("gym_other@test.com", "gym_other")
    assert client.put(f"{API}/strength/exercises/{ex_id}", headers=_h(token2),
                      json={"notes": "mío"}).status_code == 404

    # La semilla no se puede editar ni borrar
    seed_id = _pick("Press de banca con barra")["id"]
    assert client.put(f"{API}/strength/exercises/{seed_id}", headers=_h(token),
                      json={"notes": "no"}).status_code == 404
    assert client.delete(f"{API}/strength/exercises/{seed_id}",
                         headers=_h(token)).status_code == 404

    # Borrar el propio
    assert client.delete(f"{API}/strength/exercises/{ex_id}",
                         headers=_h(token)).status_code == 200
    assert client.get(f"{API}/strength/exercises/{ex_id}",
                      headers=_h(token)).status_code == 404


# ---------------------------------------------------------------------------
# Plantillas
# ---------------------------------------------------------------------------

def test_template_crud():
    _setup()
    token = _register("gym_tpl@test.com", "gym_tpl")
    bench = _pick("Press de banca con barra")
    row = _pick("Remo con barra")

    assert client.get(f"{API}/strength/templates").status_code == 401

    res = client.post(f"{API}/strength/templates", headers=_h(token), json={
        "name": "Empuje A", "weekday": 0, "focus": "Push", "notes": "Torso.",
        "exercises": [
            {"exercise_id": bench["id"], "sets": 4, "reps": 8, "weight_kg": 80, "rest_seconds": 150},
            {"exercise_id": row["id"], "sets": 3, "reps": 10, "weight_kg": 60, "rest_seconds": 90,
             "notes": "Codo pegado."},
        ]})
    assert res.status_code == 201, res.text
    tpl = res.json()
    assert tpl["name"] == "Empuje A" and tpl["weekday"] == 0
    assert tpl["weekday_label"] == "Lunes"
    assert [e["exercise"]["name"] for e in tpl["exercises"]] == [
        "Press de banca con barra", "Remo con barra"]
    assert tpl["exercises"][0]["position"] == 0
    assert tpl["total_sets"] == 7
    assert tpl["estimated_tonnage_kg"] == round(4 * 8 * 80 + 3 * 10 * 60, 2)
    tpl_id = tpl["id"]

    # Listar y detalle
    lst = client.get(f"{API}/strength/templates", headers=_h(token)).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == tpl_id
    detail = client.get(f"{API}/strength/templates/{tpl_id}", headers=_h(token))
    assert detail.status_code == 200 and detail.json()["id"] == tpl_id

    # Editar: reemplaza ejercicios y conserva el orden nuevo
    res = client.put(f"{API}/strength/templates/{tpl_id}", headers=_h(token), json={
        "name": "Empuje B", "weekday": None, "focus": "Push",
        "exercises": [{"exercise_id": row["id"], "sets": 5, "reps": 5, "weight_kg": 70}]})
    assert res.status_code == 200, res.text
    edited = res.json()
    assert edited["name"] == "Empuje B" and edited["weekday"] is None
    assert len(edited["exercises"]) == 1
    assert edited["exercises"][0]["exercise"]["name"] == "Remo con barra"

    # Un ejercicio inexistente en la plantilla -> 404
    assert client.put(f"{API}/strength/templates/{tpl_id}", headers=_h(token), json={
        "name": "Mala", "exercises": [{"exercise_id": "no-existe"}]}).status_code == 404

    # Borrar
    assert client.delete(f"{API}/strength/templates/{tpl_id}",
                         headers=_h(token)).status_code == 200
    assert client.get(f"{API}/strength/templates/{tpl_id}",
                      headers=_h(token)).status_code == 404


def test_cannot_delete_exercise_used_by_template():
    _setup()
    token = _register("gym_used@test.com", "gym_used")
    created = client.post(f"{API}/strength/exercises", headers=_h(token), json={
        "name": "Sentadilla con pausa", "muscle_group": "cuadriceps",
        "equipment": "barra"}).json()
    tpl = client.post(f"{API}/strength/templates", headers=_h(token), json={
        "name": "Pierna", "exercises": [{"exercise_id": created["id"]}]}).json()
    res = client.delete(f"{API}/strength/exercises/{created['id']}", headers=_h(token))
    assert res.status_code == 409, res.text
    client.delete(f"{API}/strength/templates/{tpl['id']}", headers=_h(token))
    assert client.delete(f"{API}/strength/exercises/{created['id']}",
                         headers=_h(token)).status_code == 200


# ---------------------------------------------------------------------------
# Sesiones con series individuales
# ---------------------------------------------------------------------------

def _session_payload(tpl: dict, bench: dict, row: dict) -> dict:
    return {
        "template_id": tpl["id"],
        "started_at": "2026-11-04T18:00:00",
        "finished_at": "2026-11-04T18:45:00",
        "notes": "Buena sesión.",
        "sets": [
            # calentamiento: NO cuenta para tonelaje
            {"exercise_id": bench["id"], "set_number": 1, "weight_kg": 40, "reps": 10,
             "is_warmup": True, "set_type": "warmup"},
            {"exercise_id": bench["id"], "set_number": 2, "weight_kg": 80, "reps": 10,
             "rir": 2, "rest_seconds": 150},
            {"exercise_id": bench["id"], "set_number": 3, "weight_kg": 80, "reps": 10},
            {"exercise_id": bench["id"], "set_number": 4, "weight_kg": 80, "reps": 10},
            {"exercise_id": row["id"], "set_number": 1, "weight_kg": 60, "reps": 12},
            {"exercise_id": row["id"], "set_number": 2, "weight_kg": 60, "reps": 12},
        ],
    }


def test_session_flow():
    _setup()
    token = _register("gym_sess@test.com", "gym_sess")
    bench = _pick("Press de banca con barra")
    row = _pick("Remo con barra")
    tpl = client.post(f"{API}/strength/templates", headers=_h(token), json={
        "name": "Empuje A", "focus": "Full Body",
        "exercises": [{"exercise_id": bench["id"], "sets": 4, "reps": 10, "weight_kg": 80}]}
    ).json()

    assert client.post(f"{API}/strength/sessions",
                       json={"sets": [{"exercise_id": bench["id"], "weight_kg": 80, "reps": 10}]}
                       ).status_code == 401

    res = client.post(f"{API}/strength/sessions", headers=_h(token),
                      json=_session_payload(tpl, bench, row))
    assert res.status_code == 201, res.text
    sess = res.json()
    sess_id = sess["id"]

    # Tonelaje: (3 x 80 x 10) + (2 x 60 x 12) = 3840 ; el calentamiento no cuenta
    assert sess["total_tonnage_kg"] == 3840.0, sess["total_tonnage_kg"]
    # TSS = tonelaje * factor(focus 'Full Body' = 0.025)
    assert sess["computed_tss"] == round(3840.0 * 0.025, 2), sess["computed_tss"]
    assert sess["duration_min"] == 45.0
    assert sess["date"] == "2026-11-04"
    assert sess["sets_count"] == 6 and sess["exercises_count"] == 2
    assert sess["exercises"][0]["exercise"]["name"] == "Press de banca con barra"
    assert len(sess["exercises"][0]["sets"]) == 4
    assert sess["exercises"][0]["tonnage_kg"] == 2400.0

    # La fila Activity espejo existe y lleva la carga
    acts = client.get(f"{API}/activities/", headers=_h(token),
                      params={"sport": "strength"}).json()
    assert len(acts) == 1, acts
    assert acts[0]["type"] == "strength" and acts[0]["tss"] == sess["computed_tss"]
    assert acts[0]["duration_min"] == 45.0

    # Listado paginado
    lst = client.get(f"{API}/strength/sessions", headers=_h(token)).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == sess_id
    # Filtro por ejercicio
    only_row = client.get(f"{API}/strength/sessions", headers=_h(token),
                          params={"exercise_id": row["id"]}).json()
    assert only_row["total"] == 1
    other = _pick("Dominadas")
    assert client.get(f"{API}/strength/sessions", headers=_h(token),
                      params={"exercise_id": other["id"]}).json()["total"] == 0

    # Detalle
    det = client.get(f"{API}/strength/sessions/{sess_id}", headers=_h(token))
    assert det.status_code == 200 and det.json()["id"] == sess_id

    # Última marca (para precargar el peso)
    marks = client.get(f"{API}/strength/last-marks", headers=_h(token),
                       params={"exercise_ids": f"{bench['id']},{row['id']}"}).json()
    assert marks["marks"][bench["id"]]["weight_kg"] == 80
    assert marks["marks"][bench["id"]]["reps"] == 10
    assert marks["marks"][row["id"]]["weight_kg"] == 60

    # Historial del ejercicio
    hist = client.get(f"{API}/strength/exercises/{bench['id']}/history",
                      headers=_h(token)).json()
    assert hist["pr"] == {"weight_kg": 80.0, "reps": 10, "date": "2026-11-04"}
    assert len(hist["sessions"]) == 1 and len(hist["sessions"][0]["sets"]) == 4
    assert hist["sessions"][0]["tonnage_kg"] == 2400.0
    assert len(hist["series"]) == 1 and hist["series"][0]["max_weight_kg"] == 80

    # Corregir una serie: cambia el 80x10 por 85x8 en las 3 de trabajo
    fixed = _session_payload(tpl, bench, row)
    for s in fixed["sets"]:
        if s["exercise_id"] == bench["id"] and not s.get("is_warmup"):
            s["weight_kg"], s["reps"] = 85, 8
    res = client.put(f"{API}/strength/sessions/{sess_id}", headers=_h(token), json=fixed)
    assert res.status_code == 200, res.text
    updated = res.json()
    assert updated["total_tonnage_kg"] == round(3 * 85 * 8 + 2 * 60 * 12, 2)
    assert updated["sets_count"] == 6
    # La actividad espejo se actualizó, no se duplicó
    acts2 = client.get(f"{API}/activities/", headers=_h(token),
                       params={"sport": "strength"}).json()
    assert len(acts2) == 1
    assert acts2[0]["tss"] == updated["computed_tss"]

    # Borrar sesión: se va también la actividad
    assert client.delete(f"{API}/strength/sessions/{sess_id}",
                         headers=_h(token)).status_code == 200
    assert client.get(f"{API}/strength/sessions/{sess_id}",
                      headers=_h(token)).status_code == 404
    assert client.get(f"{API}/activities/", headers=_h(token),
                      params={"sport": "strength"}).json() == []


def test_session_validation():
    _setup()
    token = _register("gym_val@test.com", "gym_val")
    bench = _pick("Press de banca con barra")
    # Sin series
    assert client.post(f"{API}/strength/sessions", headers=_h(token),
                       json={"sets": []}).status_code == 422
    # Ejercicio inexistente
    assert client.post(f"{API}/strength/sessions", headers=_h(token), json={
        "sets": [{"exercise_id": "no-existe", "weight_kg": 50, "reps": 5}]}).status_code == 404
    # Fin anterior al inicio
    res = client.post(f"{API}/strength/sessions", headers=_h(token), json={
        "started_at": "2026-11-04T18:00:00", "finished_at": "2026-11-04T17:00:00",
        "sets": [{"exercise_id": bench["id"], "weight_kg": 50, "reps": 5}]})
    assert res.status_code == 422, res.text
    # Peso fuera de rango
    assert client.post(f"{API}/strength/sessions", headers=_h(token), json={
        "sets": [{"exercise_id": bench["id"], "weight_kg": 5000, "reps": 5}]}).status_code == 422


def test_exercises_prs_route_not_shadowed():
    """La ruta vieja `/strength/exercises/prs` no debe quedar tapada por `/{exercise_id}`."""
    _setup()
    res = client.get(f"{API}/strength/exercises/prs")
    assert res.status_code == 200, res.text
    assert isinstance(res.json(), list)


def test_legacy_strength_log_still_works():
    """Compatibilidad: el endpoint viejo y su contrato siguen intactos."""
    _setup()
    token = _register("gym_legacy@test.com", "gym_legacy")
    res = client.post(f"{API}/strength/log", headers=_h(token), json={
        "workout_date": "2026-11-04", "routine_name": "Rutina vieja",
        "target_focus": "Push",
        "exercises": [{"name": "Press de banca", "sets": 4, "reps": 10, "weight_kg": 80}],
        "notes": "endpoint legado"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "success"
    assert body["total_tonnage_kg"] == 3200.0
    hist = client.get(f"{API}/strength/history", headers=_h(token))
    assert hist.status_code == 200 and len(hist.json()) == 1


if __name__ == "__main__":
    test_catalog_seeded_and_filters()
    test_seed_is_idempotent()
    test_custom_exercise_crud_and_protections()
    test_template_crud()
    test_cannot_delete_exercise_used_by_template()
    test_session_flow()
    test_session_validation()
    test_exercises_prs_route_not_shadowed()
    test_legacy_strength_log_still_works()
    print("SUCCESS: gym v2 OK.")
