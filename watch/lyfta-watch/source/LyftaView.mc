using Toybox.Activity;
using Toybox.ActivityRecording;
using Toybox.Graphics;
using Toybox.WatchUi;

class LyftaView extends WatchUi.View {
    private var _model as LyftaModel;
    private var _state = "loading";
    private var _lastSetId = "";
    private var _session;
    private var _sensor;
    private var _lastReps = 0;
    private var _lastVelocity = 0.0;
    private var _lastForce = 0.0;
    private var _lastOneRm = 0.0;
    private var _autoBusy = false;

    function initialize() {
        View.initialize();
        _model = new LyftaModel();
        _sensor = new LyftaSensor();
        loadWorkout();
    }

    function loadWorkout() as Void {
        _state = "loading";
        var api = new LyftaApi();
        if (api.configured()) {
            api.loadToday(method(:onToday));
        } else {
            _model.loadDemo();
            _state = "workout";
        }
        WatchUi.requestUpdate();
    }

    function onToday(code, data) as Void {
        if (code == 200 && data instanceof Dictionary) {
            _model.loadFromDictionary(data);
            _state = _model.hasWorkout() ? "workout" : "empty";
            if (_state == "workout") {
                startSensor();
            }
        } else {
            _state = "offline";
        }
        WatchUi.requestUpdate();
    }

    function onSelect() as Void {
        if (_state == "workout") {
            markSet();
        } else if (_state == "offline") {
            loadWorkout();
        } else if (_state == "done" || _state == "empty") {
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        }
    }

    function markSet() as Void {
        if (_autoBusy) {
            return;
        }
        _autoBusy = true;
        var detected = _sensor.reps();
        var velocity = _sensor.averageVelocityMps();
        var force = _sensor.estimatedForceN(_model.weight());
        var oneRm = _sensor.estimatedOneRepMaxKg(_model.weight(), _model.reps());
        var record = _model.markSet(detected, velocity, force, oneRm);
        if (record == null) {
            _autoBusy = false;
            return;
        }
        _lastReps = detected;
        _lastVelocity = velocity;
        _lastForce = force;
        _lastOneRm = oneRm;
        _sensor.reset();
        _lastSetId = record["client_set_id"];
        startRecording();
        var api = new LyftaApi();
        if (api.configured()) {
            api.sendSet(record, method(:onSetSent));
        }
        _state = _model.finished ? "done" : "workout";
        if (_state == "workout") {
            startSensor();
        } else {
            _sensor.stop();
        }
        _autoBusy = false;
        WatchUi.requestUpdate();
    }

    function startSensor() as Void {
        if (_state != "workout" || _autoBusy) {
            return;
        }
        _sensor.start(_model.reps(), method(:onSetFinished));
    }

    function onSetFinished() as Void {
        if (_state != "workout" || _autoBusy) {
            return;
        }
        markSet();
    }

    function onSetSent(code, data) as Void {
        if (code == 200) {
            _model.removePending(_lastSetId);
        }
        WatchUi.requestUpdate();
    }

    function onNext() as Void {
        if (_state == "workout") {
            _model.goNextExercise();
            _sensor.reset();
            startSensor();
            WatchUi.requestUpdate();
        }
    }

    function onBack() as Void {
        if (_state == "workout") {
            saveRecording();
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (_state == "offline") {
            loadWorkout();
        } else {
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        }
    }

    function startRecording() as Void {
        if (_session != null) {
            return;
        }
        if (Toybox has :ActivityRecording) {
            _session = ActivityRecording.createSession({
                :name => "Lyfta",
                :sport => Activity.SPORT_TRAINING,
                :subSport => Activity.SUB_SPORT_STRENGTH_TRAINING
            });
            if (_session != null) {
                _session.start();
            }
        }
    }

    function saveRecording() as Void {
        if (_session != null) {
            _session.stop();
            _session.save();
            _session = null;
        }
    }

    function onShow() as Void {
        if (_state == "workout") {
            startSensor();
        }
        WatchUi.requestUpdate();
    }

    function onHide() as Void {
        _sensor.stop();
        saveRecording();
    }

    function draw(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        if (_state == "loading") {
            drawCentered(dc, "Lyfta", 70, Graphics.FONT_LARGE, Graphics.COLOR_WHITE);
            drawCentered(dc, "Buscando entreno", 130, Graphics.FONT_SMALL, Graphics.COLOR_LT_GRAY);
        } else if (_state == "offline") {
            drawCentered(dc, "Lyfta", 60, Graphics.FONT_LARGE, Graphics.COLOR_WHITE);
            drawCentered(dc, "Sin conexión", 120, Graphics.FONT_MEDIUM, Graphics.COLOR_ORANGE);
            drawCentered(dc, "OK reintentar", 180, Graphics.FONT_TINY, Graphics.COLOR_LT_GRAY);
        } else if (_state == "empty") {
            drawCentered(dc, "Lyfta", 60, Graphics.FONT_LARGE, Graphics.COLOR_WHITE);
            drawCentered(dc, "Hoy no toca fuerza", 130, Graphics.FONT_MEDIUM, Graphics.COLOR_WHITE);
            drawCentered(dc, "ATRÁS salir", 190, Graphics.FONT_TINY, Graphics.COLOR_LT_GRAY);
        } else if (_state == "done") {
            drawCentered(dc, "Lyfta", 50, Graphics.FONT_LARGE, Graphics.COLOR_WHITE);
            drawCentered(dc, "Entreno terminado", 110, Graphics.FONT_MEDIUM, Graphics.COLOR_GREEN);
            drawCentered(dc, _model.done.toString() + " series", 160, Graphics.FONT_SMALL, Graphics.COLOR_WHITE);
            if (_lastOneRm > 0) {
                drawCentered(dc, "1RM ~ " + fmt(_lastOneRm) + " kg", 185, Graphics.FONT_TINY, Graphics.COLOR_ORANGE);
            }
            if (_model.pendingCount() > 0) {
                drawCentered(dc, _model.pendingCount().toString() + " por enviar", 195, Graphics.FONT_TINY, Graphics.COLOR_ORANGE);
            }
            drawCentered(dc, "OK cerrar", 230, Graphics.FONT_TINY, Graphics.COLOR_LT_GRAY);
        } else {
            drawWorkout(dc);
        }
    }

    function drawWorkout(dc as Graphics.Dc) as Void {
        var width = dc.getWidth();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 10, Graphics.FONT_SMALL, "Lyfta", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 32, Graphics.FONT_TINY, short(_model.name, 22), Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawLine(20, 52, width - 20, 52);

        var ex = _model.currentExercise();
        if (ex == null) {
            return;
        }
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 58, Graphics.FONT_TINY,
            "Ejercicio " + (_model.exerciseIndex + 1).toString() + "/" + _model.exerciseCount().toString(),
            Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 78, Graphics.FONT_MEDIUM, short(_model.text(ex, "name", "Ejercicio"), 20),
            Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 108, Graphics.FONT_SMALL,
            "Serie " + (_model.setIndex + 1).toString() + "/" + _model.currentSets().toString(),
            Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 132, Graphics.FONT_NUMBER_MEDIUM,
            "Peso " + _model.weight().toString() + " kg", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 158, Graphics.FONT_MEDIUM, "Objetivo × " + _model.reps().toString(),
            Graphics.TEXT_JUSTIFY_CENTER);

        var liveReps = _sensor.reps();
        var repsShown = liveReps > 0 ? liveReps : _lastReps;
        var velocityShown = liveReps > 0 ? _sensor.averageVelocityMps() : _lastVelocity;
        var forceShown = liveReps > 0 ? _sensor.estimatedForceN(_model.weight()) : _lastForce;

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 180, Graphics.FONT_TINY, "Reps detectadas: " + repsShown.toString(),
            Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 196, Graphics.FONT_TINY, "Velocidad: " + fmt(velocityShown) + " m/s",
            Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(width / 2, 212, Graphics.FONT_TINY, "Fuerza ~ " + Math.round(forceShown).toString() + " N",
            Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 232, Graphics.FONT_TINY, "AUTO · no pulses nada", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 246, Graphics.FONT_TINY, "ATRÁS salir", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function fmt(value) {
        return (Math.round(value * 10) / 10.0).toString();
    }

    function drawCentered(dc as Graphics.Dc, text, y, font, color) as Void {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(dc.getWidth() / 2, y, font, text, Graphics.TEXT_JUSTIFY_CENTER);
    }

    function short(value, limit) {
        return value.length() > limit ? value.substring(0, limit - 1) + "…" : value;
    }
}
