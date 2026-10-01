import { gameLabel, modeLabelForGame } from "../config/games";

export function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-NP")}`;
}

export function modeLabel(value, game = "EFOOTBALL") {
  return modeLabelForGame(game, value);
}

export function formatLabel(value) {
  return String(value || "").toLowerCase();
}

export function gameName(value) {
  return gameLabel(value);
}

export function statusLabel(status) {
  const map = {
    OPEN: "Waiting for challenger",
    READY: "Ready to play",
    RESULT_PENDING: "Result pending",
    DISPUTED: "Disputed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled"
  };
  return map[status] || status;
}

export function walletTypeLabel(type) {
  const map = {
    DEPOSIT: "Deposit",
    ENTRY_FEE: "Match entry",
    PRIZE: "Match prize",
    REFUND: "Refund",
    ADMIN_CREDIT: "Admin credit",
    ADMIN_DEBIT: "Admin deduction",
    WITHDRAWAL_HOLD: "Withdrawal request",
    WITHDRAWAL_RELEASE: "Withdrawal returned"
  };
  return map[type] || type;
}

export function shortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
