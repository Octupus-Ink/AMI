/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema } from "mongoose";

const Mixed = Schema.Types.Mixed;

const baseOptions = {
  timestamps: true,
  versionKey: false as const
};

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true }
  },
  baseOptions
);

const SessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  baseOptions
);

const WorkspaceSchema = new Schema(
  {
    workspaceName: { type: String, required: true },
    workspaceType: { type: String, required: true },
    defaultRegion: { type: String, required: true },
    defaultCurrency: { type: String, required: true },
    createdByUserId: { type: String, required: true, index: true }
  },
  baseOptions
);

const WorkspaceLinkedSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    data: { type: Mixed, required: true }
  },
  baseOptions
);

const MarketplaceProfileSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    businessName: { type: String, required: true },
    businessType: { type: String, required: true },
    primaryMarketplace: { type: String, required: true },
    mainProductCategory: { type: String, required: true },
    targetRegion: { type: String, required: true },
    defaultCurrency: { type: String, required: true }
  },
  baseOptions
);

const MarketContextSchema = WorkspaceLinkedSchema.clone();
const AnalysisRunSchema = WorkspaceLinkedSchema.clone();
const AssistantRunSchema = WorkspaceLinkedSchema.clone();
const RawSourceSnapshotSchema = WorkspaceLinkedSchema.clone();
const NormalizedProductSchema = WorkspaceLinkedSchema.clone();
const InventorySnapshotSchema = WorkspaceLinkedSchema.clone();
const TrendSignalSchema = WorkspaceLinkedSchema.clone();
const CompetitorSnapshotSchema = WorkspaceLinkedSchema.clone();
const SupplierCandidateSchema = WorkspaceLinkedSchema.clone();
const ProductAttributeSchema = WorkspaceLinkedSchema.clone();
const ProductMatchSchema = WorkspaceLinkedSchema.clone();
const OpportunitySchema = WorkspaceLinkedSchema.clone();
const RecommendationSchema = WorkspaceLinkedSchema.clone();
const EvidencePackageSchema = WorkspaceLinkedSchema.clone();
const SavedReportSchema = WorkspaceLinkedSchema.clone();
const ApprovedRecommendationSchema = WorkspaceLinkedSchema.clone();
const AssistantUsageSchema = WorkspaceLinkedSchema.clone();
const WorkspaceCreditSchema = WorkspaceLinkedSchema.clone();
const CreditLedgerSchema = WorkspaceLinkedSchema.clone();
const InventoryConnectionSchema = WorkspaceLinkedSchema.clone();
const InventorySyncStatusSchema = WorkspaceLinkedSchema.clone();
const CreditPackageSchema = WorkspaceLinkedSchema.clone();
const SimulatedPaymentSchema = WorkspaceLinkedSchema.clone();
const AuditEventSchema = WorkspaceLinkedSchema.clone();

function model(name: string, schema: Schema, collection: string) {
  return (mongoose.models as Record<string, any>)[name] || mongoose.model(name, schema, collection);
}

export const User = model("User", UserSchema, "users");
export const Session = model("Session", SessionSchema, "sessions");
export const Workspace = model("Workspace", WorkspaceSchema, "workspaces");
export const MarketplaceProfile = model("MarketplaceProfile", MarketplaceProfileSchema, "marketplaceProfiles");
export const MarketContext = model("MarketContext", MarketContextSchema, "marketContexts");
export const AnalysisRun = model("AnalysisRun", AnalysisRunSchema, "analysisRuns");
export const AssistantRun = model("AssistantRun", AssistantRunSchema, "assistantRuns");
export const RawSourceSnapshot = model("RawSourceSnapshot", RawSourceSnapshotSchema, "rawSourceSnapshots");
export const NormalizedProduct = model("NormalizedProduct", NormalizedProductSchema, "normalizedProducts");
export const InventorySnapshot = model("InventorySnapshot", InventorySnapshotSchema, "inventorySnapshots");
export const TrendSignal = model("TrendSignal", TrendSignalSchema, "trendSignals");
export const CompetitorSnapshot = model("CompetitorSnapshot", CompetitorSnapshotSchema, "competitorSnapshots");
export const SupplierCandidate = model("SupplierCandidate", SupplierCandidateSchema, "supplierCandidates");
export const ProductAttribute = model("ProductAttribute", ProductAttributeSchema, "productAttributes");
export const ProductMatch = model("ProductMatch", ProductMatchSchema, "productMatches");
export const Opportunity = model("Opportunity", OpportunitySchema, "opportunities");
export const RecommendationModel = model("Recommendation", RecommendationSchema, "recommendations");
export const EvidencePackageModel = model("EvidencePackage", EvidencePackageSchema, "evidencePackages");
export const SavedReport = model("SavedReport", SavedReportSchema, "savedReports");
export const ApprovedRecommendation = model("ApprovedRecommendation", ApprovedRecommendationSchema, "approvedRecommendations");
export const AssistantUsageModel = model("AssistantUsage", AssistantUsageSchema, "assistantUsage");
export const WorkspaceCredit = model("WorkspaceCredit", WorkspaceCreditSchema, "workspaceCredits");
export const CreditLedger = model("CreditLedger", CreditLedgerSchema, "creditLedger");
export const InventoryConnection = model("InventoryConnection", InventoryConnectionSchema, "inventoryConnections");
export const InventorySyncStatus = model("InventorySyncStatus", InventorySyncStatusSchema, "inventorySyncStatus");
export const CreditPackage = model("CreditPackage", CreditPackageSchema, "creditPackages");
export const SimulatedPayment = model("SimulatedPayment", SimulatedPaymentSchema, "simulatedPayments");
export const AuditEvent = model("AuditEvent", AuditEventSchema, "auditEvents");
