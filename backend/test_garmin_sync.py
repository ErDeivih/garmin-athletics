import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Añadir el directorio backend al path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

# Cargar variables de entorno
load_dotenv(backend_dir.parent / ".env")

from app.services.garmin_service import GarminService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_garmin_sync")

def main():
    import sys as _sys
    # Evita UnicodeEncodeError en consolas Windows (cp1252) con los emojis.
    if hasattr(_sys.stdout, "reconfigure"):
        _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=" * 60)
    print("  TEST DE CONEXION E INGESTA AUTOMATICA DE GARMIN CONNECT  ")
    print("=" * 60)

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password or email == "tu_email@ejemplo.com":
        print("\n⚠️ AVISO: Configura tus credenciales en el archivo .env antes de probar.")
        print("Edita el archivo .env en la raíz del proyecto y añade:")
        print("GARMIN_EMAIL=tu_correo_de_garmin")
        print("GARMIN_PASSWORD=tu_contraseña_de_garmin\n")
        return

    try:
        # Callback interactivo por si Garmin pide código 2FA/MFA en este primer login.
        service = GarminService(mfa_callback=lambda *a: input("Introduce el código 2FA de Garmin: "))
        print("\n1. Autenticando con Garmin (usando tokens persistentes si existen)...")
        service.authenticate()

        print("\n2. Descargando datos biométricos del día de hoy...")
        biometrics = service.get_daily_biometrics()
        
        print("\n--- RESUMEN BIOMÉTRICO OBTENIDO ---")
        print(f"📅 Fecha: {biometrics.get('date')}")
        print(f"😴 Calidad de Sueño (Score): {biometrics.get('sleep_score')} / 100")
        print(f"💓 HRV / VFC (Noche anterior): {biometrics.get('hrv_overnight_avg')} ms (Media semanal: {biometrics.get('hrv_weekly_avg')} ms)")
        print(f"🫀 Pulsaciones en Reposo: {biometrics.get('resting_hr')} bpm")
        print(f"🔋 Body Battery Máx: {biometrics.get('body_battery_max')} | Mín: {biometrics.get('body_battery_min')}")
        print(f"📊 Estrés Medio: {biometrics.get('stress_avg')}")

        print("\n3. Obteniendo últimas actividades grabadas...")
        activities = service.get_activities(limit=5)
        print(f"🏃 Actividades encontradas: {len(activities)}")
        for act in activities:
            print(f"  - [{act.get('start_time')}] {act.get('activity_name')} ({act.get('activity_type')}) | EPOC: {act.get('garmin_epoc')}")

        print("\n✅ ¡PRUEBA COMPLETADA CON ÉXITO!")

    except Exception as err:
        print(f"\n❌ ERROR EN LA PRUEBA: {err}")

if __name__ == "__main__":
    main()
