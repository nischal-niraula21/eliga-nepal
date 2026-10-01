import express from "express";
import mongoose from "mongoose";
import Room from "../models/Room.js";
import Result from "../models/Result.js";
import { protect, playerOnly } from "../middleware/auth.js";
import { uploadImage } from "../middleware/upload.js";
import { saveImage } from "../utils/uploadFile.js";
import { getSettings } from "../utils/settings.js";
import { createUniqueRoomCode } from "../utils/roomCode.js";
import { roomForUser } from "../utils/roomView.js";
import { checkFpEligibility, creditWallet, debitWallet, withWalletTransaction } from "../utils/wallet.js";
import { balanceField, walletName, walletType } from "../config/wallets.js";
import { settleRoom } from "../utils/settleRoom.js";
import { getGameConfig, normalizedGame } from "../config/games.js";
import { upsertGameProfile } from "../utils/gameProfiles.js";

const router = express.Router();
const RESERVATION_MS = 5 * 60 * 1000;

function availableReservationQuery(now = new Date()) {
  return {
    $or: [
      { pendingChallenger: null },
      { pendingChallenger: { $exists: false } },
      { reservationExpiresAt: null },
      { reservationExpiresAt: { $lte: now } }
    ]
  };
}

function validObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function publicRoom(room) {
  return {
    _id: room._id,
    roomCode: room.roomCode,
    game: room.game || "EFOOTBALL",
    host: room.host?._id || room.host,
    hostGameUsername: room.hostGameUsername,
    hostGamePlayerId: room.hostGamePlayerId || "",
    challengerGameUsername: room.challengerGameUsername || "",
    challengerGamePlayerId: room.challengerGamePlayerId || "",
    gameMode: room.gameMode,
    matchFormat: room.matchFormat,
    entryFee: room.entryFee,
    totalPool: room.totalPool,
    platformFeeAmount: room.platformFeeAmount,
    prizeAmount: room.prizeAmount,
    roomAccessId: room.roomAccessId || room.efootballRoomId || "",
    status: room.status,
    reservationExpiresAt: room.reservationExpiresAt || null,
    createdAt: room.createdAt
  };
}

router.get("/public", async (req, res) => {
  try {
    const query = { status: "OPEN", $and: [availableReservationQuery()] };
    const game = normalizedGame(req.query.game);
    if (req.query.game && game) {
      if (game === "EFOOTBALL") query.$or = [{ game: "EFOOTBALL" }, { game: { $exists: false } }];
      else query.game = game;
    }
    if (req.query.gameMode) query.gameMode = req.query.gameMode;
    if (req.query.matchFormat) query.matchFormat = req.query.matchFormat;

    const rooms = await Room.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ rooms: rooms.map(publicRoom) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load open rooms." });
  }
});

router.get("/public/:id", async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const room = await Room.findOne({ _id: req.params.id, status: "OPEN" }).lean();
    if (!room) return res.status(404).json({ message: "Room is no longer available." });
    res.json({ room: publicRoom(room) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load room." });
  }
});

