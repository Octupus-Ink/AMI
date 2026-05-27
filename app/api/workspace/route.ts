import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/services/ami-store";
import { requireSession } from "@/lib/services/http";

export async function GET(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const snapshot = await getWorkspaceSnapshot(bundle.workspaceId);

  return NextResponse.json({
    user: bundle.user,
    ...snapshot
  });
}
