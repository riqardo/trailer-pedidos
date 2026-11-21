import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, enum: ["lanche", "bebida"], required: true },
    price: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    icon: { type: String, default: "🌭" },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ available: 1, sortOrder: 1 });

export const Product = mongoose.model("Product", productSchema);
