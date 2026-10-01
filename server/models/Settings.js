import mongoose from "mongoose";

const paymentMethodSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    label: { type: String, trim: true },
    accountName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    qrUrl: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "platform" },
    minEntryFee: { type: Number, default: 30 },
    maxEntryFee: { type: Number, default: 500 },
    commissionPercent: { type: Number, default: 10 },
    minDeposit: { type: Number, default: 30 },
    maxDeposit: { type: Number, default: 10000 },
    minWithdrawal: { type: Number, default: 100 },
    maxWithdrawal: { type: Number, default: 10000 },
    referralProgramEnabled: { type: Boolean, default: true },
    referralRewardAmount: { type: Number, default: 5, min: 0, max: 500 },
    whatsappNumber: { type: String, trim: true, default: "" },
    paymentMethods: {
      esewa: { type: paymentMethodSchema, default: () => ({ label: "eSewa" }) },
      khalti: { type: paymentMethodSchema, default: () => ({ label: "Khalti" }) }
    }
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
