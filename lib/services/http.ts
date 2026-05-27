import { NextRequest, NextResponse } from "next/server";
import { getSessionBundle } from "@/lib/services/ami-store";

export const SESSION_COOKIE = "ami_session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const bundle = await getSessionBundle(token);

  if (!bundle) {
    return {
      bundle: null,
      response: jsonError("Authentication is required", 401)
    };
  }

  return {
    bundle,
    response: null
  };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
