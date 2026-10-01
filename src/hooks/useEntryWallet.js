import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function useEntryWallet(initialWallet = "MAIN") {
  const { user } = useAuth();
  const [walletType, setWalletType] = useState(initialWallet === "FP" ? "FP" : "MAIN");
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setData(null);
    setError("");
    api.get("/wallet/balances", { signal: controller.signal })
      .then(({ data: response }) => { if (!controller.signal.aborted) setData(response); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not check FP eligibility. Reload to try again."); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [user?._id]);

  const mainBalance = Number(data?.balance ?? user?.walletBalance ?? 0);
  const fpBalance = Number(data?.fpBalance ?? user?.fpWalletBalance ?? 0);
  const successfulReferrals = Number(data?.successfulReferrals ?? 0);
  const requiredReferrals = Number(data?.fpMinimumSuccessfulReferrals ?? 4);
  const fpLocked = successfulReferrals < requiredReferrals;
  return {
    walletType, setWalletType, mainBalance, fpBalance, successfulReferrals, requiredReferrals,
    checking, error, fpLocked,
    balance: walletType === "FP" ? fpBalance : mainBalance,
    blocked: walletType === "FP" && (checking || Boolean(error) || fpLocked)
  };
}
