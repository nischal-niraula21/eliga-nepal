import { GAME_KEYS } from "../config/games.js";

function clean(value, max = 100) {
  return String(value || "").trim().slice(0, max);
}

export function publicGameProfiles(user) {
  const raw = Array.isArray(user?.gameProfiles) ? user.gameProfiles : [];
  const profiles = raw
    .filter((item) => GAME_KEYS.includes(item.game))
    .map((item) => ({
      game: item.game,
      username: clean(item.username, 60),
      playerId: clean(item.playerId, 80),
    }));

  if (user?.efootballUsername && !profiles.some((item) => item.game === "EFOOTBALL")) {
    profiles.unshift({ game: "EFOOTBALL", username: clean(user.efootballUsername, 60), playerId: "" });
  }

  return profiles;
}

export async function replaceGameProfiles(user, incoming = []) {
  if (!Array.isArray(incoming)) return;

  const seen = new Set();
  const profiles = [];
  for (const item of incoming) {
    const game = String(item?.game || "").toUpperCase();
    if (!GAME_KEYS.includes(game) || seen.has(game)) continue;
    seen.add(game);
    const username = clean(item?.username, 60);
    const playerId = clean(item?.playerId, 80);
    if (username || playerId) profiles.push({ game, username, playerId });
  }

  user.gameProfiles = profiles;
  const efootball = profiles.find((item) => item.game === "EFOOTBALL");
  user.efootballUsername = efootball?.username || "";
}

export async function upsertGameProfile(user, game, username, playerId = "") {
  const key = String(game || "").toUpperCase();
  if (!GAME_KEYS.includes(key)) return;

  const nextUsername = clean(username, 60);
  const nextPlayerId = clean(playerId, 80);
  const profiles = publicGameProfiles(user).filter((item) => item.game !== key);
  profiles.push({ game: key, username: nextUsername, playerId: nextPlayerId });
  user.gameProfiles = profiles;
  if (key === "EFOOTBALL") user.efootballUsername = nextUsername;
  await user.save();
}
