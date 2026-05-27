import { NextRequest, NextResponse } from "next/server";
import { InventoryConnectionPayloadSchema, type InventoryConnectionPayload } from "@/lib/schemas/ami";
import { validatePublicHttpUrl } from "@/lib/security/url";
import { connectInventorySource, removeInventorySource } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

const URL_REQUIRED_CONNECTIONS = new Set(["marketplace_url", "api_key", "bearer_token"]);
const CREDENTIAL_REQUIRED_CONNECTIONS = new Set(["api_key", "bearer_token"]);

function validateUploadedFile(payload: InventoryConnectionPayload) {
  if (payload.connectionType !== "csv_upload" && payload.connectionType !== "json_upload") {
    return null;
  }

  const expectedType = payload.connectionType === "csv_upload" ? "csv" : "json";
  const expectedExtension = `.${expectedType}`;

  if (!payload.uploadedFileName || !payload.uploadedFileSize || !payload.uploadedFileContent) {
    return `${expectedType.toUpperCase()} file is required before connecting.`;
  }

  if (payload.uploadedFileType !== expectedType || !payload.uploadedFileName.toLowerCase().endsWith(expectedExtension)) {
    return `Selected file must be a ${expectedExtension} file.`;
  }

  if (expectedType === "json") {
    try {
      JSON.parse(payload.uploadedFileContent);
    } catch {
      return "Selected JSON file must contain parseable JSON.";
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = InventoryConnectionPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Inventory connection payload is invalid", 422);
  }

  const marketplaceUrl = parsed.data.marketplaceUrl.trim();
  const needsUrl = URL_REQUIRED_CONNECTIONS.has(parsed.data.connectionType);

  if (needsUrl && !marketplaceUrl) {
    return jsonError("Marketplace URL is required for this inventory connection type.", 422);
  }

  const urlCheck: { ok: boolean; normalizedUrl?: string; reason?: string } = marketplaceUrl
    ? validatePublicHttpUrl(marketplaceUrl)
    : { ok: true, normalizedUrl: "" };

  if (!urlCheck.ok || (marketplaceUrl && !urlCheck.normalizedUrl)) {
    return jsonError(urlCheck.reason ?? "Inventory URL is not allowed", 422);
  }

  if (CREDENTIAL_REQUIRED_CONNECTIONS.has(parsed.data.connectionType) && !parsed.data.credential.trim()) {
    return jsonError(
      parsed.data.connectionType === "api_key" ? "API key is required." : "Bearer token is required.",
      422
    );
  }

  const uploadError = validateUploadedFile(parsed.data);

  if (uploadError) {
    return jsonError(uploadError, 422);
  }

  const isUpload = parsed.data.connectionType === "csv_upload" || parsed.data.connectionType === "json_upload";
  const isCredential = CREDENTIAL_REQUIRED_CONNECTIONS.has(parsed.data.connectionType);
  const connection = await connectInventorySource(bundle.workspaceId, {
    ...parsed.data,
    credentialType: parsed.data.connectionType,
    credential: isCredential ? parsed.data.credential : "",
    marketplaceUrl: urlCheck.normalizedUrl ?? "",
    uploadedFileName: isUpload ? parsed.data.uploadedFileName : undefined,
    uploadedFileType: isUpload ? parsed.data.uploadedFileType : undefined,
    uploadedFileSize: isUpload ? parsed.data.uploadedFileSize : undefined,
    uploadedFileContent: isUpload ? parsed.data.uploadedFileContent : undefined
  });

  return NextResponse.json({ connection, inventoryStatus: connection.inventoryStatus });
}

export async function DELETE(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const inventoryStatus = await removeInventorySource(bundle.workspaceId);
  return NextResponse.json({ inventoryStatus });
}
