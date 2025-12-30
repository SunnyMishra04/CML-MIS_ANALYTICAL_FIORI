sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
    "use strict";

    return BaseObject.extend("iifcl.cml.cmlmisapp.controller.helpers.DataHelper", {

        constructor: function (oController) {
            this._controller = oController;
        },

        loadReportData: function (sReportId, oCfg, sBucketKey, sMetricKey, sTenure) {
            var aRows = [];

            if (oCfg && oCfg.dataFile) {
                var oJson = new JSONModel();
                oJson.loadData(oCfg.dataFile, null, false);
                aRows = oJson.getProperty("/rows") || [];
            }

            var sField1 = oCfg.fields && oCfg.fields.col1 || "";
            var sField2 = oCfg.fields && oCfg.fields.col2 || "";
            var sField3 = oCfg.fields && oCfg.fields.col3 || "";

            var oBucketCY = oCfg.buckets ? oCfg.buckets.CY : null;
            var oBucketPY = oCfg.buckets ? oCfg.buckets.PY : null;
            var oBucketActive = oCfg.buckets ? oCfg.buckets[sBucketKey] : null;

            // SIMULATE TENURE FACTOR
            var fTenureFactor = 1.0;
            if (sTenure === "HalfYearly") fTenureFactor = 0.5;
            if (sTenure === "Quarterly") fTenureFactor = 0.25;
            if (sTenure === "Monthly") fTenureFactor = 0.0833;

            var fCr = 10000000;

            if (oBucketActive) {
                aRows.forEach(function (r) {
                    r.DisplayCol1 = r[sField1] || r.Sector || r.SectorName || r.StateName || "Unknown";
                    r.DisplayCol2 = r[sField2] || r.SubSectorName || r.Scheme || "-";
                    r.BorrowerGroupName = r[sField3] || r.BorrowerGroupName || "";
                    r.GenericDim = (sReportId === "DEV_GROUP") ? r.BorrowerGroupName : r.DisplayCol1;

                    if (oBucketCY) {
                        r.ProjectsCY = Number(r[oBucketCY.noProj] || 0);
                        r.ProjectCostCY = Number(r[oBucketCY.projCost] || 0) * fCr;
                        var rawMetricCY = Number(r[oBucketCY[sMetricKey]] || 0);
                        r.MetricCY = ((sMetricKey === "os") ? rawMetricCY : rawMetricCY * fCr) * fTenureFactor;
                    }

                    if (oBucketPY) {
                        r.ProjectsPY = Number(r[oBucketPY.noProj] || 0);
                        r.ProjectCostPY = Number(r[oBucketPY.projCost] || 0) * fCr;
                        var rawMetricPY = Number(r[oBucketPY[sMetricKey]] || 0);
                        r.MetricPY = ((sMetricKey === "os") ? rawMetricPY : rawMetricPY * fCr) * fTenureFactor;
                    }

                    // FINANCIAL VARIANCE CALCULATION
                    r.ProjectsVar = (r.ProjectsCY || 0) - (r.ProjectsPY || 0);
                    r.MetricVar = (r.MetricCY || 0) - (r.MetricPY || 0);

                    if (r.ProjectsPY === 0) {
                        r.ProjectsVarPct = (r.ProjectsCY === 0) ? 0 : 100;
                    } else {
                        r.ProjectsVarPct = (r.ProjectsVar / Math.abs(r.ProjectsPY)) * 100;
                    }

                    if (r.MetricPY === 0) {
                        r.MetricVarPct = (r.MetricCY === 0) ? 0 : 100;
                    } else {
                        r.MetricVarPct = (r.MetricVar / Math.abs(r.MetricPY)) * 100;
                    }

                    r.MetricVarState = r.MetricVar >= 0 ? "Success" : "Error";
                    r.ProjectsVarState = r.ProjectsVar >= 0 ? "Success" : "Error";
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
                    fMetricPY += r.MetricPY || 0;
                }
            });

            var kpis = {
                totalProjects: iProjCY,
                totalProjectCost: fCostCY,
                totalMetric: fMetricCY
            };

            if (bComparisonMode) {
                kpis.totalProjectsPY = iProjPY;
                kpis.totalProjectCostPY = fCostPY.toFixed(2);
                kpis.totalMetricPY = fMetricPY.toFixed(2);

                var iVarProj = iProjCY - iProjPY;
                var fVarMetric = fMetricCY - fMetricPY;
                var fVarPctProj = 0;
                var fVarPctMetric = 0;

                if (iProjPY > 0) {
                    fVarPctProj = (iVarProj / iProjPY) * 100;
                } else if (iVarProj !== 0) {
                    fVarPctProj = iVarProj > 0 ? 100 : 0;
                }

                if (fMetricPY > 0) {
                    fVarPctMetric = (fVarMetric / fMetricPY) * 100;
                } else if (fVarMetric !== 0) {
                    fVarPctMetric = fVarMetric > 0 ? 100 : 0;
                }

                kpis.totalProjectsVar = iVarProj;
                kpis.totalProjectsVarPct = fVarPctProj.toFixed(2);
                kpis.totalMetricVar = fVarMetric.toFixed(2);
                kpis.totalMetricVarPct = fVarPctMetric.toFixed(2);
            }
            return kpis;
        }
    });
});
