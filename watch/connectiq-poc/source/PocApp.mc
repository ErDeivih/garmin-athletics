using Toybox.Application;
using Toybox.Activity;
using Toybox.ActivityRecording;
using Toybox.Communications;
using Toybox.Lang;
using Toybox.PersistedContent;
using Toybox.Sensor;
using Toybox.System;
using Toybox.WatchUi;

// PoC de compatibilidad: usa SOLO las APIs que necesita el camino del reloj
// (acelerómetro de alta frecuencia, grabación de fuerza, HTTP por el móvil y
// almacenamiento). No usa `AccelerometerData.timestamp` porque llegó en API
// 5.1.1 y dejaría fuera a relojes más antiguos: el conteo de repeticiones se
// hará por índice de muestra y periodo.
class PocApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        return [new PocView()];
    }
}

class PocView extends WatchUi.View {
    private var _session as ActivityRecording.Session?;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        if (Toybox has :Sensor) {
            Sensor.registerSensorDataListener(method(:onSensor), {
                :period => 1,
                :accelerometer => {:enabled => true, :sampleRate => 25}
            });
        }
        if (Toybox has :ActivityRecording) {
            _session = ActivityRecording.createSession({
                :name => "Gym",
                :sport => Activity.SPORT_TRAINING,
                :subSport => Activity.SUB_SPORT_STRENGTH_TRAINING
            });
            if (_session != null) {
                _session.start();
            }
        }
        if (Toybox has :Communications) {
            Communications.makeWebRequest("https://example.com/api/v1/ping", null, {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            }, method(:onHttp));
        }
        // La mano del reloj no la expone el SDK: se guarda como preferencia.
        Application.Storage.setValue("watchHand", "left");
    }

    function onSensor(data as Sensor.SensorData) as Void {
        if (data.accelerometerData != null) {
            System.println(data.accelerometerData.x[0]);
        }
    }

    function onHttp(code as Lang.Number,
                    data as Lang.Dictionary or Lang.String or PersistedContent.Iterator or Null) as Void {
        System.println(code);
    }

    function onHide() as Void {
        if (_session != null) {
            _session.stop();
            _session.save();
            _session = null;
        }
    }
}
