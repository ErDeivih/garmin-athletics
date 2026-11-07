import uuid
from datetime import date, datetime
from typing import Optional, Any
from sqlalchemy import Column, String, Integer, Float, Date, DateTime, Boolean, Text, JSON
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, unique=True, index=True)
    username = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    password_hash = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class GarminCredential(Base):
    __tablename__ = "garmin_credentials"

    user_id = Column(String(36), primary_key=True)
    garmin_email = Column(String(255), nullable=False)
    # LEGADO (privacidad): antes se guardaba la contraseña cifrada reversible.
    # Desde el refactor passwordless ya NO se persiste: solo tokens de sesión
    # en disco (token_dir por usuario). Columna conservada por compatibilidad,
    # siempre NULL en filas nuevas.
    garmin_password_encrypted = Column(String(500), nullable=True)
    needs_reauth = Column(Boolean, default=False)  # tokens caducados/revocados
    last_sync_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FriendInvite(Base):
    __tablename__ = "friend_invites"

    code = Column(String(12), primary_key=True)  # ej. "K7Q2XA" (corto para WhatsApp)
    inviter_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used_by_id = Column(String(36), nullable=True)
    used_at = Column(DateTime, nullable=True)

class Route(Base):
    __tablename__ = "routes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    sport = Column(String(20), nullable=False, default="cycling")  # cycling|running|hiking
    distance_meters = Column(Float, nullable=True)
    gain_m = Column(Float, nullable=True)
    point_count = Column(Integer, nullable=True)
    file_path = Column(String(300), nullable=True)  # data/routes/{user_id}/{id}.json
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    requester_id = Column(String(36), nullable=False, index=True)   # quien envía la solicitud
    addressee_id = Column(String(36), nullable=False, index=True)   # quien la recibe
    status = Column(String(20), nullable=False, default="pending")  # 'pending' | 'accepted' | 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DailyBiometrics(Base):
    __tablename__ = "daily_biometrics"

    user_id = Column(String(36), primary_key=True, index=True)
    date = Column(Date, primary_key=True)
    sleep_seconds = Column(Integer, nullable=True)
    sleep_score = Column(Integer, nullable=True)
    # Detalle de sueño Fase 8 (de dailySleepDTO)
    sleep_deep_seconds = Column(Integer, nullable=True)
    sleep_light_seconds = Column(Integer, nullable=True)
    sleep_rem_seconds = Column(Integer, nullable=True)
    sleep_awake_seconds = Column(Integer, nullable=True)
    time_in_bed_seconds = Column(Integer, nullable=True)
    sleep_efficiency = Column(Float, nullable=True)
    bedtime_local = Column(DateTime, nullable=True)
    wakeup_local = Column(DateTime, nullable=True)
    hrv_weekly_avg = Column(Float, nullable=True)
    hrv_overnight_avg = Column(Float, nullable=True)
    hrv_status = Column(String(20), nullable=True)  # BALANCED/LOW/...
    resting_hr = Column(Integer, nullable=True)
    body_battery_max = Column(Integer, nullable=True)
    body_battery_min = Column(Integer, nullable=True)
    body_battery_wake = Column(Integer, nullable=True)
    body_battery_curve = Column(JSON, nullable=True)  # [[ts_ms, value], ...]
    training_snapshot = Column(JSON, nullable=True)  # estado Garmin: VO2max, status, predicciones
    stress_avg = Column(Integer, nullable=True)
    readiness_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Activity(Base):
    __tablename__ = "activities"

    id = Column(String(100), primary_key=True)
    user_id = Column(String(36), nullable=True, index=True)
    source = Column(String(20), nullable=False, default="garmin") # 'garmin', 'manual'
    activity_type = Column(String(50), nullable=False) # 'running', 'cycling', 'swimming', 'soccer', 'strength'
    activity_name = Column(String(150), nullable=True)
    start_time = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    distance_meters = Column(Float, default=0.0)
    avg_hr = Column(Integer, nullable=True)
    max_hr = Column(Integer, nullable=True)
    rpe = Column(Integer, nullable=True) # 1-10
    training_load_tss = Column(Float, nullable=False, default=0.0)
    garmin_epoc = Column(Float, nullable=True)
    # Detalle enriquecido Garmin (Fase 7): se rellena al abrir el detalle (lazy).
    elevation_gain_m = Column(Float, nullable=True)
    elevation_loss_m = Column(Float, nullable=True)
    avg_cadence = Column(Integer, nullable=True)
    avg_power = Column(Integer, nullable=True)
    avg_speed_kmh = Column(Float, nullable=True)
    calories = Column(Float, nullable=True)
    has_track = Column(Boolean, default=False)
    track_path = Column(String(300), nullable=True)  # data/tracks/{user_id}/{id}.json
    bbox_min_lat = Column(Float, nullable=True)
    bbox_min_lon = Column(Float, nullable=True)
    bbox_max_lat = Column(Float, nullable=True)
    bbox_max_lon = Column(Float, nullable=True)
    hr_zones = Column(JSON, nullable=True)   # [{zone, secs, low}]
    weather = Column(JSON, nullable=True)    # resumen meteo
    detail_fetched_at = Column(DateTime, nullable=True)
    visibility = Column(String(20), default="private")
    created_at = Column(DateTime, default=datetime.utcnow)

