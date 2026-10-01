import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["ESEWA", "KHALTI"], required: true },
    accountName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["PENDING", "PAID", "REJECTED"], default: "PENDING", index: true },
    adminTransactionId: { type: String, trim: true, uppercase: true, default: "" },
    payoutScreenshotUrl: { type: String, default: "" },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
