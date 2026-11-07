import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import settings
from app.services.garmin_service import GarminService

USER = "f8aae4f6-7ab0-4628-9d03-8d67f70c8cab"
WORKOUT_ID = 1753715348
DEVICE_ID = 3498989127
TOKEN_DIR = f"{settings.GARMIN_TOKENS_DIR}_{USER}"

service = GarminService(password=None, token_dir=TOKEN_DIR, use_env_fallback=False)
client = service.authenticate()
print("AUTH_OK")

try:
    workouts = client.get_workouts(0, 100)
    found = [w for w in workouts if int(w.get("workoutId", 0)) == WORKOUT_ID]
    print("WORKOUT_FOUND", len(found))
    for w in found:
        print("WORKOUT", w.get("workoutId"), w.get("workoutName"), w.get("sportType", {}).get("sportTypeKey"))
except Exception as exc:
    print("WORKOUTS_ERR", str(exc)[:300])

try:
    calendar = client.get_scheduled_workouts(2026, 11)
    items = (calendar or {}).get("calendarItems") or []
    matches = [i for i in items if int(i.get("workoutId") or 0) == WORKOUT_ID]
    print("SCHEDULED_FOUND", len(matches))
    for i in matches:
        print("SCHEDULED", i.get("id"), i.get("date"), i.get("title"), i.get("workoutId"))
except Exception as exc:
    print("SCHEDULED_ERR", str(exc)[:300])

try:
    devices = client.get_devices()
    print("DEVICES")
    for d in devices or []:
        print("DEVICE", d.get("deviceId"), d.get("displayName"), d.get("productId"), d.get("applicationName"))
except Exception as exc:
    print("DEVICES_ERR", str(exc)[:300])

try:
    last = client.get_device_last_used()
    print("LAST_USED", json.dumps(last, ensure_ascii=False)[:1000])
except Exception as exc:
    print("LAST_USED_ERR", str(exc)[:300])

try:
    settings = client.get_device_settings(DEVICE_ID)
    keys = ["deviceId", "deviceName", "applicationName", "lastSyncTime", "lastSyncDate", "syncStatus", "connected", "connectionType"]
    print("DEVICE_SETTINGS", {k: settings.get(k) for k in keys if k in settings})
except Exception as exc:
    print("DEVICE_SETTINGS_ERR", str(exc)[:300])

try:
    url = getattr(client, "garmin_connect_devicemessage_url", "/device-service/devicemessage/messages")
    response = client.connectapi(url)
    print("MESSAGES")
    print(json.dumps(response, ensure_ascii=False)[:3000])
except Exception as exc:
    print("MESSAGES_ERR", str(exc)[:500])
