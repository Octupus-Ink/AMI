import mongoose, { Schema, models, model } from "mongoose";

const AnalysisRunSchema = new Schema(
  {
    runType: { type: String, required: true, default: "brightdata_raw_import" },
    source: { type: String, required: true, default: "brightdata" },
    sourceFile: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
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
