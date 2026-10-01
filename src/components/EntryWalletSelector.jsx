import { Gift, Wallet } from "lucide-react";
import { money } from "../utils/format";

export default function EntryWalletSelector({ payment, disabled = false }) {
  const fpUnavailable = payment.checking || Boolean(payment.error) || payment.fpLocked;
  return <fieldset className="entry-wallet-selector" disabled={disabled}>
    <legend>Pay entry from</legend>
    <div className="entry-wallet-options">
      {[
        { value: "MAIN", label: "Main Wallet", balance: payment.mainBalance, Icon: Wallet, help: "Deposits and match winnings" },
        { value: "FP", label: "FP Wallet", balance: payment.fpBalance, Icon: Gift, help: "Referral rewards · play only" }
      ].map(({ value, label, balance, Icon, help }) => <label key={value} className={`entry-wallet-option ${payment.walletType === value ? "selected" : ""} ${value === "FP" && fpUnavailable ? "unavailable" : ""}`}>
        <input type="radio" name="entryWallet" value={value} checked={payment.walletType === value} disabled={disabled || (value === "FP" && fpUnavailable)} onChange={() => payment.setWalletType(value)} />
        <Icon size={20} />
        <span><strong>{label}</strong><b>{money(balance)}</b><small>{help}</small></span>
      </label>)}
    </div>
    <p className="field-help">{payment.checking ? "Checking FP eligibility…" : payment.error || (payment.fpLocked ? `${payment.successfulReferrals}/${payment.requiredReferrals} successful referrals. FP unlocks at ${payment.requiredReferrals}.` : "FP unlocked. The selected wallet must cover the full entry fee.")}</p>
    {payment.walletType === "FP" && <p className="field-help">Only a finalized win pays the prize to Main Wallet. Cancellations and draws return the entry to FP Wallet.</p>}
  </fieldset>;
}
