"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, DatabaseZap, Radar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { VisibleAssistants } from "@/lib/schemas/ami";

type AssistantState = "pending" | "running" | "completed";

const initialStates: Record<string, AssistantState> = {
  competitor: "pending",
  inventory: "pending",
  trend: "pending"
};

export function ProcessingClient() {
  const router = useRouter();
  const started = useRef(false);
  const [progress, setProgress] = useState(12);
  const [assistantStates, setAssistantStates] = useState(initialStates);
  const [sourceStatus, setSourceStatus] = useState("Collecting marketplace and demand signals");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    const stored = window.localStorage.getItem("ami.marketContext");

    if (!stored) {
      router.push("/market-context-setup");
      return;
    }

    const context = JSON.parse(stored);
    const timers = [
      window.setTimeout(() => {
        setProgress(28);
        setAssistantStates((current) => ({ ...current, competitor: "running" }));
      }, 300),
      window.setTimeout(() => {
        setProgress(48);
        setAssistantStates((current) => ({ ...current, competitor: "completed", inventory: "running" }));
        setSourceStatus("Bright Data contribution is being attached to the evidence package");
      }, 950),
      window.setTimeout(() => {
        setProgress(68);
        setAssistantStates((current) => ({ ...current, inventory: "completed", trend: "running" }));
      }, 1500)
    ];

    async function startAnalysis() {
      const response = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context)
      });

      if (!response.ok) {
        setMessage("AMI could not complete this analysis. Return to setup and validate the context.");
        return;
      }

      const result = await response.json();
      setAssistantStates({ competitor: "completed", inventory: "completed", trend: "completed" });
      setProgress(100);
      setSourceStatus(result.sourceCollectionStatus?.label ?? "Source collection completed");
      window.localStorage.setItem("ami.latestAnalysis", JSON.stringify(result));
      window.setTimeout(() => router.push(`/recommendations?runId=${result.analysisRunId}`), 650);
    }

    startAnalysis();

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [router]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="teal">Processing</Badge>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">AMI is coordinating the assistants</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              AMI is reviewing the market context, resolving assistant signals, and preparing the recommendation layer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/market-context-setup")}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
          >
            <ArrowLeft size={17} />
            Back to setup
          </button>
        </div>

        <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Radar className="text-teal-700" size={24} />
              <div>
                <p className="font-semibold text-slate-950">AMI status</p>
                <p className="text-sm text-slate-600">Generating decision-first recommendation</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-teal-800">{progress}%</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {VisibleAssistants.map((assistant) => {
            const state = assistantStates[assistant.id];

            return (
              <div key={assistant.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{assistant.name}</p>
                  {state === "completed" ? (
                    <CheckCircle2 className="text-emerald-600" size={20} />
                  ) : (
                    <CircleDashed className="text-teal-700" size={20} />
                  )}
                </div>
                <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{assistant.role}</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <StatusDot tone={state === "completed" ? "green" : state === "running" ? "teal" : "slate"} />
                  {state === "completed" ? "Completed" : state === "running" ? "Reviewing signals" : "Pending"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <DatabaseZap className="text-blue-800" size={20} />
            <p className="text-sm font-semibold text-blue-950">{sourceStatus}</p>
          </div>
        </div>

        {message && <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      </section>
    </main>
  );
}
