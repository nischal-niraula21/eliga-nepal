export const GAMES = {
  EFOOTBALL: {
    key: "EFOOTBALL",
    name: "eFootball",
    modes: ["DREAM_TEAM", "AUTHENTIC"],
    formats: ["1V1", "2V2", "3V3", "4V4"],
    playerIdRequired: false,
    accessIdRequired: true,
    accessPasswordRequired: true,
  },
  FREE_FIRE: {
    key: "FREE_FIRE",
    name: "Free Fire",
    modes: ["CLASH_SQUAD", "CUSTOM_ROOM"],
    formats: ["1V1", "2V2", "4V4"],
    playerIdRequired: true,
    accessIdRequired: true,
    accessPasswordRequired: true,
  },
  PUBG_MOBILE: {
    key: "PUBG_MOBILE",
    name: "PUBG Mobile",
    modes: ["TDM", "CUSTOM_ROOM", "CLASSIC"],
    formats: ["1V1", "2V2", "4V4"],
    playerIdRequired: true,
    accessIdRequired: true,
    accessPasswordRequired: true,
  },
  FC_MOBILE: {
    key: "FC_MOBILE",
    name: "FC Mobile",
    modes: ["H2H", "VS_ATTACK"],
    formats: ["1V1"],
    playerIdRequired: false,
    accessIdRequired: false,
    accessPasswordRequired: false,
  },
};

export const GAME_KEYS = Object.keys(GAMES);

export function getGameConfig(value) {
  return GAMES[String(value || "").toUpperCase()] || null;
}

export function normalizedGame(value) {
  const key = String(value || "EFOOTBALL").toUpperCase();
  return GAMES[key] ? key : "";
}
