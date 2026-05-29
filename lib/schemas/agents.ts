import { z } from "zod";

export const AgentTypeSchema = z.enum(["trend", "competitor", "supplier", "inventory", "coordinator", "strategy"]);
export const AgentStatusSchema = z.enum(["pending", "running", "completed", "warning", "failed", "skipped", "fallback"]);
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical", "unknown"]);

export const EvidenceRefSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourceType: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url().optional(),
  snippet: z.string().max(360).optional(),
  collectedAt: z.string().min(1),
  provider: z.enum(["brightdata", "demo_fallback", "internal"]),
  product: z.string().optional()
});

export const AgentFindingSchema = z.object({
  agentType: AgentTypeSchema.exclude(["coordinator", "strategy"]),
  status: AgentStatusSchema,
  finding: z.string().min(4),
  reasoning: z.string().min(4),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema,
  suggestedAction: z.string().min(4),
  evidenceUsed: z.array(z.string()).default([]),
  sourceAgents: z.array(AgentTypeSchema).default([])
});

export const TrendAgentOutputSchema = AgentFindingSchema.extend({
  agentType: z.literal("trend"),
  demand: z.string().optional(),
  momentum: z.string().optional(),
  seasonality: z.string().optional(),
  trendDirection: z.enum(["declining", "stable", "growing", "surging", "unknown"]).default("unknown")
});

export const CompetitorAgentOutputSchema = AgentFindingSchema.extend({
  agentType: z.literal("competitor"),
  pricingPressure: z.string().optional(),
  marketSaturation: z.string().optional(),
  availabilityGaps: z.string().optional()
});

export const SupplierAgentOutputSchema = AgentFindingSchema.extend({
  agentType: z.literal("supplier"),
  marginPotential: z.string().optional(),
  sourcingRisk: z.string().optional(),
  matchConfidence: z.string().optional()
});

export const InventoryAgentOutputSchema = AgentFindingSchema.extend({
  agentType: z.literal("inventory"),
  stockPosture: z.string().optional(),
  stockMovementRisk: z.string().optional(),
  promotionOpportunity: z.string().optional()
});

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function readArray(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = value[key];

    if (Array.isArray(candidate)) {
      return candidate.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
    }

    if (typeof candidate === "string" && candidate.trim()) {
      return [candidate.trim()];
    }
  }

  return [];
}

function readConfidence(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? Math.min(1, value / 100) : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));

    if (Number.isFinite(parsed)) {
      return parsed > 1 ? Math.min(1, parsed / 100) : parsed;
    }
  }

  return 0.7;
}

function normalizeEnumText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.toLowerCase().replace(/[\s-]+/g, "_") : fallback;
}

function normalizeCoordinatorResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasCoordinatorShape = [
    "summary",
    "executiveSummary",
    "synthesis",
    "agreements",
    "conflicts",
    "confidenceGaps",
    "confidence_gaps",
    "riskBlockers",
    "risk_blockers",
    "decisionFactors",
    "decision_factors",
    "strongestSignals",
    "strongest_signals",
    "weakestSignals",
    "weakest_signals"
  ].some((key) => key in record);

  if (!hasCoordinatorShape) {
    return value;
  }

  const agreements = readArray(record, ["agreements", "agreement", "agentAgreement", "agent_agreement"]);
  const conflicts = readArray(record, ["conflicts", "conflict", "agentConflicts", "agent_conflicts"]);
  const confidenceGaps = readArray(record, ["confidenceGaps", "confidence_gaps", "gaps"]);
  const riskBlockers = readArray(record, ["riskBlockers", "risk_blockers", "blockers", "risks"]);
  const decisionFactors = readArray(record, ["decisionFactors", "decision_factors", "factors"]);
  const strongestSignals = readArray(record, ["strongestSignals", "strongest_signals", "strongSignals", "strong_signals"]);
  const weakestSignals = readArray(record, ["weakestSignals", "weakest_signals", "weakSignals", "weak_signals"]);
  const summary =
    readString(record, ["summary", "executiveSummary", "executive_summary", "synthesis", "finalSummary", "final_summary"]) ??
    [...agreements, ...conflicts, ...decisionFactors][0] ??
    "Coordinator synthesized specialist agent outputs.";

  return {
    ...record,
    agentType: "coordinator",
    status: normalizeEnumText(record.status, "completed"),
    summary,
    agreements,
    conflicts,
    confidenceGaps,
    riskBlockers,
    decisionFactors,
    strongestSignals,
    weakestSignals,
    confidence: readConfidence(record.confidence),
    riskLevel: normalizeEnumText(record.riskLevel ?? record.risk_level ?? record.risk, "medium")
  };
}

export const CoordinatorSynthesisOutputSchema = z.preprocess(normalizeCoordinatorResponse, z.object({
  agentType: z.literal("coordinator"),
  status: AgentStatusSchema,
  summary: z.string().min(4),
  agreements: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  confidenceGaps: z.array(z.string()).default([]),
  riskBlockers: z.array(z.string()).default([]),
  decisionFactors: z.array(z.string()).default([]),
  strongestSignals: z.array(z.string()).default([]),
  weakestSignals: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema
}));

