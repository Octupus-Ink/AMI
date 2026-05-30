import { Schema, models, model } from "mongoose";

const AssistantOutputSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "AnalysisRun", required: true },
    assistantId: { type: String, required: true },
    assistantName: { type: String, required: true },
    analysisRunId: { type: String, default: "" },
    agent: { type: String, default: "" },
    businessGoal: { type: String, default: "" },
    goalIntent: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "warning", "failed", "skipped", "simulated"],
      default: "completed",
    },
    executionOrder: { type: Number, default: null },
    sourceUsed: [{ type: String }],
    sourcesUsed: [{ type: String }],
    missingSignals: [{ type: String }],
    fallbackSignals: [{ type: String }],
    confidenceAdjustment: { type: Schema.Types.Mixed, default: {} },
    contributionSummary: { type: String, required: true },
    signals: { type: Schema.Types.Mixed, default: {} },
    usage: {
      usageCount: { type: Number, default: 1 },
      estimatedCost: { type: Number, default: 0 },
      creditFootprint: { type: String, default: "low" },
    },
  },
  {
    timestamps: true,
    collection: "assistant_outputs",
  }
);

AssistantOutputSchema.index({ runId: 1 });
AssistantOutputSchema.index({ assistantId: 1 });

export const AssistantOutput =
  models.AssistantOutput || model("AssistantOutput", AssistantOutputSchema);

export default AssistantOutput;
