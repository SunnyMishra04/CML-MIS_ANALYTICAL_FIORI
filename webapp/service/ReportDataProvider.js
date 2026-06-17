/**
 * ReportDataProvider.js
 * ─────────────────────────────────────────────────────────────────
 * THE single data broker for the CML MIS Analytical Fiori app.
 *
 * ARCHITECTURE
 * ┌──────────────────────────────────────┐
 * │          Main.controller.js          │
 * │  calls: ReportDataProvider.getData() │
 * └──────────────┬───────────────────────┘
 *                │
 *       ┌────────▼─────────┐
 *       │ ReportDataProvider│  ◄─ ServiceConfig.USE_MOCK_DATA
 *       └────────┬──────────┘
 *         ┌──────┴──────┐
 *  MOCK mode│             │OData mode
 *  ┌────────▼──┐   ┌──────▼──────────┐
 *  │ JSON files│   │ ODataModel.read()│
 *  │/model/*.  │   │ ZCML_MIS_ANALY..│
 *  └───────────┘   └─────────────────┘
 *
 * USAGE IN CONTROLLER (Step 2 refactor):
 *
 *   // In onInit or onReportSelect:
 *   var oProvider = ReportDataProvider.getInstance(this.getView());
 *
 *   oProvider.getData(oFilterState).then(function(aData) {
 *       // aData is always the same shape — mock or live
 *       oViewModel.setProperty("/rows", aData);
 *   }).catch(function(oError) {
 *       MessageBox.error("Data load failed: " + oError.message);
 *   });
 *
 * ─────────────────────────────────────────────────────────────────
 */
sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel",
    "iifcl/cml/cmlmisapp/service/ServiceConfig",
    "iifcl/cml/cmlmisapp/service/ODataFilterBuilder",
    "sap/base/Log"
], function (BaseObject, JSONModel, ServiceConfig, ODataFilterBuilder, Log) {
    "use strict";

    var LOG_SRC = "CML.ReportDataProvider";

    // ── Singleton instance ──────────────────────────────────────────
    var _oInstance = null;

    var ReportDataProvider = BaseObject.extend("iifcl.cml.cmlmisapp.service.ReportDataProvider", {

        /**
         * @param {sap.ui.core.mvc.View} oView – reference to Main view
         *        (needed to resolve the OData model via oView.getModel())
         */
        constructor: function (oView) {
            BaseObject.call(this);
            this._oView         = oView;
            this._oReportConfig = null;   // loaded once on first call
            this._oCacheMap     = {};     // reportId → { timestamp, data }
            this._CACHE_TTL_MS  = 5 * 60 * 1000;  // 5 min mock cache
        },

        /* ═══════════════════════════════════════════════════════════
           PUBLIC API
        ═══════════════════════════════════════════════════════════ */

        /**
         * Primary entry point called by the controller.
         *
         * @param  {object} oFilterState – see ODataFilterBuilder for shape
         * @returns {Promise<Array>} resolves with record array
         */
        getData: function (oFilterState) {
            var that = this;
            return this._loadReportConfig().then(function (oConfig) {
                var oReportCfg = oConfig[oFilterState.reportId];
                if (!oReportCfg) {
                    return Promise.reject(new Error("Unknown reportId: " + oFilterState.reportId));
                }

                if (ServiceConfig.USE_MOCK_DATA) {
                    return that._fetchMock(oFilterState, oReportCfg);
                } else {
                    return that._fetchOData(oFilterState, oReportCfg);
                }
            });
        },

        /**
         * Returns the report config entry for a given reportId.
         * Useful for controllers that need column headers / bucket labels.
         * @param  {string} sReportId
         * @returns {Promise<object>}
         */
        getReportConfig: function (sReportId) {
            return this._loadReportConfig().then(function (oConfig) {
                return oConfig[sReportId] || null;
            });
        },

        /**
         * Clears the in-memory cache (call on filter reset or period change).
         */
        clearCache: function () {
            this._oCacheMap = {};
            Log.info("ReportDataProvider cache cleared", null, LOG_SRC);
        },

        /* ═══════════════════════════════════════════════════════════
           PRIVATE: CONFIG LOADER
        ═══════════════════════════════════════════════════════════ */

        _loadReportConfig: function () {
            var that = this;
            if (this._oReportConfig) {
                return Promise.resolve(this._oReportConfig);
            }
            return new Promise(function (resolve, reject) {
                var oModel = new JSONModel();
                oModel.loadData(sap.ui.require.toUrl("iifcl/cml/cmlmisapp/model/reportConfig.json"), null, false);
                var oData = oModel.getData();
                if (oData && Object.keys(oData).length > 0) {
                    that._oReportConfig = oData;
                    resolve(oData);
                } else {
                    // Async fallback
                    oModel.attachRequestCompleted(function () {
                        that._oReportConfig = oModel.getData();
                        resolve(that._oReportConfig);
                    });
                    oModel.attachRequestFailed(function (oErr) {
                        reject(new Error("Failed to load reportConfig.json: " + oErr));
                    });
                }
            });
        },

        /* ═══════════════════════════════════════════════════════════
           PRIVATE: MOCK DATA PATH
        ═══════════════════════════════════════════════════════════ */

        /**
         * Loads data from the local JSON file declared in reportConfig.
         * Applies client-side filtering via ODataFilterBuilder.applyToMockData.
         */
        _fetchMock: function (oFilterState, oReportCfg) {
            var that = this;
            var sCacheKey = oFilterState.reportId;

            // Return cached raw data and re-filter (filters change more often than data)
            var oCached = this._oCacheMap[sCacheKey];
            if (oCached && (Date.now() - oCached.timestamp) < this._CACHE_TTL_MS) {
                Log.debug("ReportDataProvider MOCK cache hit: " + sCacheKey, null, LOG_SRC);
                var aFiltered = ODataFilterBuilder.applyToMockData(oCached.rawData, oFilterState, oReportCfg);
                return Promise.resolve(this._normalizeMockData(aFiltered, oFilterState, oReportCfg));
            }

            return new Promise(function (resolve, reject) {
                var sUrl = sap.ui.require.toUrl("iifcl/cml/cmlmisapp/" + oReportCfg.dataFile);
                Log.info("ReportDataProvider MOCK load: " + sUrl, null, LOG_SRC);

                var oModel = new JSONModel();
                oModel.attachRequestCompleted(function () {
                    var aRaw = oModel.getData();
                    // Most JSONs are { results: [...] } or direct arrays
                    if (Array.isArray(aRaw)) {
                        // ok
                    } else if (aRaw && Array.isArray(aRaw.results)) {
                        aRaw = aRaw.results;
                    } else if (aRaw && Array.isArray(aRaw.value)) {
                        aRaw = aRaw.value;
                    } else {
                        // Flatten object-of-arrays (some reports)
                        aRaw = that._flattenObjectData(aRaw);
                    }

                    // Cache raw (unfiltered)
                    that._oCacheMap[sCacheKey] = { timestamp: Date.now(), rawData: aRaw };

                    var aFiltered = ODataFilterBuilder.applyToMockData(aRaw, oFilterState, oReportCfg);
                    resolve(that._normalizeMockData(aFiltered, oFilterState, oReportCfg));
                });
                oModel.attachRequestFailed(function () {
                    Log.error("ReportDataProvider MOCK load failed: " + sUrl, null, LOG_SRC);
                    reject(new Error("Could not load " + oReportCfg.dataFile));
                });
                oModel.loadData(sUrl);
            });
        },

        /**
         * Normalize raw mock record to the standard view row shape
         * that Main.controller.js already expects:
         * { DisplayCol1, DisplayCol2, BorrowerGroupName,
         *   CurrentMetric, MetricPY, ProjectsCY, ProjectsPY,
         *   ProjectCostCY, ProjectCostPY, ... }
         *
         * This keeps the VIEW XML bindings untouched during Step 1.
         */
        _normalizeMockData: function (aData, oFilterState, oReportCfg) {
            var oBucketCfg  = oReportCfg.buckets[oFilterState.bucket || "CY"];
            var oBucketCfgPY = oReportCfg.buckets["PY"];
            var sMetric     = oFilterState.metric || "gross";

            // Metric field resolver (same logic currently in controller)
            var fnMetricField = function (oBkt) {
                if (!oBkt) return null;
                switch (sMetric) {
                    case "gross":    return oBkt.gross    || oBkt.disb || null;
                    case "disb":     return oBkt.disb     || null;
                    case "net":      return oBkt.net      || null;
                    case "os":       return oBkt.os       || null;
                    case "exposure": return oBkt.exposure || null;
                    default:         return oBkt.gross    || null;
                }
            };

            var sCYField  = fnMetricField(oBucketCfg);
            var sPYField  = fnMetricField(oBucketCfgPY);

            return aData.map(function (oRow) {
                var oNorm = Object.assign({}, oRow);  // carry all original fields

                // Canonical display columns
                oNorm.DisplayCol1       = oRow[oReportCfg.fields.col1]  || "";
                oNorm.DisplayCol2       = oRow[oReportCfg.fields.col2]  || "";
                oNorm.BorrowerGroupName = oRow[oReportCfg.fields.col3]  || oRow.BorrowerGroupName || "";

                // Metric values for the chosen metric
                oNorm.CurrentMetric  = sCYField  ? (parseFloat(oRow[sCYField])  || 0) : 0;
                oNorm.MetricPY       = sPYField  ? (parseFloat(oRow[sPYField])  || 0) : 0;

                // Standard project / cost columns
                oNorm.ProjectsCY     = oRow[oBucketCfg  && oBucketCfg.noProj  ? oBucketCfg.noProj  : "ProjectsCY"]  || 0;
                oNorm.ProjectsPY     = oRow[oBucketCfgPY && oBucketCfgPY.noProj ? oBucketCfgPY.noProj : "ProjectsPY"] || 0;
                oNorm.ProjectCostCY  = oRow[oBucketCfg  && oBucketCfg.cost    ? oBucketCfg.cost    : "ProjectCostCY"]  || 0;
                oNorm.ProjectCostPY  = oRow[oBucketCfgPY && oBucketCfgPY.cost  ? oBucketCfgPY.cost  : "ProjectCostPY"]  || 0;

                // Variance (controller currently computes this — replicate here)
                oNorm.MetricVar      = oNorm.CurrentMetric - oNorm.MetricPY;
                oNorm.MetricVarPct   = oNorm.MetricPY !== 0
                    ? ((oNorm.MetricVar / Math.abs(oNorm.MetricPY)) * 100)
                    : (oNorm.CurrentMetric !== 0 ? 100 : 0);
                oNorm.MetricVarState = oNorm.MetricVar >= 0 ? "Success" : "Error";

                oNorm.ProjectsVar    = (oNorm.ProjectsCY || 0) - (oNorm.ProjectsPY || 0);
                oNorm.ProjectsVarState = oNorm.ProjectsVar >= 0 ? "Success" : "Error";

                return oNorm;
            });
        },

        /**
         * Some JSON files are structured as { "SchemeA": [...], "SchemeB": [...] }.
         * Flatten them into a single array preserving a Scheme field.
         */
        _flattenObjectData: function (oData) {
            if (!oData || typeof oData !== "object") return [];
            var aAll = [];
            Object.keys(oData).forEach(function (sKey) {
                var aRows = oData[sKey];
                if (Array.isArray(aRows)) {
                    aRows.forEach(function (oRow) {
                        if (!oRow.Scheme) oRow.Scheme = sKey;
                        aAll.push(oRow);
                    });
                }
            });
            return aAll;
        },

        /* ═══════════════════════════════════════════════════════════
           PRIVATE: ODATA PATH
           (Inactive while ServiceConfig.USE_MOCK_DATA = true)
        ═══════════════════════════════════════════════════════════ */

        _fetchOData: function (oFilterState, oReportCfg) {
            var that = this;
            var sEntitySet = ServiceConfig.ENTITY_SETS[oFilterState.reportId];

            if (!sEntitySet) {
                return Promise.reject(
                    new Error("No OData EntitySet mapped for reportId: " + oFilterState.reportId +
                        ". Add it to ServiceConfig.ENTITY_SETS.")
                );
            }

            var oODataModel = this._oView.getModel(ServiceConfig.ODATA_MODEL_NAME);
            if (!oODataModel) {
                return Promise.reject(new Error("OData model '" + ServiceConfig.ODATA_MODEL_NAME + "' not found on view."));
            }

            var aFilters   = ODataFilterBuilder.build(oFilterState, oReportCfg);
            var oUrlParams = ODataFilterBuilder.buildUrlParams(oFilterState, ServiceConfig.DEFAULT_PAGE_SIZE);

            Log.info("ReportDataProvider OData read: /" + sEntitySet, JSON.stringify(oUrlParams), LOG_SRC);

            return new Promise(function (resolve, reject) {
                oODataModel.read("/" + sEntitySet, {
                    filters:       aFilters,
                    urlParameters: oUrlParams,
                    success: function (oData) {
                        var aRaw = oData.results || [];
                        resolve(that._normalizeMockData(aRaw, oFilterState, oReportCfg));
                    },
                    error: function (oErr) {
                        var sMsg = (oErr.responseText || oErr.message || "OData call failed");
                        Log.error("ReportDataProvider OData error: " + sMsg, null, LOG_SRC);
                        reject(new Error(sMsg));
                    }
                });
            });
        }
    });

    /* ── Singleton accessor ────────────────────────────────────────── */
    ReportDataProvider.getInstance = function (oView) {
        if (!_oInstance) {
            _oInstance = new ReportDataProvider(oView);
        } else if (oView && !_oInstance._oView) {
            _oInstance._oView = oView;
        }
        return _oInstance;
    };

    return ReportDataProvider;
});