export const ExternalActionPayloadSchema = z.object({
  actionType: z.string().min(2).default("promotion_recommendation"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  requiresHumanApproval: z.boolean().default(true),
  targetProducts: z.array(z.string()).default([]),
  sourceAnalysisRunId: z.string().default("")
});

function normalizeVerdictResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasVerdictShape = [
    "finalVerdict",
    "final_verdict",
    "verdict",
    "recommendedAction",
    "recommended_action",
    "reasoning",
    "nextStep",
    "next_step",
    "evidenceSummary",
    "evidence_summary",
    "externalActionPayload",
    "external_action_payload"
  ].some((key) => key in record);

  if (!hasVerdictShape) {
    return value;
  }

  const finalVerdict =
    readString(record, ["finalVerdict", "final_verdict", "verdict", "summary"]) ??
    readString(record, ["recommendedAction", "recommended_action", "action"]) ??
    "AMI generated a strategy verdict from the available evidence.";
  const recommendedAction =
    readString(record, ["recommendedAction", "recommended_action", "action", "recommendation"]) ?? finalVerdict;
  const nextStep =
    readString(record, ["nextStep", "next_step", "suggestedNextStep", "suggested_next_step"]) ??
    "Validate supplier terms and monitor product velocity before scaling.";
  const rawPayload =
    record.externalActionPayload && typeof record.externalActionPayload === "object" && !Array.isArray(record.externalActionPayload)
      ? (record.externalActionPayload as Record<string, unknown>)
      : record.external_action_payload && typeof record.external_action_payload === "object" && !Array.isArray(record.external_action_payload)
        ? (record.external_action_payload as Record<string, unknown>)
        : {};

  return {
    ...record,
    agentType: "strategy",
    status: normalizeEnumText(record.status, "completed"),
    finalVerdict,
    recommendedAction,
    reasoning: readString(record, ["reasoning", "rationale", "reason", "primaryReason", "primary_reason"]) ?? finalVerdict,
    confidence: readConfidence(record.confidence),
    riskLevel: normalizeEnumText(record.riskLevel ?? record.risk_level ?? record.risk, "medium"),
    nextStep,
    agentAgreement: readArray(record, ["agentAgreement", "agent_agreement", "agreements"]),
    agentConflicts: readArray(record, ["agentConflicts", "agent_conflicts", "conflicts"]),
    evidenceSummary: readArray(record, ["evidenceSummary", "evidence_summary", "evidence"]),
    externalActionPayload: {
      actionType: readString(rawPayload, ["actionType", "action_type"]) ?? "promotion_recommendation",
      priority: normalizeEnumText(rawPayload.priority, "medium"),
      requiresHumanApproval:
        typeof rawPayload.requiresHumanApproval === "boolean"
          ? rawPayload.requiresHumanApproval
          : typeof rawPayload.requires_human_approval === "boolean"
            ? rawPayload.requires_human_approval
            : true,
      targetProducts: readArray(rawPayload, ["targetProducts", "target_products"]),
      sourceAnalysisRunId: readString(rawPayload, ["sourceAnalysisRunId", "source_analysis_run_id"]) ?? ""
    }
  };
}

export const VerdictAgentOutputSchema = z.preprocess(normalizeVerdictResponse, z.object({
  agentType: z.literal("strategy"),
  status: AgentStatusSchema,
  finalVerdict: z.string().min(4),
  recommendedAction: z.string().min(4),
  reasoning: z.string().min(4),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema,
  nextStep: z.string().min(4),
  agentAgreement: z.array(z.string()).default([]),
  agentConflicts: z.array(z.string()).default([]),
  evidenceSummary: z.array(z.string()).default([]),
  externalActionPayload: ExternalActionPayloadSchema
}));

export const AgentOutputUnion = z.union([
  TrendAgentOutputSchema,
  CompetitorAgentOutputSchema,
  SupplierAgentOutputSchema,
  InventoryAgentOutputSchema,
  CoordinatorSynthesisOutputSchema,
  VerdictAgentOutputSchema
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type AgentFinding = z.infer<typeof AgentFindingSchema>;
export type TrendAgentOutput = z.infer<typeof TrendAgentOutputSchema>;
export type CompetitorAgentOutput = z.infer<typeof CompetitorAgentOutputSchema>;
export type SupplierAgentOutput = z.infer<typeof SupplierAgentOutputSchema>;
export type InventoryAgentOutput = z.infer<typeof InventoryAgentOutputSchema>;
export type CoordinatorSynthesisOutput = z.infer<typeof CoordinatorSynthesisOutputSchema>;
export type VerdictAgentOutput = z.infer<typeof VerdictAgentOutputSchema>;
export type ExternalActionPayload = z.infer<typeof ExternalActionPayloadSchema>;
export type AgentOutput = z.infer<typeof AgentOutputUnion>;
