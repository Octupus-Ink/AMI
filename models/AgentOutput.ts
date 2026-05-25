import { model, models, Schema } from "mongoose";

const AgentOutputSchema = new Schema(
  {
    analysisRunId: { type: String, required: true, index: true },
    agentName: { type: String, required: true, index: true },
    status: { type: String, required: true },
    input: { type: Schema.Types.Mixed },
    output: { type: Schema.Types.Mixed },
    confidence: { type: Number },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default models.AgentOutput || model("AgentOutput", AgentOutputSchema);
