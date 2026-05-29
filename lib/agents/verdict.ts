import {
  VerdictAgentOutputSchema,
  type AgentFinding,
  type CoordinatorSynthesisOutput,
  type RiskLevel,
  type VerdictAgentOutput
} from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";
import { buildExternalActionPayload } from "@/lib/analysis/external-action-payload";
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
  const finalVerdict = highPricePressure
    ? "Prioritize a limited promotion before restocking."
    : "Prioritize a controlled sourcing validation before scaling.";
  const recommendedAction = highPricePressure
    ? "Run an 8-10% temporary discount for 48 hours and monitor velocity before increasing inventory."
    : "Validate supplier terms on the top product candidates and monitor competitor pricing before purchase approval.";
  const confidence = Math.min(0.9, Math.max(0.55, synthesis.confidence));
  const riskLevel: RiskLevel = supplierRisk === "high" || context.metrics.inventoryRisk >= 75 ? "high" : lowTrend ? "medium" : "medium";
  const base = {
    riskLevel,
    confidence
  };

  return VerdictAgentOutputSchema.parse({
    agentType: "strategy",
    status,
    finalVerdict,
    recommendedAction,
    reasoning:
      "Competitor pressure, supplier margin, trend momentum, and inventory risk support action only as a measured business test.",
    confidence,
    riskLevel,
    nextStep: "Validate supplier delivery time and review product velocity after the promotion or sourcing validation window.",
    agentAgreement: synthesis.agreements,
    agentConflicts: synthesis.conflicts,
    evidenceSummary: [
      `Competitor pricing pressure is ${context.metrics.pricePressure}/100.`,
      `Estimated supplier-backed margin is ${context.metrics.estimatedMargin.toFixed(1)}%.`,
      `Trend momentum is ${context.metrics.trendMomentum}/100.`,
      `Inventory risk is ${context.metrics.inventoryRisk}/100.`
    ],
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
      label: ref.label,
      snippet: ref.snippet
    })),
    findings,
    synthesis,
    requiredStyle: "Finding -> Reason -> Confidence/Risk -> Suggested next step. Business advisor tone, not chatbot tone.",
    requiredJsonShape: {
      agentType: "strategy",
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
    "You are AMI's Strategy Agent. Produce the final AMI business verdict as strict JSON with recommendedAction, reasoning, confidence, riskLevel, nextStep, agreements, conflicts, evidenceSummary, and externalActionPayload. Do not call external systems.",
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
