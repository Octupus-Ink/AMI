"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Database, Target } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const initialContext = {
  productName: "Insulated stainless steel tumbler",
  category: "Drinkware",
  targetMarketplace: "Amazon",
  supplierSource: "Verified supplier catalog",
  businessGoal: "increase_margin",
  region: "United States",
  currency: "USD",
  useInventoryContext: false
};

export function MarketContextClient() {
  const router = useRouter();
  const [form, setForm] = useState(initialContext);
  const [inventoryConnected, setInventoryConnected] = useState(false);
  const [inventoryLabel, setInventoryLabel] = useState("No inventory context connected");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadWorkspace() {
      const response = await fetch("/api/workspace");

      if (!response.ok) {
        router.push("/");
        return;
      }

      const snapshot = await response.json();
      const connected = Boolean(snapshot.inventoryStatus?.connected);
      setInventoryConnected(connected);
      setInventoryLabel(snapshot.inventoryStatus?.latestConnectionLabel ?? "No inventory context connected");
      setForm((current) => ({ ...current, useInventoryContext: connected }));
    }

    loadWorkspace();
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload = {
      ...form,
      useInventoryContext: inventoryConnected && form.useInventoryContext
    };
    const response = await fetch("/api/market-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);

    if (!response.ok) {
      setMessage("AMI could not save this market context.");
      return;
    }

    window.localStorage.setItem("ami.marketContext", JSON.stringify(payload));
    router.push("/processing");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="teal">Market Context Setup</Badge>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">Define the decision AMI should analyze</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              AMI uses this context to coordinate competitor, inventory, and trend review before returning a prioritized
              recommendation.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-950">
              <Database size={17} />
              Inventory context
            </div>
            <p className="mt-1">{inventoryLabel}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Product or product family" value={form.productName} onChange={(value) => setForm((current) => ({ ...current, productName: value }))} />
            <Field label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
            <Field
              label="Target marketplace"
              value={form.targetMarketplace}
              onChange={(value) => setForm((current) => ({ ...current, targetMarketplace: value }))}
            />
            <Field
              label="Supplier source"
              value={form.supplierSource}
              onChange={(value) => setForm((current) => ({ ...current, supplierSource: value }))}
            />
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Business goal</span>
              <select
                value={form.businessGoal}
                onChange={(event) => setForm((current) => ({ ...current, businessGoal: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="increase_margin">Increase margin</option>
                <option value="capture_demand">Capture demand</option>
                <option value="reduce_stock_risk">Reduce stock risk</option>
                <option value="validate_opportunity">Validate opportunity</option>
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Region" value={form.region} onChange={(value) => setForm((current) => ({ ...current, region: value }))} />
              <Field
                label="Currency"
                value={form.currency}
                onChange={(value) => setForm((current) => ({ ...current, currency: value.toUpperCase() }))}
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Target size={17} />
                Use inventory context
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {inventoryConnected
                  ? "AMI will include the connected inventory context in the recommendation."
                  : "Connect inventory inside Account / Workspace to enable this context."}
              </span>
            </span>
            <input
              type="checkbox"
              checked={inventoryConnected && form.useInventoryContext}
              disabled={!inventoryConnected}
              onChange={(event) => setForm((current) => ({ ...current, useInventoryContext: event.target.checked }))}
              className="h-5 w-5 accent-teal-700"
            />
          </label>

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
