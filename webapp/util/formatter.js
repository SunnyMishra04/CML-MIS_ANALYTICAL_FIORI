sap.ui.define([], function () {
    "use strict";

    return {
        metric: function (value) {
            if (!value || isNaN(value)) return "0.00";
            var num = parseFloat(value);
            return num.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        projects: function (value) {
            if (!value || isNaN(value)) return "0";
            return parseInt(value, 10).toLocaleString("en-IN");
        },

        percentage: function (value) {
            if (!value || isNaN(value)) return "0%";
            return parseFloat(value).toFixed(1) + "%";
        }
    };
});
