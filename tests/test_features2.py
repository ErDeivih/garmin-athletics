"""Nuevas funciones: streams/splits/export, privacy, calendario, avisos,
rendimiento, stats, GDPR, logout, import GPX, filtros."""
import io
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_feat2.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
import app.services.sync_service as sync_svc_mod  # noqa: E402
import app.services.garmin_service as svc_mod  # noqa: E402
from app.core.config import settings  # noqa: E402

client = TestClient(app)
API = "/api/v1"
YESTERDAY = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

TRK = [{"lat": 40.9 + i * 0.01, "lon": -5.5, "altitude": 800.0 + i * 10,
        "time": 1700000000000 + i * 60000, "speed": 3.0} for i in range(12)]


class StubClient:
    def get_stats(self, d):
        return {"totalSteps": 8000, "dailyStepGoal": 6500,
                "totalKilocalories": 2200.0, "activeKilocalories": 300.0,
                "totalDistanceMeters": 6000, "moderateIntensityMinutes": 20,
                "vigorousIntensityMinutes": 10, "floorsAscendedInMeters": 5,
                "sedentarySeconds": 40000}


class Fake2:
    ACT_ID = "770001"

    def __init__(self, *a, **k):
        self.client = StubClient()

    def get_daily_biometrics(self, d):
        return {"date": str(d), "sleep_seconds": 25200, "sleep_score": 78,
                "sleep_deep_seconds": 3600, "sleep_light_seconds": 12000,
                "sleep_rem_seconds": 5400, "sleep_awake_seconds": 1200,
                "time_in_bed_seconds": 26400, "sleep_efficiency": 95.5,
                "bedtime_local": "2026-09-08T23:30:00",
                "wakeup_local": "2026-09-09T07:00:00",
                "hrv_weekly_avg": 60.0, "hrv_overnight_avg": 62.0,
                "hrv_status": "BALANCED", "resting_hr": 47,
                "body_battery_max": 95, "body_battery_min": 15,
                "body_battery_wake": 90,
                "body_battery_curve": [[1700000000000, 20], [1700003600000, 90]],
                "stress_avg": 20}

    def get_activities(self, limit=20):
        return [{"id": self.ACT_ID, "activity_name": "Rodaje test",
                 "activity_type": "running", "start_time": YESTERDAY,
                 "duration_seconds": 1800, "distance_meters": 5000.0,
                 "avg_hr": 150, "max_hr": 165, "garmin_epoc": 2.5,
                 "calories": 300}]

    def get_activity_full(self, aid):
        assert aid == self.ACT_ID
        return {
            "details": {"geoPolylineDTO": {"polyline": TRK}, "metricDescriptors": []},            "splits": {"lapDTOs": [
                {"lapIndex": 1, "distance": 2500.0, "movingDuration": 900.0,
                 "averageHR": 148, "maxHR": 160, "elevationGain": 60.0,
                 "elevationLoss": 10.0, "calories": 150.0, "averageSpeed": 2.78}]},
            "hr_zones": [{"zoneNumber": 2, "secsInZone": 600.0, "zoneLowBoundary": 122},
                         {"zoneNumber": 3, "secsInZone": 1200.0, "zoneLowBoundary": 144}],
            "power_zones": None,
            "weather": None}

    def get_training_snapshot(self, d=None):
        return {"vo2max": 51.0, "vo2max_date": "2026-08-29",
                "status_feedback": "RECOVERY_2", "sport": "RUNNING",
                "balance": {"feedback": "AEROBIC_LOW_SHORTAGE"},
                "acute": 222, "chronic": 438, "acwr": 0.5,
                "device": "Forerunner 255",
                "race_5k_s": 1356, "race_10k_s": 2909,
                "race_hm_s": 6607, "race_mar_s": 14983}


def _setup():
    with client:
        pass


def _register(email, username):
    res = client.post(f"{API}/auth/register", json={
        "email": email, "username": username,
        "display_name": username, "password": "password_segura_123"})
    assert res.status_code == 201, res.text
    return res.json()


def _use():
    r1, r2, r3 = sync_svc_mod.GarminService, svc_mod.GarminService, settings.TRACKS_DIR
    sync_svc_mod.GarminService = Fake2
    svc_mod.GarminService = Fake2
    settings.TRACKS_DIR = tempfile.mkdtemp()
    return r1, r2, r3


def _restore(r):
    sync_svc_mod.GarminService, svc_mod.GarminService, settings.TRACKS_DIR = r


