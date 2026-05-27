import { NextRequest, NextResponse } from "next/server";
import { syncInventorySource } from "@/lib/services/ami-store";
import { requireSession } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  const inventoryStatus = await syncInventorySource(bundle.workspaceId);
  return NextResponse.json({ inventoryStatus });
}
