# CML MIS Analytical Fiori — Antigravity Agent Context

> **Paste this entire file at the start of every Antigravity session.**
> This is the single source of truth for all agents working on this project.

---

## 1. Project Identity

| Field              | Value                                                                 |
|--------------------|-----------------------------------------------------------------------|
| App ID             | `iifcl.cml.cmlmisapp`                                                |
| App Name           | CML MIS Analytical Workbench                                          |
| Organisation       | IIFCL (India Infrastructure Finance Company Ltd)                      |
| Domain             | SAP FS-CML — Credit Management & Lending, MIS Reporting              |
| GitHub Repo        | https://github.com/SunnyMishra04/CML-MIS_ANALYTICAL_FIORI             |
| Active Branch      | `feature/service-abstraction-layer`                                   |
| Base Branch        | `main` / `20d114d6` (last stable commit)                             |
| SAP BAS Workspace  | Clone repo → BAS → run `npm install` → `fiori run`                   |
| BTP Target         | SAP BTP Cloud Foundry (Fiori Launchpad deployment)                    |
| OData Service URI  | `/sap/opu/odata/sap/ZCML_MIS_ANALYTICS_SRV/`  (OData v2)            |
| ABAP Backend       | CDS Views exist; OData annotations + service binding **in progress** |

---

## 2. Technology Stack

```
UI Layer        : SAPUI5 1.143.2+  (minUI5Version in manifest)
View Type       : XML Views (never JS views)
Controller Style: AMD — sap.ui.define([...], function(...){}) ONLY
Model Types     : sap.ui.model.json.JSONModel (dev/mock)
                  sap.ui.model.odata.v2.ODataModel (live — not yet wired)
Charts          : sap.viz (VizFrame + FlattenedDataset)
Export          : sap.ui.export (Spreadsheet)
Layout Libs     : sap.m, sap.f, sap.ui.layout, sap.ui.layout.form
Theme           : SAP Horizon (sap_horizon)
i18n            : webapp/i18n/i18n.properties  (key={{appTitle}} etc.)
CSS             : webapp/css/style.css  (custom overrides only)
```

### Hard Rules — Stack Compliance
- **Never** use jQuery (`$`, `jQuery.ajax`, etc.) — use `fetch()` or OData model APIs
- **Never** use ES6 `import/export` — always `sap.ui.define` + `sap.ui.require`
- **Never** use arrow functions at module top level — SAP transpiler issues
- **Never** hardcode `/sap/opu/odata` URLs in controllers — always via `manifest.json` dataSources
- **Always** use `sap.m` controls, not raw HTML, for UI elements
- **Always** wrap formatter functions in `sap.ui.define` module — never inline in XML
- **Always** use `{i18n>keyName}` binding for all user-facing strings
- **Always** add `core:require` or `xmlns` declarations before using a new library in XML

---

## 3. Project File Structure

```
CML-MIS_ANALYTICAL_FIORI/
├── webapp/
│   ├── manifest.json                    ← App descriptor, routes, models, dataSources
│   ├── index.html                       ← Entry point (do not modify for new features)
│   ├── Component.js                     ← App component init
│   │
│   ├── controller/
│   │   ├── App.controller.js            ← Shell/app-level controller (minimal)
│   │   ├── Main.controller.js           ← PRIMARY controller (~216KB, monolithic)
│   │   └── helpers/
│   │       └── UiHelper.js              ← Step 2: KPI, scheme filter, dialog, insights
│   │
│   ├── view/
│   │   ├── App.view.xml                 ← App shell (NavContainer)
│   │   ├── Main.view.xml                ← PRIMARY view — all report UI lives here
│   │   └── fragments/
│   │       ├── KpiStrip.fragment.xml          ← 5-KPI GenericTile horizontal strip
│   │       ├── SchemeTabHeader.fragment.xml   ← Scheme SegmentedButton + record count
│   │       ├── ContractDetailDialog.fragment.xml ← Row drill-down dialog (4 sections)
│   │       └── InsightStrip.fragment.xml      ← Auto-generated insight MessageStrips
│   │
│   ├── model/
│   │   ├── devGroup.json               ← PRIMARY mock dataset (borrower group level)
│   │   └── [other report JSON files]   ← One JSON per report type
│   │
│   ├── util/                           ← Utility modules (formatter.js etc.)
│   ├── css/
│   │   └── style.css                   ← Custom CSS (SAP Horizon overrides)
│   ├── i18n/
│   │   └── i18n.properties             ← All UI strings
│   └── test/                           ← QUnit + OPA5 test stubs
│
├── .antigravity/
│   └── context.md                      ← THIS FILE
├── package.json
├── ui5.yaml                            ← UI5 tooling config
└── xs-app.json                         ← BTP routing config
```

