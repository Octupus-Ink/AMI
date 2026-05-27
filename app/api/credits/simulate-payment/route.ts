import { NextRequest, NextResponse } from "next/server";
import { DemoPaymentPayloadSchema } from "@/lib/schemas/ami";
import { simulateCreditPurchase } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = DemoPaymentPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Demo payment payload is invalid", 422);
  }

  const result = await simulateCreditPurchase(bundle.workspaceId, parsed.data);

  return NextResponse.json(result);
}
