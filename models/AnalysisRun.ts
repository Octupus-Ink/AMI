import { Schema, models, model } from "mongoose";

const AnalysisRunSchema = new Schema(
  {
    runType: { type: String, required: true, default: "brightdata_raw_import" },
    source: { type: String, required: true, default: "brightdata" },
    sourceFile: { type: String, default: "" },
    analysisRunId: { type: String, default: "" },
    workspaceId: { type: String, default: "" },
    businessGoal: { type: String, default: "" },
    goalIntent: { type: String, default: "" },
    mode: { type: String, enum: ["live", "demo", "fallback", ""], default: "" },
    sourceMode: { type: String, enum: ["live", "demo", "mixed", "fallback", ""], default: "" },
    inputContext: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "completed_with_fallback", "failed"],
      default: "pending",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    summary: {
      totalRawRecords: { type: Number, default: 0 },
      normalizedProducts: { type: Number, default: 0 },
      opportunities: { type: Number, default: 0 },
      averageOpportunityScore: { type: Number, default: 0 },
      topOpportunityTitle: { type: String, default: "" },
    },
    error: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "analysis_runs",
  }
);

AnalysisRunSchema.index({ runType: 1, sourceFile: 1, createdAt: -1 });

export const AnalysisRun =
  models.AnalysisRun || model("AnalysisRun", AnalysisRunSchema);

export default AnalysisRun;
