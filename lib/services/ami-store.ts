import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  demoAssistantUsage,
  demoCredits,
  demoInventoryStatus,
  demoMarketplaceProfile,
  demoSavedReports,
  demoUser,
  demoWorkspace
} from "@/lib/demo/data";
import {
  type AnalysisResult,
  type AssistantId,
  type AssistantUsage,
  type DemoPaymentPayload,
  type InventoryConnectionType,
  type InventoryConnectionPayload,
  type InventorySourceStatus,
  type MarketContextPayload,
  type Recommendation,
  type RegisterPayload,
  VisibleAssistants
} from "@/lib/schemas/ami";
import { encryptCredential } from "@/lib/security/credentials";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { createSessionToken, hashToken } from "@/lib/security/tokens";
import {
  AnalysisRun,
  ApprovedRecommendation,
  AssistantRun,
  AssistantUsageModel,
  AuditEvent,
  CreditLedger,
  EvidencePackageModel,
  InventoryConnection,
  InventorySyncStatus,
  InventorySnapshot,
  MarketplaceProfile,
  MarketContext,
  NormalizedProduct,
  Opportunity,
  CompetitorSnapshot,
  RawSourceSnapshot,
  RecommendationModel,
  SavedReport,
  Session,
  SimulatedPayment,
  SupplierCandidate,
  TrendSignal,
  User,
  Workspace,
  WorkspaceCredit
} from "@/models/ami";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
};

type WorkspaceRecord = {
  id: string;
  workspaceName: string;
  workspaceType: string;
  defaultRegion: string;
  defaultCurrency: string;
  createdByUserId: string;
};

type MarketplaceProfileRecord = typeof demoMarketplaceProfile;

type SessionRecord = {
  id: string;
  userId: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: string;
};

type InventoryConnectionRecord = {
  id: string;
  workspaceId: string;
  marketplaceName: string;
  marketplaceUrl?: string;
  connectionType: InventoryConnectionType;
  credentialType: InventoryConnectionType;
  encryptedCredential: string;
  credentialFingerprint: string;
  maskedCredential: string;
  syncMode: "demo" | "connected";
  status: Extract<InventorySourceStatus, "connected" | "demo_snapshot">;
  lastSyncAt: string;
  lastAnalysisAt: string;
  uploadedFileName?: string;
  uploadedFileType?: "csv" | "json";
  uploadedFileSize?: number;
  uploadedFileContent?: string;
  createdAt: string;
};

export type InventorySourceState = {
  workspaceId: string;
  connected: boolean;
  marketplaceName?: string;
  marketplaceUrl?: string;
  connectionType?: InventoryConnectionType;
  credentialType?: InventoryConnectionType;
  latestConnectionLabel: string;
  lastSyncAt: string | null;
  lastAnalysisAt: string | null;
  uploadedFileName?: string;
  uploadedFileType?: "csv" | "json";
  uploadedFileSize?: number;
  status: InventorySourceStatus;
  warningMessage?: string;
  errorMessage?: string;
};

type CreditRecord = {
  workspaceId: string;
  balance: number;
  initialDemoCredits: number;
  lastLedgerEvent: string;
};

type AmiStore = {
  users: UserRecord[];
  sessions: SessionRecord[];
  workspaces: WorkspaceRecord[];
  marketplaceProfiles: MarketplaceProfileRecord[];
  marketContexts: Array<{ id: string; workspaceId: string; data: MarketContextPayload; createdAt: string }>;
  analysisResults: AnalysisResult[];
  assistantUsage: AssistantUsage[];
  workspaceCredits: CreditRecord[];
  creditLedger: Array<Record<string, unknown>>;
  inventoryConnections: InventoryConnectionRecord[];
  inventorySyncStatus: Array<Record<string, unknown>>;
  savedReports: Array<Record<string, unknown>>;
  approvedRecommendations: Recommendation[];
  simulatedPayments: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
};

const globalForStore = globalThis as typeof globalThis & {
  amiStore?: AmiStore;
};

function initialStore(): AmiStore {
  return {
    users: [
      {
        ...demoUser,
        passwordHash: "$2a$12$/6bkM80goeEHKMe8wbYMXery4f70VHJzwezxAC6kZWtHDMprHEZe6"
      }
    ],
    sessions: [],
    workspaces: [demoWorkspace],
    marketplaceProfiles: [demoMarketplaceProfile],
    marketContexts: [],
    analysisResults: [],
    assistantUsage: demoAssistantUsage.map((usage) => ({ ...usage })),
    workspaceCredits: [demoCredits],
    creditLedger: [
      {
        id: "demo-credit-grant",
        workspaceId: demoWorkspace.id,
        type: "grant",
        amountCredits: demoCredits.initialDemoCredits,
        createdAt: "2026-05-26T18:00:00.000Z",
        note: "Initial demo credits"
      }
    ],
    inventoryConnections: [],
    inventorySyncStatus: [demoInventoryStatus],
    savedReports: demoSavedReports,
    approvedRecommendations: [],
    simulatedPayments: [],
    auditEvents: []
  };
}

export function getDemoStore() {
  if (!globalForStore.amiStore) {
    globalForStore.amiStore = initialStore();
  }

  return globalForStore.amiStore;
}

async function databaseReady() {
  try {
    return Boolean(await connectToDatabase());
  } catch {
    return false;
  }
}

const INVENTORY_CONNECTION_TYPES: readonly InventoryConnectionType[] = [
  "marketplace_url",
  "api_key",
  "bearer_token",
  "csv_upload",
  "json_upload",
  "demo_snapshot"
];

const INVENTORY_SOURCE_STATUSES: readonly InventorySourceStatus[] = [
  "not_connected",
  "connected",
  "demo_snapshot",
  "warning",
  "syncing",
  "error"
];

const NO_INVENTORY_SOURCE_MESSAGE = "No inventory source is connected. Connect a source before re-syncing.";

function isInventoryConnectionType(value: unknown): value is InventoryConnectionType {
  return typeof value === "string" && INVENTORY_CONNECTION_TYPES.includes(value as InventoryConnectionType);
}

