import {
  VerdictAgentOutputSchema,
  type AgentFinding,
  type CoordinatorSynthesisOutput,
  type RiskLevel,
  type VerdictAgentOutput
} from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";
import { buildExternalActionPayload } from "@/lib/analysis/external-action-payload";
import { sanitizeEvidenceSnippet, sanitizeEvidenceTitle } from "@/lib/analysis/source-state";
import { generateVerdictJson } from "@/lib/llm-providers/aimlapi/structured-json";

function fallbackVerdict(
  context: AgentContext,
  findings: AgentFinding[],
  synthesis: CoordinatorSynthesisOutput,
  status: "completed" | "fallback"
): VerdictAgentOutput {
  const highPricePressure = context.metrics.pricePressure >= 65;
  const lowTrend = context.metrics.trendMomentum < 58;
  const supplierRisk = findings.find((finding) => finding.agentType === "supplier")?.riskLevel ?? "medium";
  const scores = context.metrics.canonicalMetrics;
  const stockProtection = typeof scores.stockProtectionScore === "number" ? scores.stockProtectionScore : 0;
  const stockAction = typeof scores.stockActionScore === "number" ? scores.stockActionScore : 0;
  const supplierAvailability = typeof scores.supplierAvailability === "number" ? scores.supplierAvailability : null;
  const finalVerdict =
    context.briefing.businessGoal === "stock_optimization"
      ? stockProtection > stockAction
        ? "Protect stock position instead of discounting."
        : highPricePressure
          ? "Prioritize a controlled stock action."
          : "Keep stock action measured while monitoring velocity."
      : context.briefing.businessGoal === "revenue_stock_opportunities"
        ? "Prioritize the strongest revenue expansion opportunity."
        : supplierAvailability !== null && supplierAvailability < 0.45
          ? "Treat this as supplier validation before sourcing."
          : "Prioritize a controlled sourcing validation before scaling.";
  const recommendedAction =
    context.briefing.businessGoal === "stock_optimization"
      ? stockProtection > stockAction
        ? "Protect margin, review restock timing, and avoid discounting until demand weakens."
        : highPricePressure
          ? "Run a controlled bundle, reprice, or short discount while monitoring velocity."
          : "Pause aggressive stock changes and validate demand direction first."
      : context.briefing.businessGoal === "revenue_stock_opportunities"
        ? "Prioritize the revenue opportunity, then validate supplier leverage or internal execution fit before scaling."
        : supplierAvailability !== null && supplierAvailability < 0.45
          ? "Validate supplier availability and delivery terms before taking sourcing action."
          : "Validate supplier terms on the top product candidates and monitor competitor pricing before purchase approval.";
  const confidence = Math.min(0.9, Math.max(0.55, synthesis.confidence));
  const riskLevel: RiskLevel = supplierRisk === "high" || context.metrics.inventoryRisk >= 75 ? "high" : lowTrend ? "medium" : "medium";
  const base = {
    riskLevel,
    confidence
  };

  return VerdictAgentOutputSchema.parse({
    agentType: "orchestrator",
    status,
    finalVerdict,
    recommendedAction,
    reasoning:
      "AMI compared goal-specific agent outputs, null-safe metrics, conflict rules, data quality, and fallback limits before choosing the final action.",
    confidence,
    riskLevel,
    nextStep:
      context.dataQuality.fallbacksUsed.length || context.dataQuality.failedSources.length
        ? "Review degraded source signals and validate supplier or demand assumptions before acting."
        : "Review evidence, validate execution constraints, and monitor the selected metric after the action window.",
    agentAgreement: synthesis.agreements,
    agentConflicts: synthesis.conflicts,
    evidenceSummary: [
      `Competitor pricing pressure is ${context.metrics.pricePressure}/100.`,
      `Estimated supplier-backed margin is ${context.metrics.estimatedMargin.toFixed(1)}%.`,
      `Trend momentum is ${context.metrics.trendMomentum}/100.`,
      `Inventory risk is ${context.metrics.inventoryRisk}/100.`,
      context.dataQuality.fallbacksUsed.length ? `Fallbacks used: ${context.dataQuality.fallbacksUsed.join(", ")}.` : ""
    ].filter(Boolean),
    externalActionPayload: buildExternalActionPayload(context.analysisRunId, base, context.products)
  });
}

export async function runVerdictAgent(
  context: AgentContext,
  findings: AgentFinding[],
  synthesis: CoordinatorSynthesisOutput
): Promise<{ output: VerdictAgentOutput; usedFallback: boolean; warning?: string }> {
  const compactPayload = {
    briefing: context.briefing,
    metrics: context.metrics,
    products: context.products.slice(0, 5),
    evidence: context.evidenceRefs.slice(0, 10).map((ref) => ({
      id: ref.id,
      sourceType: ref.sourceType,
      label: sanitizeEvidenceTitle(ref.label),
      snippet: sanitizeEvidenceSnippet(ref.snippet)
    })),
    findings,
    synthesis,
    requiredStyle: "Finding -> Reason -> Confidence/Risk -> Suggested next step. Business advisor tone, not chatbot tone.",
    requiredJsonShape: {
      agentType: "orchestrator",
      status: "completed",
      finalVerdict: "One concise final business verdict.",
      recommendedAction: "Specific action AMI recommends.",
      reasoning: "Why this action follows from the evidence.",
      confidence: 0.75,
      riskLevel: "medium",
      nextStep: "Next validation step.",
      agentAgreement: ["Agreement item"],
      agentConflicts: ["Conflict item"],
      evidenceSummary: ["Evidence item"],
      externalActionPayload: {
        actionType: "promotion_recommendation",
        priority: "high",
        requiresHumanApproval: true,
        targetProducts: [],
        sourceAnalysisRunId: context.analysisRunId
      }
    }
  };
  const live = await generateVerdictJson(
    VerdictAgentOutputSchema,
    "You are AMI's Orchestrator. Produce the final AMI business verdict as strict JSON with recommendedAction, reasoning, confidence, riskLevel, nextStep, agreements, conflicts, evidenceSummary, and externalActionPayload. Follow the selected business goal and blocker rules. Do not call external systems.",
    compactPayload
  );

  if (live.output) {
    const parsed = VerdictAgentOutputSchema.parse(live.output);

    return {
      output: VerdictAgentOutputSchema.parse({
        ...parsed,
        externalActionPayload: {
          ...parsed.externalActionPayload,
          sourceAnalysisRunId: context.analysisRunId,
          targetProducts: (parsed.externalActionPayload.targetProducts ?? []).slice(0, 5)
        }
      }),
      usedFallback: false,
      warning: undefined
    };
  }

  return {
    output: fallbackVerdict(context, findings, synthesis, "fallback"),
    usedFallback: true,
    warning: live.safeError ?? "AIMLAPI verdict fallback used."
  };
}
