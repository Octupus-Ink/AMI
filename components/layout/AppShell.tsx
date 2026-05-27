import Link from "next/link";
import { BarChart3, BriefcaseBusiness, CreditCard, Home, Radar, Settings2 } from "lucide-react";

const navigation = [
  { href: "/", label: "Start / Access", icon: Home },
  { href: "/market-context-setup", label: "Market Context Setup", icon: Settings2 },
  { href: "/processing", label: "Processing", icon: Radar },
  { href: "/recommendations", label: "AMI Recommendations", icon: BarChart3 },
  { href: "/assistant-overview", label: "Assistant Overview", icon: CreditCard },
  { href: "/account-workspace", label: "Account / Workspace", icon: BriefcaseBusiness }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
                AMI
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Autonomous Marketplace Intelligence</p>
                <p className="text-xs text-slate-500">Decision-first marketplace workspace</p>
              </div>
            </Link>
            <div className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              Bright Data: live when configured, demo fallback otherwise
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