router.get("/mine", protect, playerOnly, async (req, res) => {
  try {
    const rooms = await Room.find({ $or: [{ host: req.user._id }, { challenger: req.user._id }] })
      .populate("host", "name gameProfiles efootballUsername")
      .populate("challenger", "name gameProfiles efootballUsername")
      .sort({ updatedAt: -1 });
    res.json({ rooms: rooms.map((room) => roomForUser(room, req.user)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load your matches." });
  }
});

router.post("/", protect, playerOnly, async (req, res) => {
  try {
    const game = normalizedGame(req.body.game);
    const config = getGameConfig(game);
    const gameMode = String(req.body.gameMode || "").toUpperCase();
    const matchFormat = String(req.body.matchFormat || "").toUpperCase();
    const gameUsername = String(req.body.gameUsername || "").trim();
    const gamePlayerId = String(req.body.gamePlayerId || "").trim();
    const roomAccessId = String(req.body.roomAccessId || req.body.efootballRoomId || "").trim();
    const roomAccessPassword = String(req.body.roomAccessPassword || req.body.efootballPassword || "").trim();
    const settings = await getSettings();
    const fee = Number(req.body.entryFee);

    if (!config) return res.status(400).json({ message: "Choose a supported game." });
    if (!Number.isFinite(fee) || fee < settings.minEntryFee || fee > settings.maxEntryFee) {
      return res.status(400).json({ message: `Entry fee must be between Rs. ${settings.minEntryFee} and Rs. ${settings.maxEntryFee}.` });
    }
    if (!config.modes.includes(gameMode)) {
      return res.status(400).json({ message: `Choose a valid ${config.name} mode.` });
    }
    if (!config.formats.includes(matchFormat)) {
      return res.status(400).json({ message: `Choose a valid ${config.name} format.` });
    }
    if (!gameUsername) return res.status(400).json({ message: "Your in-game username is required." });
    if (config.playerIdRequired && !gamePlayerId) return res.status(400).json({ message: `${config.name} player ID is required.` });
    if (config.accessIdRequired && !roomAccessId) return res.status(400).json({ message: `${config.name} room ID is required.` });
    if (config.accessPasswordRequired && !roomAccessPassword) return res.status(400).json({ message: `${config.name} room password is required.` });


    const source = walletType(req.body.walletType);
    const totalPool = fee * 2;
    const platformFeeAmount = Math.round((totalPool * settings.commissionPercent) / 100);
    const roomCode = await createUniqueRoomCode();
    const room = await withWalletTransaction(async (session) => {
      const created = new Room({
        roomCode, game, host: req.user._id, hostGameUsername: gameUsername,
        hostGamePlayerId: gamePlayerId, gameMode, matchFormat,
        entryFee: fee, hostWalletType: source, totalPool,
        platformFeePercent: settings.commissionPercent, platformFeeAmount,
        prizeAmount: totalPool - platformFeeAmount, roomAccessId, roomAccessPassword,
        efootballRoomId: game === "EFOOTBALL" ? roomAccessId : "",
        efootballPassword: game === "EFOOTBALL" ? roomAccessPassword : "",
        status: "OPEN"
      });
      await debitWallet(req.user._id, fee, {
        walletType: source, type: "ENTRY_FEE",
        description: `${config.name} entry fee for ${roomCode} from ${walletName(source)}`,
        referenceType: "Room", referenceId: created._id, createdBy: req.user._id,
        idempotencyKey: `room:${created._id}:entry:host`
      }, session);
      await created.save({ session });
      return created;
    });
    await upsertGameProfile(req.user, game, gameUsername, gamePlayerId).catch((error) => {
      console.error("Could not save host game profile:", error);
    });
    await room.populate("host", "name gameProfiles efootballUsername");
    res.status(201).json({ room: roomForUser(room, req.user) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Could not create room." });
  }
});

router.post("/:id/reserve", protect, playerOnly, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const existing = await Room.findById(req.params.id).select("host challenger status pendingChallenger reservationExpiresAt entryFee");
    if (!existing) return res.status(404).json({ message: "Room not found." });
    if (String(existing.host) === String(req.user._id)) {
      return res.status(409).json({ message: "You cannot join a room you created." });
    }
    if (existing.status !== "OPEN" || existing.challenger) {
      return res.status(409).json({ message: "This room is no longer available to join." });
    }

    const now = new Date();
    const source = walletType(req.body.walletType);
    if (source === "FP") await checkFpEligibility(req.user._id);
    if (Number(req.user[balanceField(source)] || 0) < Number(existing.entryFee || 0)) {
      return res.status(409).json({ message: `You need Rs. ${existing.entryFee} in ${walletName(source)} before this room can be reserved.` });
    }

    const otherReservation = await Room.exists({
      _id: { $ne: existing._id },
      status: "OPEN",
      challenger: null,
      pendingChallenger: req.user._id,
      reservationExpiresAt: { $gt: now }
    });
    if (otherReservation) {
      return res.status(409).json({ message: "You already have another room reserved. Leave it or wait for that reservation to expire." });
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_MS);
    const room = await Room.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "OPEN",
        challenger: null,
        host: { $ne: req.user._id },
        $or: [
          { pendingChallenger: req.user._id },
          { pendingChallenger: null },
          { pendingChallenger: { $exists: false } },
          { reservationExpiresAt: null },
          { reservationExpiresAt: { $lte: now } }
        ]
      },
      { $set: { pendingChallenger: req.user._id, reservationExpiresAt: expiresAt } },
      { new: true }
    )
      .populate("host", "name gameProfiles efootballUsername")
      .lean();

    if (!room) {
      return res.status(409).json({ message: "Another player is currently preparing to join this room. Try again shortly." });
    }

    res.json({ room: publicRoom(room), reservationExpiresAt: room.reservationExpiresAt });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.status ? error.message : "Could not reserve this room." });
  }
});

