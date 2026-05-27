import { NextRequest, NextResponse } from "next/server";
import { saveRecommendationAction } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const { id } = await context.params;

  try {
    return NextResponse.json({
      recommendation: await saveRecommendationAction(bundle.workspaceId, id, "saved")
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Recommendation save failed", 404);
  }
}
