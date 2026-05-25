import { Activity, ArrowRight, Database, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";

const agents = [
  { label: "Competitor Intelligence", tone: "cyan" },
  { label: "Inventory Optimization", tone: "emerald" },
  { label: "Trend Intelligence", tone: "amber" },
  { label: "Coordinator", tone: "rose" }
];

export default function Home() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_0.92fr]">
          <div className="max-w-3xl">
            <Badge tone="cyan">Hackathon MVP</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Autonomous Marketplace Intelligence System
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Live web intelligence for marketplace decisions. Three specialized agents analyze competitor pressure,
              inventory posture, and demand signals before a coordinator turns the evidence into business moves.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                <Activity size={18} />
                Launch Demo Analysis
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/api/health"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900"
              >
                <ShieldCheck size={18} />
                Check System Health
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-sm font-medium text-slate-400">Agent workspace</p>
                <p className="text-xl font-semibold text-white">Marketplace run preview</p>
              </div>
              <Badge tone="emerald">Demo safe</Badge>
            </div>
            <div className="space-y-3">
              {agents.map((agent, index) => (
                <div
                  key={agent.label}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm font-semibold text-slate-200">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{agent.label}</p>
                    <p className="text-xs text-slate-400">
                      {index === 3 ? "Synthesizes final recommendations" : "Produces structured findings"}
                    </p>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      agent.tone === "cyan"
                        ? "bg-cyan-300"
                        : agent.tone === "emerald"
                          ? "bg-emerald-300"
                          : agent.tone === "amber"
                            ? "bg-amber-300"
                            : "bg-rose-300"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <Network className="mb-3 text-cyan-300" size={20} />
                <p className="text-sm font-semibold text-white">Bright Data ready</p>
                <p className="mt-1 text-sm text-slate-400">SERP, scraper, and unlocker wrappers with demo fallback.</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <Database className="mb-3 text-emerald-300" size={20} />
                <p className="text-sm font-semibold text-white">MongoDB optional</p>
                <p className="mt-1 text-sm text-slate-400">Runs persist when configured and stay usable without it.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
