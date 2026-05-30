import type { AgentOutput, AgentStatus, AgentType, CoordinatorSynthesisOutput, VerdictAgentOutput } from "@/lib/schemas/agents";
import type { AgentRunStatus, BusinessGoal } from "@/lib/schemas/ami";
import type { AgentContext, GoalWorkflowStep } from "@/lib/agents/types";
import { runCompetitorAgent } from "@/lib/agents/competitor";
import { runCoordinatorAgent } from "@/lib/agents/coordinator";
import { runInventoryAgent } from "@/lib/agents/inventory";
import { runSupplierAgent } from "@/lib/agents/supplier";
import { runTrendAgent } from "@/lib/agents/trend";
import { runVerdictAgent } from "@/lib/agents/verdict";

export const AMI_AGENT_SEQUENCE: Array<{ agentType: AgentType; label: string }> = [
  { agentType: "orchestrator", label: "AMI Orchestrator" },
  { agentType: "inventory", label: "Inventory Assistant" },
  { agentType: "trend", label: "Trend Assistant" },
  { agentType: "competitor", label: "Competitor Assistant" },
  { agentType: "supplier", label: "Supplier Assistant" }
];

const goalIntents: Record<BusinessGoal, string> = {
  discover_new_products:
    "Find new product opportunities that fit current marketplace context, show demand, avoid saturation, and remain viable to source.",
  stock_optimization:
    "Improve existing stock decisions by comparing action pressure against stock protection and restock signals.",
  revenue_stock_opportunities:
    "Identify current or adjacent inventory opportunities that can increase revenue or margin now."
};

export function goalIntentFor(goal: BusinessGoal) {
  return goalIntents[goal];
}

export function buildGoalWorkflow(goal: BusinessGoal, options: { supplierNeeded?: boolean } = {}): GoalWorkflowStep[] {
  if (goal === "stock_optimization") {
    return [
      {
        agentType: "inventory",
        label: "Inventory Assistant",
        goalIntent: "Diagnose slow-moving stock, overstock, low stock, margin sensitivity, and operational risk.",
        executionOrder: 1
      },
      {
        agentType: "competitor",
        label: "Competitor Assistant",
        goalIntent: "Check price pressure, discounts, saturation, and competitor availability.",
        executionOrder: 2
      },
      {
        agentType: "trend",
        label: "Trend Assistant",
        goalIntent: "Check demand direction for the current stock item or category.",
        executionOrder: 2
      },
      {
        agentType: "supplier",
        label: "Supplier Assistant",
        goalIntent: "Validate restock or alternative supplier only when the stock action requires sourcing.",
        executionOrder: 3,
        optional: !options.supplierNeeded
      },
      {
        agentType: "orchestrator",
        label: "AMI Orchestrator",
        goalIntent: "Compare stockActionScore against stockProtectionScore and produce the operational stock decision.",
        executionOrder: 4
      }
    ];
  }

  if (goal === "revenue_stock_opportunities") {
    return [
      {
        agentType: "inventory",
        label: "Inventory Assistant",
        goalIntent: "Identify revenue-capable products, categories, bundle candidates, margin opportunities, and restock needs.",
        executionOrder: 1
      },
      {
        agentType: "trend",
        label: "Trend Assistant",
        goalIntent: "Validate demand upside in current stock categories and products.",
        executionOrder: 2
      },
      {
        agentType: "competitor",
        label: "Competitor Assistant",
        goalIntent: "Validate price gap, market gap, promotion pressure, and competitor stockouts.",
        executionOrder: 2
      },
      {
        agentType: "supplier",
        label: "Supplier Assistant",
        goalIntent: "Validate restock, supplier leverage, margin expansion, and sourcing risk when needed.",
        executionOrder: 3
      },
      {
        agentType: "orchestrator",
        label: "AMI Orchestrator",
        goalIntent: "Calculate revenueOpportunityScore and choose a revenue or margin expansion action.",
        executionOrder: 4
      }
    ];
  }

  return [
    {
      agentType: "inventory",
      label: "Inventory Assistant",
      goalIntent: "Map current marketplace categories, product families, stock depth, cannibalization zones, and replacement opportunities.",
      executionOrder: 1
    },
    {
      agentType: "trend",
      label: "Trend Assistant",
      goalIntent: "Find category-aligned emerging or growing products.",
      executionOrder: 2
    },
    {
      agentType: "competitor",
      label: "Competitor Assistant",
      goalIntent: "Filter saturated or price-compressed candidates.",
      executionOrder: 3
    },
    {
      agentType: "supplier",
      label: "Supplier Assistant",
      goalIntent: "Validate sourcing feasibility, cost, availability, delivery, trust, and margin.",
      executionOrder: 4
    },
    {
      agentType: "orchestrator",
      label: "AMI Orchestrator",
      goalIntent: "Calculate discoverOpportunityScore, resolve blockers, and produce the final sourcing recommendation.",
      executionOrder: 5
    }
  ];
}

