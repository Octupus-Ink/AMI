import { InventoryAgentOutputSchema, type InventoryAgentOutput } from "@/lib/schemas/agents";
import type { MarketplaceProduct, MarketplaceProject } from "@/lib/schemas/api";
import type { AgentRunResult } from "@/lib/agents/competitor";

function getSalesVelocity(product: MarketplaceProduct) {
  if (product.monthlySales >= 150) {
    return "fast" as const;
  }

  if (product.monthlySales <= 60) {
    return "slow" as const;
  }

  return "normal" as const;
}

function getInventoryRisk(product: MarketplaceProduct) {
  const stockRatio = product.currentStock / Math.max(product.targetStock, 1);
  const velocity = getSalesVelocity(product);

  if (stockRatio < 0.45) {
    return "low_stock" as const;
  }

  if (stockRatio > 1.45 && velocity === "slow") {
    return "stagnant" as const;
  }

  if (stockRatio > 1.35) {
    return "overstock" as const;
  }

  return "healthy" as const;
}

export async function runInventoryAgent(project: MarketplaceProject): Promise<AgentRunResult<InventoryAgentOutput>> {
  const findings = project.products.map((product) => {
    const salesVelocity = getSalesVelocity(product);
    const inventoryRisk = getInventoryRisk(product);
    const profitMarginEstimate = Math.round(((product.price - product.cost) / Math.max(product.price, 1)) * 100);
    const riskLevel =
      inventoryRisk === "low_stock" || inventoryRisk === "stagnant"
        ? "high"
        : inventoryRisk === "overstock"
          ? "medium"
          : "low";

    const recommendedAction =
      inventoryRisk === "low_stock"
        ? "Prioritize replenishment and protect margin."
        : inventoryRisk === "stagnant"
          ? "Create bundle or liquidation campaign."
          : inventoryRisk === "overstock"
            ? "Use targeted promotion to normalize stock."
            : "Maintain current inventory position.";

    return {
      productName: product.name,
      currentStock: product.currentStock,
      salesVelocity,
      inventoryRisk,
      profitMarginEstimate,
      recommendedAction,
      riskLevel
    };
  });

  const risky = findings.filter((finding) => finding.inventoryRisk !== "healthy").length;

  const output = InventoryAgentOutputSchema.parse({
    agent: "inventory",
    status: "completed",
    findings,
    summary: risky
      ? `${risky} products need inventory action before the next sales cycle.`
      : "Inventory is balanced across tracked products.",
    confidence: 0.88
  });

  return {
    output,
    input: {
      projectId: project.id,
      productCount: project.products.length,
      source: "internal-demo-inventory"
    },
    dataSource: "internal-demo-inventory"
  };
}
