import "dotenv/config";
import { connectDB } from "../config/db.js";
import { ensureAdminFromEnv } from "./adminAccount.js";

await connectDB();
await ensureAdminFromEnv();
process.exit(0);
