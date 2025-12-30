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

            // 1. Common Filter: Scheme
            var sScheme = oView.byId("fbScheme") ? oView.byId("fbScheme").getSelectedKey() : "";
            if (sScheme) {
                var sSchemeField = (sReportId === "DEV_GROUP") ? "DisplayCol1" : "DisplayCol2";
                aFilters.push(new Filter(sSchemeField, FilterOperator.EQ, sScheme));
            }

            // 2. Report Specific Filters
            if (sReportId === "DEV_GROUP") {
                var sGroup = oView.byId("fbBorrowerGroup") ? oView.byId("fbBorrowerGroup").getSelectedKey() : "";
                var sName = oView.byId("fbBorrowerName") ? oView.byId("fbBorrowerName").getSelectedKey() : "";
                
                if (sGroup) aFilters.push(new Filter("DisplayCol2", FilterOperator.EQ, sGroup));
                if (sName) aFilters.push(new Filter("BorrowerGroupName", FilterOperator.EQ, sName));
            } else {
                var sDim = oView.byId("fbDimension") ? oView.byId("fbDimension").getSelectedKey() : "";
                if (sDim) aFilters.push(new Filter("DisplayCol1", FilterOperator.EQ, sDim));
            }

            // 3. Quick Search
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
            ["fbScheme", "fbDimension", "fbBorrowerGroup", "fbBorrowerName"].forEach(id => {
                if(this._controller.byId(id)) this._controller.byId(id).setSelectedKey("");
            });
            if (this._controller.byId("fbQuickSearch")) this._controller.byId("fbQuickSearch").setValue("");
        }
    });
});
