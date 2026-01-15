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
    // ✅ Guard against empty/null data
    if (!aRows || aRows.length === 0) {
        return [{
            Category: "No Data",
            Value: 0,
            Type: "Total"
        }];
    }
    
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

        renderGeoMap: function (aRows, mConfig, oTooltip, bComparisonMode) {
            var oContainer = document.getElementById("indiaMapContainer");
            if (!oContainer) return null;
            
            var mDataById = {};
            var that = this;

            // 1. AGGREGATE DATA
            aRows.forEach(function (row) {
                var sState = that._normalizeStateName(row.StateName || row.DisplayCol1);
                
                // Find matching ID in the SVG (e.g., "tryjs1")
                var sId = Object.keys(mConfig).find(function (k) {
                    return mConfig[k] === sState;
                });

                if (sId) {
                    if (!mDataById[sId]) {
                        mDataById[sId] = { val: 0, valCY: 0, valPY: 0, count: 0 };
                    }
                    // Use CurrentMetric (Controlled by Toggle) for the heatmap intensity
                    mDataById[sId].val += parseFloat(row.CurrentMetric || 0);
                    
                    // Accumulate detailed data for Tooltip
                    mDataById[sId].valCY += parseFloat(row.MetricCY || 0);
                    mDataById[sId].valPY += parseFloat(row.MetricPY || 0);
                    mDataById[sId].count += parseInt(row.ProjectsCY || 0);
                }
            });

            // 2. DETERMINE MAX VALUE (For Color Scaling)
            var fMaxVal = Math.max.apply(Math, Object.values(mDataById).map(function (o) {
                return o.val;
            }).concat([1]));

            // 3. RENDER MAP
            oContainer.querySelectorAll("path").forEach(function (path) {
                var sId = path.getAttribute("id");
                var oInfo = mDataById[sId];

                // Reset State
                path.removeAttribute("title");
                path.style.fill = "#EBECED"; // Default Grey
                path.classList.remove("state-active");

                if (oInfo) {
                    path.classList.add("state-active");
                    // Dynamic Blue Opacity based on value
                    path.style.fill = "rgba(10, 110, 209, " + (0.3 + (0.7 * (oInfo.val / fMaxVal))) + ")";
                    
                    // 4. SMART TOOLTIP
                    path.onmousemove = function (e) {
                         if(oTooltip) {
                             var sHtml = "<div class='tooltip-header'>" + mConfig[sId] + "</div>";
                             
                             if (bComparisonMode) {
                                 // INSIGHTFUL COMPARISON TOOLTIP
                                 var fVar = oInfo.valCY - oInfo.valPY;
                                 var sIcon = fVar >= 0 ? "▲" : "▼";
                                 var sColor = fVar >= 0 ? "#256f3a" : "#b00"; // Green/Red
                                 
                                 sHtml += "<div class='tooltip-row'><span>CY</span><span>" + oInfo.valCY.toFixed(2) + " Cr</span></div>";
                                 sHtml += "<div class='tooltip-row'><span>PY</span><span>" + oInfo.valPY.toFixed(2) + " Cr</span></div>";
                                 sHtml += "<div class='tooltip-row' style='color:" + sColor + "'><span>Var</span><span>" + sIcon + " " + fVar.toFixed(2) + " Cr</span></div>";
                             } else {
                                 // STANDARD TOOLTIP
                                 sHtml += "<div class='tooltip-row'><span>Amount</span><span><strong>" + oInfo.val.toFixed(2) + " Cr</strong></span></div>";
                             }
                             
                             sHtml += "<div class='tooltip-row'><span>Projects</span><span><strong>" + oInfo.count + "</strong></span></div>";

                             oTooltip.innerHTML = sHtml;
                             oTooltip.style.display = "block";
                             oTooltip.style.left = (e.pageX + 20) + "px";
                             oTooltip.style.top = (e.pageY + 20) + "px";
                         }
                    };
                    path.onmouseout = function () {
                        if(oTooltip) oTooltip.style.display = "none";
                    };
                } else {
                    // Clear event listeners for empty states
                    path.onmousemove = null;
                    path.onmouseout = null;
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