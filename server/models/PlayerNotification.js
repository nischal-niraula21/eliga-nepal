import mongoose from "mongoose";

const playerNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["ACCOUNT_BLOCKED", "ACCOUNT_UNBLOCKED", "MATCH_RESOLVED", "REFERRAL_REWARD"],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, trim: true, maxlength: 400, default: "" },
    status: { type: String, trim: true, maxlength: 40, default: "INFO" },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

playerNotificationSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model("PlayerNotification", playerNotificationSchema);
