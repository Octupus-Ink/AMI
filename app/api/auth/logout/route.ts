import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/services/ami-store";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  await destroySession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
