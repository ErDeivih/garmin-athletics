"""Un solo paso: localiza la última actividad de fuerza de hoy, la importa en Lyfta
y confirma las series que vuelven al backend.

Uso (desde la raíz del repo):
    .\\venv\\Scripts\\python.exe scripts\\import_latest_strength.py
"""
import json
import os
import sys
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from app.core.config import settings
from app.core.security import create_token
from app.services.garmin_service import GarminService

USER_ID = "f8aae4f6-7ab0-4628-9d03-8d67f70c8cab"
TOKEN_DIR = f"{settings.GARMIN_TOKENS_DIR}_{USER_ID}"
API = "http://127.0.0.1:8010/api/v1"


def get_strength_activity():
    service = GarminService(password=None, token_dir=TOKEN_DIR, use_env_fallback=False)
    client = service.authenticate()
    activities = client.get_activities(0, 40)
    if isinstance(activities, dict):
        activities = activities.get("activityList") or activities.get("activities") or []
    today = date.today().isoformat()
    candidates = []
    for activity in activities:
        type_key = str((activity.get("activityType") or {}).get("typeKey", "")).lower()
        start = str(activity.get("startTimeLocal") or "")
        if "strength" in type_key and start.startswith(today):
            candidates.append(activity)
    if not candidates:
        return None
    return max(candidates, key=lambda item: str(item.get("startTimeLocal") or ""))


def main() -> int:
    activity = get_strength_activity()
    if activity is None:
        print("NO_STRENGTH_ACTIVITY: no hay una actividad de fuerza de hoy en Garmin.")
        return 0
    activity_id = str(activity.get("activityId"))
    print(f"ACTIVIDAD {activity_id} {activity.get('startTimeLocal')} {activity.get('activityName') or ''}".strip())
    token = create_token(USER_ID)
    with httpx.Client(timeout=90) as client:
        response = client.post(
            f"{API}/strength/import-garmin/{activity_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    print("HTTP", response.status_code)
    try:
        data = response.json()
    except Exception:
        print(response.text[:500])
        return 1
    if response.status_code == 409:
        print("ALREADY_IMPORTED", json.dumps(data, ensure_ascii=False))
        return 0
    if response.status_code != 200:
        print("IMPORT_ERROR", json.dumps(data, ensure_ascii=False))
        return 1
    print("IMPORT_OK", json.dumps(data, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
