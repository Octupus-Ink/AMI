import mongoose, { Schema, models, model } from "mongoose";

const NormalizedProductSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "AnalysisRun", required: true },
    rawRef: {
      type: Schema.Types.ObjectId,
      ref: "RawMarketplaceRecord",
      required: true,
    },

    source: { type: String, required: true },
    externalId: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },

    canonicalTitle: { type: String, required: true },
    brand: { type: String, default: null },
    category: { type: String, default: null },
    keyword: { type: String, default: "" },

    price: {
      current: { type: Number, default: null },
      original: { type: Number, default: null },
      currency: { type: String, default: "USD" },
    },

    marketSignals: {
      rating: { type: Number, default: null },
      reviewsCount: { type: Number, default: 0 },
      boughtPastMonth: { type: Number, default: 0 },
      rankOnPage: { type: Number, default: null },
      sponsored: { type: Boolean, default: false },
      isPrime: { type: Boolean, default: false },
      isCoupon: { type: Boolean, default: false },
      totalResults: { type: Number, default: null },
    },

    media: {
      imageUrl: { type: String, default: "" },
    },

    dataQuality: {
      hasPrice: { type: Boolean, default: false },
      hasRating: { type: Boolean, default: false },
      hasDemandSignal: { type: Boolean, default: false },
      hasImage: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    collection: "normalized_products",
  }
);

NormalizedProductSchema.index({ runId: 1 });
NormalizedProductSchema.index({ source: 1, externalId: 1 });
NormalizedProductSchema.index({ keyword: 1 });
NormalizedProductSchema.index({ "price.current": 1 });
NormalizedProductSchema.index({ "marketSignals.boughtPastMonth": -1 });

export const NormalizedProduct =
  models.NormalizedProduct ||
  model("NormalizedProduct", NormalizedProductSchema);

export default NormalizedProduct;
