import { model, models, Schema } from "mongoose";

const RecommendationSchema = new Schema(
  {
    analysisRunId: { type: String, required: true, index: true },
    type: { type: String, default: "coordinator" },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    sourceAgents: [{ type: String }],
    businessImpact: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default models.Recommendation || model("Recommendation", RecommendationSchema);