---

## 4. Data Model — Current Mock Schema

### Primary Dataset: `devGroup.json`
Path: `webapp/model/devGroup.json`
Root key: `rows` (array)

Each record represents one **Borrower Group × Scheme** combination:

```json
{
  "Scheme":             "Direct Lending",
  "BorrowerGroup":      100,
  "BorrowerGroupName":  "Sadbhav Engineering",
  "ProjectsCY":         5,
  "ProjectCostCY":      0.0,
  "DisbursementCY":     0.0,
  "GrossSanctionCY":    0.0,
  "NetSanctionCY":      0.0,
  "PrincipalOsCY":      33230224456.7,
  "ProjectsPY":         7,
  "ProjectCostPY":      0.0,
  "DisbursementPY":     62.10071605,
  "GrossSanctionPY":    0.0,
  "NetSanctionPY":      0.0,
  "PrincipalOsPY":      353.884844611,
  "ProjectsVar":        -7,
  "DisbursementVar":    -62.1,
  "GrossSanctionVar":   0.0,
  "ProjectsVarPct":     -100.0,
  "DisbursementVarPct": -100.0,
  "GrossSanctionVarPct":0
}
```

### ⚠️ Critical Data Quirk — PrincipalOs Unit Inconsistency
`PrincipalOsCY` is stored in **raw paise/sub-unit** for some rows (e.g. `33230224456.7`),
while other financial fields are in **₹ Crore**. `UiHelper.js` auto-detects this:
if `Math.abs(value) > 1,000,000` → divide by `1e7` to get ₹ Cr.
**All new code must use this same normalisation logic.**

### Schemes in Dataset
| Key  | Display Name      | Segment Key |
|------|-------------------|-------------|
| DL   | Direct Lending    | `DL`        |
| TOF  | Take Out Finance  | `TOF`       |
| OTH  | Others            | `OTH`       |
| ALL  | All Schemes       | `ALL`       |

---

## 5. ViewModel Schema

The `viewModel` (JSONModel) is the central UI state store. All fragments bind to it.
When adding new UI state, **always extend this schema** rather than creating ad-hoc models.

```json
{
  "pageTitle":        "CML MIS Workbench",
  "activeReport":     "portfolioOverview",
  "activeScheme":     "ALL",
  "activeMetric":     "Disbursement",
  "activeTenure":     "Yearly",
  "compareCYvsPY":    false,
  "filteredRowCount": 0,

  "kpis": [
    {
      "title":      "Total Disbursement",
      "value":      "1234.56",
      "unit":       "₹ Cr",
      "footer":     "CY",
      "delta":      "-62.10",
      "deltaState": "Critical",
      "indicator":  "Down",
      "valueColor": "Critical",
      "icon":       "sap-icon://money-bills"
    }
  ],

  "insights": [
    { "text": "8 groups had ₹0 disbursement in CY vs PY", "type": "Warning" }
  ],

  "schemeFilter": {
    "ALL": true, "DL": false, "TOF": false, "OTH": false
  },

  "filterBar": {
    "borrowerGroup":  [],
    "borrowerName":   [],
    "scheme":         [],
    "dateFrom":       null,
    "dateTo":         null,
    "searchQuery":    ""
  },

  "sidebarCollapsed": false,
  "currentTab":        "dataTable"
}
```

