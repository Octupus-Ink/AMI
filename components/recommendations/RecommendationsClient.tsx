"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileSearch,
  ShieldAlert
} from "lucide-react";
import { PageShell, Section, Surface } from "@/components/layout/PagePrimitives";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult, SourceMode, SupplierOption } from "@/lib/schemas/ami";
import { BusinessGoals, VisibleAssistants } from "@/lib/schemas/ami";

const strategyTabs = [
  "Product Candidates",
  "Promo Candidates",
  "Inventory Actions",
  "Supplier Comparison",
  "Evidence & Reasoning"
] as const;

type StrategyTab = (typeof strategyTabs)[number];

function formatMode(mode: SourceMode | string) {
  return String(mode)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function goalLabel(goalId: string) {
  return BusinessGoals.find((goal) => goal.id === goalId)?.label ?? goalId;
}

function assistantTone(status: string | undefined): "neutral" | "green" | "amber" | "red" | "blue" {
  if (status === "completed") {
    return "green";
  }

  if (status === "warning" || status === "skipped") {
    return "amber";
  }

  if (status === "failed") {
    return "red";
  }

  if (status === "running") {
    return "blue";
  }

  return "neutral";
}

function fallbackSupplierOptions(analysis: AnalysisResult): SupplierOption[] {
  const evidence = analysis.evidencePackages[0];

  return [
    {
      supplierName: "Verified supplier catalog option",
      source: analysis.marketContext.supplierSource,
      estimatedUnitCost: evidence?.supplierPrice ?? 0,
      estimatedDeliveryTime: "Validation required",
      availability: "Supplier validation pending",
      ratingQualityProxy: "Quality proxy pending",
      matchConfidence: evidence?.matchQuality ?? "medium",
      risk: "medium"
    }
  ];
}

export function RecommendationsClient() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<StrategyTab>("Product Candidates");

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search);
      const runId = params.get("runId");
      const cached = window.localStorage.getItem("ami.latestAnalysis");

      if (runId) {
        const response = await fetch(`/api/analysis/${runId}`);

        if (response.ok) {
          const result = (await response.json()) as AnalysisResult;
          setAnalysis(result);
          setSelectedId(result.executiveRecommendation.recommendationId);
          return;
        }
      }

      if (cached) {
        const result = JSON.parse(cached) as AnalysisResult;
        setAnalysis(result);
        setSelectedId(result.executiveRecommendation.recommendationId);
        return;
      }

      router.push("/market-context-setup");
    }

    load();
  }, [router]);

  const selected = useMemo(() => {
    if (!analysis) {
      return null;
    }

    return analysis.opportunities.find((recommendation) => recommendation.recommendationId === selectedId) ?? analysis.executiveRecommendation;
  }, [analysis, selectedId]);

  if (!analysis || !selected) {
    return null;
  }

  const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === selected.evidencePackageId);
  const suppliers = analysis.supplierOptions?.length ? analysis.supplierOptions : fallbackSupplierOptions(analysis);
  const strategySignals =
    analysis.assistantFindings.length > 0
      ? analysis.assistantFindings
      : selected.assistantContributions.map((contribution) => ({
          assistantId: contribution.assistantId,
          finding: contribution.latestContribution,
          reason: contribution.summary,
          risk: contribution.risk,
          confidence: contribution.confidence
        }));
  const promoCandidateCount = analysis.assistantFindings.filter(
    (finding) => (finding.assistantId === "trend" || finding.assistantId === "competitor") && finding.signal !== "weak"
  ).length;
  const inventoryActionCount = analysis.assistantFindings.filter(
    (finding) => finding.assistantId === "inventory" && analysis.assistantStatus?.inventory !== "skipped"
  ).length;

  return (
    <PageShell>
      <section className="border-b border-slate-200 pb-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge tone="teal">AMI Strategy</Badge>
            <p className="mt-5 text-xs font-semibold uppercase text-slate-500">Business goal</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {goalLabel(analysis.marketContext.businessGoal)}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-600">
              <span>
                <span className="font-semibold text-slate-950">Last analysis:</span>{" "}
                {analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : "Pending"}
              </span>
              <span>
                <span className="font-semibold text-slate-950">Source mode:</span>{" "}
                {formatMode(analysis.sourceCollectionStatus.mode)}
              </span>
              <BrightDataPill />
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
            <Counter label="Product Candidates" value={analysis.opportunities.length} />
            <Counter label="Promo Candidates" value={promoCandidateCount} />
            <Counter label="Inventory Actions" value={inventoryActionCount} />
          </div>
        </div>
      </section>

      {analysis.warnings?.length > 0 && (
        <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 text-amber-800" size={20} />
            <p className="text-sm leading-6 text-amber-950">{analysis.warnings[0]}</p>
          </div>
        </section>
      )}

      <Section className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">AMI Strategy Signals | Category: {analysis.marketContext.category}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Interpreted signals explaining why AMI detected a strategic opening in this market context.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-4">
          {strategySignals.map((signal) => {
            const assistant = VisibleAssistants.find((item) => item.id === signal.assistantId);

            return (
              <div
                key={`${signal.assistantId}-${signal.finding}`}
                className="flex flex-col gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-start"
              >
                <div className="min-w-32">
                  <Badge tone={signal.risk === "high" ? "red" : signal.risk === "medium" ? "amber" : "green"}>
                    {signal.risk} risk
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950">{signal.finding}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{signal.reason}</p>
                  {assistant && <p className="mt-1 text-xs font-semibold uppercase text-slate-400">{assistant.name}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {strategyTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-teal-600 text-teal-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <Surface className="mt-5">
          <ActiveTabContent activeTab={activeTab} analysis={analysis} selected={selected} evidence={evidence} suppliers={suppliers} />
        </Surface>
      </Section>

      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 text-amber-800" size={20} />
          <p className="text-sm leading-6 text-amber-950">
            AMI does not automate purchasing. Approved recommendations are stored as decision history inside Control Hub.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-36 border-l-2 border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ActiveTabContent({
  activeTab,
  analysis,
  selected,
  evidence,
  suppliers
}: {
  activeTab: StrategyTab;
  analysis: AnalysisResult;
  selected: AnalysisResult["executiveRecommendation"];
  evidence: AnalysisResult["evidencePackages"][number] | undefined;
  suppliers: SupplierOption[];
}) {
  if (activeTab === "Product Candidates") {
    return (
      <div>
        <TabHeader
          title="Product Candidates"
          description="Product candidates generated from this analysis are shown as simple previews for now."
        />
        <div className="mt-4 flex flex-col gap-3">
          {analysis.opportunities.length > 0 ? (
            analysis.opportunities.map((recommendation) => (
              <div key={recommendation.recommendationId} className="border-b border-slate-100 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={recommendation.riskLevel === "high" ? "red" : recommendation.riskLevel === "medium" ? "amber" : "green"}>
                    {recommendation.riskLevel} risk
                  </Badge>
                  <Badge tone="blue">{recommendation.confidenceLevel} confidence</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{recommendation.recommendedAction}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.primaryReason}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">Product candidates generated from this analysis will appear here.</p>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "Promo Candidates") {
    return (
      <div>
        <TabHeader
          title="Promo Candidates"
          description="Promotion candidates generated from trend, competitor, and inventory signals will appear here."
        />
        <p className="mt-4 text-sm leading-6 text-slate-600">
          AMI has signal inputs for demand, competitor pressure, and market timing. Promo-specific output mapping is deferred.
        </p>
      </div>
    );
  }

  if (activeTab === "Inventory Actions") {
    const inventoryContribution = selected.assistantContributions.find((contribution) => contribution.assistantId === "inventory");

    return (
      <div>
        <TabHeader
          title="Inventory Actions"
          description="Inventory actions recommended from workspace context and market signals will appear here."
        />
        {inventoryContribution ? (
          <div className="mt-4 border-l-2 border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">{inventoryContribution.latestContribution}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{inventoryContribution.summary}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Inventory actions recommended from workspace context and market signals will appear here.</p>
        )}
      </div>
    );
  }

  if (activeTab === "Supplier Comparison") {
    return (
      <div>
        <TabHeader title="Supplier Comparison" description="Aggregated supplier comparison for the current analysis context." />
        {suppliers.length > 0 ? (
          <SupplierTable suppliers={suppliers} />
        ) : (
          <p className="mt-4 text-sm text-slate-600">Aggregated supplier comparison will appear here.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabHeader
          title="Evidence & Reasoning"
          description="Assistant reasoning, source evidence, product match, and technical details for this analysis."
        />
        <BrightDataPill />
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" open>
        <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
          Source evidence
          <FileSearch size={18} />
        </summary>
        {evidence ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
            <Comparison label="Product identity" value={evidence.productIdentity} />
            <Comparison label="Source marketplace" value={evidence.sourceMarketplace} />
            <Comparison label="Source mode" value={formatMode(evidence.brightDataMode)} />
            <Comparison label="Bright Data product" value={evidence.brightDataProduct} />
            <Comparison label="Current price" value={`$${evidence.currentPrice.toFixed(2)}`} />
            <Comparison label="Supplier price" value={`$${evidence.supplierPrice.toFixed(2)}`} />
            <Comparison label="Matched attributes" value={evidence.matchedAttributes.join(", ")} />
            <Comparison label="Demand indicators" value={evidence.demandIndicators.join(", ")} />
            <Comparison label="Risk inputs" value={evidence.riskInputs.join(", ")} />
            <Comparison label="Evidence package" value={evidence.evidencePackageId} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Assistant reasoning, source evidence, product match, and technical details will appear here.</p>
        )}
      </details>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
          Assistant reasoning and technical details
          <ChevronRight size={18} />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          {selected.assistantContributions.map((contribution) => {
            const assistant = VisibleAssistants.find((item) => item.id === contribution.assistantId);

            return (
              <div key={contribution.assistantId} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">{assistant?.name ?? contribution.assistantId}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={assistantTone(analysis.assistantStatus?.[contribution.assistantId])}>
                      {formatMode(analysis.assistantStatus?.[contribution.assistantId] ?? "completed")}
                    </Badge>
                    <Badge tone={contribution.risk === "high" ? "red" : contribution.risk === "medium" ? "amber" : "green"}>
                      {contribution.confidence}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{contribution.summary}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{contribution.latestContribution}</p>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            <Comparison label="Analysis run" value={analysis.analysisRunId} />
            <Comparison label="Collection mode" value={formatMode(analysis.sourceCollectionStatus.mode)} />
            <Comparison label="Collected at" value={new Date(analysis.sourceCollectionStatus.collectedAt).toLocaleString()} />
            <Comparison label="Status" value={analysis.status} />
          </div>
        </div>
      </details>
    </div>
  );
}

function TabHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SupplierTable({ suppliers }: { suppliers: SupplierOption[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-500">
            {["Supplier", "Source", "Unit cost", "Delivery", "Availability", "Rating / quality", "Match", "Risk"].map((header) => (
              <th key={header} className="border-b border-slate-200 px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={`${supplier.supplierName}-${supplier.source}`}>
              <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">{supplier.supplierName}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{supplier.source}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">${supplier.estimatedUnitCost.toFixed(2)}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{supplier.estimatedDeliveryTime}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{supplier.availability}</td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{supplier.ratingQualityProxy}</td>
              <td className="border-b border-slate-100 px-3 py-3 capitalize text-slate-700">{supplier.matchConfidence}</td>
              <td className="border-b border-slate-100 px-3 py-3 capitalize text-slate-700">{supplier.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Comparison({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-56 flex-1 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