function isInventorySourceStatus(value: unknown): value is InventorySourceStatus {
  return typeof value === "string" && INVENTORY_SOURCE_STATUSES.includes(value as InventorySourceStatus);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readOptionalFileType(value: unknown): "csv" | "json" | undefined {
  return value === "csv" || value === "json" ? value : undefined;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sourceLabel(marketplaceName: string | undefined, connectionType: InventoryConnectionType | undefined) {
  return marketplaceName && connectionType ? `${marketplaceName} - ${connectionType}` : "No inventory source connected";
}

function disconnectedInventoryStatus(workspaceId: string): InventorySourceState {
  return {
    workspaceId,
    connected: false,
    latestConnectionLabel: "No inventory source connected",
    lastSyncAt: null,
    lastAnalysisAt: null,
    status: "not_connected"
  };
}

function normalizeInventoryStatus(workspaceId: string, raw?: Record<string, unknown> | null): InventorySourceState {
  if (!raw) {
    return disconnectedInventoryStatus(workspaceId);
  }

  const status = isInventorySourceStatus(raw.status)
    ? raw.status
    : raw.connected
      ? "connected"
      : "not_connected";
  const connectionType = isInventoryConnectionType(raw.connectionType)
    ? raw.connectionType
    : status === "demo_snapshot"
      ? "demo_snapshot"
      : status === "connected"
        ? "marketplace_url"
        : undefined;
  const marketplaceName = readOptionalString(raw.marketplaceName) ?? (connectionType === "demo_snapshot" ? "Amazon" : undefined);
  const connected = Boolean(raw.connected) && (status === "connected" || status === "demo_snapshot");

  if (!connected && status !== "warning" && status !== "error" && status !== "syncing") {
    return disconnectedInventoryStatus(workspaceId);
  }

  return {
    workspaceId,
    connected,
    marketplaceName,
    marketplaceUrl: readOptionalString(raw.marketplaceUrl),
    connectionType,
    credentialType: isInventoryConnectionType(raw.credentialType) ? raw.credentialType : connectionType,
    latestConnectionLabel: connected ? sourceLabel(marketplaceName, connectionType) : "No inventory source connected",
    lastSyncAt: readOptionalString(raw.lastSyncAt) ?? null,
    lastAnalysisAt: readOptionalString(raw.lastAnalysisAt) ?? null,
    uploadedFileName: readOptionalString(raw.uploadedFileName),
    uploadedFileType: readOptionalFileType(raw.uploadedFileType),
    uploadedFileSize: readOptionalNumber(raw.uploadedFileSize),
    status,
    warningMessage: readOptionalString(raw.warningMessage),
    errorMessage: readOptionalString(raw.errorMessage)
  };
}

function inventoryStatusFromRecord(record: InventoryConnectionRecord): InventorySourceState {
  return {
    workspaceId: record.workspaceId,
    connected: true,
    marketplaceName: record.marketplaceName,
    marketplaceUrl: record.marketplaceUrl,
    connectionType: record.connectionType,
    credentialType: record.credentialType,
    latestConnectionLabel: sourceLabel(record.marketplaceName, record.connectionType),
    lastSyncAt: record.lastSyncAt,
    lastAnalysisAt: record.lastAnalysisAt,
    uploadedFileName: record.uploadedFileName,
    uploadedFileType: record.uploadedFileType,
    uploadedFileSize: record.uploadedFileSize,
    status: record.status
  };
}

export function isUsableInventorySource(status: InventorySourceState) {
  return status.connected && (status.status === "connected" || status.status === "demo_snapshot") && Boolean(status.connectionType);
}

function calculateAlertState(creditsUsed: number, creditLimit: number): AssistantUsage["alertState"] {
  if (creditsUsed > creditLimit) {
    return "exceeded";
  }

  if (creditsUsed >= creditLimit * 0.9) {
    return "near_limit";
  }

  return "normal";
}

function defaultAssistantUsage(workspaceId: string): AssistantUsage[] {
  return VisibleAssistants.map((assistant) => ({
    assistantId: assistant.id,
    usageCount: 0,
    creditLimit: 100,
    creditsUsed: 0,
    estimatedUsageCost: 0,
    lastRun: null,
    latestContribution: "No completed AMI analysis yet.",
    dataSourcesUsed: ["Not used yet"],
    alertState: "normal"
  })).map((usage) => ({ ...usage, workspaceId } as AssistantUsage & { workspaceId: string }));
}

export async function createRegisteredWorkspace(payload: RegisterPayload) {
  const passwordHash = await hashPassword(payload.user.password);
  const now = new Date();

  if (await databaseReady()) {
    const existing = await User.findOne({ email: payload.user.email }).lean();

    if (existing) {
      throw new Error("Email is already registered");
    }

    const user = await User.create({
      name: payload.user.name,
      email: payload.user.email,
      passwordHash
    });
    const userId = String(user._id);

    const workspace = await Workspace.create({
      ...payload.workspace,
      createdByUserId: userId
    });
    const workspaceId = String(workspace._id);

    await Promise.all([
      MarketplaceProfile.create({
        workspaceId,
        ...payload.marketplaceProfile
      }),
      ...defaultAssistantUsage(workspaceId).map((usage) =>
        AssistantUsageModel.create({
          workspaceId,
          data: usage
        })
      ),
      WorkspaceCredit.create({
        workspaceId,
        data: {
          workspaceId,
          balance: 250,
          initialDemoCredits: 250,
          lastLedgerEvent: "Initial demo grant"
        }
      }),
      CreditLedger.create({
        workspaceId,
        data: {
          id: randomUUID(),
          type: "grant",
          amountCredits: 250,
          createdAt: now.toISOString(),
          note: "Initial demo credits"
        }
      })
    ]);

    const session = await createSession(userId, workspaceId);

    return {
      session,
      user: { id: userId, name: payload.user.name, email: payload.user.email },
      workspace: { id: workspaceId, ...payload.workspace, createdByUserId: userId }
    };
  }

  const store = getDemoStore();
  const existing = store.users.find((user) => user.email === payload.user.email);

  if (existing) {
    throw new Error("Email is already registered");
  }

  const userId = randomUUID();
  const workspaceId = randomUUID();
  const user = {
    id: userId,
    name: payload.user.name,
    email: payload.user.email,
    passwordHash
  };
  const workspace = {
    id: workspaceId,
    ...payload.workspace,
    createdByUserId: userId
  };

  store.users.push(user);
  store.workspaces.push(workspace);
  store.marketplaceProfiles.push({
    workspaceId,
    ...payload.marketplaceProfile
  });
  store.assistantUsage.push(...defaultAssistantUsage(workspaceId));
  store.workspaceCredits.push({
    workspaceId,
    balance: 250,
    initialDemoCredits: 250,
    lastLedgerEvent: "Initial demo grant"
  });
  store.creditLedger.push({
    id: randomUUID(),
    workspaceId,
    type: "grant",
    amountCredits: 250,
    createdAt: now.toISOString(),
    note: "Initial demo credits"
  });

  const session = await createSession(userId, workspaceId);

  return {
    session,
    user: { id: user.id, name: user.name, email: user.email },
    workspace
  };
}

export async function createSession(userId: string, workspaceId: string) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  if (await databaseReady()) {
    await Session.create({
      userId,
      workspaceId,
      tokenHash,
      expiresAt
    });
  } else {
    getDemoStore().sessions.push({
      id: randomUUID(),
      userId,
      workspaceId,
      tokenHash,
      expiresAt: expiresAt.toISOString()
    });
  }

  return {
    token,
    expiresAt
  };
}

export async function login(email: string, password: string) {
  const identifier = email.trim();
  const normalizedEmail = identifier.toLowerCase();
  const isDemoLogin =
    normalizedEmail === demoUser.email ||
    identifier === demoWorkspace.id ||
    identifier === demoWorkspace.workspaceName;

  if (isDemoLogin && password === "demo-workspace-password") {
    const demo = await createDemoSession();
    return demo.session;
  }

  if (await databaseReady()) {
    let user = (await User.findOne({ email: normalizedEmail }).lean()) as
      | { _id: unknown; name: string; email: string; passwordHash: string }
      | null;

    if (!user) {
      const objectIdCandidate = /^[a-f\d]{24}$/i.test(identifier) ? [{ _id: identifier }] : [];
      const workspace = (await Workspace.findOne({
        $or: [{ workspaceName: identifier }, ...objectIdCandidate]
      }).lean()) as { createdByUserId?: string } | null;

      if (workspace?.createdByUserId) {
        user = (await User.findById(workspace.createdByUserId).lean()) as
          | { _id: unknown; name: string; email: string; passwordHash: string }
          | null;
      }
    }

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error("Invalid workspace ID or password");
    }

    const workspace = (await Workspace.findOne({ createdByUserId: String(user._id) }).lean()) as
      | { _id: unknown }
      | null;

    if (!workspace) {
      throw new Error("Workspace was not found");
    }

    return createSession(String(user._id), String(workspace._id));
  }

  const store = getDemoStore();
  const workspaceByIdentifier = store.workspaces.find(
    (candidate) => candidate.id === identifier || candidate.workspaceName === identifier
  );
  const user = store.users.find(
    (candidate) => candidate.email === normalizedEmail || candidate.id === workspaceByIdentifier?.createdByUserId
  );

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid workspace ID or password");
  }

  const workspace = store.workspaces.find((candidate) => candidate.createdByUserId === user.id);

  if (!workspace) {
    throw new Error("Workspace was not found");
  }

  return createSession(user.id, workspace.id);
}

