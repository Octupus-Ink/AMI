import { NextResponse } from "next/server";
import { runMarketplaceAnalysis } from "@/lib/agents/orchestrator";
import { demoProject } from "@/lib/demo/data";
import { StartAnalysisRequestSchema } from "@/lib/schemas/api";

async function parseBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json({
    route: "/api/analysis/start",
    method: "POST",
    message: "Post a marketplace project or omit the body to run the built-in demo project."
  });
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const parsed = StartAnalysisRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analysis request",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const result = await runMarketplaceAnalysis(parsed.data.project ?? demoProject);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Analysis failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