---

## 6. OData Service Contract (Future Live Integration)

### Service Name
`ZCML_MIS_ANALYTICS_SRV` (OData v2)

### Entity Sets to Be Created in ABAP

| Entity Set               | CDS Consumption View      | Maps to JSON             | Key Fields                        |
|--------------------------|---------------------------|--------------------------|-----------------------------------|
| `DevGroupSet`            | `ZC_CML_DEV_GROUP`        | `devGroup.json`          | Scheme, BorrowerGroup             |
| `DisbursementSet`        | `ZC_CML_DISBURSEMENT`     | *(planned)*              | Scheme, BorrowerGroup, FiscalYear |
| `SanctionSet`            | `ZC_CML_SANCTION`         | *(planned)*              | ContractID, FiscalYear            |
| `PrincipalOsSet`         | `ZC_CML_PRINCIPAL_OS`     | *(planned)*              | BorrowerGroup, FiscalYear         |
| `GeographySet`           | `ZC_CML_GEOGRAPHY`        | *(planned)*              | State, Scheme                     |
| `NpaDelinquencySet`      | `ZC_CML_NPA`              | *(planned)*              | BorrowerGroup, DPDBucket          |

### How to Switch Mock → Live
```javascript
// webapp/service/ReportDataService.js
var USE_MOCK = true; // set false for live OData
```
Never call OData or fetch JSON directly from a controller — always go through `ReportDataService`.

### PrincipalOs Unit Issue — ABAP Fix Required
Apply `@Semantics.amount.currencyCode` annotation on CDS and ensure consumption view
outputs values in **₹ Crore** so frontend receives consistent units.

---

## 7. Development Progress

### ✅ Completed (main — 20d114d6)
- Main.view.xml — full layout: sidebar, toolbar, FilterBar, IconTabBar
- Main.controller.js — report switching, VizFrame charts, toolbar handlers
- KPI cards (3), data table with CY/PY/Var columns, Compare toggle
- sap.viz charts: Column, Line, Stacked Bar, Waterfall
- Geographical tab: India SVG map + zonal bar chart
- devGroup.json mock dataset (50+ records)

### ✅ Completed (feature/service-abstraction-layer — 3009fc1)
- KpiStrip.fragment.xml, SchemeTabHeader.fragment.xml
- ContractDetailDialog.fragment.xml, InsightStrip.fragment.xml
- UiHelper.js — KPI compute, insight logic, formatters, dialog

### 🔲 Step 3 — ViewModel Hardening
- [ ] Full viewModel init in onInit()
- [ ] onSchemeChange() handler
- [ ] UiHelper.refreshUiMetrics() wired to data load
- [ ] onTableRowPress() → openContractDetail()

### 🔲 Step 4 — ReportDataService
- [ ] webapp/service/ReportDataService.js
- [ ] Mock + OData adapters with USE_MOCK flag

### 🔲 Step 5 — NPA & Delinquency Tab
- [ ] DPD Bucket table + NPA waterfall chart

### 🔲 Step 6 — ABAP/OData Prep
- [ ] localService/metadata.xml stub
- [ ] xs-app.json destination routing

### 🔲 Step 7 — AI Copilot (Gemini)
- [ ] AiContextBuilder.js + AiInsightPanel.fragment.xml

---

## 8. Formatting & Display Conventions