export async function createDemoSession() {
  if (await databaseReady()) {
    const demoPasswordHash = await hashPassword("demo-workspace-password");
    let user = (await User.findOne({ email: demoUser.email }).lean()) as
      | { _id: unknown; name: string; email: string }
      | null;

    if (!user) {
      const createdUser = await User.create({
        name: demoUser.name,
        email: demoUser.email,
        passwordHash: demoPasswordHash
      });
      user = {
        _id: createdUser._id,
        name: createdUser.name,
        email: createdUser.email
      };
    } else {
      await User.findByIdAndUpdate(user._id, { passwordHash: demoPasswordHash });
    }

    const userId = String(user._id);
    let workspace = (await Workspace.findOne({ createdByUserId: userId }).lean()) as
      | { _id: unknown; workspaceName: string; workspaceType: string; defaultRegion: string; defaultCurrency: string; createdByUserId: string }
      | null;

    if (!workspace) {
      const createdWorkspace = await Workspace.create({
        workspaceName: demoWorkspace.workspaceName,
        workspaceType: demoWorkspace.workspaceType,
        defaultRegion: demoWorkspace.defaultRegion,
        defaultCurrency: demoWorkspace.defaultCurrency,
        createdByUserId: userId
      });
      workspace = {
        _id: createdWorkspace._id,
        workspaceName: createdWorkspace.workspaceName,
        workspaceType: createdWorkspace.workspaceType,
        defaultRegion: createdWorkspace.defaultRegion,
        defaultCurrency: createdWorkspace.defaultCurrency,
        createdByUserId: createdWorkspace.createdByUserId
      };
    }

    const workspaceId = String(workspace._id);

    await Promise.all([
      MarketplaceProfile.findOneAndUpdate(
        { workspaceId },
        {
          workspaceId,
          businessName: demoMarketplaceProfile.businessName,
          businessType: demoMarketplaceProfile.businessType,
          primaryMarketplace: demoMarketplaceProfile.primaryMarketplace,
          mainProductCategory: demoMarketplaceProfile.mainProductCategory,
          targetRegion: demoMarketplaceProfile.targetRegion,
          defaultCurrency: demoMarketplaceProfile.defaultCurrency
        },
        { upsert: true, new: true }
      ),
      ...defaultAssistantUsage(workspaceId).map((usage) =>
        AssistantUsageModel.findOneAndUpdate(
          { workspaceId, "data.assistantId": usage.assistantId },
          { workspaceId, data: usage },
          { upsert: true, new: true }
        )
      ),
      WorkspaceCredit.findOneAndUpdate(
        { workspaceId },
        {
          workspaceId,
          data: {
            workspaceId,
            balance: demoCredits.balance,
            initialDemoCredits: demoCredits.initialDemoCredits,
            lastLedgerEvent: demoCredits.lastLedgerEvent
          }
        },
        { upsert: true, new: true }
      ),
      InventorySyncStatus.findOneAndUpdate(
        { workspaceId },
        {
          workspaceId,
          data: {
            ...demoInventoryStatus,
            workspaceId
          }
        },
        { upsert: true, new: true }
      )
    ]);

    const session = await createSession(userId, workspaceId);

    return {
      session,
      user: { id: userId, name: user.name, email: user.email },
      workspace: { id: workspaceId, ...workspace, createdByUserId: userId }
    };
  }

  const store = getDemoStore();
  const session = await createSession(demoUser.id, demoWorkspace.id);
  const hasDemoUsage = store.assistantUsage.some((usage) => usage.assistantId === "trend");

  if (!hasDemoUsage) {
    store.assistantUsage.push(...demoAssistantUsage);
  }

  return {
    session,
    user: demoUser,
    workspace: demoWorkspace
  };
}

