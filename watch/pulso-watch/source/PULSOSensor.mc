using Toybox.Math;
using Toybox.Sensor;
using Toybox.System;

/**
 * Detector de repeticiones por movimiento de la muñeca.
 *
 * No pide duración de repetición ni inicio de serie: al abrir el entreno
 * escucha el acelerómetro a 25 Hz, detecta el pico de cada repetición y mide
 * el tiempo entre picos. Con ese tiempo estima la velocidad de ejecución y,
 * junto al peso de la serie, una fuerza aproximada y un 1RM estimado.
 *
 * Es una estimación de POC: no sustituye una medición de laboratorio.
 */
class PULSOSensor {
    private var _reps = 0;
    private var _lastPeakAt = 0;
    private var _intervals = [];
    private var _active = false;
    private var _threshold = 1250.0;

    function initialize() {
    }

    function start() {
        if (_active) {
            return;
        }
        reset();
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
        _intervals = [];
    }

    function onData(sensorData as Sensor.SensorData) as Void {
        var data = sensorData.accelerometerData;
        if (data == null) {
            return;
        }
        var x = lastValue(data.x);
        var y = lastValue(data.y);
        var z = lastValue(data.z);
        var magnitude = Math.sqrt(x * x + y * y + z * z);
        var now = System.getTimer();
        if (magnitude < _threshold) {
            return;
        }
        if (_lastPeakAt > 0 && now - _lastPeakAt < 320) {
            return;
        }
        if (_lastPeakAt > 0) {
            var interval = now - _lastPeakAt;
            if (interval < 5000) {
                _intervals.add(interval);
            }
        }
        _lastPeakAt = now;
        _reps += 1;
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
