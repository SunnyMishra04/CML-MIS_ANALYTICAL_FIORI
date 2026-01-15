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

        populateFilters: function (aRows, sReportId, oVM, sCol1Header) {
            // 1. Reset Visibility
            oVM.setProperty("/showBorrowerGroupFilter", false);
            oVM.setProperty("/showBorrowerNameFilter", false);
            oVM.setProperty("/showDimensionFilter", true);

            // Check if Col2 exists
            var sCol2Header = oVM.getProperty("/col2Header");
            var bHasCol2 = (sCol2Header && sCol2Header !== "-" && sCol2Header !== "");
            oVM.setProperty("/showSchemeFilter", bHasCol2); 

            // 2. Set Dynamic Labels
            oVM.setProperty("/filterLabel", sCol1Header || "Dimension");
            oVM.setProperty("/filterPlaceholder", "Select " + (sCol1Header || "Entity"));
            oVM.setProperty("/filterLabelSecondary", sCol2Header || "Sub-Dimension");
            oVM.setProperty("/filterPlaceholderSecondary", "Select " + (sCol2Header || "Option"));

            // 3. Populate Standard Filters
            var aCol1Values = [...new Set(aRows.map(r => r.DisplayCol1))].filter(x => x && x !== "Unknown").sort();
            oVM.setProperty("/filterDimensions", aCol1Values.map(v => ({ key: v, text: v })));

            if (bHasCol2) {
                var aCol2Values = [...new Set(aRows.map(r => r.DisplayCol2))].filter(x => x && x !== "-").sort();
                oVM.setProperty("/filterSchemes", aCol2Values.map(v => ({ key: v, text: v })));
            }

            // 4. Special Case: Developer Group (Uses specific Borrower Group & Name filters)
            if (sReportId === "DEV_GROUP") {
                oVM.setProperty("/showBorrowerGroupFilter", true);
                oVM.setProperty("/showBorrowerNameFilter", true);
                oVM.setProperty("/showSchemeFilter", false); // Hide generic scheme filter to avoid duplicates

                var aGroups = [...new Set(aRows.map(r => r.DisplayCol2))].filter(x => x && x !== "-").sort();
                oVM.setProperty("/filterBorrowerGroups", aGroups.map(g => ({ key: g, text: g })));

                var aNames = [...new Set(aRows.map(r => r.BorrowerGroupName))].filter(Boolean).sort();
                oVM.setProperty("/filterBorrowerNames", aNames.map(n => ({ key: n, text: n })));
            }
            
            // 5. Special Case: Borrower Recovery (Uses Borrower Name)
            if (sReportId === "BORROWER_RECOV") {
                oVM.setProperty("/showBorrowerNameFilter", true);
                oVM.setProperty("/filterLabel", "Contract Number"); // Rename Dimension to Contract
                
                var aNamesRecov = [...new Set(aRows.map(r => r.BorrowerName))].filter(Boolean).sort();
                oVM.setProperty("/filterBorrowerNames", aNamesRecov.map(n => ({ key: n, text: n })));
            }
        },

