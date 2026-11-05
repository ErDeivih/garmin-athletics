using Toybox.Application;
using Toybox.WatchUi;

class ForjaApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new ForjaView();
        return [view, new ForjaDelegate(view)];
    }
}
