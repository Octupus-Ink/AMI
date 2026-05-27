import { NextRequest, NextResponse } from "next/server";
import { getAnalysisResult } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const { id } = await context.params;
  const result = await getAnalysisResult(bundle.workspaceId, id);

  if (!result) {
    return jsonError("Analysis run was not found", 404);
  }

  return NextResponse.json(result);
}
