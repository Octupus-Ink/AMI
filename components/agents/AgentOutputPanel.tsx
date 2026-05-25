import type {
  CompetitorAgentOutput,
  InventoryAgentOutput,
  TrendAgentOutput
} from "@/lib/schemas/agents";
import { Badge } from "@/components/ui/Badge";

type AgentOutput = CompetitorAgentOutput | InventoryAgentOutput | TrendAgentOutput;

function renderFinding(finding: AgentOutput["findings"][number]) {
  if ("competitorName" in finding) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">{finding.productName}</p>
          <Badge tone={finding.riskLevel === "high" ? "rose" : finding.riskLevel === "medium" ? "amber" : "emerald"}>
            {finding.riskLevel} risk
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {finding.competitorName}: ${finding.price} | {finding.stockStatus.replaceAll("_", " ")} |{" "}
          {finding.discountDetected ? `${finding.discountPercentage}% discount` : "no discount"}
        </p>
        <p className="mt-2 text-sm text-slate-300">{finding.insight}</p>
      </>
    );
  }

  if ("inventoryRisk" in finding) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">{finding.productName}</p>
          <Badge tone={finding.riskLevel === "high" ? "rose" : finding.riskLevel === "medium" ? "amber" : "emerald"}>
            {finding.inventoryRisk.replaceAll("_", " ")}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {finding.currentStock} units | {finding.salesVelocity} velocity | {finding.profitMarginEstimate}% margin
        </p>
        <p className="mt-2 text-sm text-slate-300">{finding.recommendedAction}</p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-white">{finding.productName}</p>
        <Badge tone={finding.marketStatus === "growing" || finding.marketStatus === "viral" ? "emerald" : "amber"}>
          {finding.marketStatus}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Trend score {finding.trendScore}/100 | {finding.seasonality} seasonality | {finding.demandSignal} demand
      </p>
      <p className="mt-2 text-sm text-slate-300">{finding.recommendation}</p>
    </>
  );
}

export function AgentOutputPanel({ title, output }: { title: string; output: AgentOutput }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{output.summary}</p>
        </div>
        <Badge tone="emerald">{Math.round(output.confidence * 100)}% confidence</Badge>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {output.findings.map((finding) => (
          <article key={`${title}-${finding.productName}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            {renderFinding(finding)}
          </article>
        ))}
      </div>
    </section>
  );
}
