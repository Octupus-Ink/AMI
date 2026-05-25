import { NextResponse } from "next/server";
import { analysisRunStore } from "@/lib/demo/run-store";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getAnalysisResultFromDatabase } from "@/lib/db/repositories";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = await connectToDatabase();

  if (db.available) {
    try {
      const stored = await getAnalysisResultFromDatabase(id);

      if (stored) {
        return NextResponse.json(stored);
      }
    } catch {
      // Fall through to the in-memory demo store.
    }
  }

  const fallback = analysisRunStore.get(id);

  if (fallback) {
    return NextResponse.json(fallback);
  }

  return NextResponse.json(
    {
      error: "Analysis run not found",
      id
    },
    { status: 404 }
  );
}
