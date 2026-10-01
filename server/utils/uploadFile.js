import path from "path";
import { v2 as cloudinary } from "cloudinary";

function clean(value) {
  return String(value || "").trim();
}

function parseCloudinaryUrl(rawUrl) {
  const url = clean(rawUrl);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "cloudinary:") {
      throw new Error("CLOUDINARY_URL must start with cloudinary://");
    }

    return {
      cloudName: decodeURIComponent(parsed.hostname || ""),
      apiKey: decodeURIComponent(parsed.username || ""),
      apiSecret: decodeURIComponent(parsed.password || "")
    };
  } catch (error) {
    throw new Error(`Invalid CLOUDINARY_URL: ${error.message}`);
  }
}

export function getImageStorageConfig() {
  let cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
  let apiKey = clean(process.env.CLOUDINARY_API_KEY);
  let apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

  if ((!cloudName || !apiKey || !apiSecret) && clean(process.env.CLOUDINARY_URL)) {
    const parsed = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
    cloudName ||= parsed.cloudName;
    apiKey ||= parsed.apiKey;
    apiSecret ||= parsed.apiSecret;
  }

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is required. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in the root .env file."
    );
  }

  return {
    provider: "cloudinary",
    cloudName,
    apiKey,
    apiSecret,
    rootFolder: clean(process.env.CLOUDINARY_FOLDER) || "eliga"
  };
}

function configureCloudinary(config) {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  });
}

export function imageStorageStatus() {
  const config = getImageStorageConfig();
  return {
    provider: "cloudinary",
    cloudName: config.cloudName,
    folder: config.rootFolder
  };
}

export async function verifyCloudinaryConnection() {
  const config = getImageStorageConfig();
  configureCloudinary(config);

  // Admin API call validates cloud name, key and secret before the server accepts uploads.
  await cloudinary.api.resources({ resource_type: "image", max_results: 1 });
  return imageStorageStatus();
}

export async function uploadBufferToCloudinary(buffer, originalname, folder) {
  if (!buffer) throw new Error("Image buffer is required.");

  const config = getImageStorageConfig();
  configureCloudinary(config);

  const extension = path.extname(originalname || "").replace(".", "").toLowerCase();
  const allowedFormats = ["jpg", "jpeg", "png", "webp"];

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${config.rootFolder}/${folder}`,
        resource_type: "image",
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        ...(allowedFormats.includes(extension) ? { format: extension === "jpeg" ? "jpg" : extension } : {})
      },
      (error, result) => {
        if (error) return reject(new Error(`Cloudinary upload failed: ${error.message || "Unknown Cloudinary error"}`));
        if (!result?.secure_url) return reject(new Error("Cloudinary did not return a secure image URL."));
        resolve(result.secure_url);
      }
    );

    stream.on("error", (error) => reject(new Error(`Cloudinary upload stream failed: ${error.message}`)));
    stream.end(buffer);
  });
}

export async function saveImage(file, folder) {
  if (!file) throw new Error("Image is required.");
  if (!file.buffer) throw new Error("Uploaded image could not be read.");
  return uploadBufferToCloudinary(file.buffer, file.originalname, folder);
}
