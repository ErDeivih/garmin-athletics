using Toybox.Math;
using Toybox.Sensor;
using Toybox.System;

/**
 * Detector de series por movimiento, rediseñado para press y curl.
 *
 * - Arranca la grabación ANTES de registrar el sensor (lo hace la vista).
 * - Pide 50 Hz y cae a 25 Hz solo si la registración falla.
 * - Procesa todas las muestras del lote con su tiempo, no solo la última.
 * - Usa una señal por ejercicio: giro (x) en curl, aceleración sin gravedad
 *   en press. Ambas pasan por un paso bajo de ~4,5 Hz.
 * - Cuenta un ciclo completo de ida y vuelta entre 0,6 y 6 s con umbrales
 *   adaptados al ruido y al recorrido del ejercicio (55 % del recorrido).
 * - Cierra la serie solo tras reposo real: 2,5 × duración mediana, acotado
 *   entre 5 y 10 s; un movimiento retoma la serie dentro de la ventana.
 * - Si el conteo no es fiable, la serie se marca para revisión en el móvil.
 */
class LyftaSensor {
    private var _reps = 0;
    private var _active = false;
    private var _finished = false;
    private var _callback = null;
    private var _curl = false;
    private var _targetReps = 0;
    private var _sampleRate = 50;
    private var _samplePeriod = 20.0;

    private var _startedAt = 0;
    private var _calibrating = true;
    private var _rawMin = 0.0;
    private var _rawMax = 0.0;
    private var _noise = 0.0;
    private var _filtered = 0.0;
    private var _gravity = 0.0;

    private var _mid = 0.0;
    private var _amp = 0.0;
    private var _state = 0; // 0 espera, 1 arriba, 2 abajo
    private var _cycleStartAt = 0;
    private var _lastMotionAt = 0;
    private var _lastCycleAt = 0;
    private var _durations = [];
    private var _doubtful = false;
    private var _lostSamples = 0;

    function initialize() {
    }

    function start(targetReps, exerciseName, callback) {
        if (_active) {
            stop();
        }
        reset();
        _targetReps = targetReps;
        _callback = callback;
        var name = exerciseName == null ? "" : exerciseName;
        _curl = name.find("curl") != null;
        register(50);
        if (!_active) {
            register(25);
        }
        if (_active) {
            _startedAt = System.getTimer();
        }
    }

    function register(rate) {
        var options = {:period => 1, :accelerometer => {:enabled => true, :sampleRate => rate}};
        try {
            Sensor.registerSensorDataListener(method(:onData), options);
            _sampleRate = rate;
            _samplePeriod = 1000.0 / rate;
            _active = true;
        } catch (e) {
            _active = false;
        }
    }

    function stop() {
        if (!_active) {
            return;
        }
        try {
            Sensor.unregisterSensorDataListener();
        } catch (e) {
        }
        _active = false;
    }

    function reset() {
        _reps = 0;
        _finished = false;
        _calibrating = true;
        _rawMin = 0.0;
        _rawMax = 0.0;
        _noise = 0.0;
        _filtered = 0.0;
        _gravity = 0.0;
        _mid = 0.0;
        _amp = 0.0;
        _state = 0;
        _cycleStartAt = 0;
        _lastMotionAt = 0;
        _lastCycleAt = 0;
        _durations = [];
        _doubtful = false;
        _lostSamples = 0;
        _startedAt = 0;
    }

    function onData(sensorData as Sensor.SensorData) as Void {
        if (_finished) {
            return;
        }
        var data = sensorData.accelerometerData;
        if (data == null) {
            return;
        }
        var xs = data.x;
        var ys = data.y;
        var zs = data.z;
        var now = System.getTimer();
        if (xs instanceof Array) {
            var count = xs.size();
            for (var i = 0; i < count; i += 1) {
                var t = now - (count - 1 - i) * _samplePeriod;
                processSample(lastValue(xs, i), lastValue(ys, i), lastValue(zs, i), t);
            }
        } else {
            processSample(xs, ys, zs, now);
            _lostSamples += 1;
        }
        if (!_calibrating && _reps > 0) {
            var rest = _restTargetMs();
            if (now - _lastMotionAt > rest) {
                finish();
            }
        }
    }

