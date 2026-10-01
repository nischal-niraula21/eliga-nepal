import crypto from "crypto";
import Room from "../models/Room.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPart(length = 6) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function createUniqueRoomCode() {
  for (let i = 0; i < 12; i += 1) {
    const code = `EL-${randomPart()}`;
    const exists = await Room.exists({ roomCode: code });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique room code.");
}
