/**
 * AiContextBuilder.js — Step 7 · AI Copilot Context + Gemini Integration
 *
 * Responsibilities:
 *   1. Build a structured context payload from the current app state
 *   2. Format context into a domain-expert prompt for Gemini
 *   3. Call Gemini API and return the analysis text
 *
 * Usage (from controller):
 *   AiContextBuilder.analyze(oController).then(function(sText) { ... });
 */
sap.ui.define([], function () {
    "use strict";

    /* ─── Configuration ──────────────────────────────────────────────────── */

    /**
     * Gemini API endpoint.
     * Uses gemini-2.0-flash for fast, cost-effective analysis.
     */
    var AI_MODEL = "gemini-2.0-flash";
    var AI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + AI_MODEL + ":generateContent";

    /**
     * API key for Gemini calls.
     * ⚠️ Do NOT hardcode keys here. Use setApiKey() from the controller,
     * which loads the key from .env / config at runtime.
     * For production: route through BTP destination with server-side auth.
     */
    var AI_API_KEY = "Gemini_API_Key";

    /* ─── System Prompt ──────────────────────────────────────────────────── */

    var SYSTEM_PROMPT =
        "You are an expert SAP FICO and SAP FS-CML (Financial Services – Credit Management and Lending) " +
        "consultant with deep knowledge of loan portfolio management, NPA classification, disbursement tracking, " +
        "and MIS reporting as practiced in Indian Development Finance Institutions (DFIs) like IIFCL, NaBFID, PFC, and REC. " +
        "Analyze the data provided and give:\n" +
        "1. **Summary** — 2-3 sentence overview of the current report state\n" +
        "2. **Key Findings** — bullet points highlighting notable metrics, trends, or anomalies\n" +
        "3. **Recommendations** — actionable suggestions based on the data\n\n" +
        "Use ₹ Crore as the currency unit. Be concise and specific. " +
        "Reference actual numbers from the data. Format with markdown.";

    /* ─── Public API ─────────────────────────────────────────────────────── */

    return {

        /**
         * Set the Gemini API key at runtime.
         * Call this from the controller during onInit.
         * @param {string} sKey - Gemini API key
         */
        setApiKey: function (sKey) {
            AI_API_KEY = sKey || "";
        },

        /**
         * Build a context object from the current app state.
         * @param {sap.ui.core.mvc.Controller} oController
         * @returns {object} structured context payload
         */
        buildContext: function (oController) {
            var oVM  = oController.getView().getModel("view");
            var oFVM = oController.getView().getModel("viewModel");
            var aRows = oVM.getProperty("/rows") || [];

            return {
                reportId:    oVM.getProperty("/currentReportId"),
                reportTitle: oVM.getProperty("/currentReportTitle"),
                metric:      oVM.getProperty("/activeMetricLabel"),
                period:      oVM.getProperty("/periodDisplayText"),
                tenure:      oVM.getProperty("/selectedTenure"),
                bucket:      oVM.getProperty("/selectedBucketKey"),
                scheme:      oFVM ? oFVM.getProperty("/activeScheme") : "ALL",
                rowCount:    aRows.length,
                kpis:        oFVM ? (oFVM.getProperty("/kpis") || []) : [],
                topRows:     aRows.slice(0, 15),
                totals: {
                    totalProjects:     oVM.getProperty("/totalProjects"),
                    totalProjectCost:  oVM.getProperty("/totalProjectCost"),
                    totalMetric:       oVM.getProperty("/totalMetric"),
                    totalMetricPY:     oVM.getProperty("/totalMetricPY"),
                    totalMetricVar:    oVM.getProperty("/totalMetricVar"),
                    totalMetricVarPct: oVM.getProperty("/totalMetricVarPct")
                }
            };
        },

        /**
         * Format context object into a Gemini prompt string.
         * @param {object} oCtx - from buildContext()
         * @returns {string} formatted prompt
         */
        toPrompt: function (oCtx) {
            var lines = [];
            lines.push("## Current Report: " + (oCtx.reportTitle || "Unknown"));
            lines.push("- Period: " + (oCtx.period || "N/A"));
            lines.push("- Active Metric: " + (oCtx.metric || "N/A"));
            lines.push("- Tenure: " + (oCtx.tenure || "Yearly"));
            lines.push("- Scheme Filter: " + (oCtx.scheme || "ALL"));
            lines.push("- Total Records: " + oCtx.rowCount);
            lines.push("");

            // KPIs
            if (oCtx.kpis && oCtx.kpis.length > 0) {
                lines.push("## KPI Summary");
                oCtx.kpis.forEach(function (kpi) {
                    lines.push("- " + kpi.title + ": " + kpi.value + " " +
                              (kpi.unit || "") + " (Delta: " + (kpi.delta || "0") + ")");
                });
                lines.push("");
            }

            // Totals
            if (oCtx.totals) {
                lines.push("## Aggregate Totals");
                lines.push("- Total Projects: " + (oCtx.totals.totalProjects || 0));
                lines.push("- Total Metric (CY): " + (oCtx.totals.totalMetric || 0).toFixed(2) + " Cr");
                lines.push("- Total Metric (PY): " + (oCtx.totals.totalMetricPY || 0).toFixed(2) + " Cr");
                lines.push("- Metric Variance: " + (oCtx.totals.totalMetricVar || 0).toFixed(2) + " Cr");
                lines.push("- Variance %: " + (oCtx.totals.totalMetricVarPct || 0).toFixed(1) + "%");
                lines.push("");
            }

            // Sample rows
            if (oCtx.topRows && oCtx.topRows.length > 0) {
                lines.push("## Sample Data (top " + oCtx.topRows.length + " rows)");
                oCtx.topRows.forEach(function (r, i) {
                    var label = r.DisplayCol1 || r.BorrowerGroupName || r.SectorName || ("Row " + (i + 1));
                    lines.push("- " + label +
                              " | CY: " + (r.CurrentMetric || r.MetricCY || 0).toFixed(2) +
                              " | PY: " + (r.MetricPY || 0).toFixed(2) +
                              " | Var: " + (r.MetricVar || 0).toFixed(2) +
                              " (" + (r.MetricVarPct || 0).toFixed(1) + "%)");
                });
                lines.push("");
            }

            return lines.join("\n");
        },

        /**
         * Build context, call Gemini, return analysis text.
         * Falls back to a local mock response if API call fails.
         *
         * @param {sap.ui.core.mvc.Controller} oController
         * @param {string} [sUserQuery] - optional follow-up question from user
         * @returns {Promise<string>} resolves with AI analysis text
         */
        analyze: function (oController, sUserQuery) {
            var oCtx = this.buildContext(oController);
            var sDataPrompt = this.toPrompt(oCtx);

            var sFullPrompt = SYSTEM_PROMPT + "\n\n---\n\n" + sDataPrompt;
            if (sUserQuery) {
                sFullPrompt += "\n\n## User Question\n" + sUserQuery;
            }

            // If no API key, return mock response
            if (!AI_API_KEY) {
                console.info("[AiContextBuilder] No API key configured — returning mock response.");
                return Promise.resolve(this._mockResponse(oCtx));
            }

            var sUrl = AI_ENDPOINT + "?key=" + AI_API_KEY;

            return fetch(sUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: sFullPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                        topP: 0.95
                    }
                })
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error("Gemini API returned " + response.status);
                }
                return response.json();
            }).then(function (data) {
                // Extract text from Gemini response
                if (data && data.candidates && data.candidates[0] &&
                    data.candidates[0].content && data.candidates[0].content.parts) {
                    return data.candidates[0].content.parts
                        .map(function (p) { return p.text || ""; })
                        .join("");
                }
                return "No analysis available from AI model.";
            }).catch(function (error) {
                console.error("[AiContextBuilder] Gemini API call failed:", error);
                return "⚠️ AI analysis unavailable: " + error.message +
                       "\n\nFalling back to basic summary:\n\n" +
                       "Report: " + oCtx.reportTitle + "\n" +
                       "Records: " + oCtx.rowCount + "\n" +
                       "Total Metric CY: ₹ " + (oCtx.totals.totalMetric || 0).toFixed(2) + " Cr";
            });
        },

        /**
         * Generate a mock response for offline/testing.
         * @private
         */
        _mockResponse: function (oCtx) {
            return "## AI Analysis (Mock Mode)\n\n" +
                   "**Report:** " + oCtx.reportTitle + "\n" +
                   "**Records analyzed:** " + oCtx.rowCount + "\n\n" +
                   "### Key Findings\n" +
                   "- Total metric value (CY): ₹ " + (oCtx.totals.totalMetric || 0).toFixed(2) + " Cr\n" +
                   "- Year-over-year variance: " + (oCtx.totals.totalMetricVarPct || 0).toFixed(1) + "%\n\n" +
                   "### Recommendations\n" +
                   "- Review borrower groups with zero disbursement in current year\n" +
                   "- Monitor high principal outstanding positions for credit risk\n\n" +
                   "Configure Gemini API key for live AI analysis.";
        }
    };
});
