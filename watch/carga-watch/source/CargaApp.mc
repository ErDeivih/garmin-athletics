using Toybox.Application;
using Toybox.WatchUi;

class CargaApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new CargaView();
        return [view, new CargaDelegate(view)];
    }
}
