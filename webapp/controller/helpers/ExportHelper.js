sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
], function (BaseObject, Spreadsheet, exportLibrary) {
    "use strict";

    var EdmType = exportLibrary.EdmType;

    return BaseObject.extend("iifcl.cml.cmlmisapp.controller.helpers.ExportHelper", {

        constructor: function (oController) {
            this._controller = oController;
        },

        downloadExcel: function (aRows, sFileName, mHeaders) {
            if (!aRows || !aRows.length) {
                return;
            }

            var aCols = this._createColumnConfig(mHeaders);

            var oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level',
                    context: {
                        sheetName: 'MIS Data',
                        application: 'CML MIS Workbench'
                    }
                },
                dataSource: aRows,
                fileName: (sFileName || "Report") + ".xlsx",
                worker: false
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        _createColumnConfig: function (mHeaders) {
            var aCols = [];

            // 1. DIMENSIONS
            aCols.push({
                label: mHeaders.col1 || "Dimension",
                property: "DisplayCol1",
                type: EdmType.String,
                width: 30
            });

            aCols.push({
                label: mHeaders.col2 || "Sub-Dimension",
                property: "DisplayCol2",
                type: EdmType.String,
                width: 30
            });

            if (mHeaders.showCol3) {
                aCols.push({
                    label: mHeaders.col3 || "Details",
                    property: "BorrowerGroupName",
                    type: EdmType.String,
                    width: 40
                });
            }

            // 2. CURRENT YEAR (CY)
            aCols.push({
                label: "Projects (CY)",
                property: "ProjectsCY",
                type: EdmType.Number,
                scale: 0,
                width: 15
            });

            aCols.push({
                label: "Cost (CY)",
                property: "ProjectCostCY",
                type: EdmType.Number,
                scale: 2,
                width: 20
            });

            aCols.push({
                label: (mHeaders.metricLabel || "Metric") + " (CY)",
                property: "MetricCY",
                type: EdmType.Number,
                scale: 2,
                width: 20
            });

            // 3. PREVIOUS YEAR (PY) - ADDED Cost (PY) HERE
            aCols.push({
                label: "Projects (PY)",
                property: "ProjectsPY",
                type: EdmType.Number,
                scale: 0,
                width: 15
            });

            // --- NEW COLUMN ---
            aCols.push({
                label: "Cost (PY)",
                property: "ProjectCostPY",
                type: EdmType.Number,
                scale: 2,
                width: 20
            });
            // ------------------

            aCols.push({
                label: (mHeaders.metricLabel || "Metric") + " (PY)",
                property: "MetricPY",
                type: EdmType.Number,
                scale: 2,
                width: 20
            });

            // 4. VARIANCE
            aCols.push({
                label: "Var (Projects)",
                property: "ProjectsVar",
                type: EdmType.Number,
                scale: 0,
                width: 15
            });

            aCols.push({
                label: "Var (" + (mHeaders.metricLabel || "Metric") + ")",
                property: "MetricVar",
                type: EdmType.Number,
                scale: 2,
                width: 20
            });

             aCols.push({
                label: "Var %",
                property: "MetricVarPct",
                type: EdmType.Number,
                scale: 2,
                width: 12
            });

            return aCols;
        }
    });
});
