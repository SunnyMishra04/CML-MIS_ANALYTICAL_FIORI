sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
    "use strict";

    return BaseObject.extend("iifcl.cml.cmlmisapp.controller.helpers.ChartHelper", {

        constructor: function (oController) {
            this._controller = oController;
        },

        /**
         * Prepares data for both Comparison and Trend charts
         */
       prepareComparisonChartData: function (aRows, bComparisonMode) {
    var aTopRows = aRows.slice()
        .sort(function (a, b) { 
            return (parseFloat(b.MetricCY) || 0) - (parseFloat(a.MetricCY) || 0); 
        })
        .slice(0, 10);

    return aTopRows.map(function (r) {
        return {
            Dimension: r.DisplayCol1 || "N/A", 
            CY: parseFloat(r.MetricCY) || 0,
            PY: parseFloat(r.MetricPY) || 0,
            Value: parseFloat(r.MetricCY) || 0, // Current Year value
            Variance: parseFloat(r.MetricVar) || 0,
            Projects: r.ProjectsCY || 0,
            ProjectsPY: r.ProjectsPY || 0
        };
    });
},

        prepareWaterfallData: function (aRows, fTotalMetricPY, fTotalMetric) {
            var aPositive = aRows
                .filter(function (r) { return r.MetricVar > 0; })
                .sort(function (a, b) { return b.MetricVar - a.MetricVar; })
                .slice(0, 5);

            var aNegative = aRows
                .filter(function (r) { return r.MetricVar < 0; })
                .sort(function (a, b) { return a.MetricVar - b.MetricVar; })
                .slice(0, 5);

            var aWaterfallData = [{
                Category: "PY Total",
                Value: Number(fTotalMetricPY) || 0,
                Type: "Total"
            }];

            aPositive.forEach(function (r) {
                aWaterfallData.push({
                    Category: (r.DisplayCol1 || "Increase") + " ▲",
                    Value: r.MetricVar,
                    Type: "Increase"
                });
            });

            aNegative.forEach(function (r) {
                aWaterfallData.push({
                    Category: (r.DisplayCol1 || "Decrease") + " ▼",
                    Value: Math.abs(r.MetricVar),
                    Type: "Decrease"
                });
            });

            aWaterfallData.push({
                Category: "CY Total",
                Value: Number(fTotalMetric) || 0,
                Type: "Total"
            });
            return aWaterfallData;
        },

        renderGeoMap: function (aRows, mConfig, oTooltip) {
            var oContainer = document.getElementById("indiaMapContainer");
            if (!oContainer) return null;
            
            var mDataById = {};
            var that = this;

            aRows.forEach(function (row) {
                var sState = that._normalizeStateName(row.StateName || row.DisplayCol1);
                var sId = Object.keys(mConfig).find(function (k) {
                    return mConfig[k] === sState;
                });
                if (sId) {
                    if (!mDataById[sId]) {
                        mDataById[sId] = { val: 0, count: 0 };
                    }
                    mDataById[sId].val += parseFloat(row.MetricCY || 0);
                    mDataById[sId].count += parseInt(row.ProjectsCY || 0);
                }
            });

            var fMaxVal = Math.max.apply(Math, Object.values(mDataById).map(function (o) {
                return o.val;
            }).concat([1]));

            oContainer.querySelectorAll("path").forEach(function (path) {
                var sId = path.getAttribute("id");
                var oInfo = mDataById[sId];

                path.removeAttribute("title");
                path.style.fill = "#EBECED";
                path.classList.remove("state-active");

                if (oInfo) {
                    path.classList.add("state-active");
                    path.style.fill = "rgba(10, 110, 209, " + (0.3 + (0.7 * (oInfo.val / fMaxVal))) + ")";
                    
                    path.onmousemove = function (e) {
                         if(oTooltip) {
                             oTooltip.innerHTML = 
                                "<div class='tooltip-header'>" + mConfig[sId] + "</div>" +
                                // REMOVED the division by 10,000,000 because your DataHelper already scales to Cr
                                "<div class='tooltip-row'><span>Amount</span><span><strong>" + oInfo.val.toFixed(2) + " Cr</strong></span></div>" +
                                "<div class='tooltip-row'><span>Projects</span><span><strong>" + oInfo.count + "</strong></span></div>";
                             oTooltip.style.display = "block";
                             oTooltip.style.left = (e.pageX + 20) + "px";
                             oTooltip.style.top = (e.pageY + 20) + "px";
                         }
                    };
                    path.onmouseout = function () {
                        if(oTooltip) oTooltip.style.display = "none";
                    };
                }
            });

            return mDataById;
        },

        _normalizeStateName: function (sName) {
            var mMap = { "Orissa": "Odisha", "Andra Pradesh": "Andhra Pradesh", "Telengana": "Telangana" };
            return sName ? (mMap[sName.trim()] || sName.trim()) : "";
        }
    });
});