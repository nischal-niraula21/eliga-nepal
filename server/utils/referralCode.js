import crypto from "node:crypto";
import User from "../models/User.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(length = 6) {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return value;
}

export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = `EL${randomSuffix(6)}`;
    if (!(await User.exists({ referralCode: code }))) return code;
  }
  throw new Error("Could not generate a unique referral code.");
}

export async function ensureReferralCode(user) {
  if (!user || user.role !== "user" || user.referralCode) return user?.referralCode || "";

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = await generateUniqueReferralCode();
    const updated = await User.findOneAndUpdate(
      { _id: user._id, $or: [{ referralCode: "" }, { referralCode: { $exists: false } }, { referralCode: null }] },
      { $set: { referralCode: code } },
      { new: true }
    );
    if (updated?.referralCode) {
      user.referralCode = updated.referralCode;
      return updated.referralCode;
    }

    const fresh = await User.findById(user._id).select("referralCode");
    if (fresh?.referralCode) {
      user.referralCode = fresh.referralCode;
      return fresh.referralCode;
    }
  }

  throw new Error("Could not assign a referral code.");
}
