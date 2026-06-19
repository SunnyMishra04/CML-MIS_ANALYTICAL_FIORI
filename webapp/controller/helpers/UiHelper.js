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
            sanctCY: 0, sanctPY: 0,
            disbCY: 0,  disbPY: 0,
            netCY: 0,   netPY: 0,
            osCY: 0,    osPY: 0
        };

        var CRORE = 10000000;

        aRows.forEach(function (r) {
            totals.sanctCY += r.GrossSanctionCY || 0;
            totals.sanctPY += r.GrossSanctionPY || 0;
            totals.disbCY  += r.DisbursementCY  || 0;
            totals.disbPY  += r.DisbursementPY  || 0;
            totals.netCY   += r.PrincipalOsCY || 0; // Using PrincipalOs for Net
            totals.netPY   += r.PrincipalOsPY || 0;
            totals.osCY    += r.OutstandingBalanceCY || r.PrincipalOsCY || 0; // Fallback
            totals.osPY    += r.OutstandingBalancePY || r.PrincipalOsPY || 0;
        });

        function buildCard(title, cy, py) {
            var valCY = Math.abs(cy) > 1000000 ? cy / CRORE : cy;
            var valPY = Math.abs(py) > 1000000 ? py / CRORE : py;
            
            var delta = valCY - valPY;
            // delta % = (CY - PY) / PY * 100
            var pct = valPY !== 0 ? (delta / Math.abs(valPY)) * 100 : 0;
            
            var bUp = delta >= 0;
            var sDeltaText = (bUp ? "+" : "") + delta.toFixed(2) + " Cr (" + (bUp ? "+" : "") + pct.toFixed(1) + "%)";

            return {
                title: title,
                value: valCY.toFixed(2),
                pyValue: valPY.toFixed(2),
                unit: "Cr",
                deltaText: sDeltaText,
                isUp: bUp,
                showCompare: bCompare
            };
        }

        return [
            buildCard("Gross Sanction", totals.sanctCY, totals.sanctPY),
            buildCard("Total Disbursement", totals.disbCY, totals.disbPY),
            buildCard("Net Principal O/S", totals.netCY, totals.netPY),
            buildCard("Outstanding Balance", totals.osCY, totals.osPY)
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
            var oViewModel = this.getView().getModel("view");
            if (!oViewModel) return;
            var bCompare = oViewModel.getProperty("/comparisonMode") === true;
            
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
                var sInd = kpi.showCompare ? (kpi.isUp ? MLib.DeviationIndicator.Up : MLib.DeviationIndicator.Down) : MLib.DeviationIndicator.None;
                var sColor = kpi.showCompare ? (kpi.isUp ? MLib.ValueColor.Good : MLib.ValueColor.Critical) : MLib.ValueColor.Neutral;
                var sFooter = kpi.showCompare ? kpi.deltaText : "";
                var sSubheader = kpi.showCompare ? ("PY: " + kpi.pyValue + " " + kpi.unit) : "";

                var oTile = new GenericTile({
                    header:    kpi.title,
                    subheader: sSubheader,
                    frameType: "TwoByOne",
                    tileContent: [
                        new TileContent({
                            unit:   kpi.unit,
                            footer: sFooter,
                            content: new NumericContent({
                                value:          kpi.value,
                                scale:          "Cr",
                                truncateValueTo: 6,
                                indicator:      sInd,
                                valueColor:     sColor,
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
