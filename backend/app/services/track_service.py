"""TrackService: convierte el polyline de Garmin en track ligero para mapas.

Sin dependencias nuevas: usa `geoPolylineDTO.polyline` (+ `metricDescriptors`
para HR/distancia/potencia) en vez de descargar GPX.
Guarda `data/tracks/{user_id}/{activity_id}.json` con puntos simplificados.
"""
import json
import logging
import math
import os
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("track_service")

MAX_POINTS = 2000
# Simplificación Douglas-Peucker (~7 m en grados). Suficiente para el mapa.
DP_EPSILON = 0.00007


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _perp_dist(p: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Distancia perpendicular aproximada en grados (suficiente para simplificar)."""
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    num = abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1]))
    den = math.hypot(b[0] - a[0], b[1] - a[1])
    return num / den if den else 0.0


def douglas_peucker(points: List[Tuple[float, float]], epsilon: float) -> List[int]:
    """Retorna los ÍNDICES a conservar."""
    if len(points) < 3:
        return list(range(len(points)))
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        dmax, idx = 0.0, s
        for i in range(s + 1, e):
            d = _perp_dist(points[i], points[s], points[e])
            if d > dmax:
                dmax, idx = d, i
        if dmax > epsilon:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))
    return [i for i, k in enumerate(keep) if k]


def gain_loss(elevations: List[Optional[float]], noise_m: float = 2.0) -> Tuple[float, float]:
    gain = loss = 0.0
    prev: Optional[float] = None
    for e in elevations:
        if e is None:
            continue
        if prev is not None:
            d = e - prev
            if d > noise_m:
                gain += d
                prev = e
            elif d < -noise_m:
                loss += -d
                prev = e
        else:
            prev = e
    return round(gain, 1), round(loss, 1)


def extract_streams(details: Dict[str, Any]) -> Dict[str, List]:
    """Extrae series del polyline usando metricDescriptors (genérico por key)."""
    descriptors = details.get("metricDescriptors") or []
    key_to_idx = {d.get("key"): d.get("metricsIndex") for d in descriptors if d.get("key")}
    poly = (details.get("geoPolylineDTO") or {}).get("polyline") or []

    def _val(point: Dict[str, Any], key: str):
        idx = key_to_idx.get(key)
        if idx is None:
            return None
        # Los puntos del polyline traen campos directos; los índices aplican a
        # activityDetailMetrics (misma semántica). Mapeamos los conocidos:
        mapping = {
            "directLatitude": point.get("lat"),
            "directLongitude": point.get("lon"),
            "directElevation": point.get("altitude"),
            "directTimestamp": point.get("time"),
            "directSpeed": point.get("speed"),
            "directHeartRate": point.get("heartRate"),
            "directDistance": point.get("distanceInMeters"),
            "directPower": point.get("power"),
            "directRunCadence": point.get("cadence"),
            "directCadence": point.get("cadence"),
            "directTemperature": point.get("temperature"),
            "directVerticalOscillation": point.get("verticalOscillation"),
            "directGroundContactTime": point.get("groundContactTime"),
            "directStrideLength": point.get("strideLength"),
            "directRespirationRate": point.get("respirationRate"),
            "directSweatLoss": point.get("sweatLoss"),
        }
        return mapping.get(key)

    streams: Dict[str, List] = {
        "lat": [], "lon": [], "ele": [], "t": [], "speed": [], "hr": [], "dist": [],
        "cadence": [], "power": [], "temp": [], "vert_osc": [], "ground_contact": [],
        "stride": [], "respiration": [], "sweat": [],
    }
    # Puntos sin coordenadas fuera: los índices de streams y mapa coinciden
    # siempre (evita IndexError en actividades con huecos GPS).
    valid = [p for p in poly if p.get("lat") is not None and p.get("lon") is not None]
    for p in valid:
        streams["lat"].append(p.get("lat"))
        streams["lon"].append(p.get("lon"))
        streams["ele"].append(p.get("altitude"))
        streams["t"].append(p.get("time"))
        streams["speed"].append(p.get("speed"))
        streams["hr"].append(_val(p, "directHeartRate"))
        streams["dist"].append(_val(p, "directDistance"))
        streams["cadence"].append(_val(p, "directRunCadence") or _val(p, "directCadence"))
        streams["power"].append(_val(p, "directPower"))
        streams["temp"].append(_val(p, "directTemperature"))
        streams["vert_osc"].append(_val(p, "directVerticalOscillation"))
        streams["ground_contact"].append(_val(p, "directGroundContactTime"))
        streams["stride"].append(_val(p, "directStrideLength"))
        streams["respiration"].append(_val(p, "directRespirationRate"))
        streams["sweat"].append(_val(p, "directSweatLoss"))
    # Métricas extra de activityDetailMetrics si el polyline no trae HR
    if all(v is None for v in streams["hr"]):
        hr_idx = key_to_idx.get("directHeartRate")
        dist_idx = key_to_idx.get("directDistance")
        metrics = details.get("activityDetailMetrics") or []
        if hr_idx is not None or dist_idx is not None:
            hrs = [m.get("metrics", [])[hr_idx] if len(m.get("metrics", [])) > hr_idx else None
                   for m in metrics] if hr_idx is not None else [None] * len(metrics)
            # Diezmar a la longitud del polyline válido para alinear
            if hrs and len(hrs) != len(valid) and valid:
                step = max(1, len(hrs) // len(valid))
                hrs = [hrs[i * step] for i in range(len(valid))]
            if len(hrs) == len(valid):
                streams["hr"] = hrs
    return streams


def build_track(details: Dict[str, Any], max_points: int = MAX_POINTS) -> Optional[Dict[str, Any]]:
    """Construye el track en resolución COMPLETA + resumen. None si no hay GPS.

    La simplificación para el mapa se hace al leer (`/track`), no al guardar,
    para no perder picos de altitud ni datos de streams/splits/export.
    """
    poly = (details.get("geoPolylineDTO") or {}).get("polyline") or []
    pts = [(p.get("lat"), p.get("lon")) for p in poly
           if p.get("lat") is not None and p.get("lon") is not None]
    if len(pts) < 2:
        return None

    streams = extract_streams(details)
    lats = [x for x in streams["lat"] if x is not None]
    lons = [x for x in streams["lon"] if x is not None]
    gain, loss = gain_loss([e for e in streams["ele"] if e is not None])
    dist = 0.0
    pts = [(la, lo) for la, lo in zip(streams["lat"], streams["lon"])
           if la is not None and lo is not None]
    for i in range(1, len(pts)):
        dist += _haversine_m(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
    if len(pts) < 2:
        return None

    # Conteo informativo de simplificación (el mapa simplifica al leer)
    keep = douglas_peucker(pts, DP_EPSILON)

    return {
        # Resolución COMPLETA: streams/splits/export la usan tal cual.
        "points": {k: streams[k] for k in (
            "lat", "lon", "ele", "t", "speed", "hr", "dist",
            "cadence", "power", "temp", "vert_osc", "ground_contact", "stride", "respiration", "sweat")},
        "point_count": len(pts),
        "simplified_count": len(keep),
        "distance_m": round(dist, 1),
        "gain_m": gain,
        "loss_m": loss,
        "bbox": [min(lats), min(lons), max(lats), max(lons)] if lats and lons else None,
    }


def track_file_path(base_dir: str, user_id: Optional[str], activity_id: str) -> str:
    folder = os.path.join(base_dir, (user_id or "legacy"))
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f"{activity_id}.json")


def save_track(base_dir: str, user_id: Optional[str], activity_id: str, track: Dict[str, Any]) -> str:
    path = track_file_path(base_dir, user_id, activity_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(track, f)
    return path


def load_track(base_dir: str, user_id: Optional[str], activity_id: str) -> Optional[Dict[str, Any]]:
    path = track_file_path(base_dir, user_id, activity_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Track corrupto {path}: {e}")
        return None


def normalize_hr_zones(raw: Any) -> List[Dict[str, Any]]:
    zones = []
    for z in raw or []:
        zones.append({
            "zone": z.get("zoneNumber"),
            "secs": round(float(z.get("secsInZone") or 0)),
            "low": z.get("zoneLowBoundary"),
        })
    return zones


def normalize_weather(raw: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    def f_to_c(f: Optional[float]) -> Optional[float]:
        return round((f - 32) * 5 / 9, 1) if f is not None else None
    return {
        "temp_c": f_to_c(raw.get("temp")),
        "feels_c": f_to_c(raw.get("apparentTemp")),
        "humidity": raw.get("relativeHumidity"),
        "wind_kph": round(float(raw.get("windSpeed") or 0) * 1.609, 1) if raw.get("windSpeed") else None,
        "wind_dir": raw.get("windDirectionCompassPoint"),
        "desc": (raw.get("weatherTypeDTO") or {}).get("desc"),
        "station": (raw.get("weatherStationDTO") or {}).get("name"),
    }


def normalize_laps(raw: Any) -> List[Dict[str, Any]]:
    laps = []
    for i, lap in enumerate((raw or {}).get("lapDTOs", []), start=1):
        dist = lap.get("distance") or 0
        dur = lap.get("movingDuration") or lap.get("duration") or 0
        pace = None
        if dist > 0 and dur > 0:
            spk = dur / (dist / 1000)
            pace = f"{int(spk // 60)}:{int(spk % 60):02d} /km"
        laps.append({
            "n": lap.get("lapIndex") or i,
            "distance_m": round(dist),
            "duration_s": round(dur),
            "pace": pace,
            "avg_hr": lap.get("averageHR"),
            "max_hr": lap.get("maxHR"),
            "gain_m": lap.get("elevationGain"),
            "loss_m": lap.get("elevationLoss"),
            "calories": lap.get("calories"),
            "avg_speed": round(lap.get("averageSpeed") or 0, 2),
        })
    return laps


def _cumulative_dist(lat: List[float], lon: List[float]) -> List[float]:
    out = [0.0]
    for i in range(1, len(lat)):
        if lat[i] is None or lon[i] is None or lat[i - 1] is None or lon[i - 1] is None:
            out.append(out[-1])
        else:
            out.append(out[-1] + _haversine_m(lat[i - 1], lon[i - 1], lat[i], lon[i]))
    return out


def build_streams(track: Dict[str, Any], max_points: int = 2000) -> Dict[str, Any]:
    """Series temporales diezmadas para gráficas (FC, ritmo, altitud, velocidad)."""
    pts = track.get("points", {})
    n = len(pts.get("lat", []))
    if n == 0:
        return {"count": 0, "t_s": [], "dist_m": [], "ele": [], "speed_ms": [],
                "hr": [], "pace_sec_km": [], "cadence": [], "power": [], "temp": [],
                "vert_osc": [], "ground_contact": [], "stride": [], "respiration": [], "sweat": []}
    idx = sorted({int(i * n / max_points) for i in range(min(n, max_points))}) if n > max_points else list(range(n))
    def pick(key):
        values = pts.get(key, [])
        return [values[i] if i < len(values) else None for i in idx]
    lat = pick("lat")
    lon = pick("lon")
    ele = pick("ele")
    hrs = pick("hr")
    spd = pick("speed")
    tms = pick("t")
    t0 = next((t for t in tms if t), 0) or 0
    t_s = [round(((t or t0) - t0) / 1000) for t in tms]
    dist = _cumulative_dist(lat, lon)
    pace: List[Optional[float]] = []
    for i in range(len(dist)):
        if i == 0:
            pace.append(None)
            continue
        dd = dist[i] - dist[i - 1]
        dt = t_s[i] - t_s[i - 1]
        pace.append(round(dt / (dd / 1000), 1) if dd > 5 and dt > 0 else None)
    return {"count": len(idx), "t_s": t_s,
            "dist_m": [round(d, 1) for d in dist], "ele": ele,
            "speed_ms": spd, "hr": hrs, "pace_sec_km": pace,
            "cadence": pick("cadence"), "power": pick("power"),
            "temp": pick("temp"), "vert_osc": pick("vert_osc"),
            "ground_contact": pick("ground_contact"),
            "stride": pick("stride"), "respiration": pick("respiration"), "sweat": pick("sweat")}


def build_km_splits(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parciales por km calculados del track (ritmo, FC media, desnivel)."""
    pts = track.get("points", {})
    lat, lon = pts.get("lat", []), pts.get("lon", [])
    ele, hrs, tms = pts.get("ele", []), pts.get("hr", []), pts.get("t", [])
    n = len(lat)
    if n < 2:
        return []
    dist = _cumulative_dist(lat, lon)
    t0 = next((t for t in tms if t), 0) or 0
    splits = []
    km = 1
    start_i, start_t = 0, None
    for i in range(n):
        if start_t is None and tms[i]:
            start_t = tms[i]
        if dist[i] >= km * 1000:
            end_t = tms[i] or t0
            dur_s = round(((end_t or t0) - (start_t or t0)) / 1000)
            seg_hr = [h for h in hrs[start_i:i + 1] if h]
            seg_ele = [e for e in ele[start_i:i + 1] if e is not None]
            g, _ = gain_loss(seg_ele)
            splits.append({
                "km": km,
                "duration_s": dur_s,
                "pace": f"{dur_s // 60}:{dur_s % 60:02d} /km" if dur_s else None,
                "hr_avg": round(sum(seg_hr) / len(seg_hr)) if seg_hr else None,
                "gain_m": g,
            })
            km += 1
            start_i, start_t = i, tms[i] if tms[i] else start_t
    return splits


def build_gpx(name: str, lat: List[float], lon: List[float],
              ele: Optional[List] = None) -> str:
    pts = []
    for i, (la, lo) in enumerate(zip(lat, lon)):
        e = (ele or [None] * len(lat))[i] if ele else None
        el = f"<ele>{e:.1f}</ele>" if e is not None else ""
        pts.append(f"<trkpt lat=\"{la:.6f}\" lon=\"{lo:.6f}\">{el}</trkpt>")
    safe = "".join(c for c in name if c.isalnum() or c in " -_")[:80]
    return ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<gpx version=\"1.1\" creator=\"Lyfta\">"
            f"<trk><name>{safe}</name><trkseg>{''.join(pts)}</trkseg></trk></gpx>")


