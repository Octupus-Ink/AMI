import { scrapeProductPage, searchSERP } from "@/lib/brightdata/client";
import { demoCompetitorSnapshot } from "@/lib/demo/data";
import { CompetitorAgentOutputSchema, type CompetitorAgentOutput } from "@/lib/schemas/agents";
import type { MarketplaceProject } from "@/lib/schemas/api";

export type AgentRunResult<T> = {
  output: T;
  input: Record<string, unknown>;
  dataSource: string;
};

export async function runCompetitorAgent(project: MarketplaceProject): Promise<AgentRunResult<CompetitorAgentOutput>> {
  const query = `${project.category} competitor pricing ${project.targetMarket}`;
  const serp = await searchSERP(query);
  const scrape = await scrapeProductPage("https://example.com/demo/competitor-products");
  const rows = scrape.source === "demo-fallback" ? demoCompetitorSnapshot : scrape.data;

  const findings = rows.map((row) => {
    const discountPercentage =
      row.listPrice && row.listPrice > row.price ? Math.round(((row.listPrice - row.price) / row.listPrice) * 100) : 0;
    const discountDetected = discountPercentage >= 8;
    const stockPressure = row.stockStatus === "in_stock" || row.stockStatus === "low_stock";
    const riskLevel = discountDetected && stockPressure ? "high" : row.stockStatus === "out_of_stock" ? "low" : "medium";

    return {
      competitorName: row.competitorName,
      productName: row.productName,
      price: row.price,
      stockStatus: row.stockStatus,
      discountDetected,
      discountPercentage,
      deliveryEstimate: row.deliveryEstimate,
      riskLevel,
      insight: discountDetected
        ? `${row.competitorName} is applying visible price pressure on ${row.productName}.`
        : `${row.competitorName} pricing is stable for ${row.productName}.`
    };
  });

  const highRiskCount = findings.filter((finding) => finding.riskLevel === "high").length;

  const output = CompetitorAgentOutputSchema.parse({
    agent: "competitor",
    status: "completed",
    findings,
    summary: highRiskCount
      ? `${highRiskCount} competitor signals require pricing or positioning attention.`
      : "Competitor pressure is moderate with no critical pricing shock.",
    confidence: serp.source === "demo-fallback" || scrape.source === "demo-fallback" ? 0.82 : 0.91
  });

  return {
    output,
    input: {
      projectId: project.id,
      query,
      serpSource: serp.source,
      scrapeSource: scrape.source
    },
    dataSource: scrape.source
  };
}
