using Toybox.Math;
using Toybox.Sensor;
using Toybox.System;

/**
 * Detección automática de una serie por movimiento de la muñeca.
 *
 * No pide pulsar nada para cerrar la serie: cuando hay un mínimo de
 * repeticiones y el brazo deja de moverse durante ~1,8 s, avisa a la vista
 * para guardar la serie y preparar la siguiente. Cuenta picos con umbral
 * relativo (amplitud) y un recorrido mínimo, no un valor absoluto fijo.
 */
class LyftaSensor {
    private var _reps = 0;
    private var _lastPeakAt = 0;
    private var _lastLow = 0.0;
    private var _baseline = 0.0;
    private var _intervals = [];
    private var _active = false;
    private var _finished = false;
    private var _armed = true;
    private var _targetReps = 0;
    private var _callback = null;

    function initialize() {
    }

    function start(targetReps, callback) {
        if (_active) {
            stop();
        }
        reset();
        _targetReps = targetReps;
        _callback = callback;
        var options = {:period => 1, :accelerometer => {:enabled => true, :sampleRate => 25}};
        try {
            Sensor.registerSensorDataListener(method(:onData), options);
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
        _lastPeakAt = 0;
        _lastLow = 0.0;
        _baseline = 0.0;
        _intervals = [];
        _finished = false;
        _armed = true;
    }

    function onData(sensorData as Sensor.SensorData) as Void {
        if (_finished) {
            return;
        }
        var data = sensorData.accelerometerData;
        if (data == null) {
            return;
        }
        var x = lastValue(data.x);
        var y = lastValue(data.y);
        var z = lastValue(data.z);
        var magnitude = Math.sqrt(x * x + y * y + z * z);
        var now = System.getTimer();

        if (_baseline == 0.0) {
            _baseline = magnitude;
            _lastLow = magnitude;
            return;
        }
        // Línea base lenta: se adapta a la gravedad y a la posición del brazo.
        _baseline = _baseline * 0.92 + magnitude * 0.08;

        var highThreshold = _baseline + 650.0;
        var lowThreshold = _baseline + 260.0;
        var travel = magnitude - _lastLow;

        if (magnitude > highThreshold && _armed && travel > 320.0 &&
                (_lastPeakAt == 0 || now - _lastPeakAt > 380)) {
            if (_lastPeakAt > 0) {
                var interval = now - _lastPeakAt;
                if (interval > 350 && interval < 5000) {
                    _intervals.add(interval);
                }
            }
            _lastPeakAt = now;
            _reps += 1;
            _armed = false;
        } else if (magnitude < lowThreshold) {
            _armed = true;
            _lastLow = magnitude;
        }

        if (_reps > 0) {
            var quiet = now - _lastPeakAt;
            var reachedTarget = _targetReps > 0 && _reps >= _targetReps;
            if ((reachedTarget && quiet > 900) || quiet > 1900) {
                _finished = true;
                if (_callback != null) {
                    _callback.invoke();
                }
            }
        }
    }

    function lastValue(value) {
        if (value instanceof Array) {
            return value.size() > 0 ? value[value.size() - 1] : 0;
        }
        return value;
    }

    function reps() {
        return _reps;
    }

    function averagePeriodS() {
        if (_intervals.size() == 0) {
            return 0.0;
        }
        var total = 0;
        for (var i = 0; i < _intervals.size(); i += 1) {
            total += _intervals[i];
        }
        return (total / _intervals.size()) / 1000.0;
    }

    function averageVelocityMps() {
        var period = averagePeriodS();
        return period > 0 ? 1.0 / period : 0.0;
    }

    function estimatedForceN(weightKg) {
        return weightKg * 9.81 * (1.0 + averageVelocityMps() * 0.25);
    }

    function estimatedOneRepMaxKg(weightKg, targetReps) {
        var counted = _reps > 0 ? _reps : targetReps;
        if (counted <= 0) {
            return 0.0;
        }
        return weightKg * (1.0 + counted / 30.0);
    }
}
