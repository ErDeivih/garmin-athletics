import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# BD efímera para pruebas
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_social.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _setup():
    """Dispara el evento de startup (creación de tablas) una sola vez."""
    with client:
        pass


def _register(email: str, username: str):
    res = client.post(f"{API}/auth/register", json={
        "email": email,
        "username": username,
        "display_name": f"Atleta {username}",
        "password": "password_segura_123",
    })
    assert res.status_code == 201, res.text
    return res.json()


def _add_activity(token: str, tss_hours: float = 1.0, name: str = "Rodaje"):
    res = client.post(
        f"{API}/activities/manual",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "activity_type": "running",
            "activity_name": name,
            "duration_minutes": int(tss_hours * 60),
            "rpe": 6,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_full_social_flow():
    _setup()

    # 1. Registro de dos atletas
    david = _register("david@test.com", "david_runner")
    ana = _register("ana@test.com", "ana_cyclist")

    # 2. Login
    login = client.post(f"{API}/auth/login", json={
        "email": "david@test.com", "password": "password_segura_123"
    })
    assert login.status_code == 200
    assert login.json()["access_token"]

    # 3. Perfil autenticado
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {david['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "david_runner"

    # 4. Actividades propias de cada uno (aislamiento multiusuario)
    _add_activity(david["access_token"], 2.0)
    _add_activity(david["access_token"], 1.0)
    _add_activity(ana["access_token"], 4.0, "Saldo larga")

    acts_david = client.get(f"{API}/activities/", headers={
        "Authorization": f"Bearer {david['access_token']}"})
    names_david = [a["name"] for a in acts_david.json()]
    assert len(names_david) == 2  # no ve las de Ana

    # 5. Flujo de amistad: solicitud -> aceptación
    req = client.post(f"{API}/friends/requests",
                      headers={"Authorization": f"Bearer {david['access_token']}"},
                      json={"username": "ana_cyclist"})
    assert req.status_code == 201, req.text
    friendship_id = req.json()["friendship_id"]

    incoming = client.get(f"{API}/friends/",
                          headers={"Authorization": f"Bearer {ana['access_token']}"})
    assert len(incoming.json()["incoming_requests"]) == 1

    accept = client.post(f"{API}/friends/requests/{friendship_id}/respond",
                         headers={"Authorization": f"Bearer {ana['access_token']}"},
                         json={"action": "accept"})
    assert accept.status_code == 200 and accept.json()["status"] == "accepted"

    friends_david = client.get(f"{API}/friends/",
                               headers={"Authorization": f"Bearer {david['access_token']}"})
    assert [f["username"] for f in friends_david.json()["friends"]] == ["ana_cyclist"]

    # 6. Leaderboard comparativo (Ana tiene más TSS semanal -> primera)
    board = client.get(f"{API}/social/leaderboard",
                       headers={"Authorization": f"Bearer {david['access_token']}"})
    assert board.status_code == 200, board.text
    ranking = board.json()["ranking"]
    assert len(ranking) == 2
    assert ranking[0]["athlete"]["username"] == "ana_cyclist"
    assert ranking[0]["weekly_tss"] > ranking[1]["weekly_tss"]
    for entry in ranking:
        assert {"weekly_tss", "ctl", "tsb", "readiness_score"} <= set(entry.keys())

    # 7. Sin token en leaderboard -> 401
    anon = client.get(f"{API}/social/leaderboard")
    assert anon.status_code == 401


def test_garmin_credentials_endpoints():
    """Vinculación passwordless: la contraseña se usa una vez (mock) y NO se guarda."""
    import app.api.v1.social_auth as social_auth_mod

    linked_calls = {}

    class FakeGarminService:
        def __init__(self, *a, **k):
            pass

        def link_with_password(self, email, password):
            linked_calls["email"] = email
            assert password == "secreta-garmin-123"  # llega al login, pero...
            return {"linked": True, "need_mfa": False}

    real = social_auth_mod.GarminService
    social_auth_mod.GarminService = FakeGarminService
    try:
        _setup()

        reg = _register("carlos@test.com", "carlos_tri")
        headers = {"Authorization": f"Bearer {reg['access_token']}"}

        # Sin vincular
        status = client.get(f"{API}/auth/garmin-status", headers=headers)
        assert status.status_code == 200 and status.json()["linked"] is False

        # Vincular (mock: login OK sin red)
        link = client.put(f"{API}/auth/garmin-credentials", headers=headers, json={
            "garmin_email": "carlos@garmin.com",
            "garmin_password": "secreta-garmin-123",
        })
        assert link.status_code == 200 and link.json()["status"] == "saved"
        assert linked_calls.get("email") == "carlos@garmin.com"

        status = client.get(f"{API}/auth/garmin-status", headers=headers)
        body = status.json()
        assert body["linked"] is True and body["garmin_email"] == "carlos@garmin.com"

        # La contraseña NO queda en BD: comprobar vía registro directo
        import sys as _sys
        backend_dir2 = Path(__file__).resolve().parent.parent / "backend"
        if str(backend_dir2) not in _sys.path:
            _sys.path.insert(0, str(backend_dir2))
        import asyncio as _asyncio
        from sqlalchemy import select as _select
        from app.db.session import AsyncSessionLocal as _Session
        from app.db.models import GarminCredential as _GC, User as _U

        async def _check():
            async with _Session() as db:
                u = (await db.execute(_select(_U).where(_U.username == "carlos_tri"))).scalar_one()
                c = (await db.execute(_select(_GC).where(_GC.user_id == u.id))).scalar_one()
                return c.garmin_password_encrypted

        assert _asyncio.run(_check()) is None  # passwordless: nada persistido

        # Desvincular y comprobar que ya no está
        unlink = client.delete(f"{API}/auth/garmin-credentials", headers=headers)
        assert unlink.status_code == 200
        status = client.get(f"{API}/auth/garmin-status", headers=headers)
        assert status.json()["linked"] is False
    finally:
        social_auth_mod.GarminService = real


def test_invite_flow():
    _setup()
    a = _register("invita@test.com", "invita_runner")
    b = _register("invitado@test.com", "invitado_runner")
    ha = {"Authorization": f"Bearer {a['access_token']}"}
    hb = {"Authorization": f"Bearer {b['access_token']}"}

    inv = client.post(f"{API}/friends/invite", headers=ha)
    assert inv.status_code == 201, inv.text
    code = inv.json()["code"]
    assert len(code) == 6

    acc = client.post(f"{API}/friends/accept-invite", headers=hb, json={"code": code})
    assert acc.status_code == 200 and acc.json()["status"] == "accepted"

    friends = client.get(f"{API}/friends/", headers=ha).json()["friends"]
    assert [f["username"] for f in friends] == ["invitado_runner"]

    # Reusar el código falla
    again = client.post(f"{API}/friends/accept-invite", headers=hb, json={"code": code})
    assert again.status_code == 404


def test_push_workout_dry_run():
    _setup()
    u = _register("gym@test.com", "gym_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    res = client.post(f"{API}/strength/push-to-garmin", headers=h, json={
        "routine_name": "Rutina Empuje A",
        "dry_run": True,
        "exercises": [
            {"name": "Press de Banca", "sets": 4, "reps": 8, "weight_kg": 80},
            {"name": "Ejercicio Raro Inexistente", "sets": 2, "reps": 10, "weight_kg": 20},
        ],
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "dry_run"
    assert "Ejercicio Raro Inexistente" in body["unmapped_exercises"]
    assert body["workout_json"]["workoutName"] == "Rutina Empuje A"
    assert len(body["workout_json"]["workoutSegments"][0]["workoutSteps"]) == 6  # 4+2 sets


def test_routes_crud():
    _setup()
    u = _register("rutas@test.com", "rutas_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}

    lat = [40.97 + i * 0.001 for i in range(10)]
    lon = [-5.66 + i * 0.001 for i in range(10)]
    create = client.post(f"{API}/routes/", headers=h, json={
        "name": "Vuelta test", "sport": "cycling", "lat": lat, "lon": lon})
    assert create.status_code == 200, create.text
    rid = create.json()["id"]
    assert create.json()["distance_m"] > 100

    lst = client.get(f"{API}/routes/", headers=h).json()
    assert any(r["id"] == rid for r in lst)

    one = client.get(f"{API}/routes/{rid}", headers=h)
    assert one.status_code == 200 and len(one.json()["lat"]) == 10

    exp = client.get(f"{API}/routes/{rid}/export", headers=h)
    assert exp.status_code == 200 and "<gpx" in exp.text and "Vuelta test" in exp.text

    bad = client.post(f"{API}/routes/", headers=h, json={
        "name": "Mala", "sport": "cycling", "lat": [1.0], "lon": [1.0, 2.0]})
    assert bad.status_code in (400, 422)

    delete = client.delete(f"{API}/routes/{rid}", headers=h)
    assert delete.status_code == 200
    assert client.get(f"{API}/routes/{rid}", headers=h).status_code == 404


def test_leaderboard_many_friends_parallel():
    """3 atletas con amistades: el leaderboard paralelo devuelve a los 3 ordenados."""
    _setup()
    a = _register("lead_a@test.com", "lead_a")
    b = _register("lead_b@test.com", "lead_b")
    c = _register("lead_c@test.com", "lead_c")
    ha = {"Authorization": f"Bearer {a['access_token']}"}
    hb = {"Authorization": f"Bearer {b['access_token']}"}
    hc = {"Authorization": f"Bearer {c['access_token']}"}

    for me, other in ((a["access_token"], "lead_b"), (a["access_token"], "lead_c")):
        req = client.post(f"{API}/friends/requests",
                          headers={"Authorization": f"Bearer {me}"},
                          json={"username": other})
        fid = req.json()["friendship_id"]
        who = hb if other == "lead_b" else hc
        client.post(f"{API}/friends/requests/{fid}/respond",
                    headers=who, json={"action": "accept"})

    _add_activity(c["access_token"], 3.0, "Mucha caña")
    _add_activity(b["access_token"], 1.0, "Poco")

    board = client.get(f"{API}/social/leaderboard?days=7&order_by=weekly_tss", headers=ha)
    assert board.status_code == 200, board.text
    ranking = board.json()["ranking"]
    assert [e["athlete"]["username"] for e in ranking] == ["lead_c", "lead_b", "lead_a"]
    assert ranking[0]["weekly_tss"] > ranking[1]["weekly_tss"] > ranking[2]["weekly_tss"]


if __name__ == "__main__":
    test_full_social_flow()
    test_garmin_credentials_endpoints()
    test_invite_flow()
    test_push_workout_dry_run()
    test_routes_crud()
    test_leaderboard_many_friends_parallel()
    print("SUCCESS: Flujos end-to-end (social + credenciales Garmin) OK.")
