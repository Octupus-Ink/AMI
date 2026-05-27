"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, LogIn, Play, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type Mode = "demo" | "login" | "register";

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
  const [mode, setMode] = useState<Mode>("demo");
  const [register, setRegister] = useState(registerInitial);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitDemo() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/demo", { method: "POST" });
    setBusy(false);

    if (!response.ok) {
      setMessage("Demo access could not be started.");
      return;
    }

    router.push("/market-context-setup");
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
      setMessage("Login was not accepted.");
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
      setMessage("Registration was not accepted. Confirm the required account and workspace fields.");
      return;
    }

    router.push("/market-context-setup");
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white/92 p-6 shadow-sm">
        <Badge tone="teal">Hackathon MVP</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          Autonomous Marketplace Intelligence System / AMI
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          AMI reviews marketplace context, coordinates three specialized assistants, and returns a ranked business
          recommendation with confidence, risk, evidence, and a suggested next step.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            "Opportunity detected",
            "Reason and risk attached",
            "Evidence available on demand"
          ].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <CheckCircle2 className="text-teal-700" size={20} />
              <p className="mt-3 text-sm font-semibold text-slate-900">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-lg border border-teal-200 bg-teal-50 p-5">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-1 text-teal-800" size={20} />
            <div>
              <p className="font-semibold text-teal-950">AMI advisor model</p>
              <p className="mt-1 text-sm leading-6 text-teal-900">
                Competitor Assistant tracks market pressure. Inventory Assistant evaluates stock and margin context.
                Trend Assistant detects demand momentum. AMI owns the final recommendation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("demo")}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
              mode === "demo" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
            }`}
          >
            <Play size={16} />
            Demo
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
              mode === "login" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
            }`}
          >
            <LogIn size={16} />
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
              mode === "register" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
            }`}
          >
            <UserPlus size={16} />
            Register
          </button>
        </div>

        {mode === "demo" && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <Badge tone="blue">Demo access</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Enter AMI with a prepared workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The demo workspace uses seeded Bright Data-shaped source snapshots unless live Bright Data credentials are
              configured.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={submitDemo}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Start Demo Analysis
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={submitLogin} className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              value={login.email}
              onChange={(value) => setLogin((current) => ({ ...current, email: value }))}
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
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <LockKeyhole size={18} />
              Login
            </button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={submitRegister} className="mt-6 space-y-5">
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
              Create AMI Workspace
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {message && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
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
