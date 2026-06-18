# CML MIS — Service Abstraction Layer

## Overview

This folder contains the data broker layer that decouples the Fiori UI from its data source.
The controller **never reads JSON files or calls OData directly** — it always goes through `ReportDataProvider`.

```
Main.controller.js
        │
        ▼
ReportDataProvider.getInstance(oView)
        │
        ├─ [USE_MOCK_DATA = true]  → loads /model/*.json → applyToMockData()
        │
        └─ [USE_MOCK_DATA = false] → ODataModel.read()  → ZCML_MIS_ANALYTICS_SRV
```

## Files

| File | Purpose |
|---|---|
| `ServiceConfig.js` | **Single toggle**: `USE_MOCK_DATA`, entity set registry, CML field contract |
| `ODataFilterBuilder.js` | Translates UI filter state → `sap.ui.model.Filter[]` (OData) or client-side filter (mock) |
| `ReportDataProvider.js` | Singleton data broker — `getData(oFilterState)` returns a Promise\<Array\> |

## How to Switch to Live OData

1. Open `ServiceConfig.js`
2. Set `USE_MOCK_DATA: false`
3. Ensure `ODATA_MODEL_NAME: ""` matches the model name in `manifest.json`
4. Verify each report ID in `ENTITY_SETS` matches what the ABAP team has exposed in `ZCML_MIS_ANALYTICS_SRV`
5. Done — no controller changes needed

## Filter State Object (contract between controller and service)

```js
{
  reportId      : "SECTOR_WISE",          // key from reportConfig.json
  bucket        : "CY",                   // CY | PY
  metric        : "gross",                // gross | disb | net | os | exposure
  tenure        : "Yearly",              // Yearly | HalfYearly | Quarterly | Monthly
  periodFrom    : "2025-04-01",           // ISO date or null
  periodTo      : "2026-03-31",
  dimensions    : ["Power", "Roads"],     // fbDimension MultiComboBox selected keys
  schemes       : [],                     // fbScheme
  borrowerGroups: [],                     // fbBorrowerGroup
  borrowerNames : [],                     // fbBorrowerName
  quickSearch   : ""
}
```

## OData Entity Set Registry (ABAP team handoff)

The ABAP team must expose these EntitySets in `ZCML_MIS_ANALYTICS_SRV`.
Field names **must match** the CML field contract in `ServiceConfig.CML_FIELDS`.

| Report ID | OData EntitySet | CDS View (to be created) |
|---|---|---|
| DEV_GROUP | `DevGroupSet` | `ZC_CML_DEV_GROUP` |
| SECTOR_WISE | `SectorWiseSet` | `ZC_CML_SECTOR_WISE` |
| GEO_REPORT | `GeoReportSet` | `ZC_CML_GEO_REPORT` |
| FIN_ASSIST | `FinAssistSet` | `ZC_CML_FIN_ASSIST` |
| BORROWER_RECOV | `BorrowerRecovSet` | `ZC_CML_BORROWER_RECOV` |
| PREPAYMENT | `PrepaymentSet` | `ZC_CML_PREPAYMENT` |
| SECTOR_INVEST | `SectorInvestSet` | `ZC_CML_SECTOR_INVEST` |
| SCHEME_WISE | `SchemeWiseSet` | `ZC_CML_SCHEME_WISE` |
| NPA_ANALYSIS | `NpaAnalysisSet` | `ZC_CML_NPA_ANALYSIS` |
| COD_REPORT | `CodReportSet` | `ZC_CML_COD_REPORT` |
| CATEGORY_MODE | `CategoryModeSet` | `ZC_CML_CATEGORY_MODE` |
| DISBURSEMENT_WISE | `DisbursementWiseSet` | `ZC_CML_DISBURSEMENT_WISE` |
| NPA_REPORT | `NpaReportSet` | `ZC_CML_NPA_REPORT` |

## CML Field Contract

All CDS consumption views must expose these element names.
The UI is coded against these — do not rename them on the ABAP side.

```
ContractID         – Loan contract number (e.g. CML-2024-00312)
BorrowerName       – Full legal name
BorrowerGroup      – Group code (PSU / Private / NBFC / SPV)
BorrowerGroupName  – Full group name
Scheme             – Product scheme name
SectorName         – Sector (Power / Roads / Railways ...)
SubSectorName      – Sub-sector
StateName          – Indian state name
ProjectsCY / PY    – Count of sanctioned projects
ProjectCostCY / PY – Total project cost (INR Cr)
GrossSanctionCY/PY – Gross sanctioned amount
DisbursementCY/PY  – Disbursed amount
NetSanctionCY/PY   – Net sanctioned amount
PrincipalOsCY/PY   – Principal outstanding
ExposureCY/PY      – Total exposure
DPD                – Days Past Due (integer)
NPAClass           – NPA classification
LoanStatus         – Contract lifecycle status
EMICollectionPct   – EMI collection efficiency %
ProductType        – Loan product type
PeriodFrom/To      – Reporting period dates
Bucket             – CY | PY filter key
Tenure             – Yearly | HalfYearly | Quarterly | Monthly
```