router.post("/:id/leave", protect, playerOnly, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, status: "OPEN", challenger: null, pendingChallenger: req.user._id },
      { $set: { pendingChallenger: null, reservationExpiresAt: null } },
      { new: true }
    );
    if (!room) return res.status(409).json({ message: "This room is no longer reserved by you." });
    res.json({ released: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not leave this room." });
  }
});

router.post("/:id/join", protect, playerOnly, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const source = walletType(req.body.walletType);
    const gameUsername = String(req.body.gameUsername || "").trim();
    const gamePlayerId = String(req.body.gamePlayerId || "").trim();
    if (!gameUsername) return res.status(400).json({ message: "In-game username is required." });

    const room = await withWalletTransaction(async (session) => {
      const existing = await Room.findById(req.params.id).session(session);
      if (!existing) throw Object.assign(new Error("Room not found."), { status: 404 });
      if (String(existing.host) === String(req.user._id)) {
        throw Object.assign(new Error("You cannot join a room you created."), { status: 409 });
      }
      const now = new Date();
      if (existing.status !== "OPEN" || existing.challenger ||
          String(existing.pendingChallenger || "") !== String(req.user._id) ||
          !existing.reservationExpiresAt || existing.reservationExpiresAt <= now) {
        throw Object.assign(new Error("Your reservation expired or the room is no longer available. Return to the lobby and join again."), { status: 409 });
      }
      const config = getGameConfig(existing.game || "EFOOTBALL");
      if (!config || (config.playerIdRequired && !gamePlayerId)) {
        throw Object.assign(new Error(config ? `${config.name} player ID is required.` : "Unsupported game."), { status: 400 });
      }
      const joined = await Room.findOneAndUpdate(
        { _id: existing._id, status: "OPEN", challenger: null,
          pendingChallenger: req.user._id, reservationExpiresAt: { $gt: now } },
        { $set: {
          challenger: req.user._id, challengerGameUsername: gameUsername,
          challengerGamePlayerId: gamePlayerId, challengerWalletType: source,
          status: "READY", pendingChallenger: null, reservationExpiresAt: null
        } },
        { new: true, session }
      );
      if (!joined) throw Object.assign(new Error("This room is no longer reserved by you."), { status: 409 });
      const payment = await debitWallet(req.user._id, existing.entryFee, {
        walletType: source, type: "ENTRY_FEE",
        description: `${config.name} entry fee for ${existing.roomCode} from ${walletName(source)}`,
        referenceType: "Room", referenceId: existing._id, createdBy: req.user._id,
        idempotencyKey: `room:${existing._id}:entry:challenger:${req.user._id}`
      }, session);
      if (payment.duplicate) {
        throw Object.assign(new Error("An entry payment already exists for this room. Please reload or contact support."), { status: 409 });
      }
      return joined;
    });
    await upsertGameProfile(req.user, room.game, gameUsername, gamePlayerId).catch((error) => {
      console.error("Could not save challenger game profile:", error);
    });
    await room.populate("host", "name gameProfiles efootballUsername");
    await room.populate("challenger", "name gameProfiles efootballUsername");
    res.json({ room: roomForUser(room, req.user) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Could not join room." });
  }
});