export async function destroySession(token: string | undefined) {
  if (!token) {
    return;
  }

  const tokenHash = hashToken(token);

  if (await databaseReady()) {
    await Session.deleteOne({ tokenHash });
    return;
  }

  const store = getDemoStore();
  store.sessions = store.sessions.filter((session) => session.tokenHash !== tokenHash);
}

export async function getSessionBundle(token: string | undefined) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  if (await databaseReady()) {
    const session = (await Session.findOne({ tokenHash, expiresAt: { $gt: now } }).lean()) as
      | { userId: string; workspaceId: string }
      | null;

    if (!session) {
      return null;
    }

    const [user, workspace, marketplaceProfile] = await Promise.all([
      User.findById(session.userId).lean() as Promise<{ _id: unknown; name: string; email: string } | null>,
      Workspace.findById(session.workspaceId).lean() as Promise<Record<string, unknown> | null>,
      MarketplaceProfile.findOne({ workspaceId: session.workspaceId }).lean() as Promise<Record<string, unknown> | null>
    ]);

    if (!user || !workspace || !marketplaceProfile) {
      return null;
    }

    return {
      user: { id: String(user._id), name: user.name, email: user.email },
      workspace: { ...workspace, id: String(workspace._id) },
      marketplaceProfile,
      workspaceId: session.workspaceId
    };
  }

  const store = getDemoStore();
  const session = store.sessions.find(
    (candidate) => candidate.tokenHash === tokenHash && new Date(candidate.expiresAt) > now
  );

  if (!session) {
    return null;
  }

  const user = store.users.find((candidate) => candidate.id === session.userId);
  const workspace = store.workspaces.find((candidate) => candidate.id === session.workspaceId);
  const marketplaceProfile = store.marketplaceProfiles.find((candidate) => candidate.workspaceId === session.workspaceId);

  if (!user || !workspace || !marketplaceProfile) {
    return null;
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace,
    marketplaceProfile,
    workspaceId: session.workspaceId
  };
}

export async function createMarketContext(workspaceId: string, data: MarketContextPayload) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  if (await databaseReady()) {
    const context = await MarketContext.create({
      workspaceId,
      data: {
        id,
        ...data,
        createdAt
      }
    });

    return {
      id: String(context._id),
      ...data,
      createdAt
    };
  }

  getDemoStore().marketContexts.push({
    id,
    workspaceId,
    data,
    createdAt
  });

  return {
    id,
    ...data,
    createdAt
  };
}

export async function saveAnalysisResult(result: AnalysisResult) {
  const terminal = result.status === "completed" || result.status === "completed_with_fallback" || result.status === "failed";

  if (await databaseReady()) {
    const writes = [
      AnalysisRun.findOneAndUpdate(
        {
          workspaceId: result.workspaceId,
          "data.analysisRunId": result.analysisRunId
        },
        {
          workspaceId: result.workspaceId,
          data: result
        },
        { upsert: true, new: true }
      ),
      RawSourceSnapshot.findOneAndUpdate(
        {
          workspaceId: result.workspaceId,
          "data.analysisRunId": result.analysisRunId
        },
        {
          workspaceId: result.workspaceId,
          data: {
            analysisRunId: result.analysisRunId,
            runId: result.analysisRunId,
            sourceMode: result.sourceMode,
            fallbackUsed: result.fallbackUsed,
            rawSourceSnapshots: result.rawSourceSnapshots,
            rawSourceSummary: result.rawSourceSummary,
            dataQualitySummary: result.dataQualitySummary,
            sourceProvider: result.sourceProvider,
            sourceProducts: result.sourceProducts,
            sourceSummary: result.sourceSummary,
            rawSnapshotMetadata: result.rawSnapshotMetadata,
            evidenceMetadata: result.evidenceMetadata,
            providerStatus: result.sourceCollectionStatus.providerStatus,
            demoSnapshotUsed: result.sourceCollectionStatus.demoSnapshotUsed,
            liveProviderUsed: result.sourceCollectionStatus.liveProviderUsed,
            sourceLabel: result.sourceCollectionStatus.sourceLabel,
            sourceCollectionStatus: result.sourceCollectionStatus,
            evidenceRefs: result.evidenceRefs,
            sourceProof: result.sourceCollectionStatus.sourceProof,
            normalizedProductCount: result.normalizedProducts.length
          }
        },
        { upsert: true, new: true }
      )
    ];

    if (terminal) {
      const assistantTraceRecords = result.assistantRunTrace.length
        ? result.assistantRunTrace.map((trace) => ({
            analysisRunId: result.analysisRunId,
            ...trace
          }))
        : result.assistantFindings.map((finding) => ({
            analysisRunId: result.analysisRunId,
            runId: result.analysisRunId,
            assistantType: finding.assistantId,
            status: result.assistantStatus[finding.assistantId],
            latestContribution: finding.finding,
            evidenceIds: result.evidencePackages.map((evidence) => evidence.evidencePackageId),
            dataSourcesUsed: [finding.sourceLabel],
            warning: finding.risk === "high" ? finding.reason : undefined
          }));
      writes.push(
        AssistantRun.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        EvidencePackageModel.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        NormalizedProduct.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        InventorySnapshot.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        TrendSignal.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        CompetitorSnapshot.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        SupplierCandidate.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        Opportunity.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        RecommendationModel.deleteMany({ workspaceId: result.workspaceId, "data.analysisRunId": result.analysisRunId }) as never,
        ...assistantTraceRecords.map((trace) =>
          AssistantRun.create({
            workspaceId: result.workspaceId,
            data: trace
          }) as never
        ),
        ...result.evidencePackages.map((evidence) =>
          EvidencePackageModel.create({
            workspaceId: result.workspaceId,
            data: {
              analysisRunId: result.analysisRunId,
              ...evidence
            }
          }) as never
        ),
        ...result.normalizedProducts.map((product) =>
          NormalizedProduct.create({
            workspaceId: result.workspaceId,
            data: {
              analysisRunId: result.analysisRunId,
              ...product
            }
          }) as never
        ),
        InventorySnapshot.create({
          workspaceId: result.workspaceId,
          data: {
            analysisRunId: result.analysisRunId,
            businessGoal: result.marketContext.businessGoal,
            metrics: result.preliminaryMetrics?.canonicalMetrics ?? {},
            inventoryStatus: result.assistantStatus.inventory,
            createdAt: result.completedAt ?? new Date().toISOString()
          }
        }) as never,
        TrendSignal.create({
          workspaceId: result.workspaceId,
          data: {
            analysisRunId: result.analysisRunId,
            businessGoal: result.marketContext.businessGoal,
            metrics: result.preliminaryMetrics?.canonicalMetrics ?? {},
            sources: result.sourceProducts,
            dataQuality: result.dataQualitySummary
          }
        }) as never,
        CompetitorSnapshot.create({
          workspaceId: result.workspaceId,
          data: {
            analysisRunId: result.analysisRunId,
            businessGoal: result.marketContext.businessGoal,
            metrics: result.preliminaryMetrics?.canonicalMetrics ?? {},
            products: result.normalizedProducts.map((product) => ({
              title: product.title,
              priceUsd: product.priceUsd,
              pricePressure: product.pricePressure,
              availability: product.availability
            }))
          }
        }) as never,
        SupplierCandidate.create({
          workspaceId: result.workspaceId,
          data: {
            analysisRunId: result.analysisRunId,
            businessGoal: result.marketContext.businessGoal,
            candidates: result.supplierOptions,
            dataQuality: result.dataQualitySummary
          }
        }) as never,
        ...result.opportunities.map((opportunity) =>
          Opportunity.create({
            workspaceId: result.workspaceId,
            data: opportunity
          }) as never
        ),
        ...result.opportunities.map((recommendation) =>
          RecommendationModel.create({
            workspaceId: result.workspaceId,
            data: recommendation
          }) as never
        )
      );
    }

    await Promise.all(writes);
  } else {
    const store = getDemoStore();
    store.analysisResults = store.analysisResults.filter((existing) => existing.analysisRunId !== result.analysisRunId);
    store.analysisResults.push(result);
  }

  if (terminal) {
    await updateAssistantUsageAfterRun(result.workspaceId, result);
  }

  return result;
}