def _user():
    _setup()
    u = _register(f"f2_{os.urandom(3).hex()}@test.com", f"f2_{os.urandom(3).hex()}")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    client.post(f"{API}/sync/garmin", headers=h)
    return h


def test_sleep_detail_and_stats_persisted():
    Fake2.ACT_ID = "770001"
    r = _use()
    try:
        h = _user()
        d = client.get(f"{API}/metrics/daily", headers=h).json()
        assert d["sleep"]["deep_seconds"] == 3600
        assert d["sleep"]["efficiency"] == 95.5
        assert d["sleep"]["bedtime"] is not None
        assert d["hrv"]["status"] == "BALANCED"
        assert d["body_battery"]["wake"] == 90
        assert len(d["body_battery"]["curve"]) == 2
        st = client.get(f"{API}/metrics/stats?days=7", headers=h).json()
        assert st["series"][-1]["steps"] == 8000
        assert st["series"][-1]["intensity_minutes"] == 40  # 20 + 10*2
        ts = client.get(f"{API}/metrics/training-status", headers=h).json()
        assert ts["available"] is True
        assert ts["vo2max"] == 51.0
        assert ts["status_label"] == "Recuperación"
        assert ts["race"]["p5k"] == 1356
    finally:
        _restore(r)


def test_streams_splits_export_and_privacy_crop():
    Fake2.ACT_ID = "770002"
    r = _use()
    try:
        h = _user()
        # Enriquecer abriendo el detalle
        d = client.get(f"{API}/activities/{Fake2.ACT_ID}", headers=h)
        assert d.status_code == 200 and d.json()["has_track"] is True

        s = client.get(f"{API}/activities/{Fake2.ACT_ID}/streams?max_points=500", headers=h).json()
        assert s["count"] == 12
        assert len(s["hr"]) == 12 and len(s["pace_sec_km"]) == 12

        sp = client.get(f"{API}/activities/{Fake2.ACT_ID}/splits", headers=h).json()
        assert len(sp["splits"]) >= 1 and sp["splits"][0]["km"] == 1

        gpx = client.get(f"{API}/activities/{Fake2.ACT_ID}/export", headers=h)
        assert gpx.status_code == 200 and "<gpx" in gpx.text

        # Zona de privacidad sobre el punto inicial -> recorta
        z = client.post(f"{API}/privacy-zones/", headers=h, json={
            "label": "Casa", "center_lat": 40.9, "center_lon": -5.5,
            "radius_m": 500}).json()
        assert z["status"] == "created"
        t2 = client.get(f"{API}/activities/{Fake2.ACT_ID}/track", headers=h).json()
        assert len(t2["points"]["lat"]) < 12
        assert client.get(f"{API}/privacy-zones/", headers=h).json()[0]["label"] == "Casa"
    finally:
        _restore(r)


def test_calendar_alerts_performance_prs():
    Fake2.ACT_ID = "770003"
    r = _use()
    try:
        h = _user()
        # Evento recurrente inamovible HOY (siempre <48h, determinista)
        ev = client.post(f"{API}/calendar/events", headers=h, json={
            "title": "Partido", "event_type": "soccer",
            "start_local": (date.today()).isoformat() + "T20:00:00",
            "duration_min": 90, "weekday": date.today().weekday(), "is_immovable": True}).json()
        assert ev["status"] == "created"

        cal = client.get(
            f"{API}/calendar/?from={date.today().isoformat()}&to={(date.today() + timedelta(days=14)).isoformat()}",
            headers=h).json()
        assert len(cal["days"]) == 15
        # El martes aparece la ocurrencia
        tue = [d for d in cal["days"] if d["events"]]
        assert tue and tue[0]["events"][0]["title"] == "Partido"

        # Suggest avisa del inamovible
        sg = client.get(f"{API}/strength/suggest?focus=Push", headers=h).json()
        assert sg.get("calendar_warning") and "48h" in sg["calendar_warning"]

        # Avisos con forma
        al = client.get(f"{API}/alerts/", headers=h).json()
        assert "alerts" in al and isinstance(al["alerts"], list)

        # Rendimiento + PRs (rodaje 5k a 6:00/km)
        # (abrir el detalle primero: las zonas se enriquecen en lazy)
        assert client.get(f"{API}/activities/{Fake2.ACT_ID}", headers=h).status_code == 200
        sm = client.get(f"{API}/performance/summary?sport=running&days=30", headers=h).json()
        assert sm["current"]["sessions"] >= 1 and sm["current"]["km"] == 5.0
        zn = client.get(f"{API}/performance/zones?sport=running&days=30", headers=h).json()
        assert zn["total_secs"] == 1800
        prs = client.get(f"{API}/performance/prs?sport=running", headers=h).json()
        assert any(p["label"] == "best_pace_1k" for p in prs)

        # Borrar evento
        assert client.delete(f"{API}/calendar/events/{ev['id']}", headers=h).status_code == 200
    finally:
        _restore(r)


