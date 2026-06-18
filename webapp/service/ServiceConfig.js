/**
 * ServiceConfig.js
 * ─────────────────────────────────────────────────────────────────
 * Central configuration for the CML MIS service abstraction layer.
 *
 * HOW TO SWITCH FROM MOCK → LIVE ODATA:
 *   Change USE_MOCK_DATA = false  (single flag, nothing else changes)
 *
 * ODATA SERVICE URI is already declared in manifest.json:
 *   /sap/opu/odata/sap/ZCML_MIS_ANALYTICS_SRV/
 * ─────────────────────────────────────────────────────────────────
 */
sap.ui.define([], function () {
    "use strict";

    return {

        /* ── 1. MODE FLAG ─────────────────────────────────────────── */
        /**
         * true  → data comes from /model/*.json  (current dev state)
         * false → data comes from ABAP OData service  (production)
         */
        USE_MOCK_DATA: true,

        /* ── 2. ODATA SERVICE NAME ────────────────────────────────── */
        // Must match the model name registered in manifest.json sap.ui5.models
        ODATA_MODEL_NAME: "",   // "" = default model (the mainService)

        /* ── 3. ENTITY SET REGISTRY ───────────────────────────────── */
        // Maps every reportConfig.json report ID → OData EntitySet name
        // These names MUST match what the ABAP team exposes in ZCML_MIS_ANALYTICS_SRV
        ENTITY_SETS: {
            DEV_GROUP:         "DevGroupSet",
            SECTOR_WISE:       "SectorWiseSet",
            GEO_REPORT:        "GeoReportSet",
            FIN_ASSIST:        "FinAssistSet",
            BORROWER_RECOV:    "BorrowerRecovSet",
            PREPAYMENT:        "PrepaymentSet",
            SECTOR_INVEST:     "SectorInvestSet",
            SCHEME_WISE:       "SchemeWiseSet",
            NPA_ANALYSIS:      "NpaAnalysisSet",
            COD_REPORT:        "CodReportSet",
            CATEGORY_MODE:     "CategoryModeSet",
            DISBURSEMENT_WISE: "DisbursementWiseSet",
            NPA_REPORT:        "NpaReportSet"
        },

        /* ── 4. CML FIELD CONTRACT ────────────────────────────────── */
        // Canonical field names shared between mock JSON and OData.
        // When the ABAP team creates CDS consumption views, these are
        // the element names they MUST use so the UI needs zero changes.
        CML_FIELDS: {
            // ── Identification
            CONTRACT_ID:          "ContractID",        // CML contract number e.g. CML-2024-00312
            BORROWER_NAME:        "BorrowerName",
            BORROWER_GROUP:       "BorrowerGroup",
            BORROWER_GROUP_NAME:  "BorrowerGroupName",
            SCHEME:               "Scheme",
            SECTOR_NAME:          "SectorName",
            SUB_SECTOR_NAME:      "SubSectorName",
            STATE_NAME:           "StateName",

            // ── Financial Metrics (CY)
            PROJECTS_CY:          "ProjectsCY",
            PROJECT_COST_CY:      "ProjectCostCY",
            GROSS_SANCTION_CY:    "GrossSanctionCY",
            DISBURSEMENT_CY:      "DisbursementCY",
            NET_SANCTION_CY:      "NetSanctionCY",
            PRINCIPAL_OS_CY:      "PrincipalOsCY",
            EXPOSURE_CY:          "ExposureCY",

            // ── Financial Metrics (PY)
            PROJECTS_PY:          "ProjectsPY",
            PROJECT_COST_PY:      "ProjectCostPY",
            GROSS_SANCTION_PY:    "GrossSanctionPY",
            DISBURSEMENT_PY:      "DisbursementPY",
            NET_SANCTION_PY:      "NetSanctionPY",
            PRINCIPAL_OS_PY:      "PrincipalOsPY",
            EXPOSURE_PY:          "ExposurePY",

            // ── CML-specific (new fields — add to mock JSONs in Step 3)
            DPD:                  "DPD",               // Days Past Due (integer)
            NPA_CLASS:            "NPAClass",          // Standard / Sub-Standard / Doubtful-1 / Doubtful-2 / Loss
            LOAN_STATUS:          "LoanStatus",        // Active / Closed / NPA / Restructured
            EMI_COLLECTION_PCT:   "EMICollectionPct",  // Decimal 0-100
            PRODUCT_TYPE:         "ProductType"        // Term Loan / WC / GECL / Infra Bond / Refinance
        },

        /* ── 5. PAGINATION DEFAULTS ───────────────────────────────── */
        DEFAULT_PAGE_SIZE: 200,     // $top value for OData calls
        MAX_RECORDS:       5000     // safety cap before server-side paging
    };
});
