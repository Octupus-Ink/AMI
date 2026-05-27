import { NextRequest, NextResponse } from "next/server";
import { InventoryConnectionPayloadSchema } from "@/lib/schemas/ami";
import { validatePublicHttpUrl } from "@/lib/security/url";
import { connectInventorySource } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = InventoryConnectionPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Inventory connection payload is invalid", 422);
  }

  const urlCheck = validatePublicHttpUrl(parsed.data.marketplaceUrl);

  if (!urlCheck.ok || !urlCheck.normalizedUrl) {
    return jsonError(urlCheck.reason ?? "Inventory URL is not allowed", 422);
  }

  const connection = await connectInventorySource(bundle.workspaceId, {
    ...parsed.data,
    marketplaceUrl: urlCheck.normalizedUrl
  });

  return NextResponse.json({ connection });
}
