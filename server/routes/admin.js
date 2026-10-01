import express from "express";
import DepositRequest from "../models/DepositRequest.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import Room from "../models/Room.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import PlayerNotification from "../models/PlayerNotification.js";
import Referral from "../models/Referral.js";
import Announcement from "../models/Announcement.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";
import { saveImage } from "../utils/uploadFile.js";
import { getSettings } from "../utils/settings.js";
import { completeWithdrawalHold, creditWallet, debitWallet, releaseWithdrawal } from "../utils/wallet.js";
import { settleRoom } from "../utils/settleRoom.js";
import { rewardReferralForVerifiedDeposit } from "../utils/referrals.js";

const router = express.Router();
router.use(protect, adminOnly);

router.get("/summary", async (_req, res) => {
  try {
    const [pendingDeposits, pendingWithdrawals, openRooms, disputes, users, blockedUsers, liability] = await Promise.all([
      DepositRequest.countDocuments({ status: "PENDING" }),
      WithdrawalRequest.countDocuments({ status: "PENDING" }),
      Room.countDocuments({ status: "OPEN" }),
      Room.countDocuments({ status: "DISPUTED" }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", isBlocked: true }),
      User.aggregate([
        { $match: { role: "user" } },
        { $group: { _id: null, total: { $sum: { $add: ["$walletBalance", "$walletHeld"] } }, fp: { $sum: { $ifNull: ["$fpWalletBalance", 0] } } } }
      ])
    ]);
    res.json({ pendingDeposits, pendingWithdrawals, openRooms, disputes, users, blockedUsers, walletLiability: liability[0]?.total || 0, fpBalanceTotal: liability[0]?.fp || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load dashboard summary." });
  }
});

router.get("/deposits", async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const deposits = await DepositRequest.find(query)
      .populate("user", "name email gameProfiles efootballUsername walletBalance isBlocked")
      .sort({ createdAt: -1 })
      .limit(250);
    res.json({ deposits });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load deposit requests." });
  }
});

router.patch("/deposits/:id", async (req, res) => {
  let claimed = null;
  try {
    const action = req.body.action;
    if (!["VERIFY", "REJECT"].includes(action)) return res.status(400).json({ message: "Choose VERIFY or REJECT." });

    const targetStatus = action === "VERIFY" ? "VERIFIED" : "REJECTED";
    claimed = await DepositRequest.findOneAndUpdate(
      { _id: req.params.id, status: "PENDING" },
      {
        $set: {
          status: targetStatus,
          rejectionReason: action === "REJECT" ? (req.body.reason?.trim() || "Transaction could not be verified.") : "",
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      },
      { new: true }
    );
    if (!claimed) {
      const exists = await DepositRequest.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ message: exists ? "This deposit has already been reviewed." : "Deposit request not found." });
    }

    if (action === "VERIFY") {
      await creditWallet(claimed.user, claimed.amount, {
        type: "DEPOSIT",
        description: `${claimed.method === "ESEWA" ? "eSewa" : "Khalti"} deposit verified`,
        referenceType: "DepositRequest",
        referenceId: claimed._id,
        createdBy: req.user._id,
        idempotencyKey: `deposit:${claimed._id}:credit`
      });
      try {
        await rewardReferralForVerifiedDeposit(claimed.user, claimed._id, req.user._id);
      } catch (referralError) {
        console.error("Referral reward could not be processed:", referralError);
      }
    }

    res.json({ deposit: claimed });
  } catch (error) {
    console.error(error);
    if (claimed?._id && claimed.status === "VERIFIED") {
      await DepositRequest.updateOne(
        { _id: claimed._id, status: "VERIFIED" },
        { $set: { status: "PENDING", reviewedBy: null, reviewedAt: null, rejectionReason: "" } }
      ).catch(() => {});
    }
    res.status(500).json({ message: error.message || "Could not review deposit." });
  }
});

