import { analysisRunStore } from "@/lib/demo/run-store";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  createAnalysisRun,
  ensureDemoProject,
  storeAgentOutput,
  storeRecommendations,
  updateAnalysisRunStatus
} from "@/lib/db/repositories";
import { demoProject } from "@/lib/demo/data";
import { runCompetitorAgent } from "@/lib/agents/competitor";
import { runCoordinatorAgent } from "@/lib/agents/coordinator";
import { runInventoryAgent } from "@/lib/agents/inventory";
import { runTrendAgent } from "@/lib/agents/trend";
import type { AnalysisResult, MarketplaceProject } from "@/lib/schemas/api";
import { getMissingEnvVars } from "@/lib/utils/env";

const completedAgentStatus = {
  competitor: "completed",
  inventory: "completed",
  trend: "completed",
  coordinator: "completed"
};

export async function runMarketplaceAnalysis(project: MarketplaceProject = demoProject): Promise<AnalysisResult> {
  const startedAt = new Date();
  const db = await connectToDatabase();
  const missingEnvVars = getMissingEnvVars();
  const projectForRun = project ?? demoProject;
  let projectId = projectForRun.id;
  let runId = `demo-${Date.now()}`;
  let persisted = false;

  if (db.available) {
    const saved = await ensureDemoProject(projectForRun);
    projectId = saved.projectId;
    runId = await createAnalysisRun(projectId);
    persisted = true;
  }

  const status = {
    competitor: "running",
    inventory: "pending",
    trend: "pending",
    coordinator: "pending"
  };

  if (persisted) {
    await updateAnalysisRunStatus(runId, { agentStatus: status });
  }

  try {
    const competitor = await runCompetitorAgent(projectForRun);
    if (persisted) {
      await storeAgentOutput(runId, "competitor", competitor.input, competitor.output, competitor.output.confidence);
    }

    status.competitor = "completed";
    status.inventory = "running";
    if (persisted) {
      await updateAnalysisRunStatus(runId, { agentStatus: status });
    }

    const inventory = await runInventoryAgent(projectForRun);
    if (persisted) {
      await storeAgentOutput(runId, "inventory", inventory.input, inventory.output, inventory.output.confidence);
    }

    status.inventory = "completed";
    status.trend = "running";
    if (persisted) {
      await updateAnalysisRunStatus(runId, { agentStatus: status });
    }

    const trend = await runTrendAgent(projectForRun);
    if (persisted) {
      await storeAgentOutput(runId, "trend", trend.input, trend.output, trend.output.confidence);
    }

    status.trend = "completed";
    status.coordinator = "running";
    if (persisted) {
      await updateAnalysisRunStatus(runId, { agentStatus: status });
    }

    const coordinator = runCoordinatorAgent({
      competitor: competitor.output,
      inventory: inventory.output,
      trend: trend.output
    });

    const completedAt = new Date();
    const analysisRun = {
      id: runId,
      projectId,
      status: "completed" as const,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      agentStatus: completedAgentStatus,
      finalScore: coordinator.marketplaceHealthScore,
      summary: coordinator.executiveSummary
    };

    if (persisted) {
      await storeRecommendations(runId, coordinator);
      await updateAnalysisRunStatus(runId, {
        status: "completed",
        agentStatus: completedAgentStatus,
        finalScore: coordinator.marketplaceHealthScore,
        summary: coordinator.executiveSummary,
        completedAt
      });
    }

    const result: AnalysisResult = {
      id: runId,
      project: projectForRun,
      analysisRun,
      agents: {
        competitor: competitor.output,
        inventory: inventory.output,
        trend: trend.output
      },
      coordinator,
      recommendations: coordinator.recommendations,
      demoMode: missingEnvVars.length > 0 || !persisted,
      missingEnvVars,
      dataSources: {
        persistence: persisted ? "mongodb" : "demo-fallback",
        competitor: competitor.dataSource,
        inventory: inventory.dataSource,
        trend: trend.dataSource,
        coordinator: "rule-based"
      }
    };

    analysisRunStore.set(runId, result);

    return result;
  } catch (error) {
    if (persisted) {
      await updateAnalysisRunStatus(runId, {
        status: "failed",
        summary: error instanceof Error ? error.message : "Marketplace analysis failed",
        completedAt: new Date()
      });
    }

    throw error;
  }
}