export async function getAnalysisResult(workspaceId: string, analysisRunId: string) {
  if (await databaseReady()) {
    const run = (await AnalysisRun.findOne({
      workspaceId,
      "data.analysisRunId": analysisRunId
    }).lean()) as { data?: AnalysisResult } | null;

    return run?.data ?? null;
  }

  return getDemoStore().analysisResults.find(
    (result) => result.workspaceId === workspaceId && result.analysisRunId === analysisRunId
  ) ?? null;
}

async function updateAssistantUsageAfterRun(workspaceId: string, result: AnalysisResult) {
  const costs: Record<AssistantId, number> = {
    orchestrator: 11,
    trend: 6,
    competitor: 8,
    supplier: 9,
    inventory: 7
  };
  const terminalSuccess = result.status === "completed" || result.status === "completed_with_fallback";
  const executedAssistantIds = new Set<AssistantId>();

  for (const run of result.agentRuns ?? []) {
    executedAssistantIds.add(run.agentType);
  }

  for (const finding of result.assistantFindings ?? []) {
    const status = result.assistantStatus?.[finding.assistantId];

    if (status === "completed" || status === "warning" || status === "fallback" || status === "running") {
      executedAssistantIds.add(finding.assistantId);
    }
  }

  if (!executedAssistantIds.size && terminalSuccess) {
    for (const contribution of result.executiveRecommendation.assistantContributions) {
      executedAssistantIds.add(contribution.assistantId);
    }
  }

  if (result.synthesis) {
    executedAssistantIds.add("orchestrator");
  }

  if (result.finalVerdict) {
    executedAssistantIds.add("orchestrator");
  }

  if (!executedAssistantIds.size) {
    return;
  }

  function nextUsage(current: AssistantUsage): AssistantUsage {
    const currentWithTrace = current as AssistantUsage & { lastAnalysisRunId?: string; processedAnalysisRunIds?: string[] };

    if (currentWithTrace.lastAnalysisRunId === result.analysisRunId || currentWithTrace.processedAnalysisRunIds?.includes(result.analysisRunId)) {
      return current;
    }

    const cost = costs[current.assistantId] ?? 0;
    const contribution = result.executiveRecommendation.assistantContributions.find(
      (item) => item.assistantId === current.assistantId
    );
    const nextCredits = current.creditsUsed + cost;
    const fallbackContribution = current.assistantId === "orchestrator" ? result.finalVerdict?.finalVerdict ?? result.synthesis?.summary : undefined;

    return {
      ...current,
      usageCount: current.usageCount + 1,
      creditsUsed: nextCredits,
      estimatedUsageCost: Number((current.estimatedUsageCost + cost / 10).toFixed(2)),
      lastRun: result.completedAt ?? new Date().toISOString(),
      latestContribution: contribution?.latestContribution ?? fallbackContribution ?? current.latestContribution,
      dataSourcesUsed: contribution?.dataSourcesUsed ?? current.dataSourcesUsed,
      alertState: calculateAlertState(nextCredits, current.creditLimit),
      lastAnalysisRunId: result.analysisRunId,
      processedAnalysisRunIds: [...(currentWithTrace.processedAnalysisRunIds ?? []), result.analysisRunId].slice(-50)
    } as AssistantUsage;
  }

  if (await databaseReady()) {
    const usages = (await AssistantUsageModel.find({ workspaceId }).lean()) as Array<{ _id: unknown; data: AssistantUsage }>;
    const existingByAssistant = new Map(usages.map((entry) => [entry.data.assistantId, entry]));
    const defaults = defaultAssistantUsage(workspaceId);

    await Promise.all(
      defaults
        .filter((entry) => executedAssistantIds.has(entry.assistantId))
        .map((entry) =>
          AssistantUsageModel.findOneAndUpdate(
            { workspaceId, "data.assistantId": entry.assistantId },
            {
              workspaceId,
              data: nextUsage(existingByAssistant.get(entry.assistantId)?.data ?? entry)
            },
            { upsert: true, new: true }
          )
        )
    );
    return;
  }

  const store = getDemoStore();
  const defaults = defaultAssistantUsage(workspaceId);

  for (const usage of defaults) {
    const exists = store.assistantUsage.some((entry) => {
      const usageWithWorkspace = entry as AssistantUsage & { workspaceId?: string };
      return usageWithWorkspace.assistantId === usage.assistantId && (!usageWithWorkspace.workspaceId || usageWithWorkspace.workspaceId === workspaceId);
    });

    if (!exists) {
      store.assistantUsage.push(usage);
    }
  }

  store.assistantUsage = store.assistantUsage.map((usage) => {
    const usageWithWorkspace = usage as AssistantUsage & { workspaceId?: string };
    const belongsToWorkspace = !usageWithWorkspace.workspaceId || usageWithWorkspace.workspaceId === workspaceId;

    return belongsToWorkspace && executedAssistantIds.has(usage.assistantId) ? nextUsage(usage) : usage;
  });
}