router.get("/withdrawals", async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const withdrawals = await WithdrawalRequest.find(query)
      .populate("user", "name email gameProfiles efootballUsername walletBalance walletHeld isBlocked")
      .sort({ createdAt: -1 })
      .limit(250);
    res.json({ withdrawals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load withdrawal requests." });
  }
});

router.patch("/withdrawals/:id", uploadImage.single("screenshot"), async (req, res) => {
  let claimed = null;
  try {
    const action = req.body.action;
    if (!["APPROVE", "REJECT"].includes(action)) return res.status(400).json({ message: "Choose APPROVE or REJECT." });

    const transactionId = action === "APPROVE" ? req.body.transactionId?.trim().toUpperCase() : "";
    if (action === "APPROVE" && !transactionId) return res.status(400).json({ message: "Enter the payout transaction ID before approving." });

    let payoutScreenshotUrl = "";
    if (action === "APPROVE" && req.file) payoutScreenshotUrl = await saveImage(req.file, "withdrawals");

    claimed = await WithdrawalRequest.findOneAndUpdate(
      { _id: req.params.id, status: "PENDING" },
      {
        $set: {
          status: action === "APPROVE" ? "PAID" : "REJECTED",
          adminTransactionId: transactionId,
          ...(payoutScreenshotUrl ? { payoutScreenshotUrl } : {}),
          rejectionReason: action === "REJECT" ? (req.body.reason?.trim() || "Withdrawal request rejected.") : "",
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      },
      { new: true }
    );
    if (!claimed) {
      const exists = await WithdrawalRequest.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({ message: exists ? "This withdrawal has already been reviewed." : "Withdrawal request not found." });
    }

    if (action === "APPROVE") {
      await completeWithdrawalHold(claimed.user, claimed.amount);
    } else {
      await releaseWithdrawal(claimed.user, claimed.amount, {
        referenceId: claimed._id,
        createdBy: req.user._id,
        description: "Rejected withdrawal returned to wallet",
        idempotencyKey: `withdrawal:${claimed._id}:release`
      });
    }

    res.json({ withdrawal: claimed });
  } catch (error) {
    console.error(error);
    if (claimed?._id) {
      await WithdrawalRequest.updateOne(
        { _id: claimed._id, status: claimed.status },
        { $set: { status: "PENDING", adminTransactionId: "", reviewedBy: null, reviewedAt: null, rejectionReason: "" } }
      ).catch(() => {});
    }
    res.status(500).json({ message: error.message || "Could not review withdrawal." });
  }
});

router.get("/players", async (req, res) => {
  try {
    const query = { role: "user" };
    const search = req.query.search?.trim();
    const requestedPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 25));
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { efootballUsername: { $regex: safeSearch, $options: "i" } },
        { "gameProfiles.username": { $regex: safeSearch, $options: "i" } },
        { "gameProfiles.playerId": { $regex: safeSearch, $options: "i" } }
      ];
    }

    const total = await User.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);
    const players = await User.find(query)
      .select("name email gameProfiles efootballUsername walletBalance fpWalletBalance walletHeld isBlocked blockReason referralCode createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const playerIds = players.map((player) => player._id);
    const [referralStats, depositStats, withdrawalStats] = playerIds.length
      ? await Promise.all([
          Referral.aggregate([
            { $match: { referrer: { $in: playerIds } } },
            {
              $group: {
                _id: "$referrer",
                totalCount: { $sum: 1 },
                successfulCount: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, 1, 0] } },
                totalEarned: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, "$rewardAmount", 0] } }
              }
            }
          ]),
          DepositRequest.aggregate([
            { $match: { user: { $in: playerIds }, status: "VERIFIED" } },
            { $group: { _id: "$user", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
          ]),
          WithdrawalRequest.aggregate([
            { $match: { user: { $in: playerIds }, status: "PAID" } },
            { $group: { _id: "$user", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
          ])
        ])
      : [[], [], []];

    const statsByPlayer = new Map(referralStats.map((item) => [String(item._id), item]));
    const depositsByPlayer = new Map(depositStats.map((item) => [String(item._id), item]));
    const withdrawalsByPlayer = new Map(withdrawalStats.map((item) => [String(item._id), item]));

    res.json({
      pagination: { page, limit, total, pages },
      players: players.map((player) => {
        const stats = statsByPlayer.get(String(player._id)) || {};
        const deposits = depositsByPlayer.get(String(player._id)) || {};
        const withdrawals = withdrawalsByPlayer.get(String(player._id)) || {};
        const totalCount = Number(stats.totalCount || 0);
        const successfulCount = Number(stats.successfulCount || 0);
        return {
          ...player,
          financialStats: {
            totalDeposited: Number(deposits.totalAmount || 0),
            depositCount: Number(deposits.count || 0),
            totalWithdrawn: Number(withdrawals.totalAmount || 0),
            withdrawalCount: Number(withdrawals.count || 0)
          },
          referralStats: {
            totalCount,
            successfulCount,
            pendingCount: Math.max(0, totalCount - successfulCount),
            totalEarned: Number(stats.totalEarned || 0)
          }
        };
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load players." });
  }
});


router.get("/players/:id/referrals", async (req, res) => {
  try {
    const player = await User.findOne({ _id: req.params.id, role: "user" })
      .select("name email gameProfiles efootballUsername referralCode createdAt");
    if (!player) return res.status(404).json({ message: "Player not found." });

    const [referrals, summary] = await Promise.all([
      Referral.find({ referrer: player._id })
        .populate("referredUser", "name email gameProfiles efootballUsername createdAt isBlocked")
        .sort({ createdAt: -1 })
        .limit(500),
      Referral.aggregate([
        { $match: { referrer: player._id } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            successfulCount: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, 1, 0] } },
            totalEarned: { $sum: { $cond: [{ $eq: ["$status", "REWARDED"] }, "$rewardAmount", 0] } }
          }
        }
      ])
    ]);

    const stats = summary[0] || {};
    const totalCount = Number(stats.totalCount || 0);
    const successfulCount = Number(stats.successfulCount || 0);

    res.json({
      player,
      totalCount,
      successfulCount,
      pendingCount: Math.max(0, totalCount - successfulCount),
      totalEarned: Number(stats.totalEarned || 0),
      referrals: referrals.map((item) => ({
        _id: item._id,
        codeUsed: item.codeUsed,
        status: item.status === "REWARDED" ? "REWARDED" : "PENDING",
        rewardAmount: Number(item.rewardAmount || 0),
        createdAt: item.createdAt,
        rewardedAt: item.rewardedAt,
        referredUser: item.referredUser
          ? {
              _id: item.referredUser._id,
              name: item.referredUser.name,
              email: item.referredUser.email,
              efootballUsername: item.referredUser.efootballUsername,
              gameProfiles: item.referredUser.gameProfiles || [],
              isBlocked: item.referredUser.isBlocked,
              createdAt: item.referredUser.createdAt
            }
          : null
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load player referral details." });
  }
});

router.patch("/players/:id/wallet", async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const action = req.body.action;
    const reason = req.body.reason?.trim();
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid amount." });
    if (!reason) return res.status(400).json({ message: "A reason is required for every wallet adjustment." });

    const meta = {
      description: reason,
      referenceType: "AdminAdjustment",
      createdBy: req.user._id
    };
    let result;
    if (action === "CREDIT") result = await creditWallet(req.params.id, amount, { ...meta, type: "ADMIN_CREDIT" });
    else if (action === "DEBIT") result = await debitWallet(req.params.id, amount, { ...meta, type: "ADMIN_DEBIT" });
    else return res.status(400).json({ message: "Choose CREDIT or DEBIT." });

    res.json({ user: result.user, transaction: result.transaction });
  } catch (error) {
    console.error(error);
    res.status(error.code === "INSUFFICIENT_BALANCE" ? 409 : 500).json({ message: error.message || "Could not adjust wallet." });
  }
});

router.patch("/players/:id/block", async (req, res) => {
  try {
    const blocked = Boolean(req.body.blocked);
    const player = await User.findOne({ _id: req.params.id, role: "user" });
    if (!player) return res.status(404).json({ message: "Player not found." });
    player.isBlocked = blocked;
    player.blockReason = blocked ? (req.body.reason?.trim() || "Account blocked by eLeague admin.") : "";
    player.blockedAt = blocked ? new Date() : null;
    player.blockedBy = blocked ? req.user._id : null;
    await player.save();

    await PlayerNotification.create({
      user: player._id,
      type: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_UNBLOCKED",
      title: blocked ? "Your eLeague account was blocked" : "Your eLeague account access was restored",
      message: blocked ? player.blockReason : "You can use eLeague normally again.",
      status: blocked ? "BLOCKED" : "RESTORED",
      createdBy: req.user._id
    });

    res.json({ player });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update player access." });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    if (req.query.game === "EFOOTBALL") query.$or = [{ game: "EFOOTBALL" }, { game: { $exists: false } }];
    else if (req.query.game) query.game = req.query.game;
    const rooms = await Room.find(query)
      .populate("host", "name email gameProfiles efootballUsername walletBalance")
      .populate("challenger", "name email gameProfiles efootballUsername walletBalance")
      .populate({
        path: "result",
        populate: [
          { path: "submittedBy", select: "name email" },
          { path: "disputedBy", select: "name email" },
          { path: "claimedWinner", select: "name email" },
          { path: "finalWinner", select: "name email" },
          { path: "resolvedBy", select: "name email" }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(250);
    res.json({ rooms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load rooms." });
  }
});

router.get("/disputes", async (_req, res) => {
  try {
    const results = await Result.find({ status: "DISPUTED" })
      .populate({
        path: "room",
        populate: [
          { path: "host", select: "name email gameProfiles efootballUsername" },
          { path: "challenger", select: "name email gameProfiles efootballUsername" }
        ]
      })
      .populate("submittedBy", "name email gameProfiles efootballUsername")
      .populate("disputedBy", "name email gameProfiles efootballUsername")
      .populate("claimedWinner", "name email")
      .populate("finalWinner", "name email")
      .sort({ updatedAt: -1 });
    res.json({ results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load disputes." });
  }
});

router.patch("/results/:id/resolve", async (req, res) => {
  let claimedResult = null;
  let settlementCompleted = false;
  try {
    const existing = await Result.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Result not found." });
    if (existing.status !== "DISPUTED") return res.status(409).json({ message: "This result is not disputed." });

    const room = await Room.findById(existing.room);
    if (!room) return res.status(404).json({ message: "Room not found." });
    if (room.status !== "DISPUTED") return res.status(409).json({ message: "This room is no longer awaiting dispute resolution." });

    const finalOutcome = req.body.finalOutcome;
    if (!["HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"].includes(finalOutcome)) {
      return res.status(400).json({ message: "Choose a valid final outcome." });
    }

    const hostScore = Number(req.body.hostScore ?? existing.hostScore);
    const challengerScore = Number(req.body.challengerScore ?? existing.challengerScore);
    if (![hostScore, challengerScore].every((score) => Number.isInteger(score) && score >= 0 && score <= 9999)) {
      return res.status(400).json({ message: "Enter a valid final score." });
    }

    claimedResult = await Result.findOneAndUpdate(
      { _id: existing._id, status: "DISPUTED" },
      {
        $set: {
          hostScore,
          challengerScore,
          finalOutcome,
          finalWinner: finalOutcome === "HOST_WIN" ? room.host : finalOutcome === "CHALLENGER_WIN" ? room.challenger : null,
          status: "ADMIN_RESOLVED",
          resolvedBy: req.user._id,
          resolvedAt: new Date()
        }
      },
      { new: true }
    );
    if (!claimedResult) return res.status(409).json({ message: "This dispute has already been resolved." });

    const settled = await settleRoom(room, finalOutcome, req.user._id);
    settlementCompleted = true;

    const outcomeText = finalOutcome === "HOST_WIN"
      ? `${room.hostGameUsername} was declared the winner.`
      : finalOutcome === "CHALLENGER_WIN"
        ? `${room.challengerGameUsername} was declared the winner.`
        : finalOutcome === "DRAW"
          ? "The match was resolved as a draw."
          : "The match was voided and the entry fees were refunded.";

    await PlayerNotification.insertMany([room.host, room.challenger].filter(Boolean).map((userId) => ({
      user: userId,
      type: "MATCH_RESOLVED",
      title: `Match ${room.roomCode} was resolved by admin`,
      message: outcomeText,
      status: "RESOLVED",
      referenceId: room._id,
      createdBy: req.user._id
    }))).catch((notificationError) => {
      console.error("Match resolution notification failed:", notificationError);
    });

    res.json({ result: claimedResult, room: settled });
  } catch (error) {
    console.error(error);
    if (claimedResult?._id && !settlementCompleted) {
      await Result.updateOne(
        { _id: claimedResult._id, status: "ADMIN_RESOLVED" },
        { $set: { status: "DISPUTED", finalOutcome: "", finalWinner: null, resolvedBy: null, resolvedAt: null } }
      ).catch(() => {});
    }
    res.status(500).json({ message: error.message || "Could not resolve dispute." });
  }
});


function parseAnnouncementDate(value, fieldLabel) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldLabel} is invalid.`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function normalizeAnnouncementLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !candidate.includes(" ") && candidate.includes(".")) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    return parsed.toString();
  } catch {
    const error = new Error("Announcement link must be a valid http(s) URL or an internal path beginning with /." );
    error.statusCode = 400;
    throw error;
  }
}

function announcementPayload(body, existing = null) {
  const audience = body.audience !== undefined ? String(body.audience || "").trim().toUpperCase() : existing?.audience;
  if (audience !== undefined && !["ALL", "LOGGED_IN", "NEW_SIGNUPS"].includes(audience)) {
    const error = new Error("Choose a valid announcement audience.");
    error.statusCode = 400;
    throw error;
  }

  const startsAt = parseAnnouncementDate(body.startsAt, "Start time");
  const expiresAt = parseAnnouncementDate(body.expiresAt, "Expiry time");
  const displayOrder = body.displayOrder !== undefined ? Number.parseInt(body.displayOrder, 10) : existing?.displayOrder;
  if (displayOrder !== undefined && (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 9999)) {
    const error = new Error("Display order must be a whole number between 0 and 9999.");
    error.statusCode = 400;
    throw error;
  }

  const payload = {};
  if (audience !== undefined) payload.audience = audience;
  if (body.linkUrl !== undefined) payload.linkUrl = normalizeAnnouncementLink(body.linkUrl);
  if (startsAt !== undefined) payload.startsAt = startsAt;
  if (expiresAt !== undefined) payload.expiresAt = expiresAt;
  if (displayOrder !== undefined) payload.displayOrder = displayOrder;
  if (body.isActive !== undefined) payload.isActive = String(body.isActive).toLowerCase() === "true";
  return payload;
}

router.get("/announcements", async (_req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "name email")
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    res.json({ announcements });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load announcements." });
  }
});

router.post("/announcements", uploadImage.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Upload an announcement image." });
    const payload = announcementPayload(req.body);
    const effectiveStart = payload.startsAt || new Date();
    if (payload.expiresAt && payload.expiresAt <= effectiveStart) {
      return res.status(400).json({ message: "Expiry time must be after the start time." });
    }

    const imageUrl = await saveImage(req.file, "announcements");
    const announcement = await Announcement.create({
      imageUrl,
      linkUrl: payload.linkUrl || "",
      audience: payload.audience || "ALL",
      displayOrder: payload.displayOrder ?? 0,
      startsAt: payload.startsAt ?? null,
      expiresAt: payload.expiresAt ?? null,
      isActive: payload.isActive ?? true,
      createdBy: req.user._id
    });

    res.status(201).json({ announcement });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ message: error.message || "Could not create announcement." });
  }
});

router.patch("/announcements/:id", uploadImage.single("image"), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found." });

    const payload = announcementPayload(req.body, announcement);
    Object.assign(announcement, payload);
    if (req.file) announcement.imageUrl = await saveImage(req.file, "announcements");

    const effectiveStart = announcement.startsAt || announcement.createdAt || new Date();
    if (announcement.expiresAt && announcement.expiresAt <= effectiveStart) {
      return res.status(400).json({ message: "Expiry time must be after the start time." });
    }

    await announcement.save();
    res.json({ announcement });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ message: error.message || "Could not update announcement." });
  }
});

router.delete("/announcements/:id", async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found." });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete announcement." });
  }
});

router.get("/settings", async (_req, res) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load settings." });
  }
});

router.patch(
  "/settings",
  uploadImage.fields([
    { name: "esewaQr", maxCount: 1 },
    { name: "khaltiQr", maxCount: 1 }
  ]),
  async (req, res) => {
  try {
    const incoming = req.body.settings ? JSON.parse(req.body.settings) : req.body;
    const settings = await getSettings();
    const numericFields = ["minEntryFee", "maxEntryFee", "commissionPercent", "minDeposit", "maxDeposit", "minWithdrawal", "maxWithdrawal", "referralRewardAmount"];
    for (const field of numericFields) {
      if (incoming[field] !== undefined) settings[field] = Number(incoming[field]);
    }

    if (settings.minEntryFee < 1 || settings.maxEntryFee <= settings.minEntryFee) {
      return res.status(400).json({ message: "Entry fee limits are invalid." });
    }
    if (settings.commissionPercent < 0 || settings.commissionPercent > 50) {
      return res.status(400).json({ message: "Commission must be between 0% and 50%." });
    }
    if (settings.minDeposit < 1 || settings.maxDeposit < settings.minDeposit || settings.minWithdrawal < 1 || settings.maxWithdrawal < settings.minWithdrawal) {
      return res.status(400).json({ message: "Wallet limits are invalid." });
    }
    if (settings.referralRewardAmount < 0 || settings.referralRewardAmount > 500) {
      return res.status(400).json({ message: "Referral reward must be between Rs. 0 and Rs. 500." });
    }

    if (incoming.referralProgramEnabled !== undefined) settings.referralProgramEnabled = Boolean(incoming.referralProgramEnabled);
    if (incoming.whatsappNumber !== undefined) settings.whatsappNumber = String(incoming.whatsappNumber || "").replace(/[^0-9+]/g, "").trim();

    if (incoming.paymentMethods && typeof incoming.paymentMethods === "object") {
      for (const key of ["esewa", "khalti"]) {
        const method = incoming.paymentMethods[key];
        if (!method) continue;
        for (const field of ["enabled", "label", "accountName", "accountNumber", "note"]) {
          if (method[field] !== undefined) settings.paymentMethods[key][field] = method[field];
        }
      }
    }

    const esewaQr = req.files?.esewaQr?.[0];
    const khaltiQr = req.files?.khaltiQr?.[0];
    if (esewaQr) settings.paymentMethods.esewa.qrUrl = await saveImage(esewaQr, "payment-qr/esewa");
    if (khaltiQr) settings.paymentMethods.khalti.qrUrl = await saveImage(khaltiQr, "payment-qr/khalti");

    await settings.save();
    res.json({ settings });
  } catch (error) {
    console.error(error);
    if (error instanceof SyntaxError) return res.status(400).json({ message: "Settings payload is invalid." });
    res.status(500).json({ message: error.message || "Could not update settings." });
  }
});

export default router;
