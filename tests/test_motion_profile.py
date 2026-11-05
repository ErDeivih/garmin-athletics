"""Perfil de movimiento y calibración en seco (IMU-1/IMU-4/IMU-2).

    .\\venv\\Scripts\\python.exe tests\\test_motion_profile.py
"""
import math
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_motion.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def _register():
    response = client.post(f"{API}/auth/register", json={
        "email": "imu@example.com", "username": "imu",
        "display_name": "IMU", "password": "password_segura_123"})
    assert response.status_code == 201, response.text
    return response.json()


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _synthetic(reps: int = 5, period_s: float = 2.4, rate_hz: float = 25.0):
    samples = []
    for index in range(int(reps * period_s * rate_hz)):
        t = index / rate_hz
        phase = 2 * math.pi * t / period_s
        samples.append({
            "t_ms": round(t * 1000, 1),
            "x": 12 + 8 * math.sin(phase),
            "y": -985 + 20 * math.cos(phase),
            "z": 170 + 420 * math.sin(phase),
        })
    return samples


def run():
    with client:
        pass
    user = _register()
    headers = _h(user["access_token"])
    bench = client.get(f"{API}/strength/exercises?q=press de banca", headers=headers).json()["items"][0]

    empty = client.get(f"{API}/strength/exercises/{bench['id']}/motion-profile", headers=headers)
    assert empty.status_code == 200 and empty.json()["configured"] is False

    cal = client.post(f"{API}/strength/exercises/{bench['id']}/motion-profile/calibrate",
                      headers=headers, json={
                          "samples": _synthetic(5), "sample_rate_hz": 25,
                          "reps_labeled": 5, "save_draft": True})
    assert cal.status_code == 200, cal.text
    body = cal.json()
    assert body["detected_reps"] == 5, body
    assert body["profile"]["rep"]["expected_duration_s"] == 2.4, body["profile"]["rep"]
    assert body["saved_draft_id"]

    profile = body["profile"]
    save = client.put(f"{API}/strength/exercises/{bench['id']}/motion-profile",
                      headers=headers, json={"profile": profile, "status": "active"})
    assert save.status_code == 200, save.text
    active = client.get(f"{API}/strength/exercises/{bench['id']}/motion-profile", headers=headers).json()
    assert active["configured"] and active["status"] == "active"

    # Una segunda versión activa retira la anterior.
    save2 = client.put(f"{API}/strength/exercises/{bench['id']}/motion-profile",
                       headers=headers, json={"profile": profile, "status": "active"})
    assert save2.json()["version"] == save.json()["version"] + 1
    versions = client.get(f"{API}/strength/exercises/{bench['id']}/motion-profile/versions",
                          headers=headers).json()["items"]
    assert versions[0]["version"] == save2.json()["version"]
    assert any(item["status"] == "retired" for item in versions[1:])

    detect = client.post(f"{API}/strength/exercises/{bench['id']}/motion-profile/detect",
                         headers=headers, json={"samples": _synthetic(5), "profile": profile})
    assert detect.status_code == 200, detect.text
    assert detect.json()["reps"] == 5

    bad = dict(profile)
    bad["rep"] = {**profile["rep"], "min_duration_s": 9, "max_duration_s": 1}
    assert client.put(f"{API}/strength/exercises/{bench['id']}/motion-profile",
                      headers=headers, json={"profile": bad, "status": "draft"}).status_code == 422
    assert client.get(f"{API}/strength/exercises/{bench['id']}/motion-profile").status_code == 401

    print("SUCCESS: perfiles IMU y calibración en seco OK (5/5 reps, versiones y validación).")


if __name__ == "__main__":
    run()
