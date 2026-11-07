import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services.garmin_service import GarminService
from app.core.config import settings

TOKEN_DIR = f"{settings.GARMIN_TOKENS_DIR}_f8aae4f6-7ab0-4628-9d03-8d67f70c8cab"
service = GarminService(password=None, token_dir=TOKEN_DIR, use_env_fallback=False)
client = service.authenticate()
print("AUTH_OK")
scheduled = client.get_scheduled_workouts(2026, 11)
print("SCHEDULED_TYPE", type(scheduled).__name__)
print(json.dumps(scheduled, ensure_ascii=False)[:3000])
try:
    devices = client.get_devices()
    print("DEVICES", [(d.get("deviceId"), d.get("displayName")) for d in devices or []])
except Exception as exc:
    print("DEVICES_ERR", str(exc)[:300])
try:
    acts = client.get_activities(0, 20)
    if isinstance(acts, dict):
        acts = acts.get("activityList") or acts.get("activities") or []
    strength = [a for a in acts if "strength" in str(a.get("activityType", {}).get("typeKey", "")).lower()]
    print("ACTIVITIES", len(acts), "STRENGTH", len(strength))
    for a in strength[:5]:
        print("STRENGTH_ACT", a.get("activityId"), a.get("startTimeLocal"), a.get("activityName"))
except Exception as exc:
    print("ACTIVITIES_ERR", str(exc)[:300])
