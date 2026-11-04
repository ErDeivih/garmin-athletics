"""E2E con Garmin SIMULADO (sin red): sync, detalle/track, re-auth, link+MFA.

Cada test usa BD SQLite efímera (igual que test_social_e2e) y parches sobre
GarminService. No toca la BD real ni necesita tokens.
"""
import os
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_mocked.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
import app.services.sync_service as sync_svc_mod  # noqa: E402
import app.api.v1.social_auth as auth_mod  # noqa: E402
import app.services.garmin_service as svc_mod  # noqa: E402
from app.core.config import settings  # noqa: E402

client = TestClient(app)
API = "/api/v1"

YESTERDAY = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

FULL_FIXTURE = {
    "details": {"geoPolylineDTO": {"polyline": [
        {"lat": 40.9, "lon": -5.5, "altitude": 800.0, "time": 1700000000000, "speed": 3.0},
        {"lat": 40.901, "lon": -5.501, "altitude": 805.0, "time": 1700000060000, "speed": 3.2},
        {"lat": 40.902, "lon": -5.502, "altitude": 803.0, "time": 1700000120000, "speed": 3.1}]},
        "metricDescriptors": []},
    "splits": {"lapDTOs": [
        {"lapIndex": 1, "distance": 1000.0, "movingDuration": 300.0,
         "averageHR": 150, "maxHR": 160, "elevationGain": 5.0,
         "elevationLoss": 2.0, "calories": 60.0, "averageSpeed": 3.33}]},
    "hr_zones": [{"zoneNumber": 3, "secsInZone": 300.0, "zoneLowBoundary": 144}],
    "power_zones": None,
    "weather": {"temp": 68, "apparentTemp": 68, "relativeHumidity": 50,
                "windSpeed": 5, "windDirectionCompassPoint": "n",
                "weatherTypeDTO": {"desc": "Clear"},
                "weatherStationDTO": {"name": "TEST"}},
}


class FakeGarmin:
    full_calls = 0
    ACT_ID = "999001"

    def __init__(self, *a, **k):
        pass

    def get_daily_biometrics(self, d):
        return {"date": str(d), "sleep_seconds": 27000, "sleep_score": 85,
                "hrv_weekly_avg": 55.0, "hrv_overnight_avg": 58.0,
                "resting_hr": 48, "body_battery_max": 90,
                "body_battery_min": 20, "stress_avg": 25}

    def get_activities(self, limit=20):
        return [{"id": self.ACT_ID, "activity_name": "Test Run",
                 "activity_type": "running", "start_time": YESTERDAY,
                 "duration_seconds": 1800, "distance_meters": 5000.0,
                 "avg_hr": 150, "max_hr": 165, "garmin_epoc": 3.0,
                 "calories": 300}]

    def get_activity_full(self, aid):
        FakeGarmin.full_calls += 1
        assert aid == self.ACT_ID
        return FULL_FIXTURE


def _setup():
    with client:
        pass


def _register(email, username):
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()


def _use_fake(fake_cls):
    real_sync = sync_svc_mod.GarminService
    real_pkg = svc_mod.GarminService
    sync_svc_mod.GarminService = fake_cls
    svc_mod.GarminService = fake_cls
    # Los tracks de prueba van a un dir temporal, no al repo
    real_tracks = settings.TRACKS_DIR
    settings.TRACKS_DIR = tempfile.mkdtemp()
    return real_sync, real_pkg, real_tracks


def _restore_fake(real_sync, real_pkg, real_tracks):
    sync_svc_mod.GarminService = real_sync
    svc_mod.GarminService = real_pkg
    settings.TRACKS_DIR = real_tracks


def test_sync_flow_persists_everything():
    _setup()
    real = _use_fake(FakeGarmin)
    try:
        u = _register("sync@test.com", "sync_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}

        res = client.post(f"{API}/sync/garmin", headers=h)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] == "success"
        assert body["activities_inserted"] == 1
        assert body["biometrics"]["sleep_score"] == 85
        assert body["readiness"]["score"] >= 50

        # Segunda sync no duplica
        res2 = client.post(f"{API}/sync/garmin", headers=h)
        assert res2.json()["activities_inserted"] == 0

        # Daily expone lo guardado
        daily = client.get(f"{API}/metrics/daily", headers=h).json()
        assert daily["biometrics_available"] is True
        assert daily["sleep"]["score"] == 85
        assert daily["hrv"]["overnight"] == 58.0
        assert daily["resting_hr"] == 48

        # Trends sin huecos inventados (ayer tiene valor por la actividad? no: hrv de hoy sí)
        trends = client.get(f"{API}/metrics/trends?metric=hrv&days=7", headers=h).json()
        today = date.today().isoformat()
        assert [p for p in trends["series"] if p["date"] == today][0]["value"] == 58.0

        # Load incluye el TSS (3.0 EPOC * 28 = 84)
        load = client.get(f"{API}/metrics/load?days=7", headers=h).json()
        assert any(d["tss"] == 84.0 for d in load["series"])

        # Status cuenta la actividad de ayer (dentro de 7d)
        st = client.get(f"{API}/sync/status", headers=h).json()
        assert st["linked"] is False  # sin vincular: fallback global simulado
        assert st["activities_7d"] == 1
        assert st["tss_7d"] == 84.0
    finally:
        _restore_fake(*real)


