import {
  CoordinatorAgentOutputSchema,
  type CompetitorAgentOutput,
  type CoordinatorAgentOutput,
  type InventoryAgentOutput,
  type TrendAgentOutput
} from "@/lib/schemas/agents";

type CoordinatorInput = {
  competitor: CompetitorAgentOutput;
  inventory: InventoryAgentOutput;
  trend: TrendAgentOutput;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function priorityFor(riskLevel: string, demandSignal?: string) {
  if (riskLevel === "high" && demandSignal === "strong") {
    return "critical" as const;
  }

  if (riskLevel === "high") {
    return "high" as const;
  }

  if (riskLevel === "medium") {
    return "medium" as const;
  }

  return "low" as const;
}

export function runCoordinatorAgent(input: CoordinatorInput): CoordinatorAgentOutput {
  const recommendations: CoordinatorAgentOutput["recommendations"] = [];
  let healthScore = 72;

  for (const inventoryFinding of input.inventory.findings) {
    const competitorFinding = input.competitor.findings.find(
      (finding) => finding.productName === inventoryFinding.productName
    );
    const trendFinding = input.trend.findings.find((finding) => finding.productName === inventoryFinding.productName);

    if (!trendFinding) {
      continue;
    }

    if (
      competitorFinding?.discountDetected &&
      (inventoryFinding.inventoryRisk === "overstock" || inventoryFinding.inventoryRisk === "stagnant") &&
      trendFinding.marketStatus === "declining"
    ) {
      recommendations.push({
        priority: "high",
        title: `Run a controlled discount for ${inventoryFinding.productName}`,
        description:
          "Competitor prices are dropping while stock is elevated and demand is softening, so margin-protected discounting can reduce exposure.",
        sourceAgents: ["competitor", "inventory", "trend"],
        businessImpact: "Reduces stagnant stock risk while defending share against visible competitor discounts.",
        suggestedAction: "Launch a 10-15% campaign with bundle placement and review sell-through after seven days."
      });
      healthScore -= 10;
    }

    if (
      competitorFinding?.stockStatus === "out_of_stock" &&
      inventoryFinding.inventoryRisk === "low_stock" &&
      (trendFinding.marketStatus === "growing" || trendFinding.marketStatus === "viral")
    ) {
      recommendations.push({
        priority: "critical",
        title: `Restock ${inventoryFinding.productName} before discounting`,
        description:
          "A competitor stockout overlaps with strong demand, but internal inventory is low. The best move is availability, not price cutting.",
        sourceAgents: ["competitor", "inventory", "trend"],
        businessImpact: "Captures demand displaced by competitor stockouts while protecting gross margin.",
        suggestedAction: "Expedite replenishment, raise marketplace bid caps modestly, and keep price stable."
      });
      healthScore += 8;
    }

    if (trendFinding.marketStatus === "growing" && inventoryFinding.profitMarginEstimate >= 45) {
      recommendations.push({
        priority: priorityFor(inventoryFinding.riskLevel, trendFinding.demandSignal),
        title: `Increase promotion for ${inventoryFinding.productName}`,
        description:
          "Demand is expanding and estimated margin is healthy enough to support more visibility without racing to the bottom.",
        sourceAgents: ["inventory", "trend"],
        businessImpact: "Improves revenue capture in a growing segment while keeping unit economics healthy.",
        suggestedAction: "Increase sponsored placement budget by 15% and test premium positioning copy."
      });
      healthScore += 5;
    }

    if (inventoryFinding.inventoryRisk === "stagnant" && trendFinding.demandSignal === "weak") {
      recommendations.push({
        priority: "high",
        title: `Bundle or liquidate ${inventoryFinding.productName}`,
        description:
          "Weak demand and stagnant stock create carrying cost risk. Bundling can move units without making the base price look distressed.",
        sourceAgents: ["inventory", "trend"],
        businessImpact: "Frees working capital and reduces the chance of deeper markdowns later.",
        suggestedAction: "Create a limited bundle, suppress broad paid spend, and set a sell-through target."
      });
      healthScore -= 8;
    }
  }

  if (!recommendations.length) {
    recommendations.push({
      priority: "medium",
      title: "Maintain marketplace posture with weekly monitoring",
      description:
        "No critical rule fired, but the agents found enough movement to justify scheduled review before the next buying cycle.",
      sourceAgents: ["competitor", "inventory", "trend"],
      businessImpact: "Keeps the operator responsive without unnecessary price or stock changes.",
      suggestedAction: "Review competitor price deltas, sell-through, and trend scores again in seven days."
    });
  }

  const highRiskCompetitors = input.competitor.findings.filter((finding) => finding.riskLevel === "high").length;
  const highRiskInventory = input.inventory.findings.filter((finding) => finding.riskLevel === "high").length;
  const strongTrends = input.trend.findings.filter((finding) => finding.demandSignal === "strong").length;
  healthScore = clampScore(healthScore - highRiskCompetitors * 4 - highRiskInventory * 5 + strongTrends * 4);

  const output = CoordinatorAgentOutputSchema.parse({
    status: "completed",
    marketplaceHealthScore: healthScore,
    executiveSummary: `Coordinator synthesized ${input.competitor.findings.length} competitor signals, ${input.inventory.findings.length} inventory signals, and ${input.trend.findings.length} trend signals into ${recommendations.length} prioritized recommendations.`,
    recommendations,
    nextBestActions: recommendations.slice(0, 3).map((recommendation) => recommendation.suggestedAction),
    risks: [
      highRiskCompetitors ? "Competitor discount pressure may compress margins." : "Competitor pressure is currently manageable.",
      highRiskInventory ? "Inventory imbalance can create missed sales or carrying costs." : "Inventory risk is not concentrated.",
      strongTrends ? "Fast demand shifts require frequent monitoring." : "Trend volatility appears moderate."
    ]
  });

  return output;
}
