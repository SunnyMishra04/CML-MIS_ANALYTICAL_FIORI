/**
 * ReportDataService.js — Step 4 · Service Abstraction Layer
 *
 * Single gateway for all data fetching in the CML MIS app.
 * Supports two modes controlled by USE_MOCK:
 *   true  → loads from local JSON files (webapp/model/*.json)
 *   false → reads from OData v2 service ZCML_MIS_ANALYTICS_SRV
 *
 * Usage:
 *   var oService = new ReportDataService(oComponent);
 *   oService.fetchReportData("DEV_GROUP", oReportConfig).then(function(aRows) { ... });
 *   oService.fetchAllData().then(function(aResults) { ... });
 */
sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
    "use strict";

    /* ─── Configuration ──────────────────────────────────────────────────── */

    /**
     * Master switch: true = local JSON mock, false = live OData.
     * Flip to false when ABAP CDS views + OData service binding are ready.
     */
    var USE_MOCK = true;

    /**
     * Mapping from Report ID → OData Entity Set name.
     * Used in live mode only. Extend as ABAP team publishes new entity sets.
     */
    var _ENTITY_MAP = {
        "DEV_GROUP":        "DevGroupSet",
        "SECTOR_WISE":      "SectorWiseSet",
        "GEO_REPORT":       "GeographySet",
        "FIN_ASSIST":       "FinAssistSet",
        "BORROWER_RECOV":   "BorrowerRecovSet",
        "PREPAYMENT":       "PrepaymentSet",
        "SECTOR_INVEST":    "SectorInvestSet",
        "SCHEME_WISE":      "SchemeWiseSet",
        "COD_REPORT":       "CodReportSet",
        "CATEGORY_MODE":    "CategoryModeSet",
        "NPA_ANALYSIS":     "NpaAnalysisSet",
        "DISBURSEMENT_WISE":"DisbursementWiseSet",
        "NPA_REPORT":       "NpaReportSet"
    };

    /** OData read timeout in milliseconds */
    var ODATA_TIMEOUT_MS = 3000;

    /* ─── Service Class ──────────────────────────────────────────────────── */

    return BaseObject.extend("iifcl.cml.cmlmisapp.service.ReportDataService", {

        /**
         * @param {sap.ui.core.Component} oComponent - the app component (for OData model access)
         */
        constructor: function (oComponent) {
            BaseObject.call(this);
            this._oComponent = oComponent;
        },

        /* ── Public API ─────────────────────────────────────────────────── */

        /**
         * Check if running in mock mode.
         * @returns {boolean}
         */
        isMockMode: function () {
            return USE_MOCK;
        },

        /**
         * Fetch raw (untransformed) rows for a single report.
         *
         * Mock mode  → synchronous JSONModel.loadData from reportConfig.dataFile
         * Live mode  → OData read from the mapped entity set
         *
         * @param {string} sReportId   - e.g. "DEV_GROUP"
         * @param {object} oReportConfig - the report's entry from reportConfig.json
         * @returns {Promise<Array>} resolves with raw row array
         */
        fetchReportData: function (sReportId, oReportConfig) {
            if (USE_MOCK) {
                return this._fetchMock(sReportId, oReportConfig);
            }
            return this._fetchOData(sReportId);
        },

        /**
         * Fetch ALL analytics data in one call (initial load).
         *
         * Mock mode  → resolves immediately with empty array
         *              (individual reports load via fetchReportData)
         * Live mode  → reads /ZMIS_AnalyticSet with $top=10000
         *              Includes a safety timeout of ODATA_TIMEOUT_MS.
         *
         * @returns {Promise<Array>} resolves with backend result array
         */
        fetchAllData: function () {
            if (USE_MOCK) {
                console.info("[ReportDataService] Mock mode — skipping bulk OData fetch.");
                return Promise.resolve([]);
            }
            return this._fetchAllOData();
        },

        /* ── Mock Adapter ───────────────────────────────────────────────── */

        /**
         * Load a single report's JSON file synchronously.
         * @private
         */
        _fetchMock: function (sReportId, oReportConfig) {
            var sDataFile = (oReportConfig && oReportConfig.dataFile) || "";
            if (!sDataFile) {
                console.warn("[ReportDataService] No dataFile configured for report: " + sReportId);
                return Promise.resolve([]);
            }

            try {
                var oJson = new JSONModel();
                oJson.loadData(sDataFile, null, false); // synchronous
                var oData = oJson.getData();
                var aRows = [];

                if (Array.isArray(oData)) {
                    aRows = oData;
                } else if (oData && Array.isArray(oData.rows)) {
                    aRows = oData.rows;
                }

                console.info("[ReportDataService] Mock: loaded " + aRows.length + " rows from " + sDataFile);
                return Promise.resolve(aRows);
            } catch (e) {
                console.error("[ReportDataService] Mock load failed for " + sDataFile, e);
                return Promise.resolve([]);
            }
        },

        /* ── OData Adapter ──────────────────────────────────────────────── */

        /**
         * Read a single entity set from the OData service.
         * @private
         */
        _fetchOData: function (sReportId) {
            var that = this;
            var sEntitySet = _ENTITY_MAP[sReportId];
            if (!sEntitySet) {
                console.warn("[ReportDataService] No OData entity set mapped for: " + sReportId);
                return Promise.resolve([]);
            }

            var oModel = this._oComponent.getModel();
            if (!oModel) {
                console.warn("[ReportDataService] OData model not available — returning empty.");
                return Promise.resolve([]);
            }

            return new Promise(function (resolve, reject) {
                var sPath = "/" + sEntitySet;
                oModel.read(sPath, {
                    urlParameters: { "$top": "10000" },
                    success: function (oData) {
                        var aResults = (oData && oData.results) ? oData.results : [];
                        console.info("[ReportDataService] OData: loaded " + aResults.length +
                                     " rows from " + sPath);
                        resolve(aResults);
                    },
                    error: function (oError) {
                        console.error("[ReportDataService] OData read failed for " + sPath, oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Bulk-read all analytics data from the main entity set.
         * Includes a safety timeout to prevent UI lockup.
         * @private
         */
        _fetchAllOData: function () {
            var oModel = this._oComponent.getModel();
            if (!oModel) {
                console.warn("[ReportDataService] OData model not found — resolving empty.");
                return Promise.resolve([]);
            }

            return new Promise(function (resolve) {
                var bResolved = false;

                // Safety timeout: force-resolve after ODATA_TIMEOUT_MS
                var iTimer = setTimeout(function () {
                    if (!bResolved) {
                        bResolved = true;
                        console.warn("[ReportDataService] OData bulk fetch timed out (" +
                                     ODATA_TIMEOUT_MS + "ms). Resolving empty.");
                        resolve([]);
                    }
                }, ODATA_TIMEOUT_MS);

                oModel.metadataLoaded().then(function () {
                    oModel.read("/ZMIS_AnalyticSet", {
                        urlParameters: { "$top": "10000" },
                        success: function (oData) {
                            if (!bResolved) {
                                bResolved = true;
                                clearTimeout(iTimer);
                                var aResults = (oData && oData.results) ? oData.results : [];
                                console.info("[ReportDataService] OData bulk: loaded " +
                                             aResults.length + " rows.");
                                resolve(aResults);
                            }
                        },
                        error: function (oError) {
                            if (!bResolved) {
                                bResolved = true;
                                clearTimeout(iTimer);
                                console.error("[ReportDataService] OData bulk read failed.", oError);
                                resolve([]); // resolve empty — don't reject, let app continue with local data
                            }
                        }
                    });
                }).catch(function () {
                    if (!bResolved) {
                        bResolved = true;
                        clearTimeout(iTimer);
                        console.error("[ReportDataService] OData metadata load failed.");
                        resolve([]);
                    }
                });
            });
        }
    });
});
