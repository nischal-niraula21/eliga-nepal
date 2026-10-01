import mongoose from "mongoose";
import { GAME_KEYS } from "../config/games.js";

const roomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    game: { type: String, enum: GAME_KEYS, default: "EFOOTBALL", index: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    pendingChallenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reservationExpiresAt: { type: Date, default: null, index: true },
    hostGameUsername: { type: String, required: true, trim: true, maxlength: 60 },
    challengerGameUsername: { type: String, trim: true, maxlength: 60, default: "" },
    hostGamePlayerId: { type: String, trim: true, maxlength: 80, default: "" },
    challengerGamePlayerId: { type: String, trim: true, maxlength: 80, default: "" },
    gameMode: { type: String, required: true, trim: true, maxlength: 60 },
    matchFormat: { type: String, required: true, trim: true, maxlength: 30 },
    entryFee: { type: Number, required: true },
    hostWalletType: { type: String, enum: ["MAIN", "FP"], default: "MAIN" },
    challengerWalletType: { type: String, enum: ["MAIN", "FP"], default: "MAIN" },
    totalPool: { type: Number, required: true },
    platformFeePercent: { type: Number, required: true },
    platformFeeAmount: { type: Number, required: true },
    prizeAmount: { type: Number, required: true },
    roomAccessId: { type: String, trim: true, maxlength: 120, default: "" },
    roomAccessPassword: { type: String, trim: true, maxlength: 120, default: "" },
    // Legacy fields are retained so existing eFootball rooms continue to work after deployment.
    efootballRoomId: { type: String, trim: true, maxlength: 100, default: "" },
    efootballPassword: { type: String, trim: true, maxlength: 100, default: "" },
    result: { type: mongoose.Schema.Types.ObjectId, ref: "Result", default: null },
    settledAt: { type: Date, default: null },
    settlementType: { type: String, enum: ["", "PRIZE", "REFUND"], default: "" },
    settlementOutcome: { type: String, enum: ["", "HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"], default: "" },
    status: {
      type: String,
      enum: ["OPEN", "READY", "RESULT_PENDING", "DISPUTED", "COMPLETED", "CANCELLED"],
      default: "OPEN",
      index: true
    }
  },
  { timestamps: true }
);

roomSchema.index({ game: 1, status: 1, createdAt: -1 });
roomSchema.index({ status: 1, reservationExpiresAt: 1, createdAt: -1 });
export default mongoose.model("Room", roomSchema);
