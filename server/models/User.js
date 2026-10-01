import mongoose from "mongoose";
import { GAME_KEYS } from "../config/games.js";

const gameProfileSchema = new mongoose.Schema(
  {
    game: { type: String, enum: GAME_KEYS, required: true },
    username: { type: String, trim: true, maxlength: 60, default: "" },
    playerId: { type: String, trim: true, maxlength: 80, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Kept for compatibility with existing eFootball-only accounts. New accounts use gameProfiles.
    efootballUsername: { type: String, trim: true, maxlength: 60, default: "" },
    gameProfiles: { type: [gameProfileSchema], default: [] },
    walletBalance: { type: Number, default: 0, min: 0 },
    // Missing legacy values read as zero in the API. Avoid a hydration default
    // that a profile save could write over a concurrent first FP credit.
    fpWalletBalance: { type: Number, min: 0 },
    walletHeld: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true, default: undefined },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    referralRewarded: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false, index: true },
    blockReason: { type: String, trim: true, maxlength: 300, default: "" },
    blockedAt: { type: Date, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
