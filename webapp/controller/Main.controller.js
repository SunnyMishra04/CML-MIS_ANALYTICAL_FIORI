sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "iifcl/cml/cmlmisapp/util/formatter"
], function (Controller, JSONModel,formatter) {
    "use strict";

    return Controller.extend("iifcl.cml.cmlmisapp.controller.Main", {
formatter: formatter,
        onInit: function () {
            // load report config
            var oCfgModel = new JSONModel();
            oCfgModel.loadData("model/reportConfig.json", null, false);
            this._oReportConfig = oCfgModel.getData() || {};

            // master list
            var oReportsModel = new JSONModel({
                reports: [
                    { id: "DEV_GROUP", title: this._oReportConfig.DEV_GROUP?.title || "Developer Group" },
                    { id: "SECTOR_WISE", title: this._oReportConfig.SECTOR_WISE?.title || "Sector Wise" }
                ]
            });
            this.getView().setModel(oReportsModel, "reports");

            // view model
            var oViewModel = new JSONModel({
    currentReportId: "",
    currentReportTitle: "Select a report",
    measureLabel: "",
    totalProjects: 0,
    totalMetric: 0,
    sidebarCollapsed: false,
    selectedBucketKey: "CY",
    selectedMetricKey: "gross",
    activeBucketLabel: "",
    activeMetricLabel: "",
    col1Header: "",
    col2Header: "",
    col3Header: "",
    showCol3: true,
    rows: []
});

            this.getView().setModel(oViewModel, "view");

            // initial chart properties (unchanged)
            var oChart = this.byId("devGroupChart");
            if (oChart) {
                oChart.setVizProperties({
                    plotArea: {
                        dataLabel: { visible: true, formatString: "0" },
                        colorPalette: ["#0a6ed1"]
                    },
                    valueAxis: {
                        label: { formatString: "0" },
                        title: { text: "" }
                    },
                    categoryAxis: {
                        title: { text: "" }
                    },
                    legend: { visible: false },
                    title: { visible: true, text: "Metric by Group / Sector" }
                });
            }

            var oShareChart = this.byId("shareChart");
            if (oShareChart) {
                oShareChart.setVizProperties({
                    plotArea: {
                        colorPalette: ["#0a6ed1", "#e78c07", "#2b7c2b", "#d04343"],
                        innerRadius: "60%",
                        dataLabel: {
                            visible: true,
                            formatString: "0.0'%'"
                        }
                    },
                    legend: { visible: true },
                    title: { visible: true, text: "Share of Metric" }
                });
            }
        },


        _setColumnHeaders: function (oCfg, oViewModel) {
    var oCols = oCfg.columns || {};
    var sCol3Header = oCols.col3Header || "";

    oViewModel.setProperty("/col1Header", oCols.col1Header || "");
    oViewModel.setProperty("/col2Header", oCols.col2Header || "");
    oViewModel.setProperty("/col3Header", sCol3Header);
    oViewModel.setProperty("/showCol3", !!sCol3Header); // hide when empty
}

,
        onReportSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var sId = oItem.getBindingContext("reports").getProperty("id");

            var oCfg = this._oReportConfig[sId] || {};
            var oViewModel = this.getView().getModel("view");

            oViewModel.setProperty("/currentReportId", sId);
            oViewModel.setProperty("/currentReportTitle", oCfg.title || sId);
            oViewModel.setProperty("/selectedBucketKey", "CY");
            oViewModel.setProperty("/selectedMetricKey", "gross");
            this._applyMeasureLabel(oCfg, oViewModel);
            this._loadDummyData(sId, oCfg);

            var sLabel = oViewModel.getProperty("/measureLabel") || "Metric";

            var oChart = this.byId("devGroupChart");
            if (oChart) {
                oChart.setVizProperties({
                    title: {
                        visible: true,
                        text: (oCfg.title || sId) + " - " + sLabel + " by Group"
                    }
                });
            }

            var oShareChart = this.byId("shareChart");
            if (oShareChart) {
                oShareChart.setVizProperties({
                    title: { visible: true, text: "Share of " + sLabel }
                });
            }
        },

        onBucketToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/selectedBucketKey", sKey);

            var sId = oViewModel.getProperty("/currentReportId");
            if (!sId) {
                return;
            }
            var oCfg = this._oReportConfig[sId] || {};

            this._applyMeasureLabel(oCfg, oViewModel);
            this._loadDummyData(sId, oCfg);

            var sLabel = oViewModel.getProperty("/measureLabel") || "Metric";

            var oChart = this.byId("devGroupChart");
            if (oChart) {
                oChart.setVizProperties({
                    title: {
                        visible: true,
                        text: (oCfg.title || sId) + " - " + sLabel + " by Group"
                    }
                });
            }
            var oShareChart = this.byId("shareChart");
            if (oShareChart) {
                oShareChart.setVizProperties({
                    title: { visible: true, text: "Share of " + sLabel }
                });
            }
        },

        onMetricToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/selectedMetricKey", sKey);

            var sId = oViewModel.getProperty("/currentReportId");
            if (!sId) {
                return;
            }
            var oCfg = this._oReportConfig[sId] || {};

            this._applyMeasureLabel(oCfg, oViewModel);
            this._loadDummyData(sId, oCfg);

            var sLabel = oViewModel.getProperty("/measureLabel") || "Metric";

            var oChart = this.byId("devGroupChart");
            if (oChart) {
                oChart.setVizProperties({
                    title: {
                        visible: true,
                        text: (oCfg.title || sId) + " - " + sLabel + " by Group"
                    }
                });
            }
            var oShareChart = this.byId("shareChart");
            if (oShareChart) {
                oShareChart.setVizProperties({
                    title: { visible: true, text: "Share of " + sLabel }
                });
            }
        },

        onToggleSidebar: function () {
            var oViewModel = this.getView().getModel("view");
            var bCollapsed = oViewModel.getProperty("/sidebarCollapsed");
            oViewModel.setProperty("/sidebarCollapsed", !bCollapsed);
        },

        _applyMeasureLabel: function (oCfg, oViewModel) {
            var sMetricKey = oViewModel.getProperty("/selectedMetricKey");
            var sBucketKey = oViewModel.getProperty("/selectedBucketKey");
            var oBucketCfg = oCfg.buckets && oCfg.buckets[sBucketKey];

            var sLabelBase;
            if (sMetricKey === "gross") {
                sLabelBase = "Gross Sanction";
            } else if (sMetricKey === "disb") {
                sLabelBase = "Disbursement";
            } else if (sMetricKey === "net") {
                sLabelBase = "Net Sanction";
            } else if (sMetricKey === "os") {
                sLabelBase = "Principal O/S";
            } else if (sMetricKey === "cost") {
                sLabelBase = "Project Cost";
            } else {
                sLabelBase = "Metric";
            }

            var sBucketLabel = oBucketCfg ? oBucketCfg.label : "";
            var sMeasureLabel = sBucketLabel
                ? sLabelBase + " (" + sBucketLabel + ")"
                : sLabelBase;

            oViewModel.setProperty("/measureLabel", sMeasureLabel);
            oViewModel.setProperty("/activeBucketLabel", sBucketLabel);
            oViewModel.setProperty("/activeMetricLabel", sLabelBase);
        
        this._setColumnHeaders(oCfg, oViewModel);

        },

 _loadDummyData: function (sReportId, oCfg) {
    var oViewModel = this.getView().getModel("view");
    var aRows = [];

    if (oCfg && oCfg.dataFile) {
        var oJson = new JSONModel();
        oJson.loadData(oCfg.dataFile, null, false);
        aRows = oJson.getProperty("/rows") || [];
    }

    // set GenericDim for charts
    var oFields = oCfg.fields || {};
    var sDimField = oFields.col2 || "";   // use second column (group / sub-sector)

    aRows.forEach(function (r) {
        if (sDimField && r[sDimField] !== undefined) {
            r.GenericDim = r[sDimField];
        }
    });

    if (oCfg.buckets) {
        var sBucket    = oViewModel.getProperty("/selectedBucketKey");
        var sMetric    = oViewModel.getProperty("/selectedMetricKey");
        var oBucketCfg = oCfg.buckets[sBucket];

        if (oBucketCfg) {
            var sNoProjField   = oBucketCfg.noProj;
            var sProjCostField = oBucketCfg.projCost;
            var sMeasureField  = oBucketCfg[sMetric];

            aRows.forEach(function (r) {
                r.ProjectsCY      = Number(r[sNoProjField]   || 0);
                r.ProjectCostCYUI = Number(r[sProjCostField] || 0);
                r.CurrentMetric   = Number(r[sMeasureField]  || 0);
            });
        }
    }

    oViewModel.setProperty("/rows", aRows);

    var iTotalProjects = 0;
    var fTotalMetric   = 0;
    aRows.forEach(function (r) {
        iTotalProjects += Number(r.ProjectsCY    || 0);
        fTotalMetric   += Number(r.CurrentMetric || 0);
    });
    oViewModel.setProperty("/totalProjects", iTotalProjects);
    oViewModel.setProperty("/totalMetric", parseFloat(fTotalMetric.toFixed(2)));

    var fTotal = fTotalMetric || 1;
    aRows.forEach(function (r) {
        var val = Number(r.CurrentMetric || 0);
        r.MetricSharePct = (val * 100 / fTotal).toFixed(2);
    });
}



    });
});