export async function getAssistantUsage(workspaceId: string) {
  const defaults = defaultAssistantUsage(workspaceId);

  if (await databaseReady()) {
    const usage = (await AssistantUsageModel.find({ workspaceId }).lean()) as Array<{ data: AssistantUsage }>;
    const existing = usage.map((entry) => entry.data);
    const missing = defaults.filter(
      (defaultUsage) => !existing.some((entry) => entry.assistantId === defaultUsage.assistantId)
    );

    if (missing.length) {
      await Promise.all(
        missing.map((item) =>
          AssistantUsageModel.create({
            workspaceId,
            data: item
          })
        )
      );
    }

    return [...existing, ...missing];
  }

  const store = getDemoStore();
  const existing = store.assistantUsage.filter((usage) => {
    const usageWithWorkspace = usage as AssistantUsage & { workspaceId?: string };
    return !usageWithWorkspace.workspaceId || usageWithWorkspace.workspaceId === workspaceId;
  });
  const missing = defaults.filter(
    (defaultUsage) => !existing.some((entry) => entry.assistantId === defaultUsage.assistantId)
  );

  store.assistantUsage.push(...missing);
  return [...existing, ...missing];
}

export async function updateAssistantLimit(workspaceId: string, assistantId: AssistantId, creditLimit: number) {
  if (await databaseReady()) {
    const usage = (await AssistantUsageModel.findOne({ workspaceId, "data.assistantId": assistantId }).lean()) as
      | { _id: unknown; data: AssistantUsage }
      | null;

    if (!usage) {
      throw new Error("Assistant usage record was not found");
    }

    const data = {
      ...usage.data,
      creditLimit,
      alertState: calculateAlertState(usage.data.creditsUsed, creditLimit)
    };

    await Promise.all([
      AssistantUsageModel.findByIdAndUpdate(usage._id, { data }),
      createAuditEvent(workspaceId, "assistant_credit_limit_changed", { assistantId, creditLimit })
    ]);
    return data;
  }

  const store = getDemoStore();
  const usage = store.assistantUsage.find((entry) => entry.assistantId === assistantId);

  if (!usage) {
    throw new Error("Assistant usage record was not found");
  }

  usage.creditLimit = creditLimit;
  usage.alertState = calculateAlertState(usage.creditsUsed, creditLimit);
  store.auditEvents.push({
    id: randomUUID(),
    workspaceId,
    action: "assistant_credit_limit_changed",
    metadata: { assistantId, creditLimit },
    createdAt: new Date().toISOString()
  });

  return usage;
}

export async function getWorkspaceSnapshot(workspaceId: string) {
  if (await databaseReady()) {
    const [workspace, marketplaceProfile, credits, inventoryStatus, savedReports, approvedRecommendations] = await Promise.all([
      Workspace.findById(workspaceId).lean(),
      MarketplaceProfile.findOne({ workspaceId }).lean(),
      WorkspaceCredit.findOne({ workspaceId }).lean() as Promise<{ data?: CreditRecord } | null>,
      InventorySyncStatus.findOne({ workspaceId }).lean() as Promise<{ data?: Record<string, unknown> } | null>,
      SavedReport.find({ workspaceId }).sort({ createdAt: -1 }).lean() as Promise<Array<{ data?: Record<string, unknown> }>>,
      ApprovedRecommendation.find({ workspaceId }).sort({ createdAt: -1 }).lean() as Promise<Array<{ data?: Recommendation }>>
    ]);

    return {
      workspace,
      marketplaceProfile,
      linkedServices: {
        brightDataStatus: process.env.BRIGHT_DATA_API_KEY ? "connected" : "demo_seed",
        connectionMode: process.env.BRIGHT_DATA_API_KEY ? "Live when endpoints are configured" : "Demo seed",
        lastCredentialCheck: new Date().toISOString()
      },
      credits: credits?.data,
      inventoryStatus: normalizeInventoryStatus(workspaceId, inventoryStatus?.data),
      savedReports: savedReports.map((report) => report.data),
      approvedRecommendations: approvedRecommendations.map((recommendation) => recommendation.data)
    };
  }

  const store = getDemoStore();

  return {
    workspace: store.workspaces.find((workspace) => workspace.id === workspaceId),
    marketplaceProfile: store.marketplaceProfiles.find((profile) => profile.workspaceId === workspaceId),
    linkedServices: {
      brightDataStatus: process.env.BRIGHT_DATA_API_KEY ? "connected" : "demo_seed",
      connectionMode: process.env.BRIGHT_DATA_API_KEY ? "Live when endpoints are configured" : "Demo seed",
      lastCredentialCheck: new Date().toISOString()
    },
    credits: store.workspaceCredits.find((credits) => credits.workspaceId === workspaceId),
    inventoryStatus: normalizeInventoryStatus(
      workspaceId,
      store.inventorySyncStatus.find((status) => status.workspaceId === workspaceId)
    ),
    savedReports: store.savedReports,
    approvedRecommendations: store.approvedRecommendations
  };
}

