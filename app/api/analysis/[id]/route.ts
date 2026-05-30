import { NextRequest, NextResponse } from "next/server";
import { amiDiagLog, createDiagRequestId } from "@/lib/diagnostics/ami-diag";
import { getAnalysisResult } from "@/lib/services/ami-store";
import { jsonError, requireSession } from "@/lib/services/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get("x-ami-request-id") ?? createDiagRequestId("api_get");
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    amiDiagLog("api_analysis_get_auth_failed", {
      requestId,
      route: "/api/analysis/[id]",
      responseStatus: 401,
      ok: false
    });
    return response;
  }

  const { id } = await context.params;
  amiDiagLog("api_analysis_get_received", {
    requestId,
    analysisRunId: id,
    route: "/api/analysis/[id]"
  });
  const result = await getAnalysisResult(bundle.workspaceId, id);

  if (!result) {
    amiDiagLog("api_analysis_get_not_found", {
      requestId,
      analysisRunId: id,
      route: "/api/analysis/[id]",
      responseStatus: 404,
      ok: false
    });
    return jsonError("Analysis run was not found", 404);
  }

  amiDiagLog("api_analysis_get_response_returned", {
    requestId,
    analysisRunId: id,
    route: "/api/analysis/[id]",
    responseStatus: 200,
    ok: true,
    runStatus: result.status,
    sourceMode: result.sourceMode,
    usedFallback: result.fallbackUsed,
    dataQualityStatus: result.dataQualitySummary?.status
  });

  return NextResponse.json(result);
}
