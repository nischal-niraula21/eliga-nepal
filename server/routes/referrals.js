import express from "express";
import Referral from "../models/Referral.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { ensureReferralCode } from "../utils/referralCode.js";
import { getSettings } from "../utils/settings.js";
import { FP_MIN_SUCCESSFUL_REFERRALS } from "../config/wallets.js";

const router = express.Router();

router.get("/validate/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const user = await User.findOne({ referralCode: code, role: "user", isBlocked: false }).select("name referralCode");
    if (!user) return res.status(404).json({ valid: false, message: "Referral code not found." });
    res.json({ valid: true, code: user.referralCode, referrerName: user.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ valid: false, message: "Could not validate referral code." });
  }
});

router.use(protect);

router.get("/me", async (req, res) => {
  try {
    if (req.user.role !== "user") return res.status(403).json({ message: "Player account required." });

    const [settings] = await Promise.all([getSettings(), ensureReferralCode(req.user)]);
    const summary = await Referral.aggregate([
      { $match: { referrer: req.user._id } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          successfulCount: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, 1, 0] } },
          totalEarned: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, "$rewardAmount", 0] } }
        }
      }
    ]);

    const stats = summary[0] || { totalCount: 0, successfulCount: 0, totalEarned: 0 };
    const totalCount = Number(stats.totalCount || 0);
    const successfulCount = Number(stats.successfulCount || 0);

    res.json({
      enabled: Boolean(settings.referralProgramEnabled),
      rewardAmount: Number(settings.referralRewardAmount || 0),
      rewardWalletType: "FP",
      fpBalance: req.user.fpWalletBalance || 0,
      fpMinimumSuccessfulReferrals: FP_MIN_SUCCESSFUL_REFERRALS,
      referralCode: req.user.referralCode,
      totalCount,
      successfulCount,
      pendingCount: Math.max(0, totalCount - successfulCount),
      totalEarned: Number(stats.totalEarned || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load referral details." });
  }
});

export default router;