export async function connectInventorySource(workspaceId: string, payload: InventoryConnectionPayload) {
  const now = new Date().toISOString();
  const storesCredential = payload.connectionType === "api_key" || payload.connectionType === "bearer_token";
  const encrypted = storesCredential ? encryptCredential(payload.credential) : null;
  const syncMode = payload.connectionType === "demo_snapshot" ? "demo" : "connected";
  const record: InventoryConnectionRecord = {
    id: randomUUID(),
    workspaceId,
    marketplaceName: payload.marketplaceName,
    marketplaceUrl: payload.marketplaceUrl || "",
    connectionType: payload.connectionType,
    credentialType: payload.connectionType,
    encryptedCredential: encrypted?.encryptedCredential ?? "",
    credentialFingerprint: encrypted?.credentialFingerprint ?? "",
    maskedCredential: encrypted?.maskedCredential ?? "",
    syncMode,
    status: payload.connectionType === "demo_snapshot" ? "demo_snapshot" : "connected",
    lastSyncAt: now,
    lastAnalysisAt: now,
    uploadedFileName: payload.uploadedFileName,
    uploadedFileType: payload.uploadedFileType,
    uploadedFileSize: payload.uploadedFileSize,
    uploadedFileContent: payload.uploadedFileContent,
    createdAt: now
  };
  const status = inventoryStatusFromRecord(record);

  if (await databaseReady()) {
    await Promise.all([
      InventoryConnection.deleteMany({ workspaceId }),
      InventoryConnection.create({
        workspaceId,
        data: record
      }),
      InventorySyncStatus.findOneAndUpdate({ workspaceId }, { workspaceId, data: status }, { upsert: true, new: true }),
      createAuditEvent(workspaceId, "inventory_connection_created", {
        marketplaceName: payload.marketplaceName,
        connectionType: payload.connectionType,
        credentialFingerprint: encrypted?.credentialFingerprint
      })
    ]);
  } else {
    const store = getDemoStore();
    store.inventoryConnections = store.inventoryConnections.filter((entry) => entry.workspaceId !== workspaceId);
    store.inventoryConnections.push(record);
    store.inventorySyncStatus = store.inventorySyncStatus.filter((entry) => entry.workspaceId !== workspaceId);
    store.inventorySyncStatus.push(status);
    store.auditEvents.push({
      id: randomUUID(),
      workspaceId,
      action: "inventory_connection_created",
      metadata: {
        marketplaceName: payload.marketplaceName,
        connectionType: payload.connectionType,
        credentialFingerprint: encrypted?.credentialFingerprint
      },
      createdAt: now
    });
  }

  return {
    id: record.id,
    marketplaceName: record.marketplaceName,
    marketplaceUrl: record.marketplaceUrl,
    connectionType: record.connectionType,
    credentialType: record.credentialType,
    credentialFingerprint: record.credentialFingerprint,
    maskedCredential: record.maskedCredential,
    syncMode: record.syncMode,
    status: record.status,
    lastSyncAt: record.lastSyncAt,
    lastAnalysisAt: record.lastAnalysisAt,
    uploadedFileName: record.uploadedFileName,
    uploadedFileType: record.uploadedFileType,
    uploadedFileSize: record.uploadedFileSize,
    inventoryStatus: status
  };
}

async function saveInventoryStatus(workspaceId: string, status: InventorySourceState) {
  if (await databaseReady()) {
    await InventorySyncStatus.findOneAndUpdate({ workspaceId }, { workspaceId, data: status }, { upsert: true, new: true });
    return status;
  }

  const store = getDemoStore();
  store.inventorySyncStatus = store.inventorySyncStatus.filter((entry) => entry.workspaceId !== workspaceId);
  store.inventorySyncStatus.push(status);
  return status;
}

export async function getInventorySourceState(workspaceId: string) {
  if (await databaseReady()) {
    const status = (await InventorySyncStatus.findOne({ workspaceId }).lean()) as { data?: Record<string, unknown> } | null;
    return normalizeInventoryStatus(workspaceId, status?.data);
  }

  const status = getDemoStore().inventorySyncStatus.find((entry) => entry.workspaceId === workspaceId);
  return normalizeInventoryStatus(workspaceId, status);
}

export async function syncInventorySource(workspaceId: string) {
  const current = await getInventorySourceState(workspaceId);

  if (!isUsableInventorySource(current)) {
    const warningStatus: InventorySourceState = {
      ...disconnectedInventoryStatus(workspaceId),
      status: "warning",
      warningMessage: NO_INVENTORY_SOURCE_MESSAGE
    };

    return saveInventoryStatus(workspaceId, warningStatus);
  }

  const now = new Date().toISOString();
  const nextConnectionStatus: Extract<InventorySourceStatus, "connected" | "demo_snapshot"> =
    current.connectionType === "demo_snapshot" ? "demo_snapshot" : "connected";
  const status: InventorySourceState = {
    ...current,
    latestConnectionLabel: sourceLabel(current.marketplaceName, current.connectionType),
    lastSyncAt: now,
    status: nextConnectionStatus,
    warningMessage: undefined,
    errorMessage: undefined
  };

  if (await databaseReady()) {
    await Promise.all([
      InventoryConnection.findOneAndUpdate(
        { workspaceId },
        {
          "data.lastSyncAt": now,
          "data.status": status.status
        },
        { sort: { createdAt: -1 } }
      ),
      InventorySyncStatus.findOneAndUpdate({ workspaceId }, { workspaceId, data: status }, { upsert: true, new: true }),
      createAuditEvent(workspaceId, "inventory_source_resynced", {
        marketplaceName: current.marketplaceName,
        connectionType: current.connectionType
      })
    ]);
  } else {
    const store = getDemoStore();
    store.inventoryConnections = store.inventoryConnections.map((entry) =>
      entry.workspaceId === workspaceId ? { ...entry, lastSyncAt: now, status: nextConnectionStatus } : entry
    );
    store.inventorySyncStatus = store.inventorySyncStatus.filter((entry) => entry.workspaceId !== workspaceId);
    store.inventorySyncStatus.push(status);
    store.auditEvents.push({
      id: randomUUID(),
      workspaceId,
      action: "inventory_source_resynced",
      metadata: {
        marketplaceName: current.marketplaceName,
        connectionType: current.connectionType
      },
      createdAt: now
    });
  }

  return status;
}