def test_list_filters_and_gpx_import():
    Fake2.ACT_ID = "770004"
    r = _use()
    try:
        h = _user()
        # Filtros servidor
        assert client.get(f"{API}/activities/?sport=cycling", headers=h).json() == []
        assert len(client.get(f"{API}/activities/?sport=running", headers=h).json()) == 1
        assert len(client.get(f"{API}/activities/?q=rodaje", headers=h).json()) == 1
        assert len(client.get(f"{API}/activities/?q=zzz", headers=h).json()) == 0
        dated = client.get(f"{API}/activities/?from=2020-01-01&to=2020-01-31", headers=h).json()
        assert dated == []
        p1 = client.get(f"{API}/activities/?limit=1&offset=0", headers=h)
        assert len(p1.json()) == 1 and p1.headers.get("x-total-count") == "1"

        # Import GPX
        gpx = ("<?xml version=\"1.0\"?><gpx version=\"1.1\" creator=\"t\">"
               "<trk><name>Test</name><trkseg>"
               "<trkpt lat=\"40.0\" lon=\"-5.0\"><ele>800</ele></trkpt>"
               "<trkpt lat=\"40.01\" lon=\"-5.0\"><ele>810</ele></trkpt>"
               "</trkseg></trk></gpx>").encode()
        imp = client.post(f"{API}/routes/import?sport=running&name=Imp",
                          headers=h, files={"file": ("t.gpx", gpx, "application/gpx+xml")})
        assert imp.status_code == 200, imp.text
        assert imp.json()["points"] == 2 and imp.json()["gain_m"] == 10.0
        bad = client.post(f"{API}/routes/import", headers=h,
                          files={"file": ("t.gpx", b"no xml", "text/plain")})
        assert bad.status_code == 400
    finally:
        _restore(r)


def test_logout_revoke_and_gdpr_delete():
    _setup()
    u = _register("gone@test.com", "gone_runner")
    h = {"Authorization": f"Bearer {u['access_token']}"}
    assert client.get(f"{API}/auth/me", headers=h).status_code == 200
    assert client.post(f"{API}/auth/logout", headers=h).status_code == 200
    assert client.get(f"{API}/auth/me", headers=h).status_code == 401  # revocado

    u2 = _register("gone2@test.com", "gone2_runner")
    h2 = {"Authorization": f"Bearer {u2['access_token']}"}
    client.post(f"{API}/activities/manual", headers=h2, json={
        "activity_type": "soccer", "activity_name": "X",
        "duration_minutes": 60, "rpe": 5})
    assert client.delete(f"{API}/auth/account", headers=h2).status_code == 200
    assert client.get(f"{API}/auth/me", headers=h2).status_code == 401
    assert client.get(f"{API}/activities/?limit=5", headers=h2).json() == []


def test_backfill_first_sync_fetches_more():
    seen = {}

    class LimitFake(Fake2):
        def get_activities(self, limit=20):
            seen.setdefault("calls", []).append(limit)
            return []

    Fake2.ACT_ID = "770005"
    r = _use()
    sync_svc_mod.GarminService = LimitFake
    svc_mod.GarminService = LimitFake
    try:
        u = _register("bf@test.com", "bf_runner")
        h = {"Authorization": f"Bearer {u['access_token']}"}
        client.post(f"{API}/sync/garmin", headers=h)
        client.post(f"{API}/sync/garmin", headers=h)
        assert seen["calls"][0] == 100  # primera vez: backfill
    finally:
        _restore(r)


if __name__ == "__main__":
    test_sleep_detail_and_stats_persisted()
    test_streams_splits_export_and_privacy_crop()
    test_calendar_alerts_performance_prs()
    test_list_filters_and_gpx_import()
    test_logout_revoke_and_gdpr_delete()
    test_backfill_first_sync_fetches_more()
    print("SUCCESS: features2 OK.")
