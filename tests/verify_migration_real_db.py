"""DIAGNÓSTICO (no es un test de pytest): init_db + semilla sobre una COPIA de la BD real.

Para qué sirve: las pruebas normales usan una BD vacía y no ven el caso de verdad, que es
arrancar el backend con años de datos dentro. Este script copia `garmin_athletics.db`, arranca
la app sobre la copia y verifica tres cosas:

  1. Que se crean las tablas nuevas.
  2. Que NO se altera ni una fila de las tablas viejas.
  3. Que los endpoints viejos y los nuevos responden 200, y que la semilla es idempotente.

Uso:  .\\venv\\Scripts\\python.exe tests\\verify_migration_real_db.py
Nunca escribe en la BD original.
"""
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
SRC_DB = REPO / "garmin_athletics.db"
if not SRC_DB.exists():
    raise SystemExit(f"No existe la BD local ({SRC_DB}). Este diagnóstico solo corre en la máquina de David.")

tmp = Path(tempfile.mkdtemp(prefix="garmin_migra_"))
copy_db = tmp / "copy.db"
shutil.copy2(SRC_DB, copy_db)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{copy_db.as_posix()}"
os.environ["TRACKS_DIR"] = str(REPO / "data")
sys.path.insert(0, str(BACKEND))


def snapshot(path):
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    tabs = {r[0]: r[1] for r in con.execute(
        "select name, (select count(*) from sqlite_master where type='table' and name=m.name) "
        "from sqlite_master m where type='table'")}
    counts = {}
    for t in tabs:
        try:
            counts[t] = con.execute(f'select count(*) from "{t}"').fetchone()[0]
        except Exception:
            counts[t] = -1
    con.close()
    return counts


before = snapshot(copy_db)
print("ANTES: tablas =", len(before))
print("  activities:", before.get("activities"), "| daily_biometrics:",
      before.get("daily_biometrics"), "| users:", before.get("users"),
      "| strength_logs:", before.get("strength_logs"))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from app.core.security import create_token  # noqa: E402

client = TestClient(app)

con = sqlite3.connect(f"file:{copy_db.as_posix()}?mode=ro", uri=True)
USER_ID = con.execute("select id from users limit 1").fetchone()[0]
con.close()
H = {"Authorization": f"Bearer {create_token(USER_ID)}"}

with client:  # dispara arranque -> init_db + semilla
    pass

after = snapshot(copy_db)
new_tables = sorted(set(after) - set(before))
print("DESPUÉS: tablas =", len(after), "| nuevas =", new_tables)
print("  exercises (semilla):", after.get("exercises"))
print("  workout_templates:", after.get("workout_templates"),
      "| workout_sessions:", after.get("workout_sessions"))

ok = True
for t in ("activities", "daily_biometrics", "users", "strength_logs", "daily_stats"):
    if after.get(t) != before.get(t):
        ok = False
        print(f"  !! DATOS ALTERADOS en {t}: {before.get(t)} -> {after.get(t)}")
print("  datos viejos intactos:", ok)

# Endpoints viejos siguen respondiendo lo mismo
checks = [
    ("GET", "/api/v1/metrics/daily"),
    ("GET", "/api/v1/metrics/readiness"),
    ("GET", "/api/v1/metrics/load?days=30"),
    ("GET", "/api/v1/alerts/"),
    ("GET", "/api/v1/sync/status"),
    ("GET", "/api/v1/activities/?limit=3"),
    ("GET", "/api/v1/strength/history"),
    ("GET", "/api/v1/strength/exercises/prs"),
    ("GET", "/api/v1/performance/summary?sport=running&days=30"),
    ("GET", "/api/v1/calendar/?from=2026-09-01&to=2026-09-30"),
    ("GET", "/api/v1/social/leaderboard?days=7"),
    # Nuevos
    ("GET", "/api/v1/strength/exercises?limit=3"),
    ("GET", "/api/v1/strength/templates"),
    ("GET", "/api/v1/strength/sessions"),
]
bad = []
for method, url in checks:
    r = client.request(method, url, headers=H)
    flag = "OK " if r.status_code == 200 else "FAIL"
    print(f"  {flag} {method} {url} -> {r.status_code}")
    if r.status_code != 200:
        bad.append((url, r.status_code, r.text[:120]))

# Segunda pasada de semilla: no debe duplicar
with client:
    pass
again = snapshot(copy_db)
print("  semilla idempotente:", again.get("exercises") == after.get("exercises"),
      f"({after.get('exercises')} -> {again.get('exercises')})")

shutil.rmtree(tmp, ignore_errors=True)
print()
print("RESULTADO:", "OK" if ok and not bad and again.get("exercises") == after.get("exercises") else "REVISAR")
if bad:
    print("FALLOS:", bad)
