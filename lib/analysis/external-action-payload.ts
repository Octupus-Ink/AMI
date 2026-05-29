import type { ExternalActionPayload, VerdictAgentOutput } from "@/lib/schemas/agents";
import { ExternalActionPayloadSchema } from "@/lib/schemas/agents";
import type { NormalizedProduct } from "@/lib/schemas/ami";

function priorityFromVerdict(verdict: Pick<VerdictAgentOutput, "riskLevel" | "confidence">): ExternalActionPayload["priority"] {
  if (verdict.riskLevel === "critical") {
    return "critical";
  }

  if (verdict.confidence >= 0.78 && verdict.riskLevel !== "high") {
    return "high";
  }

  if (verdict.riskLevel === "high") {
    return "medium";
  }

  return "medium";
}

export function buildExternalActionPayload(
  analysisRunId: string,
  verdict: Pick<VerdictAgentOutput, "riskLevel" | "confidence">,
  products: NormalizedProduct[]
): ExternalActionPayload {
  return ExternalActionPayloadSchema.parse({
    actionType: "promotion_recommendation",
    priority: priorityFromVerdict(verdict),
    requiresHumanApproval: true,
    targetProducts: products.slice(0, 5).map((product) => product.externalId ?? product.title),
    sourceAnalysisRunId: analysisRunId
  });
}
