sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "iifcl/cml/cmlmisapp/util/formatter",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format"
], function (Controller, JSONModel, formatter, ChartFormatter, Format) {
    "use strict";

    return Controller.extend("iifcl.cml.cmlmisapp.controller.Main", {
        formatter: formatter,

        onInit: function () {
            // 1. Load Report Config
            var oCfgModel = new JSONModel();
            oCfgModel.loadData("model/reportConfig.json", null, false);
            this._oReportConfig = oCfgModel.getData() || {};

            // 2. Master List Model
            var oReportsModel = new JSONModel({
                reports: [
                    { id: "DEV_GROUP", title: this._oReportConfig.DEV_GROUP?.title || "Developer Group" },
                    { id: "SECTOR_WISE", title: this._oReportConfig.SECTOR_WISE?.title || "Sector Wise" },
                    // Added Geo Report here
                    { id: "GEO_REPORT", title: "Geographical Report" } 
                ]
            });
            this.getView().setModel(oReportsModel, "reports");

            // 3. Main View Model
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
                isGeoReport: false, // Flag for Geo Tab
                rows: []
            });
            this.getView().setModel(oViewModel, "view");

            // 4. Initialize Charts
            this._initCharts();
        },

        _initCharts: function() {
            // --- Standard Bar Chart ---
            var oChart = this.byId("devGroupChart");
            if (oChart) {
                oChart.setVizProperties({
                    plotArea: { dataLabel: { visible: true, formatString: "0" }, colorPalette: ["#0a6ed1"] },
                    valueAxis: { title: { visible: false } },
                    categoryAxis: { title: { visible: false } },
                    title: { visible: true, text: "Metric by Group" }
                });
            }

            // --- Standard Donut Chart ---
            var oShareChart = this.byId("shareChart");
            if (oShareChart) {
                oShareChart.setVizProperties({
                    plotArea: { colorPalette: ["#0a6ed1", "#e78c07", "#2b7c2b", "#d04343"], innerRadius: "60%" },
                    title: { visible: true, text: "Share of Metric" }
                });
            }

            // --- Geo Side Chart (Bar) ---
            var oGeoChart = this.byId("geoVizFrame");
            if (oGeoChart) {
                oGeoChart.setVizProperties({
                    plotArea: { dataLabel: { visible: true, formatString: "0" }, colorPalette: ["#2b7c2b"] },
                    valueAxis: { title: { visible: false } },
                    categoryAxis: { title: { visible: false } },
                    title: { visible: false }
                });
            }
        },

        // ============================================================
        // EVENT HANDLERS
        // ============================================================

        onReportSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var sId = oItem.getBindingContext("reports").getProperty("id");
            this._loadReport(sId);
        },

        onBucketToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            this.getView().getModel("view").setProperty("/selectedBucketKey", sKey);
            
            var sReportId = this.getView().getModel("view").getProperty("/currentReportId");
            if(sReportId) this._loadReport(sReportId);
        },

        onMetricToggle: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            this.getView().getModel("view").setProperty("/selectedMetricKey", sKey);

            var sReportId = this.getView().getModel("view").getProperty("/currentReportId");
            if(sReportId) this._loadReport(sReportId);
        },

        onToggleSidebar: function () {
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/sidebarCollapsed", !oViewModel.getProperty("/sidebarCollapsed"));
        },

        // ============================================================
        // CORE LOGIC
        // ============================================================

        _loadReport: function(sId) {
            var oCfg = this._oReportConfig[sId] || {};
            var oViewModel = this.getView().getModel("view");

            // 1. Set Basics
            oViewModel.setProperty("/currentReportId", sId);
            oViewModel.setProperty("/currentReportTitle", oCfg.title || sId);

            // 2. Handle Column Headers
            this._setColumnHeaders(oCfg, oViewModel);

            // 3. Determine if it is a Geo Report
            // We check the ID or a 'type' property in config
            var bIsGeo = (sId === "GEO_REPORT"); 
            oViewModel.setProperty("/isGeoReport", bIsGeo);

            // 4. Load Data & Labels
            this._applyMeasureLabel(oCfg, oViewModel);
            var aRows = this._loadDummyData(sId, oCfg);

            // 5. Render Geo Map if applicable
            if (bIsGeo) {
                // We wrap this in a timeout to ensure the HTML div is rendered in the DOM
                setTimeout(function() {
                    this._renderGeoMap(aRows);
                }.bind(this), 200);
            }
        },

        _setColumnHeaders: function (oCfg, oViewModel) {
            var oCols = oCfg.columns || {};
            oViewModel.setProperty("/col1Header", oCols.col1Header || "");
            oViewModel.setProperty("/col2Header", oCols.col2Header || "");
            oViewModel.setProperty("/col3Header", oCols.col3Header || "");
            oViewModel.setProperty("/showCol3", !!oCols.col3Header);
        },

        _applyMeasureLabel: function (oCfg, oViewModel) {
            var sMetricKey = oViewModel.getProperty("/selectedMetricKey");
            var sBucketKey = oViewModel.getProperty("/selectedBucketKey");
            var oBucketCfg = oCfg.buckets && oCfg.buckets[sBucketKey];

            // Define Map of Keys to Human Readable Labels
            var mLabels = {
                "gross": "Gross Sanction",
                "disb": "Disbursement",
                "net": "Net Sanction",
                "os": "Principal O/S",
                "cost": "Project Cost"
            };
            
            var sLabelBase = mLabels[sMetricKey] || "Metric";
            var sBucketLabel = oBucketCfg ? oBucketCfg.label : "";
            
            oViewModel.setProperty("/measureLabel", sLabelBase + (sBucketLabel ? " (" + sBucketLabel + ")" : ""));
            oViewModel.setProperty("/activeBucketLabel", sBucketLabel);
            oViewModel.setProperty("/activeMetricLabel", sLabelBase);
        },

        _loadDummyData: function (sReportId, oCfg) {
            var oViewModel = this.getView().getModel("view");
            var aRows = [];

            // 1. Fetch Data from JSON File
            if (oCfg && oCfg.dataFile) {
                var oJson = new JSONModel();
                oJson.loadData(oCfg.dataFile, null, false);
                aRows = oJson.getProperty("/rows") || [];
            }

            // 2. Map Columns dynamically based on Config
            // For Geo Report, we assume col1 is StateName
            var sDimField = oCfg.fields?.col2 || ""; 

            // 3. Map Metrics based on Selection
            if (oCfg.buckets) {
                var sBucket    = oViewModel.getProperty("/selectedBucketKey");
                var sMetric    = oViewModel.getProperty("/selectedMetricKey");
                var oBucketCfg = oCfg.buckets[sBucket];

                if (oBucketCfg) {
                    aRows.forEach(function (r) {
                        r.GenericDim = sDimField ? r[sDimField] : "";
                        r.ProjectsCY = Number(r[oBucketCfg.noProj] || 0);
                        r.ProjectCostCYUI = Number(r[oBucketCfg.projCost] || 0);
                        r.CurrentMetric = Number(r[oBucketCfg[sMetric]] || 0);
                    });
                }
            }

            oViewModel.setProperty("/rows", aRows);

            // 4. Calculate Totals
            var iTotalProjects = 0, fTotalMetric = 0;
            aRows.forEach(function(r){
                iTotalProjects += r.ProjectsCY;
                fTotalMetric += r.CurrentMetric;
            });
            oViewModel.setProperty("/totalProjects", iTotalProjects);
            oViewModel.setProperty("/totalMetric", parseFloat(fTotalMetric.toFixed(2)));

            return aRows;
        },

        // ============================================================
        // GEO MAP LOGIC (The New Part)
        // ============================================================

        _renderGeoMap: function (aRows) {
            var oContainer = document.getElementById("indiaMapContainer");
            if (!oContainer) return;

            // 1. Inject SVG (If not already there)
            if (oContainer.innerHTML.trim() === "") {
                oContainer.innerHTML = this._getIndiaSVG();
            }

            // 2. Aggregate Data by State
            // We map the "StateName" in CSV to the "ID" in the SVG
            var mStateData = {};
            aRows.forEach(function (row) {
                var sState = row.StateName; // Ensure your JSON has "StateName"
                var fVal = row.CurrentMetric;
                
                if (sState) {
                    // Normalize state name (trim, etc)
                    sState = sState.trim();
                    if (!mStateData[sState]) mStateData[sState] = 0;
                    mStateData[sState] += fVal;
                }
            });

            // 3. Find Max Value for Heatmap Calculation
            var fMaxVal = 0;
            Object.keys(mStateData).forEach(function(k) {
                if (mStateData[k] > fMaxVal) fMaxVal = mStateData[k];
            });

            // 4. Color the Map
            var aPaths = oContainer.querySelectorAll("path");
            aPaths.forEach(function (path) {
                var sId = path.getAttribute("id"); // e.g., "Maharashtra"
                var fVal = mStateData[sId] || 0;
                
                // Reset Color
                path.style.fill = "#e0e0e0"; // default grey
                path.style.transition = "fill 0.3s";
                
                if (fVal > 0) {
                    // Calculate opacity based on value vs max
                    var fOpacity = 0.3 + (0.7 * (fVal / fMaxVal)); // Min 0.3 opacity
                    path.style.fill = "rgba(10, 110, 209, " + fOpacity + ")"; // Blue shade
                    
                    // Simple Tooltip logic
                    path.innerHTML = "<title>" + sId + ": " + fVal.toFixed(2) + " Cr</title>";
                }
            });

            // 5. Update Side Chart (Zones)
            this._updateGeoChart(mStateData);
        },

        _updateGeoChart: function(mStateData) {
            // Mapping States to Zones
            var mZones = { "North": 0, "South": 0, "East": 0, "West": 0, "Central": 0 };
            
            var mZoneMap = {
                "Tamil Nadu": "South", "Kerala": "South", "Karnataka": "South", "Andhra Pradesh": "South", "Telangana": "South",
                "Maharashtra": "West", "Gujarat": "West", "Rajasthan": "West", "Goa": "West",
                "West Bengal": "East", "Bihar": "East", "Orissa": "East", "Assam": "East",
                "Delhi": "North", "Punjab": "North", "Haryana": "North", "Uttar Pradesh": "North", "Himachal Pradesh": "North",
                "Madhya Pradesh": "Central", "Chhattisgarh": "Central"
            };

            Object.keys(mStateData).forEach(function(sState){
                var sZone = mZoneMap[sState] || "North"; // Default to North if unknown
                mZones[sZone] += mStateData[sState];
            });

            // Format data for VizFrame
            var aChartData = [];
            Object.keys(mZones).forEach(function(k){
                aChartData.push({ "Zone": k, "Value": mZones[k] });
            });

            // Create a dedicated model for GeoChart
            var oGeoModel = new JSONModel({ items: aChartData });
            var oGeoViz = this.byId("geoVizFrame");
            oGeoViz.setModel(oGeoModel, "geo");
            
            // Set Dataset & Feeds programmatically
            var oDataset = new sap.viz.ui5.data.FlattenedDataset({
                dimensions: [{ name: "Zone", value: "{geo>Zone}" }],
                measures: [{ name: "Value", value: "{geo>Value}" }],
                data: { path: "geo>/items" }
            });
            oGeoViz.setDataset(oDataset);

            var oFeedValue = new sap.viz.ui5.controls.common.feeds.FeedItem({
                "uid": "valueAxis",
                "type": "Measure",
                "values": ["Value"]
            });
            var oFeedCat = new sap.viz.ui5.controls.common.feeds.FeedItem({
                "uid": "categoryAxis",
                "type": "Dimension",
                "values": ["Zone"]
            });
            oGeoViz.removeAllFeeds();
            oGeoViz.addFeed(oFeedValue);
            oGeoViz.addFeed(oFeedCat);
        },

        // Helper to return a simplified SVG of India
        // In production, replace this string with a real SVG file load.
       _getIndiaSVG: function() {
    // Optimized India Map with correct IDs for your Controller logic
    return `
    <svg viewBox="0 0 600 700" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:transparent;">
        <g stroke="#ffffff" stroke-width="1" fill="#e0e0e0">
            
            <path id="Jammu and Kashmir" title="Jammu & Kashmir" d="M192,27 L222,22 L246,40 L273,38 L293,60 L280,82 L250,85 L230,120 L200,115 L180,95 L160,90 L150,60 Z"/>
            
            <path id="Himachal Pradesh" title="Himachal Pradesh" d="M230,120 L250,115 L260,135 L240,150 L220,135 Z"/>
            
            <path id="Punjab" title="Punjab" d="M180,125 L220,135 L210,160 L170,150 Z"/>
            
            <path id="Uttarakhand" title="Uttarakhand" d="M260,135 L300,140 L290,170 L240,150 Z"/>
            
            <path id="Haryana" title="Haryana" d="M210,160 L240,150 L230,190 L200,180 Z"/>
            
            <path id="Delhi" title="Delhi" d="M230,175 L235,175 L235,180 L230,180 Z" fill="#666"/>
            
            <path id="Rajasthan" title="Rajasthan" d="M130,170 L200,180 L230,190 L220,250 L150,280 L110,230 Z"/>
            
            <path id="Uttar Pradesh" title="Uttar Pradesh" d="M230,190 L290,170 L340,180 L350,220 L300,240 L220,250 Z"/>
            
            <path id="Bihar" title="Bihar" d="M350,220 L400,220 L410,250 L360,260 L300,240 Z"/>
            
            <path id="Sikkim" title="Sikkim" d="M400,195 L420,195 L415,215 L400,210 Z"/>
            
            <path id="West Bengal" title="West Bengal" d="M400,195 L415,215 L410,250 L390,300 L360,260 Z"/>
            
            <path id="Assam" title="Assam" d="M420,220 L480,210 L500,240 L450,250 L420,240 Z"/>
            
            <path id="Arunachal Pradesh" title="Arunachal Pradesh" d="M480,180 L550,190 L530,220 L480,210 Z"/>
            
            <path id="Nagaland" title="Nagaland" d="M530,220 L540,240 L520,250 L500,240 Z"/>
            
            <path id="Manipur" title="Manipur" d="M520,250 L515,280 L495,270 L500,240 Z"/>
            
            <path id="Mizoram" title="Mizoram" d="M495,270 L490,300 L470,290 L480,260 Z"/>
            
            <path id="Tripura" title="Tripura" d="M450,250 L460,270 L440,270 L430,250 Z"/>
            
            <path id="Meghalaya" title="Meghalaya" d="M420,240 L450,250 L440,260 L410,250 Z"/>
            
            <path id="Gujarat" title="Gujarat" d="M50,280 L110,230 L150,280 L140,320 L180,330 L160,370 L100,350 L60,300 Z"/>
            
            <path id="Madhya Pradesh" title="Madhya Pradesh" d="M220,250 L300,240 L330,280 L290,330 L220,320 L180,330 L150,280 Z"/>
            
            <path id="Jharkhand" title="Jharkhand" d="M300,240 L360,260 L350,300 L300,290 L290,330 L330,280 Z"/>
            
            <path id="Chhattisgarh" title="Chhattisgarh" d="M290,330 L350,300 L360,350 L320,400 L280,360 Z"/>
            
            <path id="Odisha" title="Odisha" d="M350,300 L390,300 L370,380 L320,400 L360,350 Z"/>
            
            <path id="Maharashtra" title="Maharashtra" d="M100,350 L160,370 L180,330 L220,320 L280,360 L250,420 L150,430 L100,350 Z"/>
            
            <path id="Goa" title="Goa" d="M150,430 L160,430 L160,440 L150,440 Z" fill="#666"/>
            
            <path id="Telangana" title="Telangana" d="M250,420 L280,360 L320,400 L300,450 L230,440 Z"/>
            
            <path id="Andhra Pradesh" title="Andhra Pradesh" d="M320,400 L370,380 L340,480 L290,500 L270,470 L300,450 Z"/>
            
            <path id="Karnataka" title="Karnataka" d="M160,440 L230,440 L250,420 L270,470 L240,530 L180,520 Z"/>
            
            <path id="Kerala" title="Kerala" d="M180,520 L210,550 L230,620 L200,600 Z"/>
            
            <path id="Tamil Nadu" title="Tamil Nadu" d="M240,530 L270,470 L290,500 L300,550 L230,620 L210,550 Z"/>
            
        </g>
    </svg>`;
},
    });
});