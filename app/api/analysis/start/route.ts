import { NextRequest, NextResponse } from "next/server";
import { runAmiAnalysis } from "@/lib/ami/analysis";
import { MarketContextPayloadSchema } from "@/lib/schemas/ami";
import { saveAnalysisResult } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const parsed = MarketContextPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Analysis request is invalid", 422);
  }

  const result = await runAmiAnalysis(bundle.workspaceId, parsed.data);
  await saveAnalysisResult(result);

  return NextResponse.json(result);
}
