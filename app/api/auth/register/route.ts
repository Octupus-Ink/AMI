import { NextRequest, NextResponse } from "next/server";
import { RegisterPayloadSchema } from "@/lib/schemas/ami";
import { createRegisteredWorkspace } from "@/lib/services/ami-store";
import { jsonError, setSessionCookie } from "@/lib/services/http";

export async function POST(request: NextRequest) {
  const parsed = RegisterPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Register payload is invalid", 422);
  }

  try {
    const result = await createRegisteredWorkspace(parsed.data);
    const response = NextResponse.json({
      user: result.user,
      workspace: result.workspace
    });

    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Registration failed", 400);
  }
}
