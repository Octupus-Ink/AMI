import { NextResponse } from "next/server";
import { getDatabaseStatus } from "@/lib/db/mongoose";
import { getIntegrationStatus, getMissingEnvVars } from "@/lib/utils/env";

export async function GET() {
  const db = await getDatabaseStatus();
  const integrations = getIntegrationStatus();
  const missingEnvVars = getMissingEnvVars();

  return NextResponse.json({
    status: "ok",
    app: "Autonomous Marketplace Intelligence System",
    database: db,
    integrations,
    demoMode: missingEnvVars.length > 0 || !db.available,
    missingEnvVars,
    timestamp: new Date().toISOString()
  });
}
