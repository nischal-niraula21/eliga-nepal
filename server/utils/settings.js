import Settings from "../models/Settings.js";

export async function getSettings() {
  let settings = await Settings.findOne({ key: "platform" });
  if (!settings) settings = await Settings.create({ key: "platform" });
  return settings;
}