export function shouldRunSupplier(context: Pick<AgentContext, "briefing" | "metrics">) {
  if (context.briefing.businessGoal === "discover_new_products" || context.briefing.businessGoal === "revenue_stock_opportunities") {
    return true;
  }

  const metrics = context.metrics.canonicalMetrics;
  const restockNeed = metrics.restockNeed;
  const stockProtectionScore = metrics.stockProtectionScore;

  return (
    (typeof restockNeed === "number" && restockNeed >= 0.55) ||
    (typeof stockProtectionScore === "number" && stockProtectionScore >= 0.55)
  );
}

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

function statusForOptional(step: GoalWorkflowStep, output: AgentOutput | undefined, runningAgent?: AgentType): AgentStatus {
  if (output) {
    return output.status;
  }

  if (runningAgent === step.agentType) {
    return "running";
  }

  return step.optional ? "skipped" : "pending";
}

export function buildPendingAgentStatus(goal?: BusinessGoal, status: AgentStatus = "pending"): AgentRunStatus[] {
  const workflow = buildGoalWorkflow(goal ?? "discover_new_products");

  return workflow.map((agent) => ({
    agentType: agent.agentType,
    status: agent.optional ? "skipped" : status,
    label: agent.label,
    goalIntent: agent.goalIntent,
    executionOrder: agent.executionOrder,
    latestActivity: agent.optional ? "Optional for this business goal unless AMI detects restock or supplier validation need." : "Waiting for goal-directed orchestration.",
    sourcesUsed: [],
    contributionSummary: undefined,
    fallbackSignals: [],
    missingSignals: [],
    confidenceAdjustment: {},
    usedFallback: false
  }));
}

export function buildAgentStatus(outputs: AgentOutput[], workflow: GoalWorkflowStep[], runningAgent?: AgentType): AgentRunStatus[] {
  return workflow.map((agent) => {
    const output = outputs.find((item) => item.agentType === agent.agentType);
    const status = statusForOptional(agent, output, runningAgent);

    return {
      agentType: agent.agentType,
      status,
      label: agent.label,
      goalIntent: agent.goalIntent,
      executionOrder: agent.executionOrder,
      latestActivity: latestActivity(
        output,
        agent.optional
          ? "Supplier validation was not required for this stock decision."
          : runningAgent === agent.agentType
            ? "Running goal-specific evidence analysis."
            : "Waiting."
      ),
      sourcesUsed: [],
      contributionSummary: output && "finding" in output ? output.finding : output && "finalVerdict" in output ? output.finalVerdict : undefined,
      fallbackSignals: output?.status === "fallback" ? ["deterministic_agent_fallback"] : [],
      missingSignals: [],
      confidenceAdjustment: output?.status === "fallback" ? { fallbackPenalty: 0.04 } : {},
      confidence: "confidence" in (output ?? {}) ? output?.confidence : undefined,
      riskLevel: "riskLevel" in (output ?? {}) ? output?.riskLevel : undefined,
      usedFallback: output?.status === "fallback"
    };
  });
}

export async function runAmiAgents(context: AgentContext) {
  const workflow = context.workflow;
  const specialistOutputs = workflow
    .filter((step) => step.agentType !== "orchestrator" && !step.optional)
    .sort((a, b) => a.executionOrder - b.executionOrder)
    .map((step) => {
      if (step.agentType === "inventory") {
        return runInventoryAgent(context);
      }

      if (step.agentType === "trend") {
        return runTrendAgent(context);
      }

      if (step.agentType === "competitor") {
        return runCompetitorAgent(context);
      }

      return runSupplierAgent(context);
    });
  const coordinator = await runCoordinatorAgent(context, specialistOutputs);
  const synthesis: CoordinatorSynthesisOutput = coordinator.output;
  const verdict = await runVerdictAgent(context, specialistOutputs, synthesis);
  const finalVerdict: VerdictAgentOutput = verdict.output;
  const outputs: AgentOutput[] = [...specialistOutputs, finalVerdict];
  const warnings = [coordinator.warning, verdict.warning].filter((warning): warning is string => Boolean(warning));

  return {
    outputs,
    synthesis,
    finalVerdict,
    warnings,
    usedFallback: coordinator.usedFallback || verdict.usedFallback
  };
}
