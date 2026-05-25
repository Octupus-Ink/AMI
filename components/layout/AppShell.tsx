import { BrainCircuit } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/75 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
              <BrainCircuit size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white sm:text-base">
                Autonomous Marketplace Intelligence
              </span>
              <span className="block truncate text-xs text-slate-400">Multi-agent marketplace optimization</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Link className="rounded-lg px-3 py-2 transition hover:bg-slate-900 hover:text-white" href="/dashboard">
              Dashboard
            </Link>
            <Link className="hidden rounded-lg px-3 py-2 transition hover:bg-slate-900 hover:text-white sm:block" href="/api/health">
              Health
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
