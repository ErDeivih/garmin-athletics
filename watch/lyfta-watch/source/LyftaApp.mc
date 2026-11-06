using Toybox.Application;
using Toybox.WatchUi;

class LyftaApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new LyftaView();
        return [view, new LyftaDelegate(view)];
    }
}
