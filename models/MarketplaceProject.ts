import { model, models, Schema } from "mongoose";

const MarketplaceProjectSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    targetMarket: { type: String, required: true },
    trackedCompetitors: [{ type: String }],
    products: [
      {
        id: String,
        name: String,
        sku: String,
        price: Number,
        cost: Number,
        currentStock: Number,
        targetStock: Number,
        monthlySales: Number
      }
    ]
  },
  { versionKey: false, timestamps: true }
);

export default models.MarketplaceProject || model("MarketplaceProject", MarketplaceProjectSchema);
