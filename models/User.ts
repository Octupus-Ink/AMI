import { model, models, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, index: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, default: "operator" },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export default models.User || model("User", UserSchema);
