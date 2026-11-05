"""Generador de rutas: checkpoints, desnivel y parciales (T-35)."""
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_routes.db"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
API = "/api/v1"


def run():
    with client:
        pass
    user = client.post(f"{API}/auth/register", json={
        "email": "routes@example.com", "username": "routes",
        "display_name": "Rutas", "password": "password_segura_123"}).json()
    h = {"Authorization": f"Bearer {user['access_token']}"}
    body = {
        "name": "Vuelta al parque",
        "sport": "running",
        "start": {"lat": 40.4168, "lon": -3.7038, "ele": 650},
        "checkpoints": [
            {"lat": 40.4250, "lon": -3.6900, "ele": 690},
            {"lat": 40.4100, "lon": -3.6800, "ele": 660},
        ],
        "distance_km": 8,
        "effort": "moderate",
        "loop": True,
    }
    res = client.post(f"{API}/routes/generate", headers=h, json=body)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] and data["distance_m"] > 1000
    assert abs(data["distance_m"] - 8000) < 800, data["distance_m"]
    assert data["estimated_duration_s"] > 1800
    assert len(data["lat"]) == len(data["lon"]) == len(data["ele"])
    assert data["splits"] and data["splits"][0]["km"] == 1
    assert data["splits"][0]["pace"] is not None
    assert data["checkpoints"][0]["lat"] == 40.4168

    detail = client.get(f"{API}/routes/{data['id']}", headers=h)
    assert detail.status_code == 200
    assert detail.json()["splits"][0]["km"] == 1
    assert client.post(f"{API}/routes/generate", json=body).status_code == 401
    print("SUCCESS: generador de rutas OK (checkpoints, desnivel y ritmo por km).")


if __name__ == "__main__":
    run()