router.post("/:id/cancel", protect, playerOnly, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const room = await withWalletTransaction(async (session) => {
      const cancelled = await Room.findOneAndUpdate(
        { _id: req.params.id, host: req.user._id, status: "OPEN", challenger: null },
        { $set: {
          status: "CANCELLED", settledAt: new Date(), settlementType: "REFUND",
          pendingChallenger: null, reservationExpiresAt: null
        } },
        { new: true, session }
      );
      if (!cancelled) {
        throw Object.assign(new Error("Only an open room without a confirmed challenger can be cancelled."), { status: 409 });
      }
      const source = cancelled.hostWalletType || "MAIN";
      await creditWallet(req.user._id, cancelled.entryFee, {
        walletType: source, type: "REFUND",
        description: `Cancelled room refund for ${cancelled.roomCode} to ${walletName(source)}`,
        referenceType: "Room", referenceId: cancelled._id, createdBy: req.user._id,
        idempotencyKey: `room:${cancelled._id}:cancel-refund`
      }, session);
      return cancelled;
    });
    res.json({ room: roomForUser(room, req.user) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Could not cancel room." });
  }
});

router.post("/:id/result", protect, playerOnly, uploadImage.single("screenshot"), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    if (room.status !== "READY") return res.status(409).json({ message: "This match is not ready for result submission." });

    const userId = String(req.user._id);
    const isParticipant = [String(room.host), String(room.challenger || "")].includes(userId);
    if (!isParticipant) return res.status(403).json({ message: "You are not part of this room." });
    if (await Result.exists({ room: room._id })) return res.status(409).json({ message: "A result has already been submitted." });

    const claimedOutcome = req.body.claimedOutcome;
    if (!["HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"].includes(claimedOutcome)) {
      return res.status(400).json({ message: "Choose a valid result." });
    }

    const hostScore = Number(req.body.hostScore ?? 0);
    const challengerScore = Number(req.body.challengerScore ?? 0);
    if (![hostScore, challengerScore].every((score) => Number.isInteger(score) && score >= 0 && score <= 9999)) {
      return res.status(400).json({ message: "Enter a valid score." });
    }

    if (!req.file) return res.status(400).json({ message: "Upload the final result screenshot." });
    const screenshotUrl = await saveImage(req.file, "results");
    const claimedWinner = claimedOutcome === "HOST_WIN" ? room.host : claimedOutcome === "CHALLENGER_WIN" ? room.challenger : null;

    const result = await Result.create({
      room: room._id,
      submittedBy: req.user._id,
      claimedOutcome,
      claimedWinner,
      hostScore,
      challengerScore,
      screenshotUrl
    });

    const updatedRoom = await Room.findOneAndUpdate(
      { _id: room._id, status: "READY", result: null },
      { $set: { result: result._id, status: "RESULT_PENDING" } },
      { new: true }
    );
    if (!updatedRoom) {
      await Result.deleteOne({ _id: result._id }).catch(() => {});
      return res.status(409).json({ message: "A result has already been submitted or the room changed. Please reload." });
    }
    res.status(201).json({ result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Could not submit result." });
  }
});

router.post("/:id/result/confirm", protect, playerOnly, async (req, res) => {
  let claimedResult = null;
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.result) return res.status(404).json({ message: "Result not found." });
    if (room.status !== "RESULT_PENDING") return res.status(409).json({ message: "This result is no longer waiting for confirmation." });

    const existing = await Result.findById(room.result);
    if (!existing) return res.status(404).json({ message: "Result not found." });
    const userId = String(req.user._id);
    const isParticipant = [String(room.host), String(room.challenger || "")].includes(userId);
    if (!isParticipant || String(existing.submittedBy) === userId) {
      return res.status(403).json({ message: "Only the other participant can confirm this result." });
    }

    claimedResult = await Result.findOneAndUpdate(
      { _id: existing._id, status: "SUBMITTED" },
      {
        $set: {
          opponentResponse: "CONFIRMED",
          status: "CONFIRMED",
          finalOutcome: existing.claimedOutcome,
          finalWinner: existing.claimedWinner,
          resolvedAt: new Date()
        }
      },
      { new: true }
    );
    if (!claimedResult) return res.status(409).json({ message: "This result has already been handled." });

    const settled = await settleRoom(room, claimedResult.finalOutcome, req.user._id);
    res.json({ result: claimedResult, room: roomForUser(settled, req.user) });
  } catch (error) {
    console.error(error);
    if (claimedResult?._id) {
      await Result.updateOne(
        { _id: claimedResult._id, status: "CONFIRMED" },
        { $set: { opponentResponse: "PENDING", status: "SUBMITTED", finalOutcome: "", finalWinner: null, resolvedAt: null } }
      ).catch(() => {});
    }
    res.status(500).json({ message: error.message || "Could not confirm result." });
  }
});

