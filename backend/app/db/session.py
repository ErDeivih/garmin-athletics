from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def _run_sqlite_migrations(conn) -> None:
    """Migraciones idempotentes para SQLite: añade columnas user_id a tablas legacy."""
    from sqlalchemy import text

    table_columns = {
        "strength_logs": [("user_id", "VARCHAR(36)")],
        "session_sets": [("rpe", "INTEGER"), ("client_set_id", "VARCHAR(64)")],
        "calendar_events": [
            ("template_id", "VARCHAR(36)"),
            ("garmin_workout_id", "VARCHAR(64)"),
            ("last_scheduled_date", "DATE"),
        ],
        "fatigue_metrics": [("user_id", "VARCHAR(36)")],
        "garmin_credentials": [("needs_reauth", "BOOLEAN DEFAULT 0")],
        # Detalle enriquecido Fase 7
        "activities": [
            ("user_id", "VARCHAR(36)"),
            ("elevation_gain_m", "FLOAT"), ("elevation_loss_m", "FLOAT"),
            ("avg_cadence", "INTEGER"), ("avg_power", "INTEGER"),
            ("avg_speed_kmh", "FLOAT"), ("calories", "FLOAT"),
            ("has_track", "BOOLEAN DEFAULT 0"), ("track_path", "VARCHAR(300)"),
            ("bbox_min_lat", "FLOAT"), ("bbox_min_lon", "FLOAT"),
            ("bbox_max_lat", "FLOAT"), ("bbox_max_lon", "FLOAT"),
            ("hr_zones", "JSON"), ("weather", "JSON"),
            ("detail_fetched_at", "DATETIME"),
            ("visibility", "VARCHAR(20) DEFAULT 'private'"),
        ],
        # Sueño/HRV/BB profundo Fase 8
        "daily_biometrics": [
            ("user_id", "VARCHAR(36)"),
            ("sleep_deep_seconds", "INTEGER"), ("sleep_light_seconds", "INTEGER"),
            ("sleep_rem_seconds", "INTEGER"), ("sleep_awake_seconds", "INTEGER"),
            ("time_in_bed_seconds", "INTEGER"), ("sleep_efficiency", "FLOAT"),
            ("bedtime_local", "DATETIME"), ("wakeup_local", "DATETIME"),
            ("hrv_status", "VARCHAR(20)"),
            ("body_battery_wake", "INTEGER"), ("body_battery_curve", "JSON"),
            ("training_snapshot", "JSON"),
        ],
    }
    for table, cols in table_columns.items():
        result = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
        rows = result.fetchall()
        if not rows:
            continue
        existing = {row[1]: row[2] for row in rows}
        for column, ddl in cols:
            if column not in existing:
                await conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"
                )

    # Reparación 2026-09-10: `needs_reauth` se creó como VARCHAR(36) en una
    # migración temprana. Con afinidad TEXT, SQLite guarda 0/1 como '0'/'1' y
    # bool('0') es True: el aviso de re-auth no se quitaba nunca. Se reconstruye
    # como BOOLEAN preservando valores reales.
    await _fix_needs_reauth_type(conn)

    # Índices de las consultas del panel y del gimnasio (T-26). Idempotentes y
    # aditivos: no tocan datos ni columnas.
    for ddl in (
        "CREATE INDEX IF NOT EXISTS idx_session_sets_exercise "
        "ON session_sets(exercise_id)",
        "CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date "
        "ON workout_sessions(user_id, started_at)",
        "CREATE INDEX IF NOT EXISTS idx_daily_biometrics_user_date "
        "ON daily_biometrics(user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_activities_user_start "
        "ON activities(user_id, start_time)",
    ):
        try:
            await conn.exec_driver_sql(ddl)
        except Exception as exc:  # una tabla antigua sin la columna no debe impedir arrancar
            logger = __import__("logging").getLogger("migrations")
            logger.warning(f"No se pudo crear un índice: {exc}")


async def _fix_needs_reauth_type(conn) -> None:
    from sqlalchemy import text as _text
    result = await conn.exec_driver_sql("PRAGMA table_info(garmin_credentials)")
    cols = {row[1]: (row[2] or "").upper() for row in result.fetchall()}
    current = cols.get("needs_reauth")
    if current is None or "BOOLEAN" in current or current in ("NUMERIC", "INTEGER", "BOOL"):
        return
    logger = __import__("logging").getLogger("migrations")
    logger.warning(f"Reparando tipo de garmin_credentials.needs_reauth ({current} -> BOOLEAN)")
    await conn.exec_driver_sql(
        "ALTER TABLE garmin_credentials RENAME COLUMN needs_reauth TO needs_reauth_legacy")
    await conn.exec_driver_sql(
        "ALTER TABLE garmin_credentials ADD COLUMN needs_reauth BOOLEAN DEFAULT 0")
    await conn.exec_driver_sql(
        "UPDATE garmin_credentials SET needs_reauth = "
        "CASE WHEN needs_reauth_legacy IN ('1', 'true', 'True', 'TRUE') THEN 1 ELSE 0 END")
    try:
        await conn.exec_driver_sql("ALTER TABLE garmin_credentials DROP COLUMN needs_reauth_legacy")
    except Exception:
        pass  # SQLite antiguo: la columna legacy huérfana no molesta

async def init_db():
    """Inicializa la base de datos creando todas las tablas y aplicando migraciones ligeras."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.url.get_backend_name().startswith("sqlite"):
            await _run_sqlite_migrations(conn)
        else:
            # PostgreSQL/Supabase: usar Alembic o SQL DDL en producción
            from sqlalchemy import text
            tables_to_patch = {
                "activities": [
                    "user_id VARCHAR(36)",
                    "elevation_gain_m FLOAT", "elevation_loss_m FLOAT",
                    "avg_cadence INTEGER", "avg_power INTEGER",
                    "avg_speed_kmh FLOAT", "calories FLOAT",
                    "has_track BOOLEAN DEFAULT FALSE", "track_path VARCHAR(300)",
                    "bbox_min_lat FLOAT", "bbox_min_lon FLOAT",
                    "bbox_max_lat FLOAT", "bbox_max_lon FLOAT",
                    "hr_zones JSONB", "weather JSONB",
                    "detail_fetched_at TIMESTAMPTZ",
                    "visibility VARCHAR(20) DEFAULT 'private'",
                ],
                "strength_logs": ["user_id VARCHAR(36)"],
                "garmin_credentials": ["needs_reauth BOOLEAN DEFAULT FALSE"],
            }
            for table, ddls in tables_to_patch.items():
                for column_ddl in ddls:
                    column = column_ddl.split()[0]
                    exists = await conn.execute(text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_name = :t AND column_name = :c"
                    ), {"t": table, "c": column})
                    if not exists.scalar():
                        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_ddl}"))

async def get_db():
    """Dependency para inyectar sesión de base de datos en endpoints FastAPI."""
    async with AsyncSessionLocal() as session:
        yield session
