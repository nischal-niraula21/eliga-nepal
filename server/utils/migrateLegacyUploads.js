import fs from "fs/promises";
import path from "path";
import DepositRequest from "../models/DepositRequest.js";
import Result from "../models/Result.js";
import Settings from "../models/Settings.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { uploadBufferToCloudinary } from "./uploadFile.js";

function isLegacyLocalUrl(value) {
  return typeof value === "string" && value.startsWith("/uploads/");
}

function localPathFromUrl(url) {
  const relative = url.replace(/^\/uploads\//, "");
  return path.resolve("uploads", relative);
}

function folderFromUrl(url, fallback) {
  const relative = url.replace(/^\/uploads\//, "");
  const folder = path.dirname(relative).replace(/\\/g, "/");
  return folder && folder !== "." ? folder : fallback;
}

async function migrateOne(url, fallbackFolder) {
  if (!isLegacyLocalUrl(url)) return { changed: false, url };

  const filePath = localPathFromUrl(url);
  try {
    const buffer = await fs.readFile(filePath);
    const uploadedUrl = await uploadBufferToCloudinary(buffer, path.basename(filePath), folderFromUrl(url, fallbackFolder));
    return { changed: true, url: uploadedUrl };
  } catch (error) {
    if (error?.code === "ENOENT") return { changed: false, missing: true, url };
    throw error;
  }
}

export async function migrateLegacyUploads() {
  let migrated = 0;
  let missing = 0;

  const settingsDocs = await Settings.find({
    $or: [
      { "paymentMethods.esewa.qrUrl": /^\/uploads\// },
      { "paymentMethods.khalti.qrUrl": /^\/uploads\// }
    ]
  });

  for (const settings of settingsDocs) {
    for (const [key, folder] of [["esewa", "payment-qr/esewa"], ["khalti", "payment-qr/khalti"]]) {
      const current = settings.paymentMethods?.[key]?.qrUrl || "";
      if (!isLegacyLocalUrl(current)) continue;
      const result = await migrateOne(current, folder);
      if (result.changed) {
        settings.paymentMethods[key].qrUrl = result.url;
        migrated += 1;
      } else if (result.missing) {
        // QR can safely be cleared so the admin can upload a fresh Cloudinary version.
        settings.paymentMethods[key].qrUrl = "";
        missing += 1;
      }
    }
    await settings.save();
  }

  const deposits = await DepositRequest.find({ screenshotUrl: /^\/uploads\// });
  for (const item of deposits) {
    const result = await migrateOne(item.screenshotUrl, "deposits");
    if (result.changed) {
      item.screenshotUrl = result.url;
      await item.save();
      migrated += 1;
    } else if (result.missing) missing += 1;
  }

  const withdrawals = await WithdrawalRequest.find({ payoutScreenshotUrl: /^\/uploads\// });
  for (const item of withdrawals) {
    const result = await migrateOne(item.payoutScreenshotUrl, "withdrawals");
    if (result.changed) {
      item.payoutScreenshotUrl = result.url;
      await item.save();
      migrated += 1;
    } else if (result.missing) missing += 1;
  }

  const results = await Result.find({
    $or: [
      { screenshotUrl: /^\/uploads\// },
      { disputeScreenshotUrl: /^\/uploads\// }
    ]
  });
  for (const item of results) {
    let changed = false;
    for (const [field, folder] of [["screenshotUrl", "results"], ["disputeScreenshotUrl", "disputes"]]) {
      const current = item[field] || "";
      if (!isLegacyLocalUrl(current)) continue;
      const result = await migrateOne(current, folder);
      if (result.changed) {
        item[field] = result.url;
        changed = true;
        migrated += 1;
      } else if (result.missing) missing += 1;
    }
    if (changed) await item.save();
  }

  if (migrated || missing) {
    console.log(`Legacy upload migration: ${migrated} migrated to Cloudinary, ${missing} local file(s) missing.`);
  }
}
