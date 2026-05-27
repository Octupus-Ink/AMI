"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CreditCard,
  Database,
  FileClock,
  LinkIcon,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Recommendation } from "@/lib/schemas/ami";

type WorkspaceSnapshot = {
  user?: { name: string; email: string };
  workspace?: Record<string, unknown>;
  marketplaceProfile?: Record<string, unknown>;
  linkedServices?: {
    brightDataStatus?: string;
    connectionMode?: string;
    lastCredentialCheck?: string;
  };
  credits?: { balance: number; initialDemoCredits?: number; lastLedgerEvent: string };
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

const mockPayment = {
  cardholderName: "Demo Workspace",
  cardBrand: "Visa",
  last4: "4242",
  expirationDate: "12/28",
  billingEmail: "billing@demo-workspace.com",
  billingCountry: "United States",
  billingZip: "94105",
  paymentStatus: "Demo mode"
};

function formatStatus(value: string | undefined) {
  return (value ?? "not_connected")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AccountWorkspaceClient() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({});
  const [inventory, setInventory] = useState(initialInventory);
  const [paymentCleared, setPaymentCleared] = useState(false);
  const [showPaymentMock, setShowPaymentMock] = useState(false);
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

  const workspace = snapshot.workspace ?? {};
  const profile = snapshot.marketplaceProfile ?? {};
  const inventoryStatus = snapshot.inventoryStatus;
  const monthlyLimit = snapshot.credits?.initialDemoCredits ?? 250;
  const availableCredits = snapshot.credits?.balance ?? 250;
  const creditsUsed = Math.max(0, monthlyLimit - availableCredits);
  const payment = paymentCleared ? { ...mockPayment, last4: "Not set", paymentStatus: "Demo method removed" } : mockPayment;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge tone="teal">Control Hub</Badge>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Control Hub</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manage workspace context, linked services, inventory source, recommendation history, and demo credits.
        </p>

        {message && <p className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
      </section>

      <details className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" open>
        <summary className="text-lg font-semibold text-slate-950">Personal Information</summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel icon={<UserRound size={20} />} title="User profile">
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Name" value={snapshot.user?.name ?? "Not loaded"} />
              <Fact label="Email" value={snapshot.user?.email ?? "Not loaded"} />
              <Fact label="Workspace role" value="Workspace operator" />
            </div>
          </Panel>

          <Panel icon={<LinkIcon size={20} />} title="Linked services">
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Bright Data status" value={formatStatus(snapshot.linkedServices?.brightDataStatus)} />
              <Fact label="Connection mode" value={snapshot.linkedServices?.connectionMode ?? "Demo fallback"} />
              <Fact
                label="Last credential check"
                value={
                  snapshot.linkedServices?.lastCredentialCheck
                    ? new Date(snapshot.linkedServices.lastCredentialCheck).toLocaleString()
                    : "Not checked"
                }
              />
            </div>
          </Panel>

          <Panel icon={<CreditCard size={20} />} title="Payment method">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Real payment processing is not active in this MVP. These fields are shown as a future-ready payment setup
              mockup. Demo credits are used to simulate assistant usage.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact label="Cardholder name" value={payment.cardholderName} />
              <Fact label="Card brand" value={payment.cardBrand} />
              <Fact label="Last 4 digits" value={payment.last4} />
              <Fact label="Expiration date" value={payment.expirationDate} />
              <Fact label="Billing email" value={payment.billingEmail} />
              <Fact label="Billing country" value={payment.billingCountry} />
              <Fact label="Billing ZIP / postal code" value={payment.billingZip} />
              <Fact label="Payment status" value={payment.paymentStatus} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentMock((current) => !current)}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
              >
                Edit payment method
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentCleared(true);
                  setMessage("Mock payment method removed from this local view only.");
                }}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
              >
                Remove payment method
              </button>
            </div>
            {showPaymentMock && (
              <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <DisabledField label="Cardholder name" value={payment.cardholderName} />
                <DisabledField label="Card brand" value={payment.cardBrand} />
                <DisabledField label="Last 4 digits" value={payment.last4} />
                <DisabledField label="Expiration date" value={payment.expirationDate} />
              </div>
            )}
          </Panel>

          <Panel icon={<WalletCards size={20} />} title="Demo credits">
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Available demo credits" value={`${availableCredits} credits`} />
              <Fact label="Credits used" value={`${creditsUsed} / ${monthlyLimit}`} />
              <Fact label="Monthly demo limit" value={`${monthlyLimit} credits`} />
              <Fact label="Credit reset date" value="01/06/26" />
            </div>
          </Panel>
        </div>
      </details>

      <details id="marketplace-setup" className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm" open>
        <summary className="text-lg font-semibold text-slate-950">Marketplace Setup</summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Panel icon={<BriefcaseBusiness size={20} />} title="Marketplace profile">
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Workspace name" value={String(workspace.workspaceName ?? workspace.name ?? "AMI Workspace")} />
              <Fact label="Workspace type" value={String(workspace.workspaceType ?? "Marketplace operator")} />
              <Fact label="Business name" value={String(profile.businessName ?? "Marketplace business")} />
              <Fact label="Primary marketplace" value={String(profile.primaryMarketplace ?? "Marketplace")} />
              <Fact label="Main category" value={String(profile.mainProductCategory ?? "Category")} />
              <Fact label="Region" value={String(profile.targetRegion ?? "Region")} />
              <Fact label="Currency" value={String(profile.defaultCurrency ?? "USD")} />
            </div>
          </Panel>

          <Panel icon={<Database size={20} />} title="Inventory context">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Sync status</p>
                <Badge tone={inventoryStatus?.connected ? "green" : "neutral"}>{formatStatus(inventoryStatus?.status)}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-700">{inventoryStatus?.latestConnectionLabel ?? "No inventory source connected"}</p>
              <p className="mt-2 text-sm text-slate-600">
                Latest sync timestamp:{" "}
                {inventoryStatus?.lastSyncAt ? new Date(inventoryStatus.lastSyncAt).toLocaleString() : "Not available"}
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
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  <LinkIcon size={18} />
                  Connect Inventory Source
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                >
                  <RefreshCw size={18} />
                  Re-sync Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setMessage("Remove Inventory Source is a mock control in this MVP. No credentials were exposed.")}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
                >
                  Remove Inventory Source
                </button>
              </div>
            </form>
          </Panel>

          <Panel icon={<FileClock size={20} />} title="Saved reports">
            <HistoryList
              items={snapshot.savedReports ?? []}
              empty="No saved reports yet. Reports saved from AMI Strategy will appear here."
            />
          </Panel>

          <Panel icon={<CheckCircle2 size={20} />} title="Approved recommendation history">
            <div className="space-y-3">
              {(snapshot.approvedRecommendations ?? []).length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No approved recommendations yet. Approved AMI recommendations will appear here after review.
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
        </div>
      </details>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-teal-700" size={20} />
          <p className="text-sm leading-6 text-slate-700">
            Inventory credentials and payment information are shown only as masked or mock data in the MVP. Real payment
            processing is not active, and the system must not store full card numbers, CVV, or sensitive billing credentials.
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

function DisabledField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        disabled
        value={value}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500"
      />
    </label>
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
