import dns from "node:dns";
import mongoose from "mongoose";

function configureMongoDns() {
  const configured = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length) {
    dns.setServers(configured);
  }

  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }

  return configured;
}

function getSrvHostname(uri) {
  const match = uri.match(/^mongodb\+srv:\/\/(?:[^@/]+@)?([^/?]+)/i);
  return match?.[1] || null;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is missing from the root .env file.");

  const dnsServers = configureMongoDns();
  const srvHostname = getSrvHostname(uri);

  if (srvHostname) {
    try {
      const records = await dns.promises.resolveSrv(`_mongodb._tcp.${srvHostname}`);
      console.log(
        `MongoDB DNS resolved ${records.length} Atlas host(s) using ${dnsServers.join(", ")}`
      );
    } catch (error) {
      const detail = error?.code || error?.message || "unknown DNS error";
      throw new Error(
        `MongoDB SRV lookup failed for ${srvHostname} (${detail}). ` +
        `The backend is already forcing DNS through ${dnsServers.join(", ")}. ` +
        "Re-copy the URI from Atlas > Connect > Drivers if the hostname is incorrect."
      );
    }
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