def test_detail_enrich_track_and_cache():
    _setup()
    FakeGarmin.full_calls = 0
    FakeGarmin.ACT_ID = "999002"
    real = _use_fake(FakeGarmin)
    try:
        u = _register("detail@test.com", "detail_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        client.post(f"{API}/sync/garmin", headers=h)

        d = client.get(f"{API}/activities/999002", headers=h)
        assert d.status_code == 200, d.text
        body = d.json()
        assert body["has_track"] is True
        assert body["laps"][0]["pace"] == "5:00 /km"
        assert body["hr_zones"] == [{"zone": 3, "secs": 300, "low": 144}]
        assert body["weather"]["temp_c"] == 20.0
        assert body["gain_m"] == 5.0
        assert body["min_alt"] == 800.0 and body["max_alt"] == 805.0

        t = client.get(f"{API}/activities/999002/track", headers=h).json()
        assert len(t["points"]["lat"]) == 3  # fixture pequeña, sin recorte
        assert t["bbox"][0] == 40.9

        # Segunda vista usa caché (sin más llamadas a Garmin)
        client.get(f"{API}/activities/999002", headers=h)
        assert FakeGarmin.full_calls == 1

        # Track de actividad inexistente -> 404
        assert client.get(f"{API}/activities/000000/track", headers=h).status_code == 404
    finally:
        _restore_fake(*real)


def test_expired_tokens_mark_reauth():
    _setup()

    class DeadGarmin(FakeGarmin):
        def get_daily_biometrics(self, d):
            raise Exception("401 Unauthorized: token expired")

    real = _use_fake(DeadGarmin)
    try:
        u = _register("dead@test.com", "dead_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        # Vincular primero con fake bueno para tener fila
        _restore_fake(*real)
        real2 = _use_fake(FakeGarmin)

        class LinkFake:
            def __init__(self, *a, **k):
                pass

            def link_with_password(self, email, password):
                return {"linked": True, "need_mfa": False}

        real_auth = auth_mod.GarminService
        auth_mod.GarminService = LinkFake
        try:
            link = client.put(f"{API}/auth/garmin-credentials", headers=h, json={
                "garmin_email": "dead@garmin.com", "garmin_password": "x"})
            assert link.status_code == 200
        finally:
            auth_mod.GarminService = real_auth
        _restore_fake(*real2)

        real3 = _use_fake(DeadGarmin)
        try:
            res = client.post(f"{API}/sync/garmin", headers=h)
            assert res.status_code == 500
            st = client.get(f"{API}/auth/garmin-status", headers=h).json()
            assert st["needs_reauth"] is True
        finally:
            _restore_fake(*real3)
    finally:
        pass


def test_link_mfa_flow():
    _setup()

    class MfaFake:
        def __init__(self, *a, **k):
            pass

        def link_with_password(self, email, password):
            assert password == "pw-2fa"
            return {"linked": False, "need_mfa": True, "ticket": {"t": "abc"}}

        def complete_mfa_link(self, email, password, ticket, code):
            assert ticket == {"t": "abc"} and code == "123456"
            return {"linked": True}

    real_auth = auth_mod.GarminService
    auth_mod.GarminService = MfaFake
    try:
        u = _register("mfa@test.com", "mfa_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        step1 = client.put(f"{API}/auth/garmin-credentials", headers=h, json={
            "garmin_email": "mfa@garmin.com", "garmin_password": "pw-2fa"})
        assert step1.status_code == 200 and step1.json()["status"] == "need_mfa"
        step2 = client.post(f"{API}/auth/garmin-mfa", headers=h, json={
            "garmin_email": "mfa@garmin.com", "garmin_password": "pw-2fa",
            "ticket": {"t": "abc"}, "code": "123456"})
        assert step2.status_code == 200 and step2.json()["status"] == "saved"
        st = client.get(f"{API}/auth/garmin-status", headers=h).json()
        assert st["linked"] is True and st["needs_reauth"] is False
    finally:
        auth_mod.GarminService = real_auth


def test_suggest_intensity_and_validation():
    _setup()
    u = _register("val@test.com", "val_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}

    # Email inválido
    bad = client.post(f"{API}/auth/register", json={
        "email": "no-es-email", "username": "xx", "display_name": "x",
        "password": "password123"})
    assert bad.status_code == 422

    # Intensidad suave fuerza rama soft (4 ejercicios)
    soft = client.get(f"{API}/strength/suggest?focus=Push&intensity=suave", headers=h)
    assert soft.status_code == 200
    assert len(soft.json()["exercises"]) == 4

    # RPE fuera de rango y duración corta -> 422 de Pydantic
    bad_rpe = client.post(f"{API}/activities/manual", headers=h, json={
        "activity_type": "soccer", "activity_name": "X",
        "duration_minutes": 90, "rpe": 11})
    assert bad_rpe.status_code == 422
    bad_dur = client.post(f"{API}/activities/manual", headers=h, json={
        "activity_type": "soccer", "activity_name": "X",
        "duration_minutes": 2, "rpe": 5})
    assert bad_dur.status_code == 422

    # Log de fuerza suma a fatiga vía activities
    log = client.post(f"{API}/strength/log", headers=h, json={
        "routine_name": "T", "target_focus": "Push",
        "exercises": [{"name": "Press", "sets": 3, "reps": 10, "weight_kg": 50}]})
    assert log.status_code == 200
    assert log.json()["total_tonnage_kg"] == 1500.0


if __name__ == "__main__":
    test_sync_flow_persists_everything()
    test_detail_enrich_track_and_cache()
    test_expired_tokens_mark_reauth()
    test_link_mfa_flow()
    test_suggest_intensity_and_validation()
    print("SUCCESS: E2E con Garmin simulado OK.")
