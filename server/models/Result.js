import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, unique: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    claimedOutcome: { type: String, enum: ["HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"], required: true },
    claimedWinner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    hostScore: { type: Number, min: 0, default: 0 },
    challengerScore: { type: Number, min: 0, default: 0 },
    screenshotUrl: { type: String, required: true },
    opponentResponse: { type: String, enum: ["PENDING", "CONFIRMED", "DISPUTED"], default: "PENDING" },
    disputeReason: { type: String, trim: true, default: "" },
    disputeScreenshotUrl: { type: String, default: "" },
    disputeOutcome: { type: String, enum: ["", "HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"], default: "" },
    disputeHostScore: { type: Number, min: 0, max: 9999, default: null },
    disputeChallengerScore: { type: Number, min: 0, max: 9999, default: null },
    disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    disputedAt: { type: Date, default: null },
    status: { type: String, enum: ["SUBMITTED", "CONFIRMED", "DISPUTED", "ADMIN_RESOLVED"], default: "SUBMITTED" },
    finalOutcome: { type: String, enum: ["", "HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"], default: "" },
    finalWinner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Result", resultSchema);
