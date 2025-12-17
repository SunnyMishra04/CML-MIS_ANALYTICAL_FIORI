sap.ui.define([], function () {
    "use strict";

    function _formatNumber(value) {
        var n = parseFloat(value);
        if (isNaN(n)) {
            return "";
        }
        return n.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    return {
        metric: function (value) {
            return _formatNumber(value);
        },
        projects: function (value) {
            var n = parseInt(value, 10);
            if (isNaN(n)) {
                return "";
            }
            return n.toLocaleString("en-IN");
        }
    };
});
