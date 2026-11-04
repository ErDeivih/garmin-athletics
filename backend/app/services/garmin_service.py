import os
import logging
from datetime import date, datetime
from typing import Dict, Any, Optional, List
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
    GarminConnectConnectionError
)
from app.core.config import settings

logger = logging.getLogger("garmin_service")

class GarminService:
    def __init__(self, email: Optional[str] = None, password: Optional[str] = None, token_dir: Optional[str] = None, mfa_callback=None, use_env_fallback: bool = True):
        # use_env_fallback=False => NUNCA usar las credenciales globales del .env
        # (obligatorio en modo multiusuario: cada cuenta usa solo sus tokens).
        if use_env_fallback:
            self.email = email or settings.GARMIN_EMAIL
            self.password = password or settings.GARMIN_PASSWORD
        else:
            self.email = email
            self.password = password
        self.token_dir = token_dir or settings.GARMIN_TOKENS_DIR
        # Callback zero-arg (o *args) que devuelve el código 2FA/MFA como str.
        # Solo el script de consola lo pasa (input interactivo); el backend web
        # no puede pedir MFA, así que allí un login con MFA pendiente da error limpio.
        self.mfa_callback = mfa_callback
        self.client: Optional[Garmin] = None

    def authenticate(self) -> Garmin:
        """
        Autentica contra Garmin Connect reutilizando tokens guardados si existen.
        Compatible con garminconnect>=0.3 (login(tokenstore) carga o loguea y
        persiste tokens automáticamente; ya no existe `client.garth`).
        """
        os.makedirs(self.token_dir, exist_ok=True)

        # Sin credenciales: solo intentar restaurar sesión guardada.
        if not self.email or not self.password:
            try:
                logger.info(f"Intentando cargar sesión desde: {self.token_dir}")
                client = Garmin()
                client.login(self.token_dir)
                self.client = client
                logger.info("✅ Sesión de Garmin restablecida con éxito desde tokens guardados.")
                return self.client
            except (GarminConnectAuthenticationError, GarminConnectTooManyRequestsError):
                raise
            except Exception as err:
                raise ValueError(
                    "Faltan credenciales de Garmin. Define GARMIN_EMAIL y GARMIN_PASSWORD en el archivo .env"
                ) from err

        # Con credenciales: login() primero prueba los tokens guardados y solo
        # si fallan hace login completo (con reintentos y backoff internos).
        try:
            logger.info(f"Autenticando con Garmin (tokens en: {self.token_dir})...")
            client = Garmin(self.email, self.password, prompt_mfa=self.mfa_callback)
            result = client.login(self.token_dir)
            mfa_status = result[0] if isinstance(result, tuple) else None
            if mfa_status:
                raise Exception(
                    "Garmin requiere verificación 2FA/MFA y no se proporcionó el código. "
                    "Ejecuta `python backend/test_garmin_sync.py` e introduce el código cuando se pida."
                )
            self.client = client
            logger.info("✅ Login exitoso. Tokens guardados para futuras ejecuciones.")
            return self.client
        except GarminConnectAuthenticationError as auth_err:
            msg = str(auth_err)
            if "mfa" in msg.lower() or "two-factor" in msg.lower() or "tfa" in msg.lower():
                raise Exception(
                    "Garmin pide verificación en dos pasos (2FA). "
                    "Ejecuta `python backend/test_garmin_sync.py` e introduce el código."
                ) from auth_err
            logger.error(f"Error de autenticación en Garmin: {auth_err}")
            raise Exception("Credenciales de Garmin incorrectas o fallo 2FA requerido.") from auth_err
        except GarminConnectTooManyRequestsError as req_err:
            logger.error(f"Límite de peticiones alcanzado en Garmin: {req_err}")
            raise Exception("Límite de peticiones alcanzado. Espera unos minutos antes de reintentar.") from req_err
        except Exception as e:
            if isinstance(e, GarminConnectConnectionError):
                logger.error(f"Error de conexión con Garmin: {e}")
                raise Exception(f"Fallo al conectar con Garmin Connect: {e}") from e
            logger.error(f"Error inesperado al conectar con Garmin: {e}")
            raise Exception(f"Fallo al conectar con Garmin Connect: {e}") from e

    # ------------------------------------------------------------------
    # Vinculación passwordless (un solo uso): la contraseña se usa UNA vez
    # para obtener tokens y JAMÁS se persiste. Solo quedan los tokens de
    # sesión en token_dir. Así ni el dueño del servidor puede ver la
    # contraseña de Garmin de sus amigos.
    # ------------------------------------------------------------------
    def link_with_password(self, email: str, password: str) -> Dict[str, Any]:
        """Paso 1 de vinculación. Retorna {"linked": True} o {"need_mfa": True, "ticket": {...}}."""
        os.makedirs(self.token_dir, exist_ok=True)
        try:
            client = Garmin(email, password, return_on_mfa=True)
            result = client.login(self.token_dir)
            mfa_ticket = result[0] if isinstance(result, tuple) else None
            if mfa_ticket:
                logger.info("Garmin pide 2FA/MFA para esta cuenta (ticket de un solo uso).")
                return {"linked": False, "need_mfa": True, "ticket": mfa_ticket}
            self.client = client
            logger.info("✅ Cuenta Garmin vinculada (solo tokens, contraseña descartada).")
            return {"linked": True, "need_mfa": False}
        except GarminConnectTooManyRequestsError as req_err:
            raise Exception("Límite de peticiones alcanzado. Espera unos minutos antes de reintentar.") from req_err
        except GarminConnectAuthenticationError as auth_err:
            raise Exception("Credenciales de Garmin incorrectas.") from auth_err
        except Exception as e:
            raise Exception(f"No se pudo vincular con Garmin: {e}") from e

    def complete_mfa_link(self, email: str, password: str, ticket: Dict[str, Any], code: str) -> Dict[str, Any]:
        """Paso 2: completa el 2FA con el ticket del paso 1. Persiste tokens e intenta volcado."""
        os.makedirs(self.token_dir, exist_ok=True)
        try:
            client = Garmin(email, password, return_on_mfa=True)
            client.resume_login(ticket, code.strip())
            self._persist_tokens_best_effort(client, self.token_dir)
            # Verificación: restaurar sesión desde disco con cliente limpio.
            check = Garmin()
            check.login(self.token_dir)
            self.client = check
            logger.info("✅ 2FA completado y sesión persistida (contraseña descartada).")
            return {"linked": True}
        except GarminConnectAuthenticationError as auth_err:
            raise Exception("Código 2FA incorrecto o caducado. Repite la vinculación.") from auth_err
        except Exception as e:
            raise Exception(f"No se pudo completar el 2FA: {e}") from e

    @staticmethod
    def _persist_tokens_best_effort(client: Garmin, token_dir: str) -> None:
        """Intenta volcar los tokens en memoria al tokenstore (API interna, puede variar)."""
        inner = getattr(client, "client", None)
        dump = getattr(inner, "dump", None)
        if callable(dump):
            try:
                dump(token_dir)
            except Exception:
                pass

    def get_daily_biometrics(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Extrae el resumen de salud del día: Sueño, VFC/HRV, Body Battery, FC reposo y Estrés.
        """
        if not self.client:
            self.authenticate()

        date_str = (target_date or date.today()).isoformat()
        logger.info(f"Descargando biometría de Garmin para la fecha: {date_str}")

        biometrics = {
            "date": date_str,
            "sleep_score": None,
            "sleep_seconds": None,
            "sleep_deep_seconds": None,
            "sleep_light_seconds": None,
            "sleep_rem_seconds": None,
            "sleep_awake_seconds": None,
            "time_in_bed_seconds": None,
            "sleep_efficiency": None,
            "bedtime_local": None,
            "wakeup_local": None,
            "hrv_weekly_avg": None,
            "hrv_overnight_avg": None,
            "hrv_status": None,
            "resting_hr": None,
            "body_battery_max": None,
            "body_battery_min": None,
            "body_battery_wake": None,
            "body_battery_curve": None,
            "stress_avg": None,
            "raw": {}
        }

        def _ms_to_iso(ms: Any) -> Optional[str]:
            try:
                if not ms:
                    return None
                from datetime import datetime as _dt
                return _dt.fromtimestamp(int(ms) / 1000).isoformat()
            except Exception:
                return None

        # 1. Datos de Sueño (detalle por fases)
        try:
            sleep_data = self.client.get_sleep_data(date_str)
            biometrics["raw"]["sleep"] = sleep_data
            daily_sleep = sleep_data.get("dailySleepDTO", {})
            biometrics["sleep_seconds"] = daily_sleep.get("sleepTimeSeconds")
            biometrics["sleep_score"] = daily_sleep.get("sleepScores", {}).get("overall", {}).get("value")
            biometrics["sleep_deep_seconds"] = daily_sleep.get("deepSleepSeconds")
            biometrics["sleep_light_seconds"] = daily_sleep.get("lightSleepSeconds")
            biometrics["sleep_rem_seconds"] = daily_sleep.get("remSleepSeconds")
            biometrics["sleep_awake_seconds"] = daily_sleep.get("awakeSleepSeconds")
            slept = daily_sleep.get("sleepTimeSeconds") or 0
            awake = daily_sleep.get("awakeSleepSeconds") or 0
            if slept:
                biometrics["time_in_bed_seconds"] = slept + awake
                biometrics["sleep_efficiency"] = round(slept / (slept + awake) * 100, 1) if awake else 100.0
            biometrics["bedtime_local"] = _ms_to_iso(daily_sleep.get("sleepStartTimestampLocal"))
            biometrics["wakeup_local"] = _ms_to_iso(daily_sleep.get("sleepEndTimestampLocal"))
        except Exception as e:
            logger.warning(f"No se pudieron obtener datos de sueño para {date_str}: {e}")

        # 2. Datos de HRV / VFC
        try:
            hrv_data = self.client.get_hrv_data(date_str)
            biometrics["raw"]["hrv"] = hrv_data
            hrv_summary = hrv_data.get("hrvSummary", {})
            biometrics["hrv_weekly_avg"] = hrv_summary.get("weeklyAvg")
            biometrics["hrv_overnight_avg"] = hrv_summary.get("lastNightAvg")
            biometrics["hrv_status"] = hrv_summary.get("status")
        except Exception as e:
            logger.warning(f"No se pudieron obtener datos de HRV para {date_str}: {e}")

        # 3. Frecuencia Cardíaca en Reposo y Estrés
        try:
            user_summary = self.client.get_user_summary(date_str)
            biometrics["raw"]["user_summary"] = user_summary
            biometrics["resting_hr"] = user_summary.get("restingHeartRate")
            biometrics["stress_avg"] = user_summary.get("averageStressLevel")
            biometrics["body_battery_max"] = user_summary.get("bodyBatteryChargedValue")
            biometrics["body_battery_min"] = user_summary.get("bodyBatteryDrainedValue")
        except Exception as e:
            logger.warning(f"No se pudieron obtener métricas de usuario/body battery para {date_str}: {e}")

        # 4. Curva intradía de Body Battery (para la gráfica del día)
        try:
            bb_days = self.client.get_body_battery(date_str)
            day = (bb_days or [{}])[0]
            curve = day.get("bodyBatteryValuesArray")
            if curve:
                biometrics["body_battery_curve"] = [[int(ts), int(v)] for ts, v in curve if v is not None]
                biometrics["body_battery_wake"] = int(curve[0][1])
        except Exception as e:
            logger.warning(f"Sin curva Body Battery para {date_str}: {e}")

        return biometrics

    def get_activities(self, start_date: Optional[date] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Descarga las actividades registradas recientes."""
        if not self.client:
            self.authenticate()

        logger.info(f"Obteniendo últimas {limit} actividades de Garmin Connect...")
        try:
            activities = self.client.get_activities(0, limit)
            parsed_activities = []
            for act in activities:
                parsed_activities.append({
                    "id": str(act.get("activityId")),
                    "activity_name": act.get("activityName"),
                    "activity_type": act.get("activityType", {}).get("typeKey"),
                    "start_time": act.get("startTimeLocal"),
                    "duration_seconds": act.get("duration"),
                    "distance_meters": act.get("distance"),
                    "avg_hr": act.get("averageHR"),
                    "max_hr": act.get("maxHR"),
                    "garmin_epoc": act.get("trainingEffect"),
                    "calories": act.get("calories")
                })
            return parsed_activities
        except Exception as e:
            logger.error(f"Error descargando actividades de Garmin: {e}")
            return []

    def get_training_snapshot(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Estado oficial Garmin: VO2max, training status, balance de carga y
        predicciones de carrera. Todo opcional (nunca lanza)."""
        if not self.client:
            self.authenticate()
        assert self.client is not None
        date_str = (target_date or date.today()).isoformat()
        out: Dict[str, Any] = {}
        try:
            ts = self.client.get_training_status(date_str) or {}
            vo2 = ((ts.get("mostRecentVO2Max") or {}).get("generic") or {})
            out["vo2max"] = vo2.get("vo2MaxValue")
            out["vo2max_date"] = vo2.get("calendarDate")
            bal_map = ((ts.get("mostRecentTrainingLoadBalance") or {})
                       .get("metricsTrainingLoadBalanceDTOMap") or {})
            bal = next(iter(bal_map.values()), {}) if bal_map else {}
            out["balance"] = {
                "aerobic_low": round(bal.get("monthlyLoadAerobicLow") or 0),
                "aerobic_high": round(bal.get("monthlyLoadAerobicHigh") or 0),
                "anaerobic": round(bal.get("monthlyLoadAnaerobic") or 0),
                "feedback": bal.get("trainingBalanceFeedbackPhrase"),
            }
            st_map = ((ts.get("mostRecentTrainingStatus") or {})
                      .get("latestTrainingStatusData") or {})
            st = next(iter(st_map.values()), {}) if st_map else {}
            out["status"] = st.get("trainingStatus")
            out["status_feedback"] = st.get("trainingStatusFeedbackPhrase")
            out["sport"] = st.get("sport")
            acwr = st.get("acuteTrainingLoadDTO") or {}
            out["acute"] = acwr.get("dailyTrainingLoadAcute")
            out["chronic"] = acwr.get("dailyTrainingLoadChronic")
            out["acwr"] = acwr.get("dailyAcuteChronicWorkloadRatio")
            devs = (ts.get("mostRecentTrainingStatus") or {}).get("recordedDevices") or []
            out["device"] = (devs[0] or {}).get("deviceName") if devs else None
        except Exception as e:
            logger.warning(f"Sin training status: {e}")
        try:
            rp = self.client.get_race_predictions() or {}
            out["race_5k_s"] = rp.get("time5K")
            out["race_10k_s"] = rp.get("time10K")
            out["race_hm_s"] = rp.get("timeHalfMarathon")
            out["race_mar_s"] = rp.get("timeMarathon")
        except Exception as e:
            logger.warning(f"Sin predicciones de carrera: {e}")
        return out

    def get_activity_full(self, garmin_activity_id: str) -> Dict[str, Any]:
        """Detalle completo: polyline, vueltas, zonas FC/potencia y meteo.

        Cada fuente falla por separado (una actividad de fútbol puede no
        tener meteo, una de piscina no tiene polyline). Nunca lanza.
        """
        if not self.client:
            self.authenticate()
        assert self.client is not None
        out: Dict[str, Any] = {"details": None, "splits": None, "hr_zones": None,
                               "power_zones": None, "weather": None}
        try:
            out["details"] = self.client.get_activity_details(garmin_activity_id)
        except Exception as e:
            logger.warning(f"Sin details para {garmin_activity_id}: {e}")
        try:
            out["splits"] = self.client.get_activity_splits(garmin_activity_id)
        except Exception as e:
            logger.warning(f"Sin splits para {garmin_activity_id}: {e}")
        try:
            out["hr_zones"] = self.client.get_activity_hr_in_timezones(garmin_activity_id)
        except Exception as e:
            logger.warning(f"Sin zonas FC para {garmin_activity_id}: {e}")
        try:
            out["power_zones"] = self.client.get_activity_power_in_timezones(garmin_activity_id)
        except Exception as e:
            logger.warning(f"Sin zonas potencia para {garmin_activity_id}: {e}")
        try:
            out["weather"] = self.client.get_activity_weather(garmin_activity_id)
        except Exception as e:
            logger.warning(f"Sin meteo para {garmin_activity_id}: {e}")
        return out
