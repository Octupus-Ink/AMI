import Link from "next/link";
import type { RecentRun } from "@/lib/schemas/api";
import { Badge } from "@/components/ui/Badge";

export function RecentRuns({ runs }: { runs: RecentRun[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Recent analysis runs</h2>
        <Badge tone={runs.length ? "emerald" : "slate"}>{runs.length} runs</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {runs.length ? (
          runs.map((run) => (
            <Link
              href={`/analysis/${run.id}`}
              key={run.id}
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-300/50 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-sm font-semibold text-white">{run.summary}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Badge tone={run.status === "completed" ? "emerald" : "amber"}>{run.status}</Badge>
                {typeof run.finalScore === "number" ? (
                  <span className="text-sm font-semibold text-cyan-100">{run.finalScore}/100</span>
                ) : null}
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            No stored runs yet. Start an analysis to create the first run.
          </p>
        )}
      </div>
    </section>
  );
}
