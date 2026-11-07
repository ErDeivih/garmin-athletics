import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT)

from app.services.garmin_service import GarminService


class MFARequired(Exception):
    pass


def ask_code():
    raise MFARequired("Garmin pide un código de 6 dígitos")


def main():
    service = GarminService(mfa_callback=ask_code)
    try:
        client = service.authenticate()
    except MFARequired:
        print("MFA_REQUIRED")
        return 2
    except Exception as exc:
        message = str(exc)
        print("LOGIN_ERROR")
        print(message[:500])
        return 1
    print("LOGIN_OK")
    try:
        profile = client.get_user_profile()
        print("DISPLAY_NAME", (profile or {}).get("displayName") or (profile or {}).get("fullName") or "")
    except Exception as exc:
        print("PROFILE_WARN", str(exc)[:200])
    try:
        devices = client.get_devices()
        for device in devices or []:
            print("DEVICE", device.get("deviceId"), device.get("displayName"), device.get("productId"))
    except Exception as exc:
        print("DEVICES_WARN", str(exc)[:200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