class StrengthLog(Base):
    __tablename__ = "strength_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    workout_date = Column(Date, nullable=False)
    routine_name = Column(String(100), nullable=False)
    target_focus = Column(String(50), nullable=False) # 'Push', 'Pull', 'Legs', 'Full Body'
    exercises = Column(JSON, nullable=False) # lista de ejercicios, series, reps, peso
    total_tonnage_kg = Column(Float, nullable=False, default=0.0)
    computed_tss = Column(Float, nullable=False, default=0.0)
    ai_generated = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FatigueMetric(Base):
    __tablename__ = "fatigue_metrics"

    user_id = Column(String(36), primary_key=True, index=True)
    date = Column(Date, primary_key=True)
    atl = Column(Float, nullable=False, default=0.0) # Acute Training Load (7 días)
    ctl = Column(Float, nullable=False, default=0.0) # Chronic Training Load (42 días)
    tsb = Column(Float, nullable=False, default=0.0) # Training Stress Balance (CTL - ATL)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PersonalRecord(Base):
    __tablename__ = "personal_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    sport = Column(String(20), nullable=False)  # running|cycling|swimming
    label = Column(String(30), nullable=False)  # best_pace_1k|best_pace_5k|fastest|longest|...
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # sec_per_km|kmh|meters
    activity_id = Column(String(100), nullable=True)
    achieved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    event_type = Column(String(30), nullable=False, default="planned_workout")
    start_local = Column(DateTime, nullable=False)
    duration_min = Column(Integer, nullable=False, default=60)
    weekday = Column(Integer, nullable=True)  # 0=lunes..6=domingo (recurrente semanal)
    recurrence_until = Column(Date, nullable=True)  # última fecha que aún se repite
    template_id = Column(String(36), nullable=True, index=True)  # plantilla que se envía al reloj
    garmin_workout_id = Column(String(64), nullable=True)
    last_scheduled_date = Column(Date, nullable=True)
    is_immovable = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
class PrivacyZone(Base):
    __tablename__ = "privacy_zones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    label = Column(String(100), nullable=False, default="Casa")
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    radius_m = Column(Integer, nullable=False, default=200)
    created_at = Column(DateTime, default=datetime.utcnow)

