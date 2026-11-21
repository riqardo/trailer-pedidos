import mongoose from "mongoose";

const attendantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    username: { type: String, required: true },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    category: { type: String, enum: ["lanche", "bebida"], required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["mesa", "placa", "balcao"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["dinheiro", "pix", "cartao"],
      required: true,
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    processedBy: { type: attendantSchema, required: true },
    simulated: { type: Boolean, default: true },
  },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    attendant: { type: attendantSchema, required: true },
    at: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    location: { type: locationSchema, required: true },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["open", "finalized"],
      default: "open",
      index: true,
    },
    payment: { type: paymentSchema, default: null },
    createdBy: { type: attendantSchema, required: true },
    updatedBy: { type: attendantSchema, required: true },
    finalizedBy: { type: attendantSchema, default: null },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ "location.label": 1 });
orderSchema.index({ customerName: 1 });

export const Order = mongoose.model("Order", orderSchema);
