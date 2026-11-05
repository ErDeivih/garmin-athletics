using Toybox.Application;
using Toybox.WatchUi;

class PULSOApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new PULSOView();
        return [view, new PULSODelegate(view)];
    }
}
