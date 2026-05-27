import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/services/http";

export async function GET(request: NextRequest) {
  const { bundle, response } = await requireSession(request);

  if (!bundle) {
    return response;
  }

  return NextResponse.json(bundle);
}
