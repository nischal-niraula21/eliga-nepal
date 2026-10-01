import mongoose from "mongoose";
import User from "../models/User.js";
import Referral from "../models/Referral.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { balanceField, FP_MIN_SUCCESSFUL_REFERRALS, walletName, walletType } from "../config/wallets.js";

export async function withWalletTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    if (result?.$session) result.$session(null);
    return result;
  } finally {
    await session.endSession();
  }
}

function positiveAmount(amount, label) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw Object.assign(new Error(`${label} amount must be greater than zero.`), { status: 400 });
  }
  return value;
}

export async function successfulReferrals(userId, session = null) {
  const query = Referral.countDocuments({ referrer: userId, status: "REWARDED" });
  if (session) query.session(session);
  return query;
}

export async function checkFpEligibility(userId, session = null) {
  if (await successfulReferrals(userId, session) < FP_MIN_SUCCESSFUL_REFERRALS) {
    throw Object.assign(new Error(`FP Wallet unlocks after ${FP_MIN_SUCCESSFUL_REFERRALS} successful referrals.`), {
      status: 409, code: "FP_LOCKED"
    });
  }
}

function duplicateResult(existing, { userId, amount, wallet, type }) {
  if (String(existing.user) !== String(userId) || existing.amount !== amount ||
      (existing.walletType || "MAIN") !== wallet || existing.type !== type) {
    throw Object.assign(new Error("This payment was already recorded with different details. Please reload."), { status: 409 });
  }
  return { duplicate: true, transaction: existing };
}

async function runWalletMutation({
  userId, amount, userFilter = {}, userInc, meta = {}, defaultType,
  defaultDirection, defaultDescription, missingError, missingCode, session = null
}) {
  const wallet = walletType(meta.walletType);
  const type = meta.type || defaultType;
  const identity = { userId, amount, wallet, type };

  async function mutate(activeSession) {
    if (meta.idempotencyKey) {
      const existing = await WalletTransaction.findOne({ idempotencyKey: meta.idempotencyKey }).session(activeSession);
      if (existing) return duplicateResult(existing, identity);
    }
    if (wallet === "FP" && defaultDirection === "DEBIT") {
      if (type !== "ENTRY_FEE") throw Object.assign(new Error("FP can only be spent on a room entry."), { status: 400 });
      await checkFpEligibility(userId, activeSession);
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, ...userFilter }, { $inc: userInc }, { new: true, session: activeSession }
    );
    if (!user) {
      throw Object.assign(new Error(missingError), { status: 409, code: missingCode });
    }

    const [transaction] = await WalletTransaction.create([{
      user: user._id,
      walletType: wallet,
      type,
      direction: defaultDirection,
      amount,
      balanceAfter: user[balanceField(wallet)] || 0,
      heldAfter: user.walletHeld || 0,
      description: meta.description || defaultDescription,
      referenceType: meta.referenceType || "",
      referenceId: meta.referenceId || null,
      createdBy: meta.createdBy || null,
      idempotencyKey: meta.idempotencyKey
    }], { session: activeSession });
    return { user, transaction };
  }

  // Room/referral callers pass their transaction so the ledger and business
  // record either both commit or both roll back. Never nest transactions.
  if (session) return mutate(session);
  try {
    return await withWalletTransaction(mutate);
  } catch (error) {
    if (error?.code === 11000 && meta.idempotencyKey) {
      const existing = await WalletTransaction.findOne({ idempotencyKey: meta.idempotencyKey });
      if (existing) return duplicateResult(existing, identity);
    }
    throw error;
  }
}

export async function creditWallet(userId, amount, meta = {}, session = null) {
  const value = positiveAmount(amount, "Credit");
  const wallet = walletType(meta.walletType);
  if (wallet === "FP" && !["REFERRAL_BONUS", "REFUND"].includes(meta.type)) {
    throw Object.assign(new Error("FP Wallet only receives referral rewards and FP refunds."), { status: 400 });
  }
  return runWalletMutation({
    userId, amount: value, userInc: { [balanceField(wallet)]: value }, meta, session,
    defaultType: "ADMIN_CREDIT", defaultDirection: "CREDIT",
    defaultDescription: `${walletName(wallet)} credit`, missingError: "Player not found."
  });
}

export async function debitWallet(userId, amount, meta = {}, session = null) {
  const value = positiveAmount(amount, "Debit");
  const field = balanceField(meta.walletType);
  return runWalletMutation({
    userId, amount: value, userFilter: { [field]: { $gte: value } },
    userInc: { [field]: -value }, meta, session,
    defaultType: "ADMIN_DEBIT", defaultDirection: "DEBIT",
    defaultDescription: `${walletName(meta.walletType)} debit`,
    missingError: `Insufficient ${walletName(meta.walletType)} balance.`,
    missingCode: "INSUFFICIENT_BALANCE"
  });
}

export async function holdWithdrawal(userId, amount, meta = {}) {
  if (walletType(meta.walletType) !== "MAIN") {
    throw Object.assign(new Error("FP Wallet cannot be withdrawn. Only finalized match winnings go to Main Wallet."), { status: 400 });
  }
  const value = positiveAmount(amount, "Withdrawal");
  return runWalletMutation({
    userId, amount: value,
    userFilter: { walletBalance: { $gte: value } },
    userInc: { walletBalance: -value, walletHeld: value },
    meta: { ...meta, walletType: "MAIN", type: "WITHDRAWAL_HOLD",
      referenceType: meta.referenceType || "WithdrawalRequest", createdBy: meta.createdBy || userId },
    defaultType: "WITHDRAWAL_HOLD", defaultDirection: "DEBIT",
    defaultDescription: "Withdrawal requested from Main Wallet",
    missingError: "Insufficient Main Wallet balance.", missingCode: "INSUFFICIENT_BALANCE"
  });
}

export async function releaseWithdrawal(userId, amount, meta = {}) {
  const value = positiveAmount(amount, "Withdrawal release");
  return runWalletMutation({
    userId, amount: value,
    userFilter: { walletHeld: { $gte: value } },
    userInc: { walletHeld: -value, walletBalance: value },
    meta: { ...meta, walletType: "MAIN", type: "WITHDRAWAL_RELEASE",
      referenceType: meta.referenceType || "WithdrawalRequest" },
    defaultType: "WITHDRAWAL_RELEASE", defaultDirection: "CREDIT",
    defaultDescription: "Withdrawal returned to Main Wallet",
    missingError: "Reserved withdrawal balance could not be released."
  });
}

export async function completeWithdrawalHold(userId, amount) {
  const value = positiveAmount(amount, "Withdrawal completion");
  const user = await User.findOneAndUpdate(
    { _id: userId, walletHeld: { $gte: value } },
    { $inc: { walletHeld: -value } }, { new: true }
  );
  if (!user) throw new Error("Reserved withdrawal balance is unavailable.");
  return user;
}
