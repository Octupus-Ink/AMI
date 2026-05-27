import mongoose, { Schema, models, model } from "mongoose";

const RawMarketplaceRecordSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "AnalysisRun", required: true },
    source: { type: String, required: true },
    sourceType: { type: String, required: true },
    sourceFile: { type: String, required: true },
    externalId: { type: String, default: "" },
    input: { type: Schema.Types.Mixed, default: null },
    rawData: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success",
    },
    errorCode: { type: String, default: "" },
    fetchedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "raw_marketplace_records",
  }
);

RawMarketplaceRecordSchema.index({ runId: 1 });
RawMarketplaceRecordSchema.index({ source: 1, sourceType: 1 });
RawMarketplaceRecordSchema.index({ externalId: 1 });
RawMarketplaceRecordSchema.index({ sourceFile: 1 });

export const RawMarketplaceRecord =
  models.RawMarketplaceRecord ||
  model("RawMarketplaceRecord", RawMarketplaceRecordSchema);

export default RawMarketplaceRecord;
