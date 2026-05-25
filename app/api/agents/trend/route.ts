import { NextResponse } from "next/server";
import { runTrendAgent } from "@/lib/agents/trend";
import { demoProject } from "@/lib/demo/data";
import { MarketplaceProjectSchema } from "@/lib/schemas/api";

async function getProject(request: Request) {
  try {
    const body = await request.json();
    const parsed = MarketplaceProjectSchema.safeParse(body.project);
    return parsed.success ? parsed.data : demoProject;
  } catch {
    return demoProject;
  }
}

export async function GET() {
  const result = await runTrendAgent(demoProject);
  return NextResponse.json(result.output);
}

export async function POST(request: Request) {
  const project = await getProject(request);
  const result = await runTrendAgent(project);
  return NextResponse.json(result.output);
}
