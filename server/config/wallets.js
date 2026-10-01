export const FP_MIN_SUCCESSFUL_REFERRALS = 4;

export function walletType(value = "MAIN") {
  if (value === "MAIN" || value === "FP") return value;
  const error = new Error("Choose Main Wallet or FP Wallet.");
  error.status = 400;
  throw error;
}

export function balanceField(wallet) {
  return walletType(wallet) === "FP" ? "fpWalletBalance" : "walletBalance";
}

export function walletName(wallet) {
  return walletType(wallet) === "FP" ? "FP Wallet" : "Main Wallet";
}
