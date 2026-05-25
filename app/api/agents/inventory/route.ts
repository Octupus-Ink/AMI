import { NextResponse } from "next/server";
import { runInventoryAgent } from "@/lib/agents/inventory";
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
  const result = await runInventoryAgent(demoProject);
  return NextResponse.json(result.output);
}

export async function POST(request: Request) {
  const project = await getProject(request);
  const result = await runInventoryAgent(project);
  return NextResponse.json(result.output);
}
