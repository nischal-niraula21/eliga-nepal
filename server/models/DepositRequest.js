import mongoose from "mongoose";

const depositRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["ESEWA", "KHALTI"], required: true },
    transactionId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    screenshotUrl: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING", index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

depositRequestSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model("DepositRequest", depositRequestSchema);
