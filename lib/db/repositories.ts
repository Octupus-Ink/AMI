import { Types } from "mongoose";
import { demoProject, demoUser } from "@/lib/demo/data";
import type { AnalysisResult, MarketplaceProject, RecentRun } from "@/lib/schemas/api";
import type {
  CompetitorAgentOutput,
  CoordinatorAgentOutput,
  InventoryAgentOutput,
  TrendAgentOutput
} from "@/lib/schemas/agents";
import AgentOutput from "@/models/AgentOutput";
import AnalysisRun from "@/models/AnalysisRun";
import MarketplaceProjectModel from "@/models/MarketplaceProject";
import Recommendation from "@/models/Recommendation";
import User from "@/models/User";

type LeanAnalysisRun = {
  _id: unknown;
  projectId: unknown;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date | string;
  completedAt?: Date | string | null;
  agentStatus?: Record<string, string>;
  finalScore?: number | null;
  summary: string;
};

type LeanMarketplaceProject = {
  _id: unknown;
  userId: unknown;
  name: string;
  category: string;
  targetMarket: string;
  trackedCompetitors?: MarketplaceProject["trackedCompetitors"];
  products?: MarketplaceProject["products"];
  createdAt: Date | string;
  updatedAt: Date | string;
};

type LeanAgentOutput = {
  agentName: string;
  output: unknown;
};

type CoordinatorRecommendation = CoordinatorAgentOutput["recommendations"][number];
type SourceAgent = CoordinatorRecommendation["sourceAgents"][number];

type LeanRecommendation = {
  priority: CoordinatorRecommendation["priority"];
  title: string;
  description: string;
  sourceAgents?: string[];
  businessImpact: string;
  suggestedAction: string;
};

const validSourceAgents = new Set<SourceAgent>(["competitor", "inventory", "trend"]);

function normalizeSourceAgents(sourceAgents?: string[]): SourceAgent[] {
  if (!sourceAgents?.length) {
    return [];
  }

  return sourceAgents.filter((agent): agent is SourceAgent =>
    validSourceAgents.has(agent as SourceAgent)
  );
}

export async function ensureDemoProject(project: MarketplaceProject = demoProject) {
  const user = await User.findOneAndUpdate(
    { email: demoUser.email },
    {
      $setOnInsert: {
        email: demoUser.email,
        name: demoUser.name,
        role: demoUser.role,
        createdAt: demoUser.createdAt
      }
    },
    { upsert: true, new: true }
  );

  if (!user) {
    throw new Error("Failed to create or load demo user");
  }

  const userId = String(user._id);

  const savedProject = await MarketplaceProjectModel.findOneAndUpdate(
    { userId, name: project.name },
    {
      userId,
      name: project.name,
      category: project.category,
      targetMarket: project.targetMarket,
      trackedCompetitors: project.trackedCompetitors,
      products: project.products,
      updatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!savedProject) {
    throw new Error("Failed to create or load demo project");
  }

  return {
    userId,
    projectId: String(savedProject._id)
  };
}

export async function createAnalysisRun(projectId: string) {
  const run = await AnalysisRun.create({
    projectId,
    status: "running",
    startedAt: new Date(),
    agentStatus: {
      competitor: "pending",
      inventory: "pending",
      trend: "pending",
      coordinator: "pending"
    },
    summary: "Marketplace analysis in progress"
  });

  return String(run._id);
}

export async function updateAnalysisRunStatus(
  runId: string,
  updates: {
    status?: "pending" | "running" | "completed" | "failed";
    agentStatus?: Record<string, string>;
    finalScore?: number;
    summary?: string;
    completedAt?: Date;
  }
) {
  if (!Types.ObjectId.isValid(runId)) {
    return;
  }

  await AnalysisRun.findByIdAndUpdate(runId, updates);
}

export async function storeAgentOutput(
  runId: string,
  agentName: string,
  input: unknown,
  output: CompetitorAgentOutput | InventoryAgentOutput | TrendAgentOutput,
  confidence: number
) {
  await AgentOutput.create({
    analysisRunId: runId,
    agentName,
    status: output.status,
    input,
    output,
    confidence
  });
}

export async function storeRecommendations(runId: string, coordinator: CoordinatorAgentOutput) {
  if (!coordinator.recommendations.length) {
    return;
  }

  await Recommendation.insertMany(
    coordinator.recommendations.map((recommendation) => ({
      analysisRunId: runId,
      type: "coordinator",
      ...recommendation
    }))
  );
}

export async function getRecentAnalysisRuns(limit = 5): Promise<RecentRun[]> {
  const runs = (await AnalysisRun.find()
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean()) as unknown as LeanAnalysisRun[];

  return runs.map((run) => ({
    id: String(run._id),
    status: run.status,
    startedAt: new Date(run.startedAt).toISOString(),
    completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
    finalScore: run.finalScore ?? null,
    summary: run.summary || "Marketplace analysis run"
  }));
}

export async function getAnalysisResultFromDatabase(id: string): Promise<AnalysisResult | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const run = (await AnalysisRun.findById(id).lean()) as unknown as LeanAnalysisRun | null;

  if (!run) {
    return null;
  }

  const [project, outputs, recommendations] = await Promise.all([
    MarketplaceProjectModel.findById(String(run.projectId)).lean() as unknown as Promise<LeanMarketplaceProject | null>,
    AgentOutput.find({ analysisRunId: id }).lean() as unknown as Promise<LeanAgentOutput[]>,
    Recommendation.find({ analysisRunId: id }).sort({ createdAt: 1 }).lean() as unknown as Promise<LeanRecommendation[]>
  ]);

  const outputByAgent = Object.fromEntries(outputs.map((output) => [output.agentName, output.output]));

  if (!outputByAgent.competitor || !outputByAgent.inventory || !outputByAgent.trend) {
    return null;
  }

  const projectPayload: MarketplaceProject = project
    ? {
        id: String(project._id),
        userId: String(project.userId),
        name: project.name,
        category: project.category,
        targetMarket: project.targetMarket,
        trackedCompetitors: project.trackedCompetitors ?? [],
        products: project.products ?? [],
        createdAt: new Date(project.createdAt).toISOString(),
        updatedAt: new Date(project.updatedAt).toISOString()
      }
    : demoProject;

  const coordinatorRecommendations: CoordinatorRecommendation[] = recommendations.map((recommendation) => ({
    priority: recommendation.priority,
    title: recommendation.title,
    description: recommendation.description,
    sourceAgents: normalizeSourceAgents(recommendation.sourceAgents),
    businessImpact: recommendation.businessImpact,
    suggestedAction: recommendation.suggestedAction
  }));

  return {
    id,
    project: projectPayload,
    analysisRun: {
      id,
      projectId: String(run.projectId),
      status: run.status,
      startedAt: new Date(run.startedAt).toISOString(),
      completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      agentStatus: run.agentStatus ?? {},
      finalScore: run.finalScore ?? null,
      summary: run.summary
    },
    agents: {
      competitor: outputByAgent.competitor as CompetitorAgentOutput,
      inventory: outputByAgent.inventory as InventoryAgentOutput,
      trend: outputByAgent.trend as TrendAgentOutput
    },
    coordinator: {
      status: "completed",
      marketplaceHealthScore: run.finalScore ?? 0,
      executiveSummary: run.summary,
      recommendations: coordinatorRecommendations,
      nextBestActions: coordinatorRecommendations.map((recommendation) => recommendation.suggestedAction),
      risks: []
    },
    recommendations: coordinatorRecommendations,
    demoMode: false,
    missingEnvVars: [],
    dataSources: {
      persistence: "mongodb"
    }
  };
}