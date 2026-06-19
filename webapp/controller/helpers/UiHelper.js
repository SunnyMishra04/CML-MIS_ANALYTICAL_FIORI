/**
 * UiHelper.js  —  Step 2 · Fragment-level UI orchestration
 *
 * Responsibilities:
 *   1. KPI strip rendering  (_renderKpiStrip)       → reads current dataset, computes 5 KPIs
 *   2. Scheme chip filter   (_applySchemeFilter)    → client-side filter on Scheme field
 *   3. Contract detail      (openContractDetail)    → sets contractDetail model + opens dialog
 *   4. Insight strip        (_buildInsights)        → up to 3 auto-generated callouts
 *   5. Formatters           (fmt.*)                 → crore display, state colours
 *
 * All methods are designed to be mixed into the Main controller via:
 *   Object.assign(oController, UiHelper);
 */
sap.ui.define([
    "sap/m/GenericTile",
    "sap/m/TileContent",
    "sap/m/NumericContent",
    "sap/m/library",
    "sap/ui/model/json/JSONModel"
], function (GenericTile, TileContent, NumericContent, MLib, JSONModel) {
    "use strict";

    /* ─── Constants ────────────────────────────────────────────────────── */
    var LAKH   = 1e5;
    var CRORE  = 1e7;

    /* ─── Helper: raw → ₹ Crore string ─────────────────────────────────── */
    function _toCr(raw) {
        if (!raw || isNaN(raw)) { return "0.00"; }
        // devGroup.json stores PrincipalOsCY in raw paisa-level units
        // Disbursement/GrossSanction are already in ₹ Cr
        // We detect unit by magnitude: if abs > 1,000,000 assume raw paisa units
        var abs = Math.abs(raw);
        var crVal = abs > 1000000 ? raw / CRORE : raw;
        return crVal.toFixed(2);
    }

    /* ─── Formatter namespace (attached to controller as this.fmt) ───────── */
    var fmt = {

        /** Display raw amount as ₹ Cr with 2dp */
        crore: function (raw) {
            return _toCr(raw);
        },

        /** Positive value → Good state, 0 → None */
        positiveState: function (val) {
            return val > 0 ? "Good" : "None";
        },

        /** Positive variance → Success, negative → Error, zero → None */
        varState: function (val) {
            if (!val || val === 0) { return "None"; }
            return val > 0 ? "Success" : "Error";
        }
    };

    /* ─── KPI computation from dataset rows ─────────────────────────────── */
    function _computeKpis(aRows, bCompare) {
        var totals = {
            disbCY: 0, disbPY: 0,
            sanctCY: 0, sanctPY: 0,
            posCY: 0,  posPY: 0,
            projCY: 0, projPY: 0,
            costCY: 0
        };

        aRows.forEach(function (r) {
            totals.disbCY  += r.DisbursementCY  || 0;
            totals.disbPY  += r.DisbursementPY  || 0;
            totals.sanctCY += r.GrossSanctionCY || 0;
            totals.sanctPY += r.GrossSanctionPY || 0;
            // PrincipalOs might be raw units — normalise
            var posCY = r.PrincipalOsCY || 0;
            var posPY = r.PrincipalOsPY || 0;
            totals.posCY  += Math.abs(posCY) > 1000000 ? posCY / CRORE : posCY;
            totals.posPY  += Math.abs(posPY) > 1000000 ? posPY / CRORE : posPY;
            totals.projCY += r.ProjectsCY || 0;
            totals.projPY += r.ProjectsPY || 0;
            totals.costCY += r.ProjectCostCY || 0;
        });

        var disbVar  = totals.disbCY  - totals.disbPY;
        var posVar   = totals.posCY   - totals.posPY;
        var projVar  = totals.projCY  - totals.projPY;
        var sanctVar = totals.sanctCY - totals.sanctPY;

        return [
            {
                title: "Total Disbursement",
                value: totals.disbCY.toFixed(2),
                unit: "₹ Cr",
                footer: bCompare ? ("PY: " + totals.disbPY.toFixed(2) + " | " + disbVar.toFixed(2)) : "CY",
                indicator: bCompare ? (disbVar > 0 ? MLib.DeviationIndicator.Up : (disbVar < 0 ? MLib.DeviationIndicator.Down : MLib.DeviationIndicator.None)) : MLib.DeviationIndicator.None,
                valueColor: bCompare ? (disbVar > 0 ? MLib.ValueColor.Good : (disbVar < 0 ? MLib.ValueColor.Critical : MLib.ValueColor.Neutral)) : MLib.ValueColor.Neutral,
                icon: "sap-icon://money-bills",
                frameType: bCompare ? "TwoByOne" : "OneByOne"
            },
            {
                title: "Gross Sanction",
                value: totals.sanctCY.toFixed(2),
                unit: "₹ Cr",
                footer: bCompare ? ("PY: " + totals.sanctPY.toFixed(2) + " | " + sanctVar.toFixed(2)) : "CY",
                indicator: bCompare ? (sanctVar > 0 ? MLib.DeviationIndicator.Up : (sanctVar < 0 ? MLib.DeviationIndicator.Down : MLib.DeviationIndicator.None)) : MLib.DeviationIndicator.None,
                valueColor: bCompare ? (sanctVar > 0 ? MLib.ValueColor.Good : (sanctVar < 0 ? MLib.ValueColor.Critical : MLib.ValueColor.Neutral)) : MLib.ValueColor.Neutral,
                icon: "sap-icon://approvals",
                frameType: bCompare ? "TwoByOne" : "OneByOne"
            },
            {
                title: "Net Principal O/S",
                value: totals.posCY.toFixed(2),
                unit: "₹ Cr",
                footer: bCompare ? ("PY: " + totals.posPY.toFixed(2) + " | " + posVar.toFixed(2)) : "CY",
                indicator: bCompare ? (posVar > 0 ? MLib.DeviationIndicator.Up : (posVar < 0 ? MLib.DeviationIndicator.Down : MLib.DeviationIndicator.None)) : MLib.DeviationIndicator.None,
                valueColor: bCompare ? (posVar > 0 ? MLib.ValueColor.Good : (posVar < 0 ? MLib.ValueColor.Critical : MLib.ValueColor.Neutral)) : MLib.ValueColor.Neutral,
                icon: "sap-icon://account",
                frameType: bCompare ? "TwoByOne" : "OneByOne"
            },
            {
                title: "Active Projects",
                value: totals.projCY.toString(),
                unit: "projects",
                footer: bCompare ? ("PY: " + totals.projPY.toString() + " | " + projVar.toString()) : "CY",
                indicator: bCompare ? (projVar > 0 ? MLib.DeviationIndicator.Up : (projVar < 0 ? MLib.DeviationIndicator.Down : MLib.DeviationIndicator.None)) : MLib.DeviationIndicator.None,
                valueColor: bCompare ? (projVar > 0 ? MLib.ValueColor.Good : (projVar < 0 ? MLib.ValueColor.Critical : MLib.ValueColor.Neutral)) : MLib.ValueColor.Neutral,
                icon: "sap-icon://portfolio",
                frameType: bCompare ? "TwoByOne" : "OneByOne"
            },
            {
                title: "Project Cost CY",
                value: totals.costCY.toFixed(2),
                unit: "₹ Cr",
                footer: "CY",
                indicator: MLib.DeviationIndicator.None,
                valueColor: MLib.ValueColor.Neutral,
                icon: "sap-icon://paid-leave",
                frameType: "OneByOne"
            }
        ];
    }

    /* ─── Insight computation ────────────────────────────────────────────── */
    function _buildInsights(aRows) {
        var insights = [];

        if (!aRows || !aRows.length) {
            insights.push({ text: "No data available for the current filter selection.", type: "Warning" });
            return insights;
        }

        // 1. Zero-disbursement rows
        var zeroDisbCY = aRows.filter(function (r) { return r.DisbursementCY === 0 && r.DisbursementPY > 0; });
        if (zeroDisbCY.length > 0) {
            insights.push({
                text: zeroDisbCY.length + " borrower group(s) had disbursements in PY but show ₹0 in CY — "
                    + "review for completed or restructured accounts.",
                type: "Warning"
            });
        }

        // 2. Large positive PrincipalOs anomalies (raw > 100000 Cr equivalent)
        var anomalies = aRows.filter(function (r) {
            return Math.abs(r.PrincipalOsCY) > 1e11;
        });
        if (anomalies.length > 0) {
            insights.push({
                text: anomalies.length + " row(s) have unusually high Principal O/S values in CY (possible data quality issue — raw units may need normalisation).",
                type: "Error"
            });
        }

        // 3. Positive disbursement growth
        var disbGrowthRows = aRows.filter(function (r) {
            return r.DisbursementVar > 100;
        });
        if (disbGrowthRows.length > 0) {
            insights.push({
                text: disbGrowthRows.length + " group(s) show disbursement growth >₹100 Cr vs PY — strong CY pipeline activity.",
                type: "Success"
            });
        }

        // 4. Full year drop (projects CY=0 but PY>0)
        var fullDrop = aRows.filter(function (r) {
            return r.ProjectsCY === 0 && r.ProjectsPY > 3;
        });
        if (fullDrop.length > 0) {
            insights.push({
                text: fullDrop.length + " group(s) lost all projects vs PY (≥3 in PY, 0 in CY) — check for exits or write-offs.",
                type: "Warning"
            });
        }

        return insights.slice(0, 3);
    }

    /* ─── Public API ─────────────────────────────────────────────────────── */
    return {

        /** Attach formatter namespace to controller */
        attachFormatters: function () {
            this.fmt = fmt;
        },

        /**
         * Build and push KPI + insight data to viewModel.
         * Call after every getData() resolution.
         * @param {Array} aRows - normalised data rows
         */
        refreshUiMetrics: function (aRows) {
            var oViewModel = this.getView().getModel("viewModel");
            var bCompare = oViewModel.getProperty("/comparisonMode") || false;
            var kpis     = _computeKpis(aRows || [], bCompare);
            var insights = _buildInsights(aRows || []);
            oViewModel.setProperty("/kpis",     kpis);
            oViewModel.setProperty("/insights", insights);
            oViewModel.setProperty("/filteredRowCount", (aRows || []).length);
        },

        /**
         * Programmatically build GenericTile KPI cards and
         * inject into the FlexBox inside KpiStrip fragment.
         * Called once fragment is loaded and data is ready.
         * @param {sap.m.FlexBox} oFlexBox - the kpiFlexBox container
         * @param {Array}         aKpis    - from viewModel>/kpis
         */
        renderKpiTiles: function (oFlexBox, aKpis) {
            if (!oFlexBox) { return; }
            oFlexBox.destroyItems();

            aKpis.forEach(function (kpi) {
                var oTile = new GenericTile({
                    header:    kpi.title,
                    frameType: kpi.frameType || "OneByOne",
                    layoutData: new sap.m.FlexItemData({ growFactor: 1 }),
                    press:     function () { /* future: drill-down */ },
                    tileContent: [
                        new TileContent({
                            unit:   kpi.unit,
                            footer: kpi.footer,
                            content: new NumericContent({
                                value:          kpi.value,
                                scale:          kpi.title === "Active Projects" ? "" : "Cr",
                                indicator:      kpi.indicator,
                                valueColor:     kpi.valueColor,
                                withMargin:     false,
                                adaptiveFontSize: true
                            })
                        })
                    ]
                });
                var sClassName = "cmlKpiTile";
                if (sClassName) {
                    sClassName.split(" ").filter(Boolean).forEach(function(c) {
                        oTile.addStyleClass(c);
                    });
                }
                oFlexBox.addItem(oTile);
            });
        },

        /**
         * Apply Scheme filter on a flat data array.
         * @param {Array}  aRows      - full dataset
         * @param {string} sSchemeKey - "ALL"|"DL"|"TOF"|"OTH"
         * @returns {Array} filtered rows
         */
        applySchemeFilter: function (aRows, sSchemeKey) {
            if (!sSchemeKey || sSchemeKey === "ALL") { return aRows; }
            var map = {
                "DL":  "Direct Lending",
                "TOF": "Take Out Finance",
                "OTH": "Others"
            };
            var target = map[sSchemeKey];
            return aRows.filter(function (r) { return r.Scheme === target; });
        },

        /**
         * Open the ContractDetailDialog for a clicked row.
         * @param {object} oRow - data row from table selection
         */
        openContractDetail: function (oRow) {
            var oView = this.getView();

            // Lazy-load fragment
            if (!this._contractDetailDialog) {
                this._contractDetailDialog = sap.ui.xmlfragment(
                    oView.getId(),
                    "iifcl.cml.cmlmisapp.view.fragments.ContractDetailDialog",
                    this
                );
                oView.addDependent(this._contractDetailDialog);
            }

            // Bind a fresh JSONModel for each open
            var oModel = new JSONModel(Object.assign({}, oRow));
            this._contractDetailDialog.setModel(oModel, "contractDetail");
            this._contractDetailDialog.open();
        },

        /** Close contract detail dialog */
        onCloseContractDetail: function () {
            if (this._contractDetailDialog) {
                this._contractDetailDialog.close();
            }
        },

        /**
         * Export the single highlighted row as a one-line CSV download.
         * Triggered from the dialog Export Row button.
         */
        onExportContractRow: function () {
            var oModel = this._contractDetailDialog.getModel("contractDetail");
            if (!oModel) { return; }
            var oRow = oModel.getData();
            var fields = [
                "Scheme", "BorrowerGroup", "BorrowerGroupName",
                "ProjectsCY", "DisbursementCY", "GrossSanctionCY", "NetSanctionCY", "PrincipalOsCY",
                "ProjectsPY", "DisbursementPY", "GrossSanctionPY", "NetSanctionPY", "PrincipalOsPY",
                "DisbursementVar", "DisbursementVarPct", "ProjectsVar", "ProjectsVarPct"
            ];
            var header = fields.join(",");
            var line   = fields.map(function (f) {
                var v = oRow[f];
                return (typeof v === "string" && v.includes(",")) ? ('"' + v + '"') : (v !== undefined ? v : "");
            }).join(",");
            var csv  = header + "\n" + line;
            var blob = new Blob([csv], { type: "text/csv" });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement("a");
            a.href     = url;
            a.download = (oRow.BorrowerGroupName || "row").replace(/[^a-zA-Z0-9]/g, "_") + "_detail.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        /** Dismiss one insight strip item (remove from array by index) */
        onDismissInsight: function (oEvent) {
            var oViewModel = this.getView().getModel("viewModel");
            var aInsights  = oViewModel.getProperty("/insights") || [];
            // find which MessageStrip fired
            var sId = oEvent.getSource().getId();
            var idx = parseInt(sId.slice(-1), 10);
            if (!isNaN(idx)) {
                aInsights.splice(idx, 1);
                oViewModel.setProperty("/insights", aInsights.slice());
            }
        }
    };
});
