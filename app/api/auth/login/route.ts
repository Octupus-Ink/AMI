import { NextRequest, NextResponse } from "next/server";
import { LoginPayloadSchema } from "@/lib/schemas/ami";
import { login } from "@/lib/services/ami-store";
import { jsonError, setSessionCookie } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const parsed = LoginPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Login payload is invalid", 422);
  }

  try {
    const session = await login(parsed.data.workspaceId, parsed.data.password);
    const response = NextResponse.json({ ok: true });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Login failed", 401);
  }
}