class Exercise(Base):
    """Catálogo de ejercicios (DECISIONES.md D-01/D-04).

    `user_id` NULL = catálogo global del sistema (semilla, compartido por todos).
    `user_id` con valor = ejercicio propio de ese atleta.
    """
    __tablename__ = "exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    slug = Column(String(160), nullable=False, index=True)
    # Nombre en minúsculas y sin tildes, para que buscar "biceps" encuentre "Curl de bíceps".
    search_text = Column(String(200), nullable=True, index=True)
    muscle_group = Column(String(40), nullable=False, default="cuerpo_completo")
    secondary_muscles = Column(JSON, nullable=True)  # ["triceps", "hombro"]
    equipment = Column(String(40), nullable=False, default="otro")
    is_unilateral = Column(Boolean, default=False)   # se hace por lado
    is_timed = Column(Boolean, default=False)        # se mide en segundos (plancha)
    notes = Column(Text, nullable=True)              # notas técnicas
    source = Column(String(20), nullable=False, default="custom")  # seed|custom
    garmin_enum = Column(String(80), nullable=True)  # enum de Garmin si se conoce
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkoutTemplate(Base):
    """Plantilla de rutina reutilizable."""
    __tablename__ = "workout_templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    weekday = Column(Integer, nullable=True)  # 0=lunes..6=domingo
    focus = Column(String(50), nullable=True)  # Push|Pull|Legs|Full Body
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TemplateExercise(Base):
    """Ejercicio dentro de una plantilla, con su prescripción."""
    __tablename__ = "template_exercises"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    exercise_id = Column(String(36), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    sets = Column(Integer, nullable=False, default=3)
    reps = Column(Integer, nullable=False, default=10)
    weight_kg = Column(Float, nullable=False, default=0.0)
    rest_seconds = Column(Integer, nullable=False, default=120)
    notes = Column(Text, nullable=True)
    set_targets = Column(JSON, nullable=True)  # [{set_number, reps, weight_kg}]


class WorkoutSession(Base):
    """Una sesión de fuerza ya ejecutada. El borrador vive en el navegador (D-02)."""
    __tablename__ = "workout_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    template_id = Column(String(36), nullable=True)
    name = Column(String(150), nullable=False)
    started_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="done")  # done
    notes = Column(Text, nullable=True)
    total_tonnage_kg = Column(Float, nullable=False, default=0.0)
    computed_tss = Column(Float, nullable=False, default=0.0)
    activity_id = Column(String(100), nullable=True)  # fila Activity espejo para la fatiga
    created_at = Column(DateTime, default=datetime.utcnow)


class ExerciseMotionProfile(Base):
    """Perfil versionado de movimiento para contar repeticiones con el IMU (T-43)."""
    __tablename__ = "exercise_motion_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exercise_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)  # NULL = perfil del catálogo
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(10), nullable=False, default="draft")  # draft|active|retired
    profile = Column(JSON, nullable=False)
    calibration = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SessionSet(Base):
    """Una serie individual de una sesión (lo que permite corregir una serie sin tocar el resto)."""
    __tablename__ = "session_sets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), nullable=False, index=True)
    exercise_id = Column(String(36), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)   # orden del ejercicio en la sesión
    set_number = Column(Integer, nullable=False, default=1)  # número de serie de ese ejercicio
    weight_kg = Column(Float, nullable=False, default=0.0)
    reps = Column(Integer, nullable=False, default=0)
    rir = Column(Integer, nullable=True)
    rpe = Column(Integer, nullable=True)  # esfuerzo percibido por serie (1-10), T-29
    is_warmup = Column(Boolean, default=False)
    set_type = Column(String(20), nullable=False, default="normal")  # normal|warmup|drop|failure
    rest_seconds = Column(Integer, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    client_set_id = Column(String(64), nullable=True, index=True)  # idempotencia del reloj (T-32)
    detected_reps = Column(Integer, nullable=True)  # repeticiones medidas por el IMU del reloj
    velocity_mps = Column(Float, nullable=True)  # velocidad media de ejecución
    estimated_force_n = Column(Float, nullable=True)
    estimated_1rm_kg = Column(Float, nullable=True)
    needs_review = Column(Boolean, default=False)  # ciclo dudoso: revisar en el móvil


class DailyStat(Base):
    __tablename__ = "daily_stats"

    user_id = Column(String(36), primary_key=True, index=True)
    date = Column(Date, primary_key=True)
    steps = Column(Integer, nullable=True)
    step_goal = Column(Integer, nullable=True)
    calories_total = Column(Float, nullable=True)
    calories_active = Column(Float, nullable=True)
    distance_m = Column(Float, nullable=True)
    intensity_minutes = Column(Integer, nullable=True)
    floors_m = Column(Float, nullable=True)
    sedentary_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
