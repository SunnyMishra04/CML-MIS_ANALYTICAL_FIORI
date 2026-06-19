


sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
    "use strict";

    return BaseObject.extend("iifcl.cml.cmlmisapp.controller.helpers.DataHelper", {

        constructor: function (oController) {
            this._controller = oController;
        },

/**
 * Process and transform pre-fetched raw rows for a report.
 * Data fetching is handled by ReportDataService — this method
 * only applies column mapping, metric selection, and variance calculation.
 *
 * @param {Array}  aRows      - pre-fetched raw data rows
 * @param {object} oCfg       - report config from reportConfig.json
 * @param {string} sBucketKey - "CY" or "PY"
 * @param {string} sMetricKey - "gross", "disb", "net", "os", "exposure", etc.
 * @param {string} sTenure    - "Yearly", "HalfYearly", "Quarterly", "Monthly"
 * @returns {Array} processed rows with computed display/metric fields
 */
processReportRows: function (aRows, oCfg, sBucketKey, sMetricKey, sTenure) {
    if (!aRows || !aRows.length) { return []; }

    // --- COMMON PROCESSING ---
    var sField1 = oCfg.fields && oCfg.fields.col1 || "";
    var sField2 = oCfg.fields && oCfg.fields.col2 || "";
    var sField3 = oCfg.fields && oCfg.fields.col3 || "";

    var oBucketCY = oCfg.buckets ? oCfg.buckets.CY : null;
    var oBucketPY = oCfg.buckets ? oCfg.buckets.PY : null;
    var oBucketActive = oCfg.buckets ? oCfg.buckets[sBucketKey] : null;

    // Visibility Flags
    var oVM = this._controller.getView().getModel("view");
    var sReportId = oVM.getProperty("/currentReportId");
    oVM.setProperty("/showProjectsCol", !!(oBucketCY && oBucketCY.noProj));
    oVM.setProperty("/showCostCol", !!(oBucketCY && oBucketCY.projCost));

    // Tenure Factor
    var fTenureFactor = 1.0;
    if (sTenure === "HalfYearly") fTenureFactor = 0.5;
    if (sTenure === "Quarterly") fTenureFactor = 0.25;
    if (sTenure === "Monthly") fTenureFactor = 0.0833;

    var fCr = 10000000; // Multiplier

    if (oBucketActive) {
        aRows.forEach(function (r) {
            // Map Dimensions
            r.DisplayCol1 = r[sField1] || r.Sector || r.SectorName || r.StateName || "Unknown";
            r.DisplayCol2 = r[sField2] || r.SubSectorName || r.Scheme || "-";
            r.BorrowerGroupName = r[sField3] || r.BorrowerGroupName || "";
            r.GenericDim = (sReportId === "DEV_GROUP") ? r.BorrowerGroupName : r.DisplayCol1;

            // Date Parsing
            var sDateStr = r[sField2] || r["Payment Date"] || r["PrepaymentDate"];
            if (sDateStr && typeof sDateStr === 'string' && sDateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                var parts = sDateStr.split(".");
                r.ReportingDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                r.ReportingDate = null;
            }

            // --- CY METRICS ---
            if (oBucketCY) {
                r.ProjectsCY = Number(r[oBucketCY.noProj] || 0);
                r.ProjectCostCY = Number(r[oBucketCY.projCost] || 0); // Removed fCr as requested for Borrower report

                // Smart Metric Lookup (Gross, Exposure, Recovery, etc.)
                var sTargetKey = oBucketCY[sMetricKey] || oBucketCY["recovery"] || oBucketCY["amount"] || oBucketCY["interest"];
                var rawMetricCY = Number(r[sTargetKey] || 0);
                
                // If the value is small (like 0.05), keep it small. If huge, assume it needs scaling? 
                // For now, assuming your JSONs are ALREADY in Crores, so factor is 1.
                r.MetricCY = rawMetricCY * fTenureFactor; 
            }

            // --- PY METRICS ---
            if (oBucketPY) {
                r.ProjectsPY = Number(r[oBucketPY.noProj] || 0);
                r.ProjectCostPY = Number(r[oBucketPY.projCost] || 0);

                var sTargetKeyPY = oBucketPY[sMetricKey] || oBucketPY["recovery"] || oBucketPY["amount"] || oBucketPY["interest"];
                var rawMetricPY = Number(r[sTargetKeyPY] || 0);
                r.MetricPY = rawMetricPY * fTenureFactor;
            }

            // Variances
            r.ProjectsVar = (r.ProjectsCY || 0) - (r.ProjectsPY || 0);
            r.MetricVar = (r.MetricCY || 0) - (r.MetricPY || 0);
            
            // Safe Percentages
            if (r.MetricPY === 0) {
                r.MetricVarPct = (r.MetricCY === 0) ? 0 : 100;
            } else {
                var rawPct = (r.MetricVar / Math.abs(r.MetricPY)) * 100;
                r.MetricVarPct = Math.round(rawPct * 100) / 100;
            }
            r.MetricVarState = r.MetricVar >= 0 ? "Success" : "Error";
            r.ProjectsVarState = r.ProjectsVar >= 0 ? "Success" : "Error";

            // Current Display Metric
            r.CurrentMetric = (sBucketKey === "CY") ? r.MetricCY : r.MetricPY;
        });
    }
    return aRows;
},
        calculateTotalKPIs: function (aRows, bComparisonMode) {
            var iProjCY = 0, fCostCY = 0, fMetricCY = 0;
            var iProjPY = 0, fCostPY = 0, fMetricPY = 0;

            aRows.forEach(function (r) {
                iProjCY += r.ProjectsCY || 0;
                fCostCY += r.ProjectCostCY || 0;
                fMetricCY += r.MetricCY || 0;
                if (bComparisonMode) {
                    iProjPY += r.ProjectsPY || 0;
                    fCostPY += r.ProjectCostPY || 0;
                }
                    fMetricPY += r.MetricPY || 0;
            });

            return {
                totalProjects: iProjCY,
                totalProjectCost: fCostCY,
                totalMetric: fMetricCY,
                totalProjectsPY: iProjPY,
                totalProjectCostPY: fCostPY,
                totalMetricPY: fMetricPY,
                totalProjectsVar: iProjCY - iProjPY,
                totalMetricVar: fMetricCY - fMetricPY,
                totalMetricVarPct: (fMetricPY > 0) ? Math.round((((fMetricCY - fMetricPY)/fMetricPY)*100) * 100) / 100 : 0,
                totalProjectsVarPct: (iProjPY > 0) ? Math.round((((iProjCY - iProjPY)/iProjPY)*100) * 100) / 100 : 0
            };
        }
    });
});