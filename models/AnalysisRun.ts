import { model, models, Schema } from "mongoose";

const AnalysisRunSchema = new Schema(
  {
    projectId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    agentStatus: { type: Schema.Types.Mixed, default: {} },
    finalScore: { type: Number },
    summary: { type: String, default: "" }
  },
  { versionKey: false }
);

export default models.AnalysisRun || model("AnalysisRun", AnalysisRunSchema);
