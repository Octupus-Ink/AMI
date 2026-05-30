import {
  CoordinatorSynthesisOutputSchema,
  type AgentFinding,
  type CoordinatorSynthesisOutput
} from "@/lib/schemas/agents";
import type { AgentContext } from "@/lib/agents/types";
import { sanitizeEvidenceSnippet, sanitizeEvidenceTitle } from "@/lib/analysis/source-state";
import { generateAgentJson } from "@/lib/llm-providers/aimlapi/structured-json";

function fallbackCoordinator(context: AgentContext, findings: AgentFinding[], status: "completed" | "fallback"): CoordinatorSynthesisOutput {
  const highConfidence = findings.filter((finding) => finding.confidence >= 0.7);
  const risky = findings.filter((finding) => finding.riskLevel === "high" || finding.riskLevel === "critical");
  const warnings = findings.filter((finding) => finding.status === "warning" || finding.status === "skipped");
  const supplier = findings.find((finding) => finding.agentType === "supplier");
  const competitor = findings.find((finding) => finding.agentType === "competitor");
  const trend = findings.find((finding) => finding.agentType === "trend");

  return CoordinatorSynthesisOutputSchema.parse({
    agentType: "orchestrator",
    status,
    summary:
      risky.length > 0
        ? "Agents support action only as a controlled validation because risk remains material."
        : "Agents broadly support near-term action with supplier and competitor validation.",
    agreements: [
      competitor && supplier ? "Competitor and Supplier agents agree that commercial action should remain margin-aware." : "",
      trend && competitor ? "Trend and Competitor agents both support monitoring near-term market movement." : ""
    ].filter(Boolean),
    conflicts: warnings.length ? warnings.map((finding) => `${finding.agentType} did not produce full confidence output.`) : [],
    confidenceGaps: [
      context.metrics.evidenceCount < 3 ? "Evidence depth is limited." : "",
      supplier?.riskLevel === "medium" ? "Supplier delivery cost and delivery time require validation." : ""
    ].filter(Boolean),
    riskBlockers: risky.map((finding) => finding.finding),
    decisionFactors: [
      `Price pressure ${context.metrics.pricePressure}/100`,
      `Estimated margin ${context.metrics.estimatedMargin.toFixed(1)}%`,
      `Trend momentum ${context.metrics.trendMomentum}/100`,
      `Inventory risk ${context.metrics.inventoryRisk}/100`
    ],
    strongestSignals: highConfidence.map((finding) => finding.finding).slice(0, 3),
    weakestSignals: findings
      .filter((finding) => finding.confidence < 0.65 || finding.status !== "completed")
      .map((finding) => finding.finding)
      .slice(0, 3),
    confidence: Math.min(0.9, findings.reduce((sum, finding) => sum + finding.confidence, 0) / Math.max(1, findings.length)),
    riskLevel: risky.length ? "high" : warnings.length ? "medium" : "medium"
  });
}

export async function runCoordinatorAgent(
  context: AgentContext,
  findings: AgentFinding[]
): Promise<{ output: CoordinatorSynthesisOutput; usedFallback: boolean; warning?: string }> {
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
    requiredJsonShape: {
      agentType: "orchestrator",
      status: "completed",
      summary: "One concise business synthesis.",
      agreements: ["Agreement item"],
      conflicts: ["Conflict item"],
      confidenceGaps: ["Gap item"],
      riskBlockers: ["Risk blocker"],
      decisionFactors: ["Decision factor"],
      strongestSignals: ["Strong signal"],
      weakestSignals: ["Weak signal"],
      confidence: 0.75,
      riskLevel: "medium"
    }
  };
  const live = await generateAgentJson(
    CoordinatorSynthesisOutputSchema,
    "You are AMI's Orchestrator. Compare specialist agent findings against the selected business goal. Return agreements, conflicts, confidence gaps, risk blockers, decision factors, strongest signals, weakest signals, confidence, and riskLevel.",
    compactPayload
  );

  if (live.output) {
    return {
      output: CoordinatorSynthesisOutputSchema.parse(live.output),
      usedFallback: false,
      warning: undefined
    };
  }

  return {
    output: fallbackCoordinator(context, findings, "fallback"),
    usedFallback: true,
    warning: live.safeError ?? "AIMLAPI orchestrator synthesis fallback used."
  };
}
