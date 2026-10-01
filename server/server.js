import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";
import walletRoutes from "./routes/wallet.js";
import referralRoutes from "./routes/referrals.js";
import announcementsRoutes from "./routes/announcements.js";
import { ensureAdminFromEnv } from "./utils/adminAccount.js";
import { imageStorageStatus, verifyCloudinaryConnection } from "./utils/uploadFile.js";
import { migrateLegacyUploads } from "./utils/migrateLegacyUploads.js";

const app = express();
const port = process.env.PORT || 5000;

console.log("Starting eLeague backend...");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

let storageStatus = imageStorageStatus();
console.log(`Image storage configured: Cloudinary (${storageStatus.cloudName}/${storageStatus.folder})`);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "eLeague API", imageStorage: storageStatus }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "Image must be 5 MB or smaller." });
  res.status(500).json({ message: err?.message || "Unexpected server error." });
});

connectDB()
  .then(async () => {
    storageStatus = await verifyCloudinaryConnection();
    console.log(`Cloudinary connection verified: ${storageStatus.cloudName}/${storageStatus.folder}`);
    await migrateLegacyUploads();
    await ensureAdminFromEnv();
    app.listen(port, () => console.log(`eLeague API running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
