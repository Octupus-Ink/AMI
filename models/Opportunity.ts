import { Schema, models, model } from "mongoose";

const OpportunitySchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "AnalysisRun", required: true },
    productRef: {
      type: Schema.Types.ObjectId,
      ref: "NormalizedProduct",
      required: true,
    },

    source: { type: String, required: true },
    externalId: { type: String, default: "" },
    title: { type: String, required: true },
    keyword: { type: String, default: "" },

    scores: {
      demandScore: { type: Number, required: true },
      priceSignal: { type: Number, required: true },
      confidenceScore: { type: Number, required: true },
      riskScore: { type: Number, required: true },
      opportunityScore: { type: Number, required: true },
    },

    recommendation: {
      action: { type: String, required: true },
      reasoningSummary: { type: String, required: true },
      nextStep: { type: String, required: true },
    },

    evidence: {
      price: { type: Number, default: null },
      currency: { type: String, default: "USD" },
      rating: { type: Number, default: null },
      reviewsCount: { type: Number, default: 0 },
      boughtPastMonth: { type: Number, default: 0 },
      rankOnPage: { type: Number, default: null },
      sponsored: { type: Boolean, default: false },
      sourceUrl: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
    collection: "opportunities",
  }
);

OpportunitySchema.index({ runId: 1 });
OpportunitySchema.index({ "scores.opportunityScore": -1 });
OpportunitySchema.index({ keyword: 1 });

export const Opportunity =
  models.Opportunity || model("Opportunity", OpportunitySchema);

export default Opportunity;
