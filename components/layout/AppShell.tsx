"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BriefcaseBusiness, CreditCard, LogOut, Menu, Settings2 } from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";

const internalNavigation = [
  { href: "/market-context-setup", label: "Briefing", icon: Settings2 },
  { href: "/recommendations", label: "AMI Strategy", icon: BarChart3 },
  { href: "/assistant-overview", label: "Assistants", icon: CreditCard },
  { href: "/account-workspace", label: "Control Hub", icon: BriefcaseBusiness }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicHome = pathname === "/";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.localStorage.removeItem("ami.marketContext");
    window.localStorage.removeItem("ami.briefingContext");
    window.localStorage.removeItem("ami.latestAnalysis");
    router.push("/");
  }

  if (isPublicHome) {
    return (
      <div className="min-h-screen">
        <HomeTopNav />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/market-context-setup" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
              AMI
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-950">Autonomous Marketplace Intelligence</p>
              <p className="text-xs text-slate-500">Decision-first marketplace workspace</p>
            </div>
          </Link>

          <>
              <nav className="hidden items-center gap-2 lg:flex">
                {internalNavigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-teal-300 bg-teal-50 text-teal-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-800"
                      }`}
                    >
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </nav>

              <details className="relative lg:hidden">
                <summary
                  className="inline-flex min-h-10 list-none items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-700"
                  aria-label="Open navigation menu"
                >
                  <Menu size={19} />
                </summary>
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {internalNavigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={logout}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                  >
                    Log out
                  </button>
                </div>
              </details>
            </>
        </div>
      </header>
      {children}
    </div>
  );
}

function HomeTopNav() {
  return (
    <header className="h-[72px] border-b border-slate-200 bg-white/88 backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 min-[1024px]:max-[1365px]:px-8 min-[1366px]:px-0">
        <BrightDataPill />

        <nav className="flex items-center gap-2 sm:gap-4">
          <a href="#how-it-works" className="hidden text-sm font-semibold text-slate-700 transition hover:text-teal-800 sm:inline">
            How it works?
          </a>
          <a href="#pricing" className="hidden text-sm font-semibold text-slate-700 transition hover:text-teal-800 sm:inline">
            Pricing
          </a>
          <a
            href="#new-workspace"
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            New Workspace
          </a>
        </nav>
      </div>
    </header>
  );
}
