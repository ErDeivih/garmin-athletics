"""Casos borde: datos raros de Garmin, endpoints sin datos, errores JSON limpios."""
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_edge.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
import app.services.sync_service as sync_svc_mod  # noqa: E402
import app.services.garmin_service as svc_mod  # noqa: E402
from app.core.config import settings  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _setup():
    with client:
        pass


def _register(email, username):
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()


class WeirdGarmin:
    def __init__(self, *a, **k):
        pass

    def get_daily_biometrics(self, d):
        return {"date": str(d), "sleep_seconds": None, "sleep_score": None,
                "hrv_weekly_avg": None, "hrv_overnight_avg": None,
                "resting_hr": None, "body_battery_max": None,
                "body_battery_min": None, "stress_avg": None}

    def get_activities(self, limit=20):
        return [
            {"id": None, "activity_name": "Sin id"},  # se salta
            {"id": "e1", "activity_name": "Sin fecha",
             "activity_type": "running", "start_time": "no-es-fecha",
             "duration_seconds": 100, "distance_meters": 10},  # se salta
            {"id": "e2", "activity_name": "Duración cero",
             "activity_type": "running", "start_time": "2026-09-09 07:00:00",
             "duration_seconds": 0, "distance_meters": 0,
             "avg_hr": None, "max_hr": None,
             "garmin_epoc": None, "calories": 0},  # entra con TSS 0
        ]

    def get_activity_full(self, aid):
        return {"details": None, "splits": None, "hr_zones": None,
                "power_zones": None, "weather": None}


class EmptyGarmin(WeirdGarmin):
    def get_activities(self, limit=20):
        return []


def _use_fake(fake_cls):
    real_sync, real_pkg, real_tracks = (
        sync_svc_mod.GarminService, svc_mod.GarminService, settings.TRACKS_DIR)
    sync_svc_mod.GarminService = fake_cls
    svc_mod.GarminService = fake_cls
    settings.TRACKS_DIR = tempfile.mkdtemp()
    return real_sync, real_pkg, real_tracks


def _restore(real):
    sync_svc_mod.GarminService, svc_mod.GarminService, settings.TRACKS_DIR = real


def test_sync_skips_garbage_and_accepts_empty():
    _setup()
    real = _use_fake(WeirdGarmin)
    try:
        u = _register("edge@test.com", "edge_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        res = client.post(f"{API}/sync/garmin", headers=h)
        assert res.status_code == 200, res.text
        assert res.json()["activities_inserted"] == 1  # solo la de duración cero
        # Readiness con todo None no revienta (fallbacks)
        daily = client.get(f"{API}/metrics/daily", headers=h).json()
        assert daily["biometrics_available"] is True
        assert daily["readiness"]["score"] >= 0
    finally:
        _restore(real)

    real = _use_fake(EmptyGarmin)
    try:
        u = _register("empty@test.com", "empty_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        res = client.post(f"{API}/sync/garmin", headers=h)
        assert res.status_code == 200 and res.json()["activities_inserted"] == 0
    finally:
        _restore(real)


def test_manual_activity_without_gps_has_no_track():
    _setup()
    u = _register("man@test.com", "man_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    created = client.post(f"{API}/activities/manual", headers=h, json={
        "activity_type": "soccer", "activity_name": "Pachanga",
        "duration_minutes": 60, "rpe": 6}).json()
    d = client.get(f"{API}/activities/{created['activity_id']}", headers=h)
    assert d.status_code == 200
    assert d.json()["has_track"] is False
    assert d.json()["laps"] == []
    t = client.get(f"{API}/activities/{created['activity_id']}/track", headers=h)
    assert t.status_code == 404
    assert "detail" in t.json()  # error JSON limpio, no HTML


def test_anonymous_suggest_and_empty_push_rejected():
    _setup()
    # Sugerencia sin login: funciona con defaults
    r = client.get(f"{API}/strength/suggest?focus=Pull&intensity=auto")
    assert r.status_code == 200 and len(r.json()["exercises"]) > 0
    # Push sin ejercicios -> 422, no workout vacío a Garmin
    u = _register("push@test.com", "push_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    bad = client.post(f"{API}/strength/push-to-garmin", headers=h, json={
        "routine_name": "Vacía", "dry_run": True, "exercises": []})
    assert bad.status_code == 422
    # Push real sin vincular -> 401/400 controlado
    real = client.post(f"{API}/strength/push-to-garmin", headers=h, json={
        "routine_name": "T", "dry_run": False,
        "exercises": [{"name": "Press", "sets": 1, "reps": 5, "weight_kg": 20}]})
    assert real.status_code == 400


def test_unknown_ids_are_json_404():
    _setup()
    u = _register("nf@test.com", "nf_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    for path in [f"{API}/activities/nope", f"{API}/activities/nope/track",
                 f"{API}/routes/nope", f"{API}/social/friends/nope/summary"]:
        r = client.get(path, headers=h)
        assert r.status_code in (403, 404), path
        assert "detail" in r.json(), path


def test_privacy_track_and_leaderboard():
    """Un usuario no ve el track de otro; el leaderboard no expone coords."""
    _setup()
    a = _register("priv_a@test.com", "priv_a")
    b = _register("priv_b@test.com", "priv_b")
    ha = {"Authorization": f"Bearer {a['access_token']}"}
    hb = {"Authorization": f"Bearer {b['access_token']}"}

    created = client.post(f"{API}/activities/manual", headers=ha, json={
        "activity_type": "soccer", "activity_name": "Privada",
        "duration_minutes": 60, "rpe": 5}).json()
    # B no ve el detalle ni el track de A (ni siquiera existe en su ámbito)
    assert client.get(f"{API}/activities/{created['activity_id']}", headers=hb).status_code == 404
    assert client.get(f"{API}/activities/{created['activity_id']}/track", headers=hb).status_code == 404
    assert client.get(f"{API}/activities/{created['activity_id']}/export", headers=hb).status_code == 404

    # Amistad + leaderboard sin rastro de GPS ni biometría cruda
    req = client.post(f"{API}/friends/requests", headers=ha, json={"username": "priv_b"})
    fid = req.json()["friendship_id"]
    client.post(f"{API}/friends/requests/{fid}/respond", headers=hb, json={"action": "accept"})
    board = client.get(f"{API}/social/leaderboard", headers=ha).json()
    blob = str(board).lower()
    for forbidden in ["track_path", "latitude", "longitude", '"lat"', '"lon"',
                      "streams", "sleep_seconds", "hrv_overnight", "body_battery"]:
        assert forbidden not in blob, forbidden


if __name__ == "__main__":
    test_sync_skips_garbage_and_accepts_empty()
    test_manual_activity_without_gps_has_no_track()
    test_anonymous_suggest_and_empty_push_rejected()
    test_unknown_ids_are_json_404()
    test_privacy_track_and_leaderboard()
    print("SUCCESS: edge cases OK.")