export async function removeInventorySource(workspaceId: string) {
  const now = new Date().toISOString();
  const status = disconnectedInventoryStatus(workspaceId);

  if (await databaseReady()) {
    await Promise.all([
      InventoryConnection.deleteMany({ workspaceId }),
      InventorySyncStatus.findOneAndUpdate({ workspaceId }, { workspaceId, data: status }, { upsert: true, new: true }),
      createAuditEvent(workspaceId, "inventory_source_removed", {})
    ]);
  } else {
    const store = getDemoStore();
    store.inventoryConnections = store.inventoryConnections.filter((entry) => entry.workspaceId !== workspaceId);
    store.inventorySyncStatus = store.inventorySyncStatus.filter((entry) => entry.workspaceId !== workspaceId);
    store.inventorySyncStatus.push(status);
    store.auditEvents.push({
      id: randomUUID(),
      workspaceId,
      action: "inventory_source_removed",
      metadata: {},
      createdAt: now
    });
  }

  return status;
}

export async function simulateCreditPurchase(workspaceId: string, payload: DemoPaymentPayload) {
  const now = new Date().toISOString();
  const normalizedNumber = payload.cardNumber.replace(/\s/g, "");
  const paymentRecord = {
    id: randomUUID(),
    workspaceId,
    cardholderName: payload.cardholderName,
    cardLast4: normalizedNumber.slice(-4),
    expirationMonth: payload.expirationMonth,
    expirationYear: payload.expirationYear,
    status: "simulated_approved",
    amountCredits: payload.amountCredits,
    createdAt: now
  };
  const ledgerEntry = {
    id: randomUUID(),
    workspaceId,
    type: "simulated_payment",
    amountCredits: payload.amountCredits,
    createdAt: now,
    paymentId: paymentRecord.id
  };

  if (await databaseReady()) {
    const credits = (await WorkspaceCredit.findOne({ workspaceId }).lean()) as
      | { _id: unknown; data?: CreditRecord }
      | null;
    const nextBalance = (credits?.data?.balance ?? 0) + payload.amountCredits;

    await Promise.all([
      SimulatedPayment.create({
        workspaceId,
        data: paymentRecord
      }),
      CreditLedger.create({
        workspaceId,
        data: ledgerEntry
      }),
      WorkspaceCredit.findOneAndUpdate(
        { workspaceId },
        {
          workspaceId,
          data: {
            workspaceId,
            balance: nextBalance,
            initialDemoCredits: credits?.data?.initialDemoCredits ?? 0,
            lastLedgerEvent: "Simulated credit purchase"
          }
        },
        { upsert: true, new: true }
      ),
      createAuditEvent(workspaceId, "credit_purchase_simulated", {
        amountCredits: payload.amountCredits,
        cardLast4: paymentRecord.cardLast4
      })
    ]);

    return {
      payment: paymentRecord,
      credits: {
        workspaceId,
        balance: nextBalance,
        lastLedgerEvent: "Simulated credit purchase"
      }
    };
  }

  const store = getDemoStore();
  const credits = store.workspaceCredits.find((entry) => entry.workspaceId === workspaceId);

  if (credits) {
    credits.balance += payload.amountCredits;
    credits.lastLedgerEvent = "Simulated credit purchase";
  }

  store.simulatedPayments.push(paymentRecord);
  store.creditLedger.push(ledgerEntry);
  store.auditEvents.push({
    id: randomUUID(),
    workspaceId,
    action: "credit_purchase_simulated",
    metadata: {
      amountCredits: payload.amountCredits,
      cardLast4: paymentRecord.cardLast4
    },
    createdAt: now
  });

  return {
    payment: paymentRecord,
    credits
  };
}

export async function saveRecommendationAction(
  workspaceId: string,
  recommendationId: string,
  action: "saved" | "approved" | "exported"
) {
  const result = await findRecommendation(workspaceId, recommendationId);

  if (!result) {
    throw new Error("Recommendation was not found");
  }

  const updated: Recommendation = {
    ...result,
    status: action
  };
  const now = new Date().toISOString();

  if (await databaseReady()) {
    const writes = [
      RecommendationModel.findOneAndUpdate(
        { workspaceId, "data.recommendationId": recommendationId },
        { workspaceId, data: updated },
        { upsert: true, new: true }
      )
    ];

    if (action === "saved") {
      writes.push(
        SavedReport.create({
          workspaceId,
          data: {
            id: randomUUID(),
            recommendationId,
            title: updated.recommendedAction,
            createdAt: now,
            status: "saved"
          }
        }) as never
      );
    }

    if (action === "approved") {
      writes.push(
        ApprovedRecommendation.create({
          workspaceId,
          data: updated
        }) as never
      );
    }

    await Promise.all(writes);
  } else {
    const store = getDemoStore();
    store.analysisResults = store.analysisResults.map((analysis) => ({
      ...analysis,
      executiveRecommendation:
        analysis.executiveRecommendation.recommendationId === recommendationId ? updated : analysis.executiveRecommendation,
      opportunities: analysis.opportunities.map((recommendation) =>
        recommendation.recommendationId === recommendationId ? updated : recommendation
      )
    }));

    if (action === "saved") {
      store.savedReports.push({
        id: randomUUID(),
        recommendationId,
        title: updated.recommendedAction,
        createdAt: now,
        status: "saved"
      });
    }

    if (action === "approved") {
      store.approvedRecommendations.push(updated);
    }
  }

  return updated;
}

async function findRecommendation(workspaceId: string, recommendationId: string) {
  if (await databaseReady()) {
    const recommendation = (await RecommendationModel.findOne({
      workspaceId,
      "data.recommendationId": recommendationId
    }).lean()) as { data?: Recommendation } | null;

    return recommendation?.data ?? null;
  }

  return (
    getDemoStore()
      .analysisResults.flatMap((analysis) => analysis.opportunities)
      .find((recommendation) => recommendation.workspaceId === workspaceId && recommendation.recommendationId === recommendationId) ??
    null
  );
}

export async function createAuditEvent(workspaceId: string, action: string, metadata: Record<string, unknown>) {
  const event = {
    id: randomUUID(),
    workspaceId,
    action,
    metadata,
    createdAt: new Date().toISOString()
  };

  if (await databaseReady()) {
    await AuditEvent.create({
      workspaceId,
      data: event
    });
  } else {
    getDemoStore().auditEvents.push(event);
  }

  return event;
}
