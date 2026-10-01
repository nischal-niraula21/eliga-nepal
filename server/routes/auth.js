import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import Referral from "../models/Referral.js";
import { protect } from "../middleware/auth.js";
import { ensureReferralCode, generateUniqueReferralCode } from "../utils/referralCode.js";
import { publicGameProfiles, replaceGameProfiles } from "../utils/gameProfiles.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false
});

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    efootballUsername: user.efootballUsername || "",
    gameProfiles: publicGameProfiles(user),
    walletBalance: user.walletBalance || 0,
    fpWalletBalance: user.fpWalletBalance || 0,
    walletHeld: user.walletHeld || 0,
    referralCode: user.referralCode || "",
    isBlocked: Boolean(user.isBlocked)
  };
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password, referralCode = "", efootballUsername = "" } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const normalizedReferralCode = String(referralCode || "").trim().toUpperCase();
    let referrer = null;
    if (normalizedReferralCode) {
      referrer = await User.findOne({
        referralCode: normalizedReferralCode,
        role: "user",
        isBlocked: false
      }).select("_id referralCode");

      if (!referrer) {
        return res.status(400).json({ message: "Referral code not found." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const ownReferralCode = await generateUniqueReferralCode();
    const legacyUsername = String(efootballUsername || "").trim();
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      efootballUsername: legacyUsername,
      gameProfiles: legacyUsername ? [{ game: "EFOOTBALL", username: legacyUsername, playerId: "" }] : [],
      referralCode: ownReferralCode,
      referredBy: referrer?._id || null
    });

    if (referrer) {
      try {
        await Referral.create({
          referrer: referrer._id,
          referredUser: user._id,
          codeUsed: normalizedReferralCode
        });
      } catch (referralError) {
        await User.findByIdAndDelete(user._id).catch(() => {});
        throw referralError;
      }
    }

    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    if (error?.code === 11000) {
      return res.status(409).json({ message: "That account or referral code already exists. Please try again." });
    }
    return res.status(500).json({ message: "Could not create account." });
  }
});

router.post("/admin-login", authLimiter, async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const password = req.body.password || "";
    const user = await User.findOne({ email: normalizedEmail, role: "admin" });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid admin email or password." });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Could not sign in to the admin panel." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (user.role !== "admin" && user.isBlocked) {
      return res.status(403).json({ message: user.blockReason || "Your eLeague account has been blocked by an administrator." });
    }
    if (user.role === "user") await ensureReferralCode(user);
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Could not sign in." });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    if (req.user.role === "user") await ensureReferralCode(req.user);
    res.json({ user: publicUser(req.user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load account." });
  }
});

router.patch("/me", protect, async (req, res) => {
  try {
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "Name is required." });
      req.user.name = name;
    }

    if (req.user.role === "user" && req.body.gameProfiles !== undefined) {
      await replaceGameProfiles(req.user, req.body.gameProfiles);
    }

    await req.user.save();
    if (req.user.role === "user") await ensureReferralCode(req.user);
    res.json({ user: publicUser(req.user) });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Could not update profile." });
  }
});

export default router;
