sap.ui.define([], function () {
    "use strict";

    return {
        metric: function (value) {
            if (!value || isNaN(value)) return "0.00";
            var num = parseFloat(value);
            
            // Format large numbers intelligently
            if (num >= 10000000) { // >= 1 Crore
                return (num / 10000000).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " Cr";
            } else if (num >= 100000) { // >= 1 Lakh
                return (num / 100000).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " L";
            } else if (num >= 1000) { // >= 1 Thousand
                return (num / 1000).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " K";
            }
            
            return num.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        // NEW: Compact formatting for KPI cards
        metricCompact: function (value) {
            if (!value || isNaN(value)) return "0.00";
            var num = parseFloat(value);
            
            if (num >= 10000000) { // >= 1 Crore
                return (num / 10000000).toFixed(2) + " Cr";
            } else if (num >= 100000) { // >= 1 Lakh
                return (num / 100000).toFixed(2) + " L";
            } else if (num >= 1000) { // >= 1 Thousand
                return (num / 1000).toFixed(2) + " K";
            }
            
            return num.toFixed(2);
        },

        projects: function (value) {
            if (!value || isNaN(value)) return "0";
            return parseInt(value, 10).toLocaleString("en-IN");
        },

        percentage: function (value) {
            if (!value || isNaN(value)) return "0.0";
            var num = parseFloat(value);
            
            // Cap display at ±999.9% for readability
            if (num > 999.9) return ">999.9";
            if (num < -99.9) return "<-99.9";
            
            return num.toFixed(1);
        },

        // NEW: Variance with sign formatter
        varianceWithSign: function (value) {
            if (!value || isNaN(value)) return "0.00";
            var num = parseFloat(value);
            var sign = num >= 0 ? "+" : "";
            
            if (Math.abs(num) >= 10000000) { // >= 1 Crore
                return sign + (num / 10000000).toFixed(2) + " Cr";
            } else if (Math.abs(num) >= 100000) { // >= 1 Lakh
                return sign + (num / 100000).toFixed(2) + " L";
            } else if (Math.abs(num) >= 1000) { // >= 1 Thousand
                return sign + (num / 1000).toFixed(2) + " K";
            }
            
            return sign + num.toFixed(2);
        },
        metricInr: function (value) {
            if (!value || isNaN(value)) return "0.00 INR";
            var base = this.metric ? this.metric(value) : parseFloat(value).toFixed(2);
            return base + " INR";
        },

        metricCompactInr: function (value) {
            if (!value || isNaN(value)) return "0.00 INR";
            var base = this.metricCompact ? this.metricCompact(value) : parseFloat(value).toFixed(2);
            return base + " INR";
        },

and: function(a, b) {
    return a && b;
}
    };
});
