import { Schema, models, model } from "mongoose";

const AssistantOutputSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "AnalysisRun", required: true },
    assistantId: { type: String, required: true },
    assistantName: { type: String, required: true },
    status: {
      type: String,
      enum: ["completed", "warning", "failed", "simulated"],
      default: "completed",
    },
    sourceUsed: [{ type: String }],
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
