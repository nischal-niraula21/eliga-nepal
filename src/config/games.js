export const GAMES = {
  EFOOTBALL: {
    key: "EFOOTBALL",
    name: "eFootball",
    shortName: "eFootball",
    mark: "eF",
    filterLabel: "eFootball",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ee/EFootball_logo.svg",
    tagline: "Dream Team and Authentic matches",
    usernameLabel: "eFootball username",
    usernamePlaceholder: "Exactly as it appears in eFootball",
    playerIdLabel: "Player ID",
    playerIdRequired: false,
    accessIdLabel: "eFootball room ID",
    accessIdPlaceholder: "Enter room ID",
    accessIdRequired: true,
    accessPasswordLabel: "Room password",
    accessPasswordPlaceholder: "Enter room password",
    accessPasswordRequired: true,
    modes: [
      { value: "DREAM_TEAM", label: "Dream Team" },
      { value: "AUTHENTIC", label: "Authentic" },
    ],
    formats: ["1V1", "2V2", "3V3", "4V4"],
  },
  FREE_FIRE: {
    key: "FREE_FIRE",
    name: "Free Fire",
    shortName: "Free Fire",
    mark: "FF",
    filterLabel: "FreeFire",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Freefirelogo.png",
    tagline: "Clash Squad and custom battles",
    usernameLabel: "Free Fire name",
    usernamePlaceholder: "Your in-game name",
    playerIdLabel: "Free Fire UID",
    playerIdRequired: true,
    accessIdLabel: "Custom room ID",
    accessIdPlaceholder: "Enter custom room ID",
    accessIdRequired: true,
    accessPasswordLabel: "Room password",
    accessPasswordPlaceholder: "Enter room password",
    accessPasswordRequired: true,
    modes: [
      { value: "CLASH_SQUAD", label: "Clash Squad" },
      { value: "CUSTOM_ROOM", label: "Custom Room" },
    ],
    formats: ["1V1", "2V2", "4V4"],
  },
  PUBG_MOBILE: {
    key: "PUBG_MOBILE",
    name: "PUBG Mobile",
    shortName: "PUBG",
    mark: "PUBG",
    filterLabel: "PUBG",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/27/PUBG_Mobile_simple_logo_black.svg",
    tagline: "TDM and custom room matches",
    usernameLabel: "PUBG name",
    usernamePlaceholder: "Your in-game name",
    playerIdLabel: "PUBG Player ID",
    playerIdRequired: true,
    accessIdLabel: "Room ID",
    accessIdPlaceholder: "Enter PUBG room ID",
    accessIdRequired: true,
    accessPasswordLabel: "Room password",
    accessPasswordPlaceholder: "Enter room password",
    accessPasswordRequired: true,
    modes: [
      { value: "TDM", label: "TDM" },
      { value: "CUSTOM_ROOM", label: "Custom Room" },
      { value: "CLASSIC", label: "Classic" },
    ],
    formats: ["1V1", "2V2", "4V4"],
  },
  FC_MOBILE: {
    key: "FC_MOBILE",
    name: "FC Mobile",
    shortName: "FC Mobile",
    mark: "FC",
    filterLabel: "FC Mobile",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/83/EA_Sports_FC_Mobile.webp",
    tagline: "Head to Head and VS Attack",
    usernameLabel: "FC Mobile username",
    usernamePlaceholder: "Your FC Mobile username",
    playerIdLabel: "User ID",
    playerIdRequired: false,
    accessIdLabel: "Match / invite code",
    accessIdPlaceholder: "Optional match or invite code",
    accessIdRequired: false,
    accessPasswordLabel: "Match password",
    accessPasswordPlaceholder: "Optional password",
    accessPasswordRequired: false,
    modes: [
      { value: "H2H", label: "Head to Head" },
      { value: "VS_ATTACK", label: "VS Attack" },
    ],
    formats: ["1V1"],
  },
};

export const GAME_LIST = Object.values(GAMES);

export function gameConfig(key) {
  return GAMES[key] || GAMES.EFOOTBALL;
}

export function gameLabel(key) {
  return gameConfig(key).name;
}

export function modeLabelForGame(game, mode) {
  return gameConfig(game).modes.find((item) => item.value === mode)?.label || mode || "";
}

export function profileForGame(user, game) {
  const profile = user?.gameProfiles?.find((item) => item.game === game);
  if (profile) return profile;
  if (game === "EFOOTBALL" && user?.efootballUsername) {
    return { game: "EFOOTBALL", username: user.efootballUsername, playerId: "" };
  }
  return { game, username: "", playerId: "" };
}
