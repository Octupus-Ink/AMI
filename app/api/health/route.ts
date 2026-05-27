import { NextResponse } from "next/server";
import { hasMongoUri } from "@/lib/db/mongoose";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    stack: "Next.js App Router, TypeScript, Zod, Mongoose",
    mongoConfigured: hasMongoUri(),
    brightDataConfigured: Boolean(process.env.BRIGHT_DATA_API_KEY),
    brightDataMode: process.env.BRIGHT_DATA_API_KEY ? "live_when_endpoints_are_configured" : "demo_fallback",
    visibleAssistants: ["Competitor Assistant", "Inventory Assistant", "Trend Assistant"]
  });
}
