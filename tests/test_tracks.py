import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.track_service import (
    douglas_peucker,
    gain_loss,
    normalize_hr_zones,
    normalize_weather,
    normalize_laps,
    build_track,
)


def test_douglas_simplifies_straight_line():
    pts = [(float(i), 0.0) for i in range(100)]
    keep = douglas_peucker(pts, 0.00007)
    assert keep[0] == 0 and keep[-1] == 99
    assert len(keep) < 10  # recta casi perfecta


def test_douglas_keeps_corners():
    pts = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (2.0, 1.0)]
    keep = douglas_peucker(pts, 0.00007)
    assert set(keep) == {0, 1, 2, 3}


def test_gain_loss_ignores_noise():
    assert gain_loss([100, 100.5, 101, 99, 105]) == (5.0, 0.0)
    assert gain_loss([]) == (0.0, 0.0)
    assert gain_loss([None, 100, None, 103]) == (3.0, 0.0)


def test_normalize_hr_zones():
    raw = [{"zoneNumber": 4, "secsInZone": 1875.7, "zoneLowBoundary": 165}]
    assert normalize_hr_zones(raw) == [{"zone": 4, "secs": 1876, "low": 165}]


def test_normalize_weather_converts_f_to_c():
    w = normalize_weather({"temp": 91, "apparentTemp": 91, "relativeHumidity": 15,
                           "windSpeed": 4, "windDirectionCompassPoint": "ne",
                           "weatherTypeDTO": {"desc": "Fair"},
                           "weatherStationDTO": {"name": "LESA"}})
    assert w["temp_c"] == 32.8
    assert w["station"] == "LESA"


def test_normalize_laps_pace():
    laps = normalize_laps({"lapDTOs": [
        {"lapIndex": 1, "distance": 1000.0, "movingDuration": 300.0,
         "averageHR": 150, "maxHR": 160, "elevationGain": 5,
         "elevationLoss": 3, "calories": 60, "averageSpeed": 3.33}]})
    assert laps[0]["pace"] == "5:00 /km"


def test_build_track_without_gps_returns_none():
    assert build_track({}) is None
    assert build_track({"geoPolylineDTO": {"polyline": [{"lat": None, "lon": None}]}}) is None


def test_build_track_skips_null_coords():
    poly = [
        {"lat": 40.0, "lon": -5.0, "altitude": 800.0, "time": 1, "speed": 3.0},
        {"lat": None, "lon": None, "altitude": 999.0, "time": 2, "speed": 9.9},
        {"lat": 40.001, "lon": -5.0, "altitude": 805.0, "time": 3, "speed": 3.0},
    ]
    track = build_track({"geoPolylineDTO": {"polyline": poly}, "metricDescriptors": []})
    assert track is not None
    assert len(track["points"]["lat"]) == 2  # el nulo, fuera
    assert track["gain_m"] == 5.0


def test_build_track_simplifies_and_bbox():
    poly = [{"lat": 40.0 + i * 0.001, "lon": -5.0, "altitude": 800 + 5 * i,
             "time": 1700000000000 + i * 1000, "speed": 7.0} for i in range(50)]
    track = build_track({"geoPolylineDTO": {"polyline": poly}, "metricDescriptors": []})
    assert track is not None
    assert track["simplified_count"] <= track["point_count"]
    assert track["gain_m"] == 245.0
    assert track["bbox"][0] <= track["bbox"][2]


if __name__ == "__main__":
    test_douglas_simplifies_straight_line()
    test_douglas_keeps_corners()
    test_gain_loss_ignores_noise()
    test_normalize_hr_zones()
    test_normalize_weather_converts_f_to_c()
    test_normalize_laps_pace()
    test_build_track_without_gps_returns_none()
    test_build_track_skips_null_coords()
    test_build_track_simplifies_and_bbox()
    print("SUCCESS: track_service OK.")
