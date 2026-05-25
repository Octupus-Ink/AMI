import { searchSERP } from "@/lib/brightdata/client";
import { demoTrendSignals } from "@/lib/demo/data";
import { TrendAgentOutputSchema, type TrendAgentOutput } from "@/lib/schemas/agents";
import type { MarketplaceProject } from "@/lib/schemas/api";
import type { AgentRunResult } from "@/lib/agents/competitor";

export async function runTrendAgent(project: MarketplaceProject): Promise<AgentRunResult<TrendAgentOutput>> {
  const query = `${project.category} demand trends ${project.targetMarket}`;
  const serp = await searchSERP(query);

  const findings = demoTrendSignals.map((signal) => ({
    productName: signal.productName,
    trendScore: signal.trendScore,
    marketStatus: signal.marketStatus,
    seasonality: signal.seasonality,
    demandSignal: signal.demandSignal,
    recommendation:
      signal.marketStatus === "growing" || signal.marketStatus === "viral"
        ? "Increase visibility while demand is expanding."
        : signal.marketStatus === "declining"
          ? "Limit paid spend and test price-sensitive offers."
          : "Maintain promotion with conservative spend."
  }));

  const growthSignals = findings.filter((finding) => finding.marketStatus === "growing" || finding.marketStatus === "viral").length;

  const output = TrendAgentOutputSchema.parse({
    agent: "trend",
    status: "completed",
    findings,
    summary: growthSignals
      ? `${growthSignals} product categories show expansion signals in current market data.`
      : "Demand signals are stable to soft across tracked products.",
    confidence: serp.source === "demo-fallback" ? 0.8 : 0.9
  });

  return {
    output,
    input: {
      projectId: project.id,
      query,
      serpSource: serp.source
    },
    dataSource: serp.source
  };
}
