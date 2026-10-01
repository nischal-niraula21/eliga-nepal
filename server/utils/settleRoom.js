import Room from "../models/Room.js";
import { creditWallet, withWalletTransaction } from "./wallet.js";
import { walletName } from "../config/wallets.js";

export async function settleRoom(roomInput, finalOutcome, actorId = null) {
  if (!["HOST_WIN", "CHALLENGER_WIN", "DRAW", "VOID"].includes(finalOutcome)) {
    throw new Error("Invalid final outcome.");
  }
  const roomId = roomInput._id || roomInput;
  return withWalletTransaction(async (session) => {
    const room = await Room.findById(roomId).session(session);
    if (!room) throw new Error("Room not found.");
    if (room.settledAt) {
      if (room.settlementOutcome && room.settlementOutcome !== finalOutcome) {
        throw new Error("This room has already been settled with a different outcome.");
      }
      return room;
    }
    if (!room.challenger || !["READY", "RESULT_PENDING", "DISPUTED"].includes(room.status)) {
      throw new Error("This room is not ready for settlement.");
    }

    if (["HOST_WIN", "CHALLENGER_WIN"].includes(finalOutcome)) {
      const winnerId = finalOutcome === "HOST_WIN" ? room.host : room.challenger;
      // Only the finalized prize converts promotional play into real money.
      await creditWallet(winnerId, room.prizeAmount, {
        walletType: "MAIN", type: "PRIZE",
        description: `Prize for ${room.roomCode} paid to Main Wallet`,
        referenceType: "Room", referenceId: room._id, createdBy: actorId,
        idempotencyKey: `room:${room._id}:prize`
      }, session);
      room.settlementType = "PRIZE";
    } else {
      // Returning an entry is not a win. Preserve each player's funding source.
      for (const side of ["host", "challenger"]) {
        const source = room[`${side}WalletType`] || "MAIN";
        await creditWallet(room[side], room.entryFee, {
          walletType: source, type: "REFUND",
          description: `Entry refund for ${room.roomCode} to ${walletName(source)}`,
          referenceType: "Room", referenceId: room._id, createdBy: actorId,
          idempotencyKey: `room:${room._id}:refund:${room[side]}`
        }, session);
      }
      room.settlementType = "REFUND";
    }
    room.settlementOutcome = finalOutcome;
    room.settledAt = new Date();
    room.status = "COMPLETED";
    await room.save({ session });
    return room;
  });
}