router.post("/:id/result/dispute", protect, playerOnly, uploadImage.single("screenshot"), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.result) return res.status(404).json({ message: "Result not found." });
    if (room.status !== "RESULT_PENDING") return res.status(409).json({ message: "This result is no longer waiting for a response." });

    const existing = await Result.findById(room.result);
    if (!existing) return res.status(404).json({ message: "Result not found." });
    const userId = String(req.user._id);
    const isParticipant = [String(room.host), String(room.challenger || "")].includes(userId);
    if (!isParticipant || String(existing.submittedBy) === userId) {
      return res.status(403).json({ message: "Only the other participant can dispute this result." });
    }

    const disputeOutcome = req.body.claimedOutcome;
    if (!["HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"].includes(disputeOutcome)) {
      return res.status(400).json({ message: "Choose the result you believe is correct." });
    }

    const disputeHostScore = Number(req.body.hostScore ?? 0);
    const disputeChallengerScore = Number(req.body.challengerScore ?? 0);
    if (![disputeHostScore, disputeChallengerScore].every((score) => Number.isInteger(score) && score >= 0 && score <= 9999)) {
      return res.status(400).json({ message: "Enter a valid disputed score." });
    }
    if (!req.file) return res.status(400).json({ message: "Upload evidence for the disputed result." });

    const disputeScreenshotUrl = await saveImage(req.file, "disputes");
    const result = await Result.findOneAndUpdate(
      { _id: existing._id, status: "SUBMITTED" },
      {
        $set: {
          opponentResponse: "DISPUTED",
          status: "DISPUTED",
          disputeReason: req.body.reason?.trim() || "Result disputed by opponent.",
          disputeScreenshotUrl,
          disputeOutcome,
          disputeHostScore,
          disputeChallengerScore,
          disputedBy: req.user._id,
          disputedAt: new Date()
        }
      },
      { new: true }
    );
    if (!result) return res.status(409).json({ message: "This result has already been handled." });

    const updatedRoom = await Room.findOneAndUpdate(
      { _id: room._id, status: "RESULT_PENDING", result: result._id },
      { $set: { status: "DISPUTED" } },
      { new: true }
    );
    if (!updatedRoom) {
      await Result.updateOne(
        { _id: result._id, status: "DISPUTED" },
        {
          $set: {
            opponentResponse: "PENDING", status: "SUBMITTED", disputeReason: "", disputeScreenshotUrl: "",
            disputeOutcome: "", disputeHostScore: null, disputeChallengerScore: null, disputedBy: null, disputedAt: null
          }
        }
      ).catch(() => {});
      return res.status(409).json({ message: "The room changed before the dispute could be recorded. Please reload." });
    }

    res.json({ result, room: roomForUser(updatedRoom, req.user) });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || "Could not submit dispute." });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return res.status(404).json({ message: "Room not found." });
    const room = await Room.findById(req.params.id)
      .populate("host", "name gameProfiles efootballUsername")
      .populate("challenger", "name gameProfiles efootballUsername")
      .populate("result");
    if (!room) return res.status(404).json({ message: "Room not found." });

    const userId = String(req.user._id);
    const participant = [String(room.host?._id || room.host), String(room.challenger?._id || room.challenger || "")].includes(userId);
    if (!participant && req.user.role !== "admin") {
      return res.status(403).json({ message: "Join this room from the lobby to view match details." });
    }
    res.json({ room: roomForUser(room, req.user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load room." });
  }
});

export default router;