buildFiltersFromUI: function (sReportId, sQuery) {
    var oView = this._controller.getView();
    var oVM = oView.getModel("view");
    var aFilters = [];

    // 1. Dimension Filter (Col1)
    var oDimCtrl = oView.byId("fbDimension");
    if (oDimCtrl && oDimCtrl.getSelectedKeys().length > 0) {
        var aDimKeys = oDimCtrl.getSelectedKeys();
        if (aDimKeys.length === 1) {
            aFilters.push(new Filter("DisplayCol1", FilterOperator.EQ, aDimKeys[0]));
        } else {
            var aDimFilters = aDimKeys.map(function(key) {
                return new Filter("DisplayCol1", FilterOperator.EQ, key);
            });
            aFilters.push(new Filter({ filters: aDimFilters, and: false }));
        }
    }

    // 2. Scheme Filter (Col2)
    var oSchemeCtrl = oView.byId("fbScheme");
    if (oVM.getProperty("/showSchemeFilter") && oSchemeCtrl && oSchemeCtrl.getSelectedKeys().length > 0) {
        var aSchemeKeys = oSchemeCtrl.getSelectedKeys();
        if (aSchemeKeys.length === 1) {
            aFilters.push(new Filter("DisplayCol2", FilterOperator.EQ, aSchemeKeys[0]));
        } else {
            var aSchemeFilters = aSchemeKeys.map(function(key) {
                return new Filter("DisplayCol2", FilterOperator.EQ, key);
            });
            aFilters.push(new Filter({ filters: aSchemeFilters, and: false }));
        }
    }

    // 3. Borrower Group Filter
    var oGroupCtrl = oView.byId("fbBorrowerGroup");
    if (oVM.getProperty("/showBorrowerGroupFilter") && oGroupCtrl && oGroupCtrl.getSelectedKeys().length > 0) {
        var aGroupKeys = oGroupCtrl.getSelectedKeys();
        if (aGroupKeys.length === 1) {
            aFilters.push(new Filter("DisplayCol2", FilterOperator.EQ, aGroupKeys[0]));
        } else {
            var aGroupFilters = aGroupKeys.map(function(key) {
                return new Filter("DisplayCol2", FilterOperator.EQ, key);
            });
            aFilters.push(new Filter({ filters: aGroupFilters, and: false }));
        }
    }

    // 4. Borrower Name Filter
    var oNameCtrl = oView.byId("fbBorrowerName");
    if (oVM.getProperty("/showBorrowerNameFilter") && oNameCtrl && oNameCtrl.getSelectedKeys().length > 0) {
        var sNameField = (sReportId === "DEV_GROUP") ? "BorrowerGroupName" : "BorrowerName";
        var aNameKeys = oNameCtrl.getSelectedKeys();
        if (aNameKeys.length === 1) {
            aFilters.push(new Filter(sNameField, FilterOperator.EQ, aNameKeys[0]));
        } else {
            var aNameFilters = aNameKeys.map(function(key) {
                return new Filter(sNameField, FilterOperator.EQ, key);
            });
            aFilters.push(new Filter({ filters: aNameFilters, and: false }));
        }
    }

    // 5.  Date Range Filter (CORRECTED)
    var oDateRange = oView.byId("fbDateRange");
    if (oDateRange) {
        var oStartDate = oDateRange.getDateValue();
        var oEndDate = oDateRange.getSecondDateValue();
        
        // Only apply filter if BOTH dates are selected
        if (oStartDate && oEndDate) {
            aFilters.push(new Filter("ReportingDate", FilterOperator.BT, oStartDate, oEndDate));
        }
    }

    // 6.  Global Search (CORRECTED - Handle empty string)
    var sSearchQuery = (sQuery || "").trim();
    if (sSearchQuery && sSearchQuery.length > 0) {
        var aSearchFilters = [
            new Filter("DisplayCol1", FilterOperator.Contains, sSearchQuery),
            new Filter("DisplayCol2", FilterOperator.Contains, sSearchQuery)
        ];
        
        if (sReportId === "DEV_GROUP" || sReportId === "BORROWER_RECOV") {
            aSearchFilters.push(new Filter("BorrowerName", FilterOperator.Contains, sSearchQuery));
            aSearchFilters.push(new Filter("BorrowerGroupName", FilterOperator.Contains, sSearchQuery));
        }
        
        // Use OR logic for search
        aFilters.push(new Filter({ filters: aSearchFilters, and: false }));
    }

    return aFilters;
},

        resetFilters: function () {
            var oView = this._controller.getView();
            // Reset ALL dropdowns
            ["fbDimension", "fbScheme", "fbBorrowerGroup", "fbBorrowerName"].forEach(id => {
                var oControl = oView.byId(id);
                if(oControl) oControl.setSelectedKeys([]);
            });
            if (oView.byId("fbDateRange")) oView.byId("fbDateRange").setValue("");
            if (oView.byId("fbQuickSearch")) oView.byId("fbQuickSearch").setValue("");
        }
    });
});