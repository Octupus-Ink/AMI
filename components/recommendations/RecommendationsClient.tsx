"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Download,
  FileSearch,
  RefreshCcw,
  Save,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisResult, SourceMode, SupplierOption } from "@/lib/schemas/ami";
import { BusinessGoals, VisibleAssistants } from "@/lib/schemas/ami";

function formatMode(mode: SourceMode | string) {
  return String(mode)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function goalLabel(goalId: string) {
  return BusinessGoals.find((goal) => goal.id === goalId)?.label ?? goalId;
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

  async function action(kind: "save" | "approve" | "export") {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/recommendations/${selected.recommendationId}/${kind}`, {
      method: "POST"
    });

    if (!response.ok) {
      setMessage("AMI could not complete this strategy action.");
      return;
    }

    const payload = await response.json();
    setMessage(
      kind === "approve"
        ? "Recommendation approved and added to Control Hub history."
        : kind === "save"
          ? "Report saved to Control Hub."
          : "Strategy summary exported as demo JSON."
    );

    if (kind === "export") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ami-strategy-summary.demo.json";
      anchor.click();
      URL.revokeObjectURL(url);
    }
  }

  if (!analysis || !selected) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Badge tone="teal">AMI Strategy</Badge>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Preparing strategy workspace</h1>
        </section>
      </main>
    );
  }

  const evidence = analysis.evidencePackages.find((item) => item.evidencePackageId === selected.evidencePackageId);
  const suppliers = analysis.supplierOptions?.length ? analysis.supplierOptions : fallbackSupplierOptions(analysis);
  const expectedImpact =
    selected.estimatedMargin > 0
      ? `Protect approximately ${selected.estimatedMargin.toFixed(1)}% estimated margin while validating demand and sourcing fit.`
      : "Validate demand, sourcing fit, and operational risk before committing budget.";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="teal">AMI Strategy</Badge>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">Review the prioritized recommendation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review the prioritized recommendation, assistant reasoning, evidence, and next action.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <Meta label="Business goal" value={goalLabel(analysis.marketContext.businessGoal)} />
            <Meta label="Last analysis" value={analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : "Pending"} />
            <Meta label="Source mode" value={formatMode(analysis.sourceCollectionStatus.mode)} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 shrink-0 text-teal-800" size={22} />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Recommended action</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selected.recommendedAction}</h2>
              <div className="mt-5 grid gap-4">
                <StrategyPoint label="Why it matters" value={selected.primaryReason} />
                <StrategyPoint label="Expected business impact" value={expectedImpact} />
                <StrategyPoint label="Suggested next step" value={selected.suggestedNextStep} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Signal label="Confidence" value={selected.confidenceLevel} tone="blue" />
            <Signal label="Risk" value={selected.riskLevel} tone={selected.riskLevel === "high" ? "red" : "amber"} />
            <Signal label="Data freshness" value={selected.dataFreshness} tone="teal" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => action("save")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              <Save size={18} />
              Save report
            </button>
            <button
              type="button"
              onClick={() => action("approve")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <BadgeCheck size={18} />
              Approve recommendation
            </button>
            <button
              type="button"
              onClick={() => action("export")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              <Download size={18} />
              Export summary
            </button>
            <button
              type="button"
              onClick={() => router.push("/market-context-setup")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              <RefreshCcw size={18} />
              Run new briefing
            </button>
          </div>

          {message && <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-teal-700" size={20} />
            <h2 className="text-lg font-semibold text-slate-950">Opportunity ranking</h2>
          </div>
          <div className="mt-4 space-y-3">
            {analysis.opportunities.map((recommendation, index) => (
              <button
                key={recommendation.recommendationId}
                type="button"
                onClick={() => setSelectedId(recommendation.recommendationId)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedId === recommendation.recommendationId
                    ? "border-teal-300 bg-teal-50"
                    : "border-slate-200 bg-white hover:border-teal-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                  <Badge tone={recommendation.riskLevel === "high" ? "red" : "amber"}>{recommendation.riskLevel} risk</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{recommendation.recommendedAction}</p>
                <p className="mt-2 text-xs text-slate-600">{recommendation.opportunityScore}/100 opportunity score</p>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Opportunity score" value={`${selected.opportunityScore}/100`} />
        <Metric label="Confidence" value={selected.confidenceLevel} />
        <Metric label="Risk level" value={selected.riskLevel} />
        <Metric label="Estimated margin" value={`${selected.estimatedMargin.toFixed(1)}%`} />
        <Metric label="Demand signal" value={selected.demandSignal} />
        <Metric label="Data freshness" value={selected.dataFreshness} />
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Assistant contribution summary</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {selected.assistantContributions.map((contribution) => {
            const assistant = VisibleAssistants.find((item) => item.id === contribution.assistantId);

            return (
              <div key={contribution.assistantId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{assistant?.name}</p>
                  <Badge tone={contribution.risk === "high" ? "red" : contribution.risk === "medium" ? "amber" : "green"}>
                    {contribution.confidence}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{contribution.summary}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{contribution.latestContribution}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Supplier comparison</h2>
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
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Evidence layer</h2>
          <BrightDataPill />
        </div>

        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4" open>
          <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
            Evidence and source data
            <FileSearch size={18} />
          </summary>
          {evidence && (
            <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
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
          )}
        </details>

        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="flex items-center justify-between text-sm font-semibold text-slate-950">
            Assistant reasoning and technical details
            <ChevronRight size={18} />
          </summary>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <Comparison label="Analysis run" value={analysis.analysisRunId} />
            <Comparison label="Collection mode" value={formatMode(analysis.sourceCollectionStatus.mode)} />
            <Comparison label="Collected at" value={new Date(analysis.sourceCollectionStatus.collectedAt).toLocaleString()} />
            <Comparison label="Status" value={analysis.status} />
          </div>
        </details>
      </section>

      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 text-amber-800" size={20} />
          <p className="text-sm leading-6 text-amber-950">
            AMI does not automate purchasing. Approved recommendations are stored as decision history inside Control Hub.
          </p>
        </div>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StrategyPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold capitalize text-slate-950">{value}</p>
    </div>
  );
}

function Signal({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "teal" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    teal: "border-teal-200 bg-teal-50 text-teal-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900"
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-2 text-base font-semibold capitalize">{value}</p>
    </div>
  );
}

function Comparison({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
