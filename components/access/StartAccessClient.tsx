"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Play, UserPlus } from "lucide-react";

type PanelMode = "login" | "register";

const preparedDemoBriefing = {
  productName: "Insulated stainless steel tumbler",
  category: "Drinkware",
  targetMarketplace: "Amazon",
  supplierSource: "Verified supplier catalog",
  businessGoal: "discover_new_products",
  region: "United States",
  currency: "USD",
  useInventoryContext: true
};

const registerInitial = {
  name: "Demo Operator",
  email: "",
  password: "",
  workspaceName: "AMI Workspace",
  workspaceType: "Marketplace operator",
  defaultRegion: "United States",
  defaultCurrency: "USD",
  businessName: "Northstar Marketplace",
  businessType: "Marketplace operator",
  primaryMarketplace: "Amazon",
  mainProductCategory: "Home and kitchen",
  targetRegion: "United States"
};

export function StartAccessClient() {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("login");
  const [register, setRegister] = useState(registerInitial);
  const [login, setLogin] = useState({ workspaceId: "", password: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function syncHashMode() {
      setMode(window.location.hash === "#new-workspace" ? "register" : "login");
    }

    syncHashMode();
    window.addEventListener("hashchange", syncHashMode);
    return () => window.removeEventListener("hashchange", syncHashMode);
  }, []);

  async function submitDemo() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/demo", { method: "POST" });
    setBusy(false);

    if (!response.ok) {
      setMessage("Demo access could not be started.");
      return;
    }

    window.localStorage.setItem("ami.marketContext", JSON.stringify(preparedDemoBriefing));
    window.localStorage.setItem("ami.briefingContext", JSON.stringify(preparedDemoBriefing));
    router.push("/processing");
  }

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(login)
    });
    setBusy(false);

    if (!response.ok) {
      setMessage("Login was not accepted. Confirm the email, workspace ID, or password.");
      return;
    }

    router.push("/market-context-setup");
  }

  async function submitRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: {
          name: register.name,
          email: register.email,
          password: register.password
        },
        workspace: {
          workspaceName: register.workspaceName,
          workspaceType: register.workspaceType,
          defaultRegion: register.defaultRegion,
          defaultCurrency: register.defaultCurrency
        },
        marketplaceProfile: {
          businessName: register.businessName,
          businessType: register.businessType,
          primaryMarketplace: register.primaryMarketplace,
          mainProductCategory: register.mainProductCategory,
          targetRegion: register.targetRegion,
          defaultCurrency: register.defaultCurrency
        }
      })
    });
    setBusy(false);

    if (!response.ok) {
      setMessage("Workspace creation was not accepted. Confirm the required account and workspace fields.");
      return;
    }

    router.push("/market-context-setup");
  }

  return (
    <main className="ami-home-canvas relative isolate flex min-h-[calc(100vh-72px)] items-center overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="ami-home-orb ami-home-orb-a" />
        <div className="ami-home-orb ami-home-orb-b" />
        <div className="ami-home-orb ami-home-orb-c" />
      </div>
      <section className="mx-auto flex min-h-[65vh] w-full max-w-7xl flex-col items-start z-1 justify-center gap-10 py-10 lg:flex-row lg:gap-16">
        <div className="flex min-w-0 flex-1 flex-col justify-center items-flex-start">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-950 text-base font-bold text-white">
            AMI
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            Autonomous Marketplace Intelligence
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            AMI reviews marketplace context, social trends, inventory status, coordinates specialized assistants, and returns a ranked business
            recommendation with confidence, risk, evidence, and a suggested next step.
          </p>
        </div>

        <section className="w-full shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-8 py-8 shadow-lg shadow-slate-200/50 lg:max-w-md">
          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--text-tertiary)]">Welcome back</p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Sign in to your workspace</h2>
              </div>
              <Field
                label="Email or workspace ID"
                value={login.workspaceId}
                onChange={(value) => setLogin((current) => ({ ...current, workspaceId: value }))}
              />
              <Field
                label="Password"
                type="password"
                value={login.password}
                onChange={(value) => setLogin((current) => ({ ...current, password: value }))}
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-[var(--accent-light)] px-4 py-2.5 text-sm font-medium text-teal-800 shadow-sm shadow-teal-100/50 transition-all duration-150 hover:-translate-y-[1px] hover:border-teal-300 hover:bg-teal-100 hover:text-teal-900 hover:shadow-md hover:shadow-teal-100/70 active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                <LockKeyhole size={18} />
                Log in
              </button>
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
                <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={submitDemo}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-teal-200/50 transition-all duration-150 hover:-translate-y-[1px] hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-teal-200/70 active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                <Play size={18} />
                Start Demo Analysis
              </button>
              <div className="text-center text-xs text-slate-500">
                Demo credits simulate assistant usage in this MVP. Real payment processing is not active.
              </div>
            </form>
          ) : (
            <form id="new-workspace" onSubmit={submitRegister} className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Create your workspace</p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Get started with AMI</h2>
              </div>
              <div className="flex flex-wrap gap-4">
                <Field label="Name" value={register.name} onChange={(value) => setRegister((current) => ({ ...current, name: value }))} />
                <Field
                  label="Email"
                  type="email"
                  value={register.email}
                  onChange={(value) => setRegister((current) => ({ ...current, email: value }))}
                />
                <Field
                  label="Password"
                  type="password"
                  value={register.password}
                  onChange={(value) => setRegister((current) => ({ ...current, password: value }))}
                />
                <Field
                  label="Workspace name"
                  value={register.workspaceName}
                  onChange={(value) => setRegister((current) => ({ ...current, workspaceName: value }))}
                />
                <Field
                  label="Workspace type"
                  value={register.workspaceType}
                  onChange={(value) => setRegister((current) => ({ ...current, workspaceType: value }))}
                />
                <Field
                  label="Default region"
                  value={register.defaultRegion}
                  onChange={(value) => setRegister((current) => ({ ...current, defaultRegion: value, targetRegion: value }))}
                />
                <Field
                  label="Default currency"
                  value={register.defaultCurrency}
                  onChange={(value) => setRegister((current) => ({ ...current, defaultCurrency: value.toUpperCase() }))}
                />
                <Field
                  label="Business name"
                  value={register.businessName}
                  onChange={(value) => setRegister((current) => ({ ...current, businessName: value }))}
                />
                <Field
                  label="Business type"
                  value={register.businessType}
                  onChange={(value) => setRegister((current) => ({ ...current, businessType: value }))}
                />
                <Field
                  label="Primary marketplace"
                  value={register.primaryMarketplace}
                  onChange={(value) => setRegister((current) => ({ ...current, primaryMarketplace: value }))}
                />
                <Field
                  label="Main product category"
                  value={register.mainProductCategory}
                  onChange={(value) => setRegister((current) => ({ ...current, mainProductCategory: value }))}
                />
                <Field
                  label="Target region"
                  value={register.targetRegion}
                  onChange={(value) => setRegister((current) => ({ ...current, targetRegion: value }))}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-teal-200/50 transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={18} />
                Create AMI Workspace
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {message && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-[var(--warning-light)] px-4 py-3 text-sm text-amber-800">
              {message}
            </p>
          )}
        </section>
      </section>
  <style>{`
    .ami-home-canvas {
      background:
        linear-gradient(135deg, #f8fafc 0%, #ffffff 46%, rgba(240, 253, 250, 0.72) 100%);
    }

    .ami-home-orb {
      position: absolute;
      border-radius: 9999px;
      filter: blur(72px);
      opacity: 0.48;
      will-change: transform;
    }

    .ami-home-orb-a {
      width: 520px;
      height: 520px;
      left: -120px;
      top: 48px;
      background: rgba(13, 148, 136, 0.18);
      animation: ami-home-orb-a 11s ease-in-out infinite;
    }

    .ami-home-orb-b {
      width: 560px;
      height: 560px;
      right: -160px;
      top: 80px;
      background: rgba(37, 99, 235, 0.11);
      animation: ami-home-orb-b 13s ease-in-out infinite;
    }

    .ami-home-orb-c {
      width: 620px;
      height: 620px;
      left: 42%;
      bottom: -260px;
      background: rgba(20, 184, 166, 0.12);
      animation: ami-home-orb-c 15s ease-in-out infinite;
    }

    @keyframes ami-home-orb-a {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(48px, 22px, 0) scale(1.2);
      }
    }

    @keyframes ami-home-orb-b {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(-56px, 30px, 0) scale(1.1);
      }
    }

    @keyframes ami-home-orb-c {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(-28px, -44px, 0) scale(1.07);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ami-home-orb-a,
      .ami-home-orb-b,
      .ami-home-orb-c {
        animation: none;
      }
    }
  `}</style>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block min-w-48 flex-1">
      <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-500/20"
      />
    </label>
  );
}
