import express from "express";
import Announcement from "../models/Announcement.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/active", optionalAuth, async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }
      ]
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(20)
      .lean();

    const isPlayer = req.user?.role === "user";
    const eligible = announcements.filter((announcement) => {
      if (announcement.audience === "ALL") return true;
      if (!isPlayer) return false;
      if (announcement.audience === "LOGGED_IN") return true;
      if (announcement.audience === "NEW_SIGNUPS") {
        const threshold = announcement.startsAt || announcement.createdAt;
        return Boolean(req.user.createdAt && threshold && new Date(req.user.createdAt) >= new Date(threshold));
      }
      return false;
    });

    res.json({ announcements: eligible });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load announcements." });
  }
});

export default router;
