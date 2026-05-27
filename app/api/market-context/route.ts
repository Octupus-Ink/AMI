import { NextRequest, NextResponse } from "next/server";
import { MarketContextPayloadSchema } from "@/lib/schemas/ami";
import { createMarketContext } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = MarketContextPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Market context payload is invalid", 422);
  }

  const context = await createMarketContext(bundle.workspaceId, parsed.data);
  return NextResponse.json({ marketContext: context });
}
