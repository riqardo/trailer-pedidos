import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: Number },
    attendant: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      username: String,
    },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ order: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
