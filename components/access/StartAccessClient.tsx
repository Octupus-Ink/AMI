"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Play, UserPlus } from "lucide-react";
import { BrightDataPill } from "@/components/ui/BrightDataPill";

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
      setMessage("Login was not accepted. Confirm the workspace ID and password.");
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
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-slate-200 bg-white/92 p-6 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-950 text-base font-bold text-white">
            AMI
          </div>
          <div className="mt-5">
            <BrightDataPill />
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            Autonomous Marketplace Intelligence
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            AMI reviews marketplace context, coordinates specialized assistants, and returns a ranked business
            recommendation with confidence, risk, evidence, and a suggested next step.
          </p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Enter AMI with a prepared workspace</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use an existing workspace or start the prepared demo flow.
                </p>
              </div>
              <Field
                label="Workspace ID"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
              >
                <LockKeyhole size={18} />
                Log in
              </button>
              <div className="flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={submitDemo}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Play size={18} />
                Start Demo Analysis
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form id="new-workspace" onSubmit={submitRegister} className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Create a new workspace</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Set up the workspace context AMI will use for future briefings.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <UserPlus size={18} />
                Create AMI Workspace
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {message && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
        </section>
      </section>

      <section id="how-it-works" className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          "Brief the marketplace decision",
          "AMI coordinates assistant reasoning",
          "Review one prioritized strategy"
        ].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 shadow-sm">
            {item}
          </div>
        ))}
      </section>

      <section id="pricing" className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
        Demo credits simulate assistant usage in this MVP. Real payment processing is not active.
      </section>
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
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
