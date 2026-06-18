/**
 * ODataFilterBuilder.js
 * ─────────────────────────────────────────────────────────────────
 * Translates the UI filter object (populated by FilterBar + toolbar
 * selectors) into a sap.ui.model.Filter array ready for ODataModel.
 *
 * The same filter object is also used in mock mode so that the
 * client-side filtering logic in ReportDataProvider stays identical
 * to the server-side OData call structure.
 *
 * Filter object shape (produced by Main.controller.js):
 * {
 *   reportId      : "SECTOR_WISE",
 *   bucket        : "CY" | "PY",
 *   metric        : "gross" | "disb" | "net" | "os" | "exposure",
 *   tenure        : "Yearly" | "HalfYearly" | "Quarterly" | "Monthly",
 *   periodFrom    : "2025-04-01",   // ISO date string or null
 *   periodTo      : "2026-03-31",
 *   dimensions    : ["Power", "Roads"],   // MultiComboBox fbDimension
 *   schemes       : ["IIFCL Direct"],     // MultiComboBox fbScheme
 *   borrowerGroups: ["PSU"],
 *   borrowerNames : ["NTPC Ltd"],
 *   quickSearch   : "NTPC"
 * }
 * ─────────────────────────────────────────────────────────────────
 */
sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    var ODataFilterBuilder = {

        /**
         * Build a Filter array for ODataModel.read().
         * @param  {object} oFilterState  – UI filter state object (shape above)
         * @param  {object} oReportConfig – single report entry from reportConfig.json
         * @returns {sap.ui.model.Filter[]}
         */
        build: function (oFilterState, oReportConfig) {
            var aFilters = [];

            // ── Date range ────────────────────────────────────────────
            if (oFilterState.periodFrom) {
                aFilters.push(new Filter("PeriodFrom", FilterOperator.GE, oFilterState.periodFrom));
            }
            if (oFilterState.periodTo) {
                aFilters.push(new Filter("PeriodTo", FilterOperator.LE, oFilterState.periodTo));
            }

            // ── Bucket (CY / PY) ──────────────────────────────────────
            if (oFilterState.bucket) {
                aFilters.push(new Filter("Bucket", FilterOperator.EQ, oFilterState.bucket));
            }

            // ── Tenure ────────────────────────────────────────────────
            if (oFilterState.tenure) {
                aFilters.push(new Filter("Tenure", FilterOperator.EQ, oFilterState.tenure));
            }

            // ── Dimension / Sector multi-select ───────────────────────
            if (oFilterState.dimensions && oFilterState.dimensions.length > 0) {
                var aDimFilters = oFilterState.dimensions.map(function (sVal) {
                    return new Filter(
                        oReportConfig.fields.col1 || "SectorName",
                        FilterOperator.EQ,
                        sVal
                    );
                });
                aFilters.push(new Filter({ filters: aDimFilters, and: false })); // OR group
            }

            // ── Scheme multi-select ───────────────────────────────────
            if (oFilterState.schemes && oFilterState.schemes.length > 0) {
                var aSchemeFilters = oFilterState.schemes.map(function (sVal) {
                    return new Filter("Scheme", FilterOperator.EQ, sVal);
                });
                aFilters.push(new Filter({ filters: aSchemeFilters, and: false }));
            }

            // ── Borrower Group multi-select ───────────────────────────
            if (oFilterState.borrowerGroups && oFilterState.borrowerGroups.length > 0) {
                var aBGFilters = oFilterState.borrowerGroups.map(function (sVal) {
                    return new Filter("BorrowerGroup", FilterOperator.EQ, sVal);
                });
                aFilters.push(new Filter({ filters: aBGFilters, and: false }));
            }

            // ── Borrower Name multi-select ────────────────────────────
            if (oFilterState.borrowerNames && oFilterState.borrowerNames.length > 0) {
                var aBNFilters = oFilterState.borrowerNames.map(function (sVal) {
                    return new Filter("BorrowerName", FilterOperator.EQ, sVal);
                });
                aFilters.push(new Filter({ filters: aBNFilters, and: false }));
            }

            // ── Quick search (contains on primary display col) ────────
            if (oFilterState.quickSearch && oFilterState.quickSearch.trim() !== "") {
                var sSearchField = oReportConfig.fields.col1 || "BorrowerName";
                aFilters.push(new Filter(sSearchField, FilterOperator.Contains, oFilterState.quickSearch.trim()));
            }

            return aFilters;
        },

        /**
         * Build OData URL parameters object for ODataModel.read() urlParameters.
         * @param  {object} oFilterState
         * @returns {object}  e.g. { "$top": "200", "$orderby": "SectorName asc" }
         */
        buildUrlParams: function (oFilterState, iPageSize) {
            var oParams = {
                "$top": String(iPageSize || 200)
            };
            // Add $orderby based on report type if needed
            if (oFilterState.sortField) {
                oParams["$orderby"] = oFilterState.sortField + " " + (oFilterState.sortOrder || "asc");
            }
            return oParams;
        },

        /**
         * Apply the same filter logic client-side on a raw JSON array.
         * Used in MOCK mode so mock + OData behave identically.
         * @param  {Array}  aData         – raw records from JSON file
         * @param  {object} oFilterState
         * @param  {object} oReportConfig
         * @returns {Array} filtered records
         */
        applyToMockData: function (aData, oFilterState, oReportConfig) {
            if (!aData || aData.length === 0) return [];

            var col1Field  = oReportConfig.fields.col1  || "";
            var schemeField = "Scheme";
            var bgField    = "BorrowerGroup";
            var bnField    = "BorrowerName";

            return aData.filter(function (oRow) {

                // Dimension filter
                if (oFilterState.dimensions && oFilterState.dimensions.length > 0) {
                    if (!oFilterState.dimensions.includes(oRow[col1Field])) return false;
                }

                // Scheme filter
                if (oFilterState.schemes && oFilterState.schemes.length > 0) {
                    if (!oFilterState.schemes.includes(oRow[schemeField])) return false;
                }

                // Borrower Group filter
                if (oFilterState.borrowerGroups && oFilterState.borrowerGroups.length > 0) {
                    if (!oFilterState.borrowerGroups.includes(oRow[bgField])) return false;
                }

                // Borrower Name filter
                if (oFilterState.borrowerNames && oFilterState.borrowerNames.length > 0) {
                    if (!oFilterState.borrowerNames.includes(oRow[bnField])) return false;
                }

                // Quick search (case-insensitive contains on col1)
                if (oFilterState.quickSearch && oFilterState.quickSearch.trim() !== "") {
                    var sSearch = oFilterState.quickSearch.trim().toLowerCase();
                    var sVal = (oRow[col1Field] || oRow[bnField] || "").toLowerCase();
                    if (!sVal.includes(sSearch)) return false;
                }

                return true;
            });
        }
    };

    return ODataFilterBuilder;
});
