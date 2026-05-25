import { NextResponse } from "next/server";
import { demoProject, demoRecentRuns } from "@/lib/demo/data";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getRecentAnalysisRuns } from "@/lib/db/repositories";
import { getIntegrationStatus, getMissingEnvVars } from "@/lib/utils/env";

export async function GET() {
  const db = await connectToDatabase();
  let recentRuns = demoRecentRuns;

  if (db.available) {
    try {
      const storedRuns = await getRecentAnalysisRuns();
      recentRuns = storedRuns.length ? storedRuns : demoRecentRuns;
    } catch {
      recentRuns = demoRecentRuns;
    }
  }

  const missingEnvVars = getMissingEnvVars();

  return NextResponse.json({
    project: demoProject,
    recentRuns,
    demoMode: missingEnvVars.length > 0 || !db.available,
    databaseAvailable: db.available,
    integrations: getIntegrationStatus(),
    missingEnvVars
  });
}
