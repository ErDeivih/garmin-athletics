"""Servido del frontend compilado y rutas profundas de la SPA (despliegue web).

El móvil abre la app en una URL que no es `/` (por ejemplo `/gimnasio`) y la
recarga con el botón Atrás o al volver del bolsillo. Sin *fallback* SPA,
`StaticFiles(html=True)` responde 404 y la app parece caída. Este guion fija ese
contrato: la SPA manda en las rutas de navegación, `/api` sigue siendo JSON y un
asset inexistente sigue siendo 404.
"""
import os
import sys
import tempfile
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test_spa.db"

# Dist de mentira: el contrato es el servido, no el build de verdad.
_dist = Path(_tmp) / "dist"
(_dist / "assets").mkdir(parents=True)
_index = "<!doctype html><html><body><div id=\"root\">LYFTA-SHELL</div></body></html>"
(_dist / "index.html").write_text(_index, encoding="utf-8")
(_dist / "assets" / "app.js").write_text("console.log('lyfta');", encoding="utf-8")
(_dist / "sw.js").write_text("self.addEventListener('install', () => {});", encoding="utf-8")
(_dist / "manifest.webmanifest").write_text('{"name": "Lyfta"}', encoding="utf-8")
os.environ["FRONTEND_DIST_DIR"] = str(_dist)

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def run():
    # 1. La raíz sirve el shell.
    root = client.get("/")
    assert root.status_code == 200, root.status_code
    assert "LYFTA-SHELL" in root.text, root.text[:200]
    assert root.headers["content-type"].startswith("text/html")

    # 2. Rutas profundas de la SPA: 200 y el mismo shell (recarga desde el móvil).
    for path in ("/gimnasio", "/ajustes", "/gimnasio/sesiones/abc-123",
                 "/gimnasio/ejercicios/xyz/deteccion"):
        res = client.get(path)
        assert res.status_code == 200, f"{path} -> {res.status_code}"
        assert "LYFTA-SHELL" in res.text, f"{path} no devolvió el shell"
        assert res.headers["content-type"].startswith("text/html"), path

    # 3. La API no se come el fallback: sigue siendo JSON y 404 real.
    api = client.get("/api/v1/no-existe")
    assert api.status_code == 404, api.status_code
    assert "LYFTA-SHELL" not in api.text
    assert api.headers["content-type"].startswith("application/json")

    # 4. Los assets se sirven con su tipo y sin pasar por el shell.
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200, asset.status_code
    assert "application/javascript" in asset.headers["content-type"], asset.headers["content-type"]
    assert "LYFTA-SHELL" not in asset.text

    # 5. Un fichero estático que no existe no se disfraza de shell (404 seco).
    missing = client.get("/no-existe.png")
    assert missing.status_code == 404, missing.status_code
    assert "LYFTA-SHELL" not in missing.text

    # 6. El service worker debe poder actualizarse: sin caché.
    sw = client.get("/sw.js")
    assert sw.status_code == 200, sw.status_code
    assert "javascript" in sw.headers["content-type"], sw.headers["content-type"]
    cache_header = sw.headers.get("cache-control", "")
    assert "no-cache" in cache_header.lower() or "no-store" in cache_header.lower(), cache_header

    # 7. El manifiesto PWA se sirve con su tipo.
    manifest = client.get("/manifest.webmanifest")
    assert manifest.status_code == 200, manifest.status_code
    assert "json" in manifest.headers["content-type"], manifest.headers["content-type"]

    # 7b. HEAD también: `curl -I` y los monitores de salud lo usan.
    head = client.head("/sw.js")
    assert head.status_code == 200, head.status_code
    assert "javascript" in head.headers["content-type"], head.headers["content-type"]
    head_root = client.head("/gimnasio")
    assert head_root.status_code == 200, head_root.status_code
    assert head_root.headers["content-type"].startswith("text/html")

    # 8. Salud del despliegue.
    assert client.get("/healthz").json() == {"status": "ok"}

    print("SUCCESS: servido de la SPA y del frontend compilado OK "
          "(rutas profundas, API, assets, sw sin caché).")


if __name__ == "__main__":
    run()
