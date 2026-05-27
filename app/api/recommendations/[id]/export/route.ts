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
    const recommendation = await saveRecommendationAction(bundle.workspaceId, id, "exported");
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      exportMode: "demo_json",
      recommendation
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Recommendation export failed", 404);
  }
}
