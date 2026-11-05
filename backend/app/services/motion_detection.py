"""Calibración y detección de repeticiones en seco (IMU-1/IMU-4).

Trabaja con muestras `{t_ms, x, y, z}` en mili-G (a 25 Hz por defecto). No hay
reloj en el bucle: sirve para validar el perfil y el detector con una grabación
o con una señal sintética antes de meterlo en Connect IQ.
"""
from statistics import median
from typing import Any, Dict, List, Optional

MIN_SAMPLES = 25


def _samples_from(payload: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    out = []
    for row in payload:
        try:
            out.append({
                "t_ms": float(row.get("t_ms", len(out) * 40)),
                "x": float(row["x"]),
                "y": float(row["y"]),
                "z": float(row["z"]),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _axis_signal(samples: List[Dict[str, float]], axis: str) -> List[float]:
    values = [row[axis] for row in samples]
    mean = sum(values) / len(values)
    return [value - mean for value in values]


def _moving_average(values: List[float], window: int = 3) -> List[float]:
    if window <= 1:
        return values
    half = window // 2
    out = []
    for index in range(len(values)):
        chunk = values[max(0, index - half): min(len(values), index + half + 1)]
        out.append(sum(chunk) / len(chunk))
    return out


def _find_peaks(signal: List[float], sample_rate: float, min_distance_s: float = 0.4) -> List[int]:
    if len(signal) < 3:
        return []
    span = max(signal) - min(signal)
    if span <= 0:
        return []
    prominence = span * 0.2
    distance = max(1, int(min_distance_s * sample_rate))
    peaks: List[int] = []
    for index in range(1, len(signal) - 1):
        value = signal[index]
        if value <= signal[index - 1] or value < signal[index + 1]:
            continue
        if value < prominence:
            continue
        if peaks and index - peaks[-1] < distance:
            if value > signal[peaks[-1]]:
                peaks[-1] = index
            continue
        peaks.append(index)
    return peaks


def _calibration_profile(samples: List[Dict[str, float]], sample_rate_hz: float,
                         axis: str, peaks: List[int], prominence: float) -> Dict[str, Any]:
    values = _axis_signal(samples, axis)
    intervals = [peaks[i] - peaks[i - 1] for i in range(1, len(peaks))]
    periods = [interval / sample_rate_hz for interval in intervals]
    period = median(periods) if periods else 2.4
    cv = 0.0
    if len(periods) > 1:
        mean = sum(periods) / len(periods)
        variance = sum((value - mean) ** 2 for value in periods) / len(periods)
        cv = (variance ** 0.5 / mean) if mean else 0.0
    # El pico positivo de cada repetición es el eje elegido; el perfil propone
    # un umbral conservador y una ventana de duración alrededor del periodo.
    return {
        "schema_version": 1,
        "sensor": {
            "source": "watch_accelerometer",
            "sample_rate_hz": int(sample_rate_hz),
            "units": "milli_g",
            "axes": ["x", "y", "z"],
            "max_window_s": 2.0,
        },
        "signal": {
            "mode": "axis_projected",
            "gravity_removal": "mean_subtract",
            "smooth_samples": 3,
            "normalize": False,
        },
        "axis": {
            "mode": "calibrated",
            "name": axis,
            "side": "watch_arm",
            "sign": 1,
        },
        "rep": {
            "peaks_per_rep": 1,
            "peak_polarity": "positive",
            "expected_duration_s": round(period, 2),
            "min_duration_s": round(max(0.6, period * 0.5), 2),
            "max_duration_s": round(min(8.0, period * 2.0), 2),
            "min_peak_distance_s": round(max(0.3, period * 0.5), 2),
            "prominence_mg": round(max(20.0, prominence * 0.6), 1),
            "hysteresis_mg": round(max(10.0, prominence * 0.2), 1),
        },
        "set": {
            "min_reps": 3,
            "start_after_reps": 2,
            "end_rest_s": 8.0,
            "auto_set_detection": True,
        },
        "side": {"mode": "unilateral", "counts": "watch_arm_only", "mirror_when_left": True},
        "confidence": {
            "min_interval_ratio": 0.65,
            "max_interval_ratio": 1.5,
            "min_reps_before_review": 2,
        },
        "calibration": {
            "source": "dry_run",
            "reps_labeled": None,
            "detected_on_calibration": len(peaks),
            "interval_cv": round(cv, 3),
        },
    }


def calibrate(samples_payload: List[Dict[str, Any]], sample_rate_hz: float = 25.0,
              reps_labeled: Optional[int] = None) -> Dict[str, Any]:
    """Propone un perfil a partir de una grabación. Devuelve error tipificado."""
    samples = _samples_from(samples_payload)
    if len(samples) < MIN_SAMPLES:
        raise ValueError(f"Hacen falta al menos {MIN_SAMPLES} muestras; llegaron {len(samples)}.")
    if sample_rate_hz <= 0:
        raise ValueError("La frecuencia debe ser positiva.")
    variances = {}
    for axis in ("x", "y", "z"):
        signal = _axis_signal(samples, axis)
        variances[axis] = sum(value * value for value in signal) / len(signal)
    axis = max(variances, key=variances.get)
    signal = _moving_average(_axis_signal(samples, axis), 3)
    peaks = _find_peaks(signal, sample_rate_hz)
    prominence = max(signal) - min(signal) if signal else 0.0
    profile = _calibration_profile(samples, sample_rate_hz, axis, peaks, prominence)
    profile["calibration"]["reps_labeled"] = reps_labeled
    return {
        "status": "ok" if peaks else "no_peaks",
        "detected_reps": len(peaks),
        "expected_reps": reps_labeled,
        "axis": axis,
        "peak_intervals_s": [
            round((peaks[i] - peaks[i - 1]) / sample_rate_hz, 3) for i in range(1, len(peaks))
        ],
        "profile": profile,
    }


def detect(samples_payload: List[Dict[str, Any]], profile: Dict[str, Any],
           sample_rate_hz: Optional[float] = None) -> Dict[str, Any]:
    """Aplica un perfil a una grabación y cuenta repeticiones (modo seco)."""
    samples = _samples_from(samples_payload)
    if len(samples) < MIN_SAMPLES:
        raise ValueError(f"Hacen falta al menos {MIN_SAMPLES} muestras; llegaron {len(samples)}.")
    rate = float(sample_rate_hz or profile.get("sensor", {}).get("sample_rate_hz", 25))
    axis = str(profile.get("axis", {}).get("name", "z"))
    if axis not in ("x", "y", "z"):
        axis = "z"
    signal = _moving_average(_axis_signal(samples, axis), int(profile.get("signal", {}).get("smooth_samples", 3)))
    rep = profile.get("rep", {})
    peaks = _find_peaks(signal, rate, float(rep.get("min_peak_distance_s", 0.4)))
    min_reps = int(profile.get("set", {}).get("min_reps", 3))
    return {
        "status": "ok" if len(peaks) >= min_reps else "review",
        "reps": len(peaks),
        "axis": axis,
        "confidence": "alta" if len(peaks) >= min_reps else "baja",
        "note": "Cuenta en seco; no sustituye la prueba en el reloj.",
    }
