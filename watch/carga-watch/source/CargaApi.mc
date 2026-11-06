using Toybox.Application.Properties;
using Toybox.Communications;
using Toybox.Lang;

class CargaApi {
    function baseUrl() {
        var value = Properties.getValue("apiUrl");
        return value instanceof String ? value : "";
    }

    function token() {
        var value = Properties.getValue("token");
        return value instanceof String ? value : "";
    }

    function configured() {
        return baseUrl().length() > 0 && token().length() > 0;
    }

    function loadToday(callback) as Void {
        if (!configured()) {
            callback.invoke(-1, null);
            return;
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => {"Authorization" => "Bearer " + token()},
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(baseUrl() + "/watch/today", null, options, callback);
    }

    function sendSet(record, callback) as Void {
        if (!configured()) {
            callback.invoke(-1, null);
            return;
        }
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {
                "Content-Type" => "application/json",
                "Authorization" => "Bearer " + token()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(baseUrl() + "/watch/sets", record, options, callback);
    }
}
