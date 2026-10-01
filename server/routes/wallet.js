import express from "express";
import DepositRequest from "../models/DepositRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import WalletTransaction from "../models/WalletTransaction.js";
import PlayerNotification from "../models/PlayerNotification.js";
import { protect, playerOnly } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";
import { saveImage } from "../utils/uploadFile.js";
import { getSettings } from "../utils/settings.js";
import { holdWithdrawal, releaseWithdrawal, successfulReferrals } from "../utils/wallet.js";
import { FP_MIN_SUCCESSFUL_REFERRALS, walletType } from "../config/wallets.js";

const router = express.Router();
router.use(protect, playerOnly);

async function balances(user) {
  return {
    balance: user.walletBalance || 0,
    fpBalance: user.fpWalletBalance || 0,
    held: user.walletHeld || 0,
    successfulReferrals: await successfulReferrals(user._id),
    fpMinimumSuccessfulReferrals: FP_MIN_SUCCESSFUL_REFERRALS
  };
}

router.get("/balances", async (req, res) => {
  try { res.json(await balances(req.user)); }
  catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load wallet balances." });
  }
});

router.get("/", async (req, res) => {
  try {
    const [transactions, deposits, withdrawals, summary] = await Promise.all([
      WalletTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
      DepositRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20),
      WithdrawalRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20),
      balances(req.user)
    ]);
    res.json({
      ...summary,
      transactions,
      deposits,
      withdrawals
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load wallet." });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const [deposits, withdrawals, walletActivity, notices] = await Promise.all([
      DepositRequest.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(20),
      WithdrawalRequest.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(20),
      WalletTransaction.find({
        user: req.user._id,
        type: { $in: ["ENTRY_FEE", "PRIZE", "REFUND", "ADMIN_CREDIT", "ADMIN_DEBIT"] }
      }).sort({ createdAt: -1 }).limit(30),
      PlayerNotification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20)
    ]);

    const items = [
      ...deposits.map((item) => ({
        id: `deposit-${item._id}`,
        type: "DEPOSIT",
        amount: item.amount,
        method: item.method,
        status: item.status,
        detail: item.status === "REJECTED" ? item.rejectionReason : "",
        createdAt: item.updatedAt || item.createdAt
      })),
      ...withdrawals.map((item) => ({
        id: `withdrawal-${item._id}`,
        type: "WITHDRAWAL",
        amount: item.amount,
        method: item.method,
        status: item.status,
        detail: item.status === "REJECTED" ? item.rejectionReason : "",
        createdAt: item.updatedAt || item.createdAt
      })),
      ...walletActivity.map((item) => ({
        id: `wallet-${item._id}`,
        type: item.type,
        walletType: item.walletType || "MAIN",
        amount: item.amount,
        status: {
          ENTRY_FEE: "PAID",
          PRIZE: "WON",
          REFUND: "REFUNDED",
          ADMIN_CREDIT: "ADDED",
          ADMIN_DEBIT: "DEDUCTED"
        }[item.type],
        detail: item.description || "eLeague wallet transaction.",
        createdAt: item.createdAt
      })),
      ...notices.map((item) => ({
        id: `notice-${item._id}`,
        type: item.type,
        title: item.title,
        status: item.status,
        detail: item.message,
        createdAt: item.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 30);

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load notifications." });
  }
});

router.post("/deposit", uploadImage.single("screenshot"), async (req, res) => {
  try {
    const settings = await getSettings();
    const amount = Number(req.body.amount);
    const method = req.body.method;
    const transactionId = req.body.transactionId?.trim().toUpperCase();

    if (!Number.isFinite(amount) || amount < settings.minDeposit || amount > settings.maxDeposit) {
      return res.status(400).json({ message: `Deposit must be between Rs. ${settings.minDeposit} and Rs. ${settings.maxDeposit}.` });
    }
    if (!["ESEWA", "KHALTI"].includes(method)) {
      return res.status(400).json({ message: "Choose eSewa or Khalti." });
    }
    if (!transactionId) return res.status(400).json({ message: "Transaction ID is required." });
    if (await DepositRequest.exists({ transactionId })) {
      return res.status(409).json({ message: "This transaction ID has already been submitted." });
    }

    const screenshotUrl = await saveImage(req.file, "deposits");
    const deposit = await DepositRequest.create({
      user: req.user._id,
      amount,
      method,
      transactionId,
      screenshotUrl
    });
    res.status(201).json({ deposit });
  } catch (error) {
    console.error(error);
    if (error?.code === 11000) return res.status(409).json({ message: "This transaction ID has already been submitted." });
    res.status(400).json({ message: error.message || "Could not submit deposit request." });
  }
});

router.post("/withdraw", async (req, res) => {
  let withdrawal;
  let held = false;
  try {
    if (walletType(req.body.walletType) !== "MAIN") {
      return res.status(400).json({ message: "FP Wallet cannot be withdrawn. Finalized match winnings are paid to Main Wallet." });
    }
    const settings = await getSettings();
    const amount = Number(req.body.amount);
    const method = req.body.method;
    const accountName = req.body.accountName?.trim();
    const accountNumber = req.body.accountNumber?.trim();

    if (!Number.isFinite(amount) || amount < settings.minWithdrawal || amount > settings.maxWithdrawal) {
      return res.status(400).json({ message: `Withdrawal must be between Rs. ${settings.minWithdrawal} and Rs. ${settings.maxWithdrawal}.` });
    }
    if (!["ESEWA", "KHALTI"].includes(method)) {
      return res.status(400).json({ message: "Choose eSewa or Khalti." });
    }
    if (!accountName || !accountNumber) {
      return res.status(400).json({ message: "Wallet account name and number are required." });
    }

    withdrawal = new WithdrawalRequest({
      user: req.user._id,
      amount,
      method,
      accountName,
      accountNumber
    });

    await holdWithdrawal(req.user._id, amount, {
      referenceId: withdrawal._id,
      description: `Withdrawal request via ${method === "ESEWA" ? "eSewa" : "Khalti"}`,
      idempotencyKey: `withdrawal:${withdrawal._id}:hold`
    });
    held = true;
    await withdrawal.save();
    held = false;
    res.status(201).json({ withdrawal });
  } catch (error) {
    console.error(error);
    if (held && withdrawal?._id) {
      await releaseWithdrawal(req.user._id, withdrawal.amount, {
        referenceId: withdrawal._id,
        description: "Withdrawal request failed; reserved balance returned",
        idempotencyKey: `withdrawal:${withdrawal._id}:create-failed-release`
      }).catch(() => {});
    }
    res.status(error.code === "INSUFFICIENT_BALANCE" ? 409 : 400).json({ message: error.message || "Could not submit withdrawal request." });
  }
});

export default router;
