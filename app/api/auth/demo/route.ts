import { NextResponse } from "next/server";
import { createDemoSession } from "@/lib/services/ami-store";
import { setSessionCookie } from "@/lib/services/http";

export async function POST() {
  const result = await createDemoSession();
  const response = NextResponse.json({
    user: result.user,
    workspace: result.workspace,
    demo: true
  });

  setSessionCookie(response, result.session.token, result.session.expiresAt);
  return response;
}
