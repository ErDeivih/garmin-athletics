using Toybox.WatchUi;

class LyftaDelegate extends WatchUi.BehaviorDelegate {
    private var _view;

    function initialize(view) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() {
        _view.onSelect();
        return true;
    }

    function onBack() {
        _view.onBack();
        return true;
    }

    function onNextPage() {
        _view.onNext();
        return true;
    }

    function onPreviousPage() {
        _view.onNext();
        return true;
    }
}
