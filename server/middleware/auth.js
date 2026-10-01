import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) return res.status(401).json({ message: "Account not found." });
    if (user.role !== "admin" && user.isBlocked) {
      return res.status(403).json({ message: user.blockReason || "Your eLeague account has been blocked by an administrator." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-passwordHash");
    if (user && !(user.role !== "admin" && user.isBlocked)) req.user = user;
  } catch {
    // Public routes should still work when a token is missing, stale or invalid.
  }
  next();
}

export function playerOnly(req, res, next) {
  if (req.user?.role !== "user") {
    return res.status(403).json({ message: "Player account required." });
  }
  next();
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}
