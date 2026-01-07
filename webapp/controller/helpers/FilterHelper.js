sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseObject, Filter, FilterOperator) {
    "use strict";

    return BaseObject.extend("iifcl.cml.cmlmisapp.controller.helpers.FilterHelper", {

        constructor: function (oController) {
            this._controller = oController;
        },

        populateFilters: function (aRows, sReportId, oVM, sColHeader) {
            oVM.setProperty("/showBorrowerGroupFilter", false);
            oVM.setProperty("/showBorrowerNameFilter", false);
            oVM.setProperty("/showDimensionFilter", true);

            if (sReportId === "DEV_GROUP") {
                var aSchemes = [...new Set(aRows.map(r => r.DisplayCol1))].filter(Boolean).sort();
                var aGroups = [...new Set(aRows.map(r => r.DisplayCol2))].filter(x => x && x !== "-").sort();
                var aNames = [...new Set(aRows.map(r => r.BorrowerGroupName))].filter(Boolean).sort();

                oVM.setProperty("/filterSchemes", aSchemes.map(s => ({ key: s, text: s })));
                oVM.setProperty("/filterBorrowerGroups", aGroups.map(g => ({ key: g, text: g })));
                oVM.setProperty("/filterBorrowerNames", aNames.map(n => ({ key: n, text: n })));
                
                oVM.setProperty("/showBorrowerGroupFilter", true);
                oVM.setProperty("/showBorrowerNameFilter", true);
                oVM.setProperty("/showDimensionFilter", false);
            } else {
                var aSchemeOptions = [...new Set(aRows.map(r => r.DisplayCol2))].filter(x => x && x !== "-").sort();
                var aDims = [...new Set(aRows.map(r => r.DisplayCol1))].filter(x => x && x !== "Unknown").sort();

                oVM.setProperty("/filterSchemes", aSchemeOptions.map(s => ({ key: s, text: s })));
                oVM.setProperty("/filterDimensions", aDims.map(d => ({ key: d, text: d })));
                
                oVM.setProperty("/filterLabel", sColHeader || "Dimension");
                oVM.setProperty("/filterPlaceholder", "Select " + (sColHeader || "Entity"));
            }
        },

        buildFiltersFromUI: function (sReportId, sText) {
            var aFilters = [];
            var sQuery = (sText || "").trim();
            var oView = this._controller.getView();

            // Helper function to create filters from MultiComboBox
            var fnAddMultiFilters = function(sControlId, sFieldName) {
                var oControl = oView.byId(sControlId);
                if (oControl) {
                    var aKeys = oControl.getSelectedKeys();
                    if (aKeys.length > 0) {
                        var aMultiFilters = aKeys.map(function(sKey) {
                            return new Filter(sFieldName, FilterOperator.EQ, sKey);
                        });
                        // Use 'false' for 'and' parameter to create an OR condition for multi-select
                        aFilters.push(new Filter({ filters: aMultiFilters, and: false }));
                    }
                }
            };

            // 1. Common Filter: Scheme (Multi-select support)
            var sSchemeField = (sReportId === "DEV_GROUP") ? "DisplayCol1" : "DisplayCol2";
            fnAddMultiFilters("fbScheme", sSchemeField);

            // 2. Report Specific Filters (Multi-select support)
            if (sReportId === "DEV_GROUP") {
                fnAddMultiFilters("fbBorrowerGroup", "DisplayCol2");
                fnAddMultiFilters("fbBorrowerName", "BorrowerGroupName");
            } else {
                fnAddMultiFilters("fbDimension", "DisplayCol1");
            }

            // 3. NEW: Date Range Filter (Reporting Period)
            var oDateRange = oView.byId("fbDateRange");
            if (oDateRange && oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
                aFilters.push(new Filter("ReportingDate", FilterOperator.BT, oDateRange.getDateValue(), oDateRange.getSecondDateValue()));
            }

            // 4. NEW: Min Amount Filter (StepInput)
            var oMinAmt = oView.byId("fbMinAmount");
            if (oMinAmt && oMinAmt.getValue() > 0) {
                // Filters rows where MetricCY is Greater Than or Equal to Input
                aFilters.push(new Filter("MetricCY", FilterOperator.GE, oMinAmt.getValue()));
            }

            // 5. Quick Search (Enhanced to include all fields)
            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("DisplayCol1", FilterOperator.Contains, sQuery),
                        new Filter("DisplayCol2", FilterOperator.Contains, sQuery),
                        new Filter("BorrowerGroupName", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }
            return aFilters;
        },

        resetFilters: function () {
            var oView = this._controller.getView();
            
            // Reset MultiComboBoxes
            ["fbScheme", "fbDimension", "fbBorrowerGroup", "fbBorrowerName"].forEach(id => {
                var oControl = oView.byId(id);
                if(oControl) oControl.setSelectedKeys([]);
            });

            // Reset DateRange
            if (oView.byId("fbDateRange")) oView.byId("fbDateRange").setValue("");

            // Reset StepInput (Numeric)
            var oMinAmt = oView.byId("fbMinAmount");
if (oMinAmt) {
    oMinAmt.setValue(0);
}


            // Reset Search
            if (oView.byId("fbQuickSearch")) oView.byId("fbQuickSearch").setValue("");
        }
    });
});