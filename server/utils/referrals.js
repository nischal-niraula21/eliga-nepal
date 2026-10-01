import Referral from "../models/Referral.js";
import User from "../models/User.js";
import WalletTransaction from "../models/WalletTransaction.js";
import PlayerNotification from "../models/PlayerNotification.js";
import { getSettings } from "./settings.js";
import { creditWallet, withWalletTransaction } from "./wallet.js";
import { walletName } from "../config/wallets.js";

export async function rewardReferralForVerifiedDeposit(referredUserId, depositId, adminUserId) {
  const settings = await getSettings();
  if (!settings.referralProgramEnabled || Number(settings.referralRewardAmount) <= 0) return null;

  return withWalletTransaction(async (session) => {
    const referral = await Referral.findOne({ referredUser: referredUserId, status: "PENDING" }).session(session);
    if (!referral) return null;
    const referrer = await User.findOne({ _id: referral.referrer, role: "user", isBlocked: false }).session(session);
    if (!referrer) return null;

    const idempotencyKey = `referral:${referral._id}:reward`;
    // Recover a legacy reward recorded before a crash without paying it again
    // or moving money already credited to Main Wallet.
    let transaction = await WalletTransaction.findOne({ idempotencyKey }).session(session);
    if (transaction && (String(transaction.user) !== String(referrer._id) || transaction.type !== "REFERRAL_BONUS")) {
      throw new Error("Referral reward ledger does not match this player.");
    }
    if (!transaction) {
      const result = await creditWallet(referrer._id, Number(settings.referralRewardAmount), {
        walletType: "FP", type: "REFERRAL_BONUS",
        description: "Referral reward added to FP Wallet after a successful first deposit",
        referenceType: "Referral", referenceId: referral._id, createdBy: adminUserId, idempotencyKey
      }, session);
      transaction = result.transaction;
    }

    referral.status = "REWARDED";
    referral.qualifyingDeposit = depositId;
    referral.rewardAmount = transaction.amount;
    referral.rewardWalletType = transaction.walletType || "MAIN";
    referral.rewardedAt = transaction.createdAt || new Date();
    await referral.save({ session });
    await User.findByIdAndUpdate(referral.referredUser, { $set: { referralRewarded: true } }, { session });

    await PlayerNotification.create([{
      user: referrer._id, type: "REFERRAL_REWARD",
      title: `Referral reward +Rs. ${referral.rewardAmount}`,
      message: `Your referral completed their first verified deposit. The reward is in your ${walletName(referral.rewardWalletType)}.`,
      status: "REWARDED", referenceId: referral._id, createdBy: adminUserId
    }], { session });
    return referral;
  });
}

