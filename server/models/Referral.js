import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    codeUsed: { type: String, required: true, trim: true, uppercase: true },
    rewardAmount: { type: Number, default: 0, min: 0 },
    rewardWalletType: { type: String, enum: ["MAIN", "FP"], default: "MAIN" },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "REWARDED"],
      default: "PENDING",
      index: true
    },
    qualifyingDeposit: { type: mongoose.Schema.Types.ObjectId, ref: "DepositRequest", default: null },
    rewardedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ referrer: 1, status: 1 });

export default mongoose.model("Referral", referralSchema);
