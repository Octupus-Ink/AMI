import { NextRequest, NextResponse } from "next/server";
import { AssistantUsageLimitPayloadSchema } from "@/lib/schemas/ami";
import { getAssistantUsage, updateAssistantLimit } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function GET(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  return NextResponse.json({
    usage: await getAssistantUsage(bundle.workspaceId)
  });
}

export async function PATCH(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = AssistantUsageLimitPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Assistant usage limit payload is invalid", 422);
  }

  const usage = await updateAssistantLimit(bundle.workspaceId, parsed.data.assistantId, parsed.data.creditLimit);
  return NextResponse.json({ usage });
}
