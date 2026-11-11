"""Prueba de integridad de pesos: plan → reloj → guardado, etapa por etapa.

Criterio GA-F1: una sesión con TRES pesos distintos (50 / 52,5 / 55 kg) y
comparación por serie entre:
- **plan**: `set_targets` de la plantilla que se envía;
- **reloj**: lo que devuelve `GET /watch/today` (lo que lee la watch-app);
- **guardado**: lo que queda en la sesión al recibir las series del reloj.

Si algo no coincide, el informe localiza la etapa (`reloj` o `guardado`) y la
serie exacta.

Script standalone, BD SQLite efímera con TestClient, sin tocar la base real ni
Garmin:
    .\\venv\\Scripts\\python.exe tests\\test_integridad_pesos.py
"""
import os
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_integridad.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"

PESOS = [50.0, 52.5, 55.0]
REPS = [8, 8, 6]
EJERCICIO = "Press de banca con barra"


def _register(email: str) -> dict:
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": email.split("@")[0],
        "display_name": "Integridad", "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _pick(nombre: str) -> dict:
    res = client.get(f"{API}/strength/exercises", params={"q": nombre})
    assert res.status_code == 200, res.text
    for item in res.json()["items"]:
        if item["name"] == nombre:
            return item
    raise AssertionError(f"El catálogo no tiene '{nombre}'")


def comparar(plan: list, reloj: list, guardado: list) -> list:
    """Compara las tres etapas serie a serie y localiza cualquier diferencia."""
    filas = []
    total = max(len(plan), len(reloj), len(guardado))
    for indice in range(total):
        p = plan[indice] if indice < len(plan) else None
        r = reloj[indice] if indice < len(reloj) else None
        g = guardado[indice] if indice < len(guardado) else None
        if p == r == g:
            filas.append({"set": indice + 1, "plan": p, "reloj": r, "guardado": g,
                          "estado": "coincide", "etapa": None})
        else:
            etapa = "reloj" if p != r else "guardado"
            filas.append({"set": indice + 1, "plan": p, "reloj": r, "guardado": g,
                          "estado": "diferencia", "etapa": etapa})
    return filas


def tabla(filas: list) -> str:
    lineas = ["| Serie | Plan | Reloj | Guardado | Estado | Etapa |",
              "|---|---|---|---|---|---|"]
    for fila in filas:
        lineas.append(f"| {fila['set']} | {fila['plan']} | {fila['reloj']} | "
                      f"{fila['guardado']} | {fila['estado']} | {fila['etapa'] or '—'} |")
    return "\n".join(lineas)


def main() -> None:
    headers = _register(f"integridad{datetime.utcnow().timestamp():.0f}@example.com")
    ejercicio = _pick(EJERCICIO)
    hoy = date.today()

    plantilla = client.post(f"{API}/strength/templates", headers=headers, json={
        "name": "Integridad 3 pesos",
        "weekday": hoy.weekday(),
        "focus": "push",
        "exercises": [{
            "exercise_id": ejercicio["id"], "sets": 3, "reps": 8,
            "weight_kg": PESOS[0], "rest_seconds": 60,
            "set_targets": [
                {"set_number": i + 1, "weight_kg": PESOS[i], "reps": REPS[i]}
                for i in range(3)
            ],
        }],
    })
    assert plantilla.status_code == 201, plantilla.text
    plan = [t["weight_kg"] for t in plantilla.json()["exercises"][0]["set_targets"]]
    assert plan == PESOS, f"El plan no conserva los tres pesos: {plan}"

    # Etapa reloj: lo que lee la watch-app del backend.
    watch = client.get(f"{API}/watch/today", headers=headers)
    assert watch.status_code == 200, watch.text
    reloj = [t["weight_kg"] for t in watch.json()["exercises"][0]["targets"]]

    # El reloj manda las tres series hechas (idempotencia por client_set_id).
    for indice in range(3):
        res = client.post(f"{API}/watch/sets", headers=headers, json={
            "client_set_id": f"integridad-set-{indice + 1}-{int(datetime.utcnow().timestamp())}",
            "workout_id": watch.json()["workout_id"],
            "exercise_id": ejercicio["id"],
            "set_number": indice + 1,
            "weight_kg": reloj[indice],
            "reps": REPS[indice],
            "detected_reps": REPS[indice],
            "completed_at": datetime.utcnow().isoformat(),
        })
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "accepted", res.text

    # Etapa guardado: la sesión que crea el reloj y su detalle.
    sesiones = client.get(f"{API}/strength/sessions", headers=headers, params={"limit": 5})
    assert sesiones.status_code == 200, sesiones.text
    lista = sesiones.json().get("items", sesiones.json())
    assert lista, "No se creó la sesión del reloj"
    detalle = client.get(f"{API}/strength/sessions/{lista[0]['id']}", headers=headers)
    assert detalle.status_code == 200, detalle.text
    guardado = [s["weight_kg"] for s in detalle.json()["exercises"][0]["sets"]]

    print("Etapas medidas")
    print(f"  plan      = {plan}")
    print(f"  reloj     = {reloj}")
    print(f"  guardado  = {guardado}")
    print(tabla(comparar(plan, reloj, guardado)))

    filas = comparar(plan, reloj, guardado)
    assert all(fila["estado"] == "coincide" for fila in filas), f"Discrepancia: {filas}"
    assert plan == reloj == guardado == PESOS, f"Los tres pesos no llegan: {plan} / {reloj} / {guardado}"

    # Localización con una diferencia inyectada: se marca la etapa y la serie.
    inyectado = comparar(plan, [plan[0], plan[1], 56.0], guardado)
    assert inyectado[2]["estado"] == "diferencia"
    assert inyectado[2]["etapa"] == "reloj"
    assert inyectado[2]["set"] == 3
    assert [f["estado"] for f in inyectado[:2]] == ["coincide", "coincide"]

    print("SUCCESS: los tres pesos (50 / 52.5 / 55) llegan a plan, reloj y guardado; "
          "la diferencia inyectada en la serie 3 se localiza en la etapa 'reloj'.")


if __name__ == "__main__":
    with client:  # dispara el arranque: init_db + semilla del catálogo
        main()
