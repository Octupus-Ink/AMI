"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Database, LinkIcon, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BusinessGoals, type MarketContextPayload } from "@/lib/schemas/ami";

const initialContext: MarketContextPayload = {
  productName: "Insulated stainless steel tumbler",
  category: "Drinkware",
  targetMarketplace: "Amazon",
  supplierSource: "Verified supplier catalog",
  businessGoal: "discover_new_products",
  region: "United States",
  currency: "USD",
  useInventoryContext: false
};

type InventoryStatus = {
  connected?: boolean;
  latestConnectionLabel?: string;
  lastSyncAt?: string | null;
  status?: string;
};

export function MarketContextClient() {
  const router = useRouter();
  const [form, setForm] = useState<MarketContextPayload>(initialContext);
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const inventoryConnected = Boolean(inventoryStatus.connected);
  const inventoryDependentGoal = form.businessGoal === "stock_optimization" || form.businessGoal === "revenue_stock_opportunities";

  useEffect(() => {
    async function loadWorkspace() {
      const stored = window.localStorage.getItem("ami.briefingContext") ?? window.localStorage.getItem("ami.marketContext");

      if (stored) {
        const parsed = JSON.parse(stored) as MarketContextPayload;
        if (BusinessGoals.some((goal) => goal.id === parsed.businessGoal)) {
          setForm({ ...initialContext, ...parsed });
        }
      }

      const response = await fetch("/api/workspace");

      if (!response.ok) {
        router.push("/");
        return;
      }

      const snapshot = await response.json();
      setInventoryStatus(snapshot.inventoryStatus ?? {});
    }

    loadWorkspace();
  }, [router]);

  function updateForm(next: Partial<MarketContextPayload>) {
    setForm((current) => {
      const updated = { ...current, ...next };
      window.localStorage.setItem("ami.briefingContext", JSON.stringify(updated));
      return updated;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload = {
      ...form,
      useInventoryContext: inventoryConnected
    };
    const response = await fetch("/api/market-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);

    if (!response.ok) {
      setMessage("AMI could not save this briefing.");
      return;
    }

    window.localStorage.setItem("ami.marketContext", JSON.stringify(payload));
    window.localStorage.setItem("ami.briefingContext", JSON.stringify(payload));
    router.push("/processing");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge tone="teal">Briefing</Badge>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Define the decision AMI should analyze</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          AMI coordinates trend, competitor, supplier, and inventory signals to evaluate market conditions and generate
          prioritized recommendations.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 text-teal-700" size={20} />
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {inventoryConnected ? "Inventory connected" : "Inventory not connected"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {inventoryConnected
                    ? `Latest sync: ${
                        inventoryStatus.lastSyncAt ? new Date(inventoryStatus.lastSyncAt).toLocaleString() : "Demo snapshot"
                      }`
                    : "Connect inventory to give AMI operational context."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/account-workspace#marketplace-setup")}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              {inventoryConnected ? <RefreshCw size={16} /> : <LinkIcon size={16} />}
              {inventoryConnected ? "Re-sync" : "Connect inventory"}
            </button>
          </div>
          {inventoryDependentGoal && !inventoryConnected && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              This goal works best with connected inventory. Connect inventory or continue with demo context.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Product or product family"
              value={form.productName}
              onChange={(value) => updateForm({ productName: value })}
            />
            <Field label="Category" value={form.category} onChange={(value) => updateForm({ category: value })} />
            <Field
              label="Target marketplace"
              value={form.targetMarketplace}
              onChange={(value) => updateForm({ targetMarketplace: value })}
            />
            <Field label="Supplier source" value={form.supplierSource} onChange={(value) => updateForm({ supplierSource: value })} />
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Business goal</span>
              <select
                value={form.businessGoal}
                onChange={(event) => updateForm({ businessGoal: event.target.value as MarketContextPayload["businessGoal"] })}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                {BusinessGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                {BusinessGoals.find((goal) => goal.id === form.businessGoal)?.description}
              </span>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Region" value={form.region} onChange={(value) => updateForm({ region: value })} />
              <Field label="Currency" value={form.currency} onChange={(value) => updateForm({ currency: value.toUpperCase() })} />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Start AMI Analysis
            <ArrowRight size={18} />
          </button>
          {message && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
