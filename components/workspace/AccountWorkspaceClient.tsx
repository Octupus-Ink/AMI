"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Database,
  FileClock,
  LinkIcon,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Recommendation } from "@/lib/schemas/ami";

type WorkspaceSnapshot = {
  user?: { name: string; email: string };
  workspace?: Record<string, unknown>;
  marketplaceProfile?: Record<string, unknown>;
  credits?: { balance: number; lastLedgerEvent: string };
  inventoryStatus?: {
    connected?: boolean;
    latestConnectionLabel?: string;
    lastSyncAt?: string | null;
    lastAnalysisAt?: string | null;
    status?: string;
  };
  savedReports?: Array<Record<string, unknown>>;
  approvedRecommendations?: Recommendation[];
};

const initialInventory = {
  marketplaceName: "Amazon",
  marketplaceUrl: "https://www.amazon.com/",
  connectionType: "demo_snapshot",
  credentialType: "demo_snapshot",
  credential: "demo"
};

const initialPayment = {
  cardholderName: "Demo Operator",
  cardNumber: "",
  expirationMonth: "12",
  expirationYear: "2027",
  ccv: "",
  amountCredits: "250"
};

export function AccountWorkspaceClient() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({});
  const [inventory, setInventory] = useState(initialInventory);
  const [payment, setPayment] = useState(initialPayment);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadWorkspace() {
      const response = await fetch("/api/workspace");

      if (response.ok) {
        setSnapshot(await response.json());
      }
    }

    loadWorkspace();
  }, []);

  async function load() {
    const response = await fetch("/api/workspace");

    if (response.ok) {
      setSnapshot(await response.json());
    }
  }

  async function connectInventory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/inventory/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inventory)
    });

    if (!response.ok) {
      const error = await response.json();
      setMessage(error.error ?? "Inventory source could not be connected.");
      return;
    }

    setInventory((current) => ({ ...current, credential: "" }));
    setMessage("Inventory context connected. Credentials are stored encrypted and shown only as masked metadata.");
    await load();
  }

  async function simulatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/credits/simulate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardholderName: payment.cardholderName,
        cardNumber: payment.cardNumber,
        expirationMonth: Number(payment.expirationMonth),
        expirationYear: Number(payment.expirationYear),
        ccv: payment.ccv,
        amountCredits: Number(payment.amountCredits)
      })
    });

    if (!response.ok) {
      setMessage("Demo payment was not accepted.");
      return;
    }

    const payload = await response.json();
    setPayment((current) => ({ ...current, cardNumber: "", ccv: "" }));
    setMessage(`Simulated payment approved. Stored card reference: ****${payload.payment.cardLast4}.`);
    await load();
  }

  const workspace = snapshot.workspace ?? {};
  const profile = snapshot.marketplaceProfile ?? {};
  const inventoryStatus = snapshot.inventoryStatus;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge tone="teal">Account / Workspace</Badge>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Workspace context and decision history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          User profile, marketplace context, inventory context, recommendation history, and demo credits stay in this
          workspace area.
        </p>

        {message && <p className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel icon={<UserRound size={20} />} title="User profile">
          <Fact label="Name" value={snapshot.user?.name ?? "Not loaded"} />
          <Fact label="Email" value={snapshot.user?.email ?? "Not loaded"} />
        </Panel>

        <Panel icon={<BriefcaseBusiness size={20} />} title="Marketplace profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Workspace" value={String(workspace.workspaceName ?? workspace.name ?? "AMI Workspace")} />
            <Fact label="Workspace type" value={String(workspace.workspaceType ?? "Marketplace operator")} />
            <Fact label="Business" value={String(profile.businessName ?? "Marketplace business")} />
            <Fact label="Primary marketplace" value={String(profile.primaryMarketplace ?? "Marketplace")} />
            <Fact label="Main category" value={String(profile.mainProductCategory ?? "Category")} />
            <Fact label="Region / currency" value={`${String(profile.targetRegion ?? "Region")} / ${String(profile.defaultCurrency ?? "USD")}`} />
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel icon={<Database size={20} />} title="Inventory context">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Sync status</p>
              <Badge tone={inventoryStatus?.connected ? "green" : "neutral"}>{inventoryStatus?.status ?? "not_connected"}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">{inventoryStatus?.latestConnectionLabel ?? "No inventory source connected"}</p>
            <p className="mt-2 text-sm text-slate-600">
              {inventoryStatus?.lastAnalysisAt
                ? `Last analysis completed using inventory data from ${new Date(inventoryStatus.lastAnalysisAt).toLocaleString()}.`
                : "No inventory analysis timestamp is available yet."}
            </p>
          </div>

          <form onSubmit={connectInventory} className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Marketplace name"
                value={inventory.marketplaceName}
                onChange={(value) => setInventory((current) => ({ ...current, marketplaceName: value }))}
              />
              <Field
                label="Marketplace URL"
                value={inventory.marketplaceUrl}
                onChange={(value) => setInventory((current) => ({ ...current, marketplaceUrl: value }))}
              />
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Connection type</span>
                <select
                  value={inventory.connectionType}
                  onChange={(event) => setInventory((current) => ({ ...current, connectionType: event.target.value }))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="marketplace_url">marketplace_url</option>
                  <option value="api_key">api_key</option>
                  <option value="bearer_token">bearer_token</option>
                  <option value="csv_upload">csv_upload</option>
                  <option value="json_upload">json_upload</option>
                  <option value="demo_snapshot">demo_snapshot</option>
                </select>
              </label>
              <Field
                label="Credential type"
                value={inventory.credentialType}
                onChange={(value) => setInventory((current) => ({ ...current, credentialType: value }))}
              />
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Secure credential input</span>
              <input
                type="password"
                value={inventory.credential}
                onChange={(event) => setInventory((current) => ({ ...current, credential: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <LinkIcon size={18} />
              Connect Inventory Source
            </button>
          </form>
        </Panel>

        <Panel icon={<CreditCard size={20} />} title="Demo payment simulator">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Real Stripe billing is not active in this MVP. This simulator updates the internal credit ledger and stores only
            card last four, expiration, simulated status, and credit amount.
          </div>
          <form onSubmit={simulatePayment} className="mt-4 grid gap-4">
            <Field
              label="Cardholder name"
              value={payment.cardholderName}
              onChange={(value) => setPayment((current) => ({ ...current, cardholderName: value }))}
            />
            <Field
              label="Card number"
              value={payment.cardNumber}
              onChange={(value) => setPayment((current) => ({ ...current, cardNumber: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Exp. month"
                value={payment.expirationMonth}
                onChange={(value) => setPayment((current) => ({ ...current, expirationMonth: value }))}
              />
              <Field
                label="Exp. year"
                value={payment.expirationYear}
                onChange={(value) => setPayment((current) => ({ ...current, expirationYear: value }))}
              />
              <Field label="CCV" value={payment.ccv} onChange={(value) => setPayment((current) => ({ ...current, ccv: value }))} />
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Credit package</span>
              <select
                value={payment.amountCredits}
                onChange={(event) => setPayment((current) => ({ ...current, amountCredits: event.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="100">100 credits</option>
                <option value="250">250 credits</option>
                <option value="500">500 credits</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <BadgeDollarSign size={18} />
              Simulate Credit Approval
            </button>
          </form>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Credit balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{snapshot.credits?.balance ?? 0} credits</p>
            <p className="mt-1 text-sm text-slate-600">{snapshot.credits?.lastLedgerEvent ?? "No ledger event loaded"}</p>
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel icon={<FileClock size={20} />} title="Saved reports">
          <HistoryList items={snapshot.savedReports ?? []} empty="No saved reports yet." />
        </Panel>
        <Panel icon={<CheckCircle2 size={20} />} title="Approved recommendation history">
          <div className="space-y-3">
            {(snapshot.approvedRecommendations ?? []).length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No approved recommendations yet.
              </p>
            )}
            {(snapshot.approvedRecommendations ?? []).map((recommendation) => (
              <div key={recommendation.recommendationId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">{recommendation.recommendedAction}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.suggestedNextStep}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="teal">{recommendation.confidenceLevel} confidence</Badge>
                  <Badge tone={recommendation.riskLevel === "high" ? "red" : "amber"}>{recommendation.riskLevel} risk</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-teal-700" size={20} />
          <p className="text-sm leading-6 text-slate-700">
            Inventory credentials are encrypted with AES-256-GCM. API responses return only masked credential metadata and
            fingerprints. Demo payment never stores full card numbers or CCV.
          </p>
        </div>
      </section>
    </main>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-slate-950">
        <span className="text-teal-700">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
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

function HistoryList({ items, empty }: { items: Array<Record<string, unknown>>; empty: string }) {
  if (!items.length) {
    return <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={String(item.id ?? index)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">{String(item.title ?? "AMI report")}</p>
          <p className="mt-2 text-sm text-slate-600">
            {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : "Timestamp unavailable"}
          </p>
        </div>
      ))}
    </div>
  );
}
