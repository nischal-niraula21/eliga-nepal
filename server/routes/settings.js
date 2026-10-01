import express from "express";
import { getSettings } from "../utils/settings.js";
import { FP_MIN_SUCCESSFUL_REFERRALS } from "../config/wallets.js";

const router = express.Router();

router.get("/public", async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      minEntryFee: settings.minEntryFee,
      maxEntryFee: settings.maxEntryFee,
      commissionPercent: settings.commissionPercent,
      minDeposit: settings.minDeposit,
      maxDeposit: settings.maxDeposit,
      minWithdrawal: settings.minWithdrawal,
      maxWithdrawal: settings.maxWithdrawal,
      referralProgramEnabled: Boolean(settings.referralProgramEnabled),
      referralRewardAmount: Number(settings.referralRewardAmount || 0),
      referralRewardWalletType: "FP",
      fpMinimumSuccessfulReferrals: FP_MIN_SUCCESSFUL_REFERRALS,
      whatsappNumber: settings.whatsappNumber || "",
      paymentMethods: settings.paymentMethods
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load platform settings." });
  }
});

export default router;
