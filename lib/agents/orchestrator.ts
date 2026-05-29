import type { AgentOutput, AgentStatus, AgentType, CoordinatorSynthesisOutput, VerdictAgentOutput } from "@/lib/schemas/agents";
import type { AgentRunStatus } from "@/lib/schemas/ami";
import type { AgentContext } from "@/lib/agents/types";
import { runCompetitorAgent } from "@/lib/agents/competitor";
import { runCoordinatorAgent } from "@/lib/agents/coordinator";
import { runInventoryAgent } from "@/lib/agents/inventory";
import { runSupplierAgent } from "@/lib/agents/supplier";
import { runTrendAgent } from "@/lib/agents/trend";
import { runVerdictAgent } from "@/lib/agents/verdict";

export const AMI_AGENT_SEQUENCE: Array<{ agentType: AgentType; label: string }> = [
  { agentType: "trend", label: "Trend Agent" },
  { agentType: "competitor", label: "Competitor Agent" },
  { agentType: "supplier", label: "Supplier Agent" },
  { agentType: "inventory", label: "Inventory Agent" },
  { agentType: "coordinator", label: "Coordinator Agent" },
  { agentType: "strategy", label: "Strategy Agent" }
];

function latestActivity(output: AgentOutput | undefined, fallback: string) {
  if (!output) {
    return fallback;
  }

  if ("finding" in output) {
    return output.finding;
  }

  if ("summary" in output) {
    return output.summary;
  }

  return output.finalVerdict;
}

export function buildPendingAgentStatus(status: AgentStatus = "pending"): AgentRunStatus[] {
  return AMI_AGENT_SEQUENCE.map((agent) => ({
    agentType: agent.agentType,
    status,
    label: agent.label,
    latestActivity: "Waiting for normalized KPIs and compact evidence.",
    usedFallback: false
  }));
}

export function buildAgentStatus(outputs: AgentOutput[], runningAgent?: AgentType): AgentRunStatus[] {
  return AMI_AGENT_SEQUENCE.map((agent) => {
    const output = outputs.find((item) => item.agentType === agent.agentType);
    const status = output?.status ?? (runningAgent === agent.agentType ? "running" : "pending");

    return {
      agentType: agent.agentType,
      status,
      label: agent.label,
      latestActivity: latestActivity(output, runningAgent === agent.agentType ? "Running compact evidence analysis." : "Waiting."),
      confidence: "confidence" in (output ?? {}) ? output?.confidence : undefined,
      riskLevel: "riskLevel" in (output ?? {}) ? output?.riskLevel : undefined,
      usedFallback: output?.status === "fallback"
    };
  });
}

export async function runAmiAgents(context: AgentContext) {
  const specialistOutputs = [
    runTrendAgent(context),
    runCompetitorAgent(context),
    runSupplierAgent(context),
    runInventoryAgent(context)
  ];
  const coordinator = await runCoordinatorAgent(context, specialistOutputs);
  const synthesis: CoordinatorSynthesisOutput = coordinator.output;
  const verdict = await runVerdictAgent(context, specialistOutputs, synthesis);
  const finalVerdict: VerdictAgentOutput = verdict.output;
  const outputs: AgentOutput[] = [...specialistOutputs, synthesis, finalVerdict];
  const warnings = [coordinator.warning, verdict.warning].filter((warning): warning is string => Boolean(warning));

  return {
    outputs,
    synthesis,
    finalVerdict,
    warnings,
    usedFallback: coordinator.usedFallback || verdict.usedFallback
  };
}
