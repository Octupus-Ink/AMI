"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Gauge, Save, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { AssistantUsage } from "@/lib/schemas/ami";
import { VisibleAssistants } from "@/lib/schemas/ami";

const thresholdCopy: Record<AssistantUsage["alertState"], string> = {
  normal: "Assistant usage is below warning threshold.",
  near_limit: "This assistant is close to its configured credit limit.",
  exceeded: "This assistant has reached its configured credit limit.",
  paused: "Assistant is disabled because its usage limit was exceeded or manually paused."
};

export function AssistantOverviewClient() {
  const [usage, setUsage] = useState<AssistantUsage[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/assistant-usage");

      if (response.ok) {
        const payload = await response.json();
        setUsage(payload.usage);
      }
    }

    load();
  }, []);

  const orderedUsage = useMemo(
    () =>
      VisibleAssistants.map((assistant) => ({
        assistant,
        usage: usage.find((item) => item.assistantId === assistant.id)
      })),
    [usage]
  );

  async function updateLimit(assistantId: AssistantUsage["assistantId"], creditLimit: number) {
    const response = await fetch("/api/assistant-usage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistantId, creditLimit })
    });

    if (!response.ok) {
      setMessage("Credit limit could not be updated.");
      return;
    }

    const payload = await response.json();
    setUsage((current) => current.map((item) => (item.assistantId === assistantId ? payload.usage : item)));
    setMessage("Assistant credit limit updated.");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge tone="teal">Assistants</Badge>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Assistants</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Monitor assistant usage, credit limits, source activity, and threshold states.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {orderedUsage.map(({ assistant, usage: item }) => {
            const usageItem =
              item ??
              ({
                assistantId: assistant.id,
                usageCount: 0,
                creditLimit: 100,
                creditsUsed: 0,
                estimatedUsageCost: 0,
                lastRun: null,
                latestContribution: "No completed AMI analysis yet.",
                dataSourcesUsed: ["Not used yet"],
                alertState: "normal"
              } satisfies AssistantUsage);
            const percent = Math.min(125, Math.round((usageItem.creditsUsed / usageItem.creditLimit) * 100));

            return (
              <div key={assistant.id} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{assistant.name}</h2>
                    <p className="mt-2 min-h-20 text-sm leading-6 text-slate-600">{assistant.role}</p>
                  </div>
                  <Badge tone={usageItem.alertState === "exceeded" || usageItem.alertState === "paused" ? "red" : usageItem.alertState === "near_limit" ? "amber" : "green"}>
                    {usageItem.alertState === "near_limit"
                      ? "Near limit"
                      : usageItem.alertState === "exceeded"
                        ? "Exceeded"
                        : usageItem.alertState === "paused"
                          ? "Paused"
                          : "Normal"}
                  </Badge>
                </div>

                <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">Credit limit</span>
                    <span className="font-semibold text-slate-950">
                      {usageItem.creditsUsed}/{usageItem.creditLimit}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        usageItem.alertState === "exceeded" || usageItem.alertState === "paused"
                          ? "bg-red-600"
                          : usageItem.alertState === "near_limit"
                            ? "bg-amber-500"
                            : "bg-teal-600"
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{thresholdCopy[usageItem.alertState]}</p>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <UsageFact icon={<Gauge size={17} />} label="Usage count" value={String(usageItem.usageCount)} />
                  <UsageFact icon={<WalletCards size={17} />} label="Estimated cost" value={`${usageItem.estimatedUsageCost.toFixed(2)} credits`} />
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-950">{usageItem.alertState.replace("_", " ")}</p>
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Latest run</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {usageItem.lastRun ? new Date(usageItem.lastRun).toLocaleString() : "No completed run"}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Latest contribution</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{usageItem.latestContribution}</p>
                  <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Data sources used</p>
                  <p className="mt-2 text-sm text-slate-700">{usageItem.dataSourcesUsed.join(", ")}</p>
                </div>

                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    updateLimit(usageItem.assistantId, Number(formData.get("creditLimit")));
                  }}
                >
                  <input
                    name="creditLimit"
                    type="number"
                    min={10}
                    max={5000}
                    defaultValue={usageItem.creditLimit}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-3 text-white transition hover:bg-teal-800"
                    aria-label={`Save ${assistant.name} credit limit`}
                    title={`Save ${assistant.name} credit limit`}
                  >
                    <Save size={18} />
                  </button>
                </form>

                {usageItem.alertState !== "normal" && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={17} />
                    <span>{thresholdCopy[usageItem.alertState]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {message && <p className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
      </section>
    </main>
  );
}

function UsageFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
