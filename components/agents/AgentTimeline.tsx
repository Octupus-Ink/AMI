import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";

type TimelineStep = {
  key: string;
  label: string;
  description: string;
  status: string;
};

function iconFor(status: string) {
  if (status === "completed") {
    return <CheckCircle2 size={18} className="text-emerald-300" />;
  }

  if (status === "running") {
    return <Loader2 size={18} className="animate-spin text-cyan-300" />;
  }

  if (status === "failed") {
    return <XCircle size={18} className="text-rose-300" />;
  }

  return <CircleDashed size={18} className="text-slate-500" />;
}

export function AgentTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
      <h2 className="text-lg font-semibold text-white">Agent activity timeline</h2>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <div key={step.key} className="grid grid-cols-[1.5rem_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 items-center justify-center">{iconFor(step.status)}</span>
              {index < steps.length - 1 ? <span className="mt-2 h-full min-h-7 w-px bg-slate-800" /> : null}
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">{step.label}</p>
                <span className="rounded-lg border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
                  {step.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
