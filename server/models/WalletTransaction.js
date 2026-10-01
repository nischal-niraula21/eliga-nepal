import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Missing on historical records: all pre-FP transactions used Main Wallet.
    walletType: { type: String, enum: ["MAIN", "FP"], default: "MAIN", index: true },
    type: {
      type: String,
      enum: [
        "DEPOSIT",
        "ENTRY_FEE",
        "PRIZE",
        "REFUND",
        "ADMIN_CREDIT",
        "ADMIN_DEBIT",
        "WITHDRAWAL_HOLD",
        "WITHDRAWAL_RELEASE",
        "REFERRAL_BONUS"
      ],
      required: true,
      index: true
    },
    direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    heldAfter: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    referenceType: { type: String, trim: true, default: "" },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true }
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model("WalletTransaction", walletTransactionSchema);