def crop_privacy(lat: List[float], lon: List[float],
                 zones: List[Dict[str, Any]]) -> List[int]:
    """Índices a CONSERVAR: recorta inicio/fin dentro de zonas privadas.

    Quita el prefijo y el sufijo de puntos que caigan dentro del radio de
    cualquier zona (casa/trabajo). El tramo intermedio no se toca.
    """
    n = len(lat)
    if n == 0 or not zones:
        return list(range(n))

    def inside(i: int) -> bool:
        for z in zones:
            try:
                if _haversine_m(lat[i], lon[i], z["center_lat"], z["center_lon"]) <= z["radius_m"]:
                    return True
            except Exception:
                continue
        return False

    start = 0
    while start < n and inside(start):
        start += 1
    end = n
    while end > start and inside(end - 1):
        end -= 1
    return list(range(start, end))


VALHALLA_URL = "https://valhalla1.openstreetmap.de"
_ELEV_SAMPLES = 100


def fetch_elevations(lat: List[float], lon: List[float],
                     timeout: int = 20) -> Optional[List[Optional[float]]]:
    """Rellena altitud con Valhalla (demo gratuita, sin clave).

    Muestrea hasta 100 puntos e interpola al resto. Devuelve None si falla.
    """
    import json as _json
    import urllib.request as _url
    import urllib.parse as _parse

    n = len(lat)
    if n == 0:
        return None
    step = max(1, n // _ELEV_SAMPLES)
    idx = list(range(0, n, step))
    if idx[-1] != n - 1:
        idx.append(n - 1)
    shape = [{"lat": lat[i], "lon": lon[i]} for i in idx
             if lat[i] is not None and lon[i] is not None]
    if len(shape) < 2:
        return None
    try:
        payload = _parse.quote(_json.dumps({"shape": shape, "range": True}))
        req = _url.Request(f"{VALHALLA_URL}/height?json={payload}",
                           headers={"User-Agent": "Lyfta/1.0"})
        with _url.urlopen(req, timeout=timeout) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
        ranges = data.get("range_height") or []
        if not ranges:
            return None
        # ranges: [[dist_acumulada, altura], ...] alineados con shape
        heights = [h for _, h in ranges]
        # Interpolar a todos los puntos
        out: List[Optional[float]] = []
        for i in range(n):
            pos = i / (n - 1) * (len(heights) - 1) if n > 1 else 0
            lo, hi = int(pos), min(int(pos) + 1, len(heights) - 1)
            frac = pos - lo
            out.append(round(heights[lo] * (1 - frac) + heights[hi] * frac, 1))
        return out
    except Exception as e:
        logger.warning(f"Valhalla height falló: {e}")
        return None


def ensure_track_elevation(base_dir: str, user_id: Optional[str],
                           activity_id: str) -> Optional[Dict[str, Any]]:
    """Si el track existe pero sin altitud, la rellena (1 llamada, cacheada)."""
    track = load_track(base_dir, user_id, activity_id)
    if not track:
        return None
    pts = track.get("points", {})
    eles = [e for e in (pts.get("ele") or []) if e is not None]
    if eles:
        return track  # ya tiene
    lat, lon = pts.get("lat", []), pts.get("lon", [])
    filled = fetch_elevations(lat, lon)
    if not filled:
        return track
    pts["ele"] = filled
    gain, loss = gain_loss([e for e in filled if e is not None])
    track["gain_m"], track["loss_m"] = gain, loss
    try:
        save_track(base_dir, user_id, activity_id, track)
    except Exception as e:
        logger.warning(f"No se pudo guardar elevación {activity_id}: {e}")
    return track