    function processSample(x, y, z, now) {
        var magnitude = Math.sqrt(x * x + y * y + z * z);
        var raw;
        if (_curl) {
            // El giro del antebrazo se aproxima con el eje x; en press se usa
            // la aceleración lineal quitando la gravedad.
            raw = x;
        } else {
            if (_gravity == 0.0) {
                _gravity = magnitude;
            }
            _gravity = _gravity * 0.995 + magnitude * 0.005;
            raw = magnitude - _gravity;
        }
        var dt = _samplePeriod / 1000.0;
        var rc = 1.0 / (2.0 * Math.PI * 4.5);
        var alpha = dt / (rc + dt);
        if (_filtered == 0.0) {
            _filtered = raw;
        } else {
            _filtered = _filtered + alpha * (raw - _filtered);
        }

        if (_calibrating) {
            if (_startedAt == 0) {
                _startedAt = now;
                _rawMin = raw;
                _rawMax = raw;
            }
            _rawMin = min(_rawMin, raw);
            _rawMax = max(_rawMax, raw);
            _noise = max(_noise, abs(raw - (_rawMin + _rawMax) / 2.0));
            if (now - _startedAt > 800) {
                _calibrating = false;
                _mid = (_rawMin + _rawMax) / 2.0;
                _amp = max(0.04, (_rawMax - _rawMin) / 2.0);
                _lastMotionAt = now;
            }
            return;
        }

        // Rango adaptativo: sigue el recorrido habitual sin dispararse con un
        // pico aislado. El umbral es el 55 % del recorrido.
        _rawMin = min(_rawMin * 1.002, _filtered);
        _rawMax = max(_rawMax * 0.998, _filtered);
        _mid = (_rawMin + _rawMax) / 2.0;
        _amp = max(0.04, (_rawMax - _rawMin) / 2.0);
        var high = _mid + _amp * 0.55;
        var low = _mid - _amp * 0.55;
        var motion = abs(_filtered - _mid) > max(0.025, _noise * 1.5);

        if (motion) {
            _lastMotionAt = now;
        }
        if (_filtered > high) {
            if (_state == 2 && _cycleStartAt > 0) {
                var duration = now - _cycleStartAt;
                if (duration >= 600 && duration <= 6000) {
                    _reps += 1;
                    _durations.add(duration);
                    _lastCycleAt = now;
                    if (duration > 3500) {
                        _doubtful = true;
                    }
                } else {
                    _doubtful = true;
                }
            }
            if (_state != 1) {
                _state = 1;
                _cycleStartAt = now;
            }
        } else if (_filtered < low) {
            if (_state == 1) {
                _state = 2;
            }
        }
    }

    function abs(value) {
        return value < 0 ? -value : value;
    }

    function compare(a, b) {
        return a < b ? -1 : (a > b ? 1 : 0);
    }

    function min(a, b) {
        return a < b ? a : b;
    }

    function max(a, b) {
        return a > b ? a : b;
    }

    function finish() {
        if (_finished) {
            return;
        }
        _finished = true;
        if (_callback != null) {
            _callback.invoke();
        }
    }

    function lastValue(values, index) {
        if (values instanceof Array) {
            return index < values.size() ? values[index] : values[values.size() - 1];
        }
        return values;
    }

    function medianDurationMs() {
        if (_durations.size() == 0) {
            return 0;
        }
        var copy = [];
        for (var i = 0; i < _durations.size(); i += 1) {
            copy.add(_durations[i]);
        }
        for (var i = 1; i < copy.size(); i += 1) {
            var value = copy[i];
            var j = i - 1;
            while (j >= 0 && copy[j] > value) {
                copy[j + 1] = copy[j];
                j -= 1;
            }
            copy[j + 1] = value;
        }
        return copy[copy.size() / 2];
    }

    function _restTargetMs() {
        var median = medianDurationMs();
        if (median == 0) {
            return 5000;
        }
        var target = median * 2.5;
        return max(5000, min(10000, target));
    }

    function reps() {
        return _reps;
    }

    function isReliable() {
        return _reps >= 3 && _reps <= 10 && !_doubtful;
    }

    function needsReview() {
        return _reps > 0 && !isReliable();
    }

    function averageVelocityMps() {
        var median = medianDurationMs();
        return median > 0 ? 1.0 / (median / 1000.0) : 0.0;
    }

    function estimatedForceN(weightKg) {
        return weightKg * 9.81 * (1.0 + averageVelocityMps() * 0.25);
    }

    /** Epley solo con 3-10 reps fiables; si no, deja el e1RM pendiente. */
    function estimatedOneRepMaxKg(weightKg) {
        if (!isReliable() || weightKg <= 0) {
            return 0.0;
        }
        return weightKg * (1.0 + _reps / 30.0);
    }
}
