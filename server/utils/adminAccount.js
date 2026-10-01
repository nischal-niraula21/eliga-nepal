import bcrypt from "bcryptjs";
import User from "../models/User.js";

export async function ensureAdminFromEnv({ log = true } = {}) {
  const name = (process.env.ADMIN_NAME || "eLeague Admin").trim();
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    if (log) {
      console.warn("Admin account not synced: ADMIN_EMAIL or ADMIN_PASSWORD is missing from .env.");
    }
    return null;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    (email === "admin@eliga.local" || password === "ChangeMe123!")
  ) {
    throw new Error("Change the default ADMIN_EMAIL and ADMIN_PASSWORD before production.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });

  if (existing) {
    existing.name = name;
    existing.role = "admin";
    existing.passwordHash = passwordHash;
    existing.isBlocked = false;
    existing.blockReason = "";
    existing.blockedAt = null;
    existing.blockedBy = null;
    await existing.save();
    if (log) console.log(`Admin account ready: ${email}`);
    return existing;
  }

  const admin = await User.create({
    name,
    email,
    passwordHash,
    role: "admin"
  });

  if (log) console.log(`Admin account created: ${email}`);
  return admin;
}