| Data Type         | Rule                                               | Example                    |
|-------------------|----------------------------------------------------|----------------------------|
| ₹ Crore amounts   | 2 decimal places, "Cr" unit label                  | `₹ 1,234.56 Cr`           |
| PrincipalOs raw   | Divide by 1e7 first, then format as ₹ Cr           | `33230224456 → 3323.02 Cr` |
| Percentages       | 1 decimal, "%" suffix                              | `–100.0%`                  |
| Positive variance | ObjectNumber state = `Success`                     | Green                      |
| Negative variance | ObjectNumber state = `Error`                       | Red                        |
| Date fields       | `dd.MM.yyyy`                                       | `01.04.2025`               |

---

## 9. Naming Conventions

```
Views       : PascalCase.view.xml          → Main.view.xml
Fragments   : PascalCase.fragment.xml      → ContractDetailDialog.fragment.xml
Controllers : PascalCase.controller.js     → Main.controller.js
Helpers     : PascalCase.js in helpers/    → UiHelper.js
Services    : PascalCase.js in service/    → ReportDataService.js
Model files : camelCase.json in model/     → devGroup.json
IDs (XML)   : camelCase                    → kpiFlexBox, schemeSegBtn
CSS classes : .cmlCamelCase               → .cmlKpiTile
i18n keys   : camelCase                    → appTitle
Events      : on + PascalCase              → onSchemeChange
```

---

## 10. Agent Prompt Templates

### Add a New Fragment
```
In SAP Fiori app iifcl.cml.cmlmisapp, create webapp/view/fragments/[Name].fragment.xml.
Purpose: [describe]
Bind to viewModel>/[path]. Use sap.m controls only.
Follow ContractDetailDialog.fragment.xml style.
Add handler stubs to UiHelper.js. Do not touch Main.view.xml yet.
```

### Add a Controller Handler
```
In webapp/controller/Main.controller.js, add handler: onXxx: function(oEvent) { ... }
Purpose: [describe]
Read/write viewModel via this.getView().getModel("viewModel").
Use AMD sap.ui.define style. Add JSDoc comment block.
```

### Add OData Entity Binding
```
In webapp/service/ReportDataService.js, add OData support for [EntitySetName].
Service: /sap/opu/odata/sap/ZCML_MIS_ANALYTICS_SRV/
Keys: [list]
Mock fallback: webapp/model/[file].json
Use USE_MOCK flag pattern. PascalCase field names — same as mock JSON.
```

### Extend KPI Strip
```
In UiHelper.js, extend _computeKpis() with new KPI:
Title: [title] | Value from aRows.[field] | Unit: [unit]
Delta: CY minus PY of [field] | Icon: sap-icon://[name]
Same object shape as existing 5 entries. No XML changes needed.
```

---

## 11. ABAP Team Briefing

### CDS Layer Architecture
```
Interface View (I_)   → Raw table data
Composite View (C_)   → Business logic, joins, aggregations  
Consumption View (ZC_) → Fiori-ready, @UI annotations, OData exposure
```

### Required CDS Annotations
```abap
@OData.publish: true
@Analytics.query: true
@Consumption.filter: [{ element: 'Scheme' }, { element: 'FiscalYear' }]
```

---

## 12. Key Links

| Resource             | URL                                                                |
|----------------------|--------------------------------------------------------------------|
| GitHub Repo          | https://github.com/SunnyMishra04/CML-MIS_ANALYTICAL_FIORI         |
| SAPUI5 API           | https://ui5.sap.com/#/api                                          |
| SAP Fiori Guidelines | https://experience.sap.com/fiori-design-web/                       |
| SAP VizFrame Docs    | https://ui5.sap.com/#/api/sap.viz.ui5.controls.VizFrame            |
| OData Service URI    | /sap/opu/odata/sap/ZCML_MIS_ANALYTICS_SRV/                        |
| UI5 Tooling          | https://sap.github.io/ui5-tooling/                                 |
| SAP BTP Deploy Docs  | https://help.sap.com/docs/SAP_FIORI_TOOLS                          |

---

*Last updated: June 2026 | Maintained by: SunnyMishra04*
