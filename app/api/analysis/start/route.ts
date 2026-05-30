import { NextRequest, NextResponse } from "next/server";
import { completeAnalysisRun, createAnalysisRunToMetrics, INVENTORY_CONTEXT_UNAVAILABLE_WARNING } from "@/lib/ami/analysis";
import { MarketContextPayloadSchema } from "@/lib/schemas/ami";
import { getInventorySourceState, isUsableInventorySource, saveAnalysisResult } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

const inventoryRequiredGoals = ["stock_optimization", "revenue_stock_opportunities"];
const inventoryOptionalGoals = ["discover_new_products"];

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = MarketContextPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Analysis request is invalid", 422);
  }

  const inventoryStatus = await getInventorySourceState(bundle.workspaceId);
  const inventoryAvailable = isUsableInventorySource(inventoryStatus);
  const inventoryRequired = inventoryRequiredGoals.includes(parsed.data.businessGoal);
  const inventoryOptional = inventoryOptionalGoals.includes(parsed.data.businessGoal);

  if (inventoryRequired && !inventoryAvailable) {
    return jsonError("Inventory context is required for this business goal. Connect an inventory source before starting analysis.", 422);
  }

  const inventoryRequested = parsed.data.useInventoryContext || inventoryRequired;
  const inventoryWarning =
    inventoryOptional && inventoryRequested && !inventoryAvailable ? INVENTORY_CONTEXT_UNAVAILABLE_WARNING : undefined;
  const metricsReady = await createAnalysisRunToMetrics(bundle.workspaceId, { ...parsed.data, useInventoryContext: inventoryRequested }, {
    requested: inventoryRequested,
    available: inventoryRequested && inventoryAvailable,
    warningMessage: inventoryWarning,
    sourceLabel: inventoryStatus.latestConnectionLabel
  });
  await saveAnalysisResult(metricsReady);

  if (metricsReady.status !== "failed") {
    void (async () => {
      try {
        await saveAnalysisResult({
          ...metricsReady,
          status: "agents_running",
          agentStatus: metricsReady.agentStatus.map((entry) => ({
            ...entry,
            status:
              entry.status === "skipped"
                ? "skipped"
                : entry.agentType === "trend" ||
                    entry.agentType === "competitor" ||
                    entry.agentType === "supplier" ||
                    entry.agentType === "inventory"
                ? "running"
                : "pending",
            latestActivity:
              entry.status === "skipped"
                ? entry.latestActivity
                : entry.agentType === "trend" ||
                    entry.agentType === "competitor" ||
                    entry.agentType === "supplier" ||
                    entry.agentType === "inventory"
                ? "Running deterministic specialist analysis on compact KPIs."
                : entry.latestActivity
          }))
        });
        const completed = await completeAnalysisRun(metricsReady);
        await saveAnalysisResult(completed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "AMI analysis failed during AI synthesis.";
        await saveAnalysisResult({
          ...metricsReady,
          status: "failed",
          completedAt: new Date().toISOString(),
          warnings: [...metricsReady.warnings, message]
        });
      }
    })();
  }

  return NextResponse.json(metricsReady);
}
