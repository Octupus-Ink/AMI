import type { AnalysisResult } from "@/lib/schemas/api";

declare global {
  var analysisRunStore: Map<string, AnalysisResult> | undefined;
}

export const analysisRunStore = globalThis.analysisRunStore ?? new Map<string, AnalysisResult>();

globalThis.analysisRunStore = analysisRunStore;
