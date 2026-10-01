import { ArrowDownLeft, ArrowUpRight, Clock3, Download, Gift, ShieldCheck, Upload, Wallet as WalletIcon, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api, { fileUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState({ balance: user?.walletBalance || 0, fpBalance: user?.fpWalletBalance || 0, held: user?.walletHeld || 0 });
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState("deposit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [{ data: wallet }, { data: publicSettings }] = await Promise.all([api.get("/wallet/balances"), api.get("/settings/public")]);
    setData(wallet);
    setSettings(publicSettings);
    await refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    load().catch(() => setError("Could not load your wallets. Please try again.")).finally(() => setLoading(false));
  }, [load]);

  if (loading) return <div className="container page-state">Loading wallet…</div>;
  if (error) return <div className="container page-state"><p className="form-error">{error}</p><button className="btn btn-secondary" onClick={() => { setLoading(true); load().catch(() => setError("Could not load your wallets. Please try again.")).finally(() => setLoading(false)); }}>Retry</button></div>;

  const requiredReferrals = data.fpMinimumSuccessfulReferrals ?? 4;
  const successfulReferrals = data.successfulReferrals ?? 0;
  const fpUnlocked = successfulReferrals >= requiredReferrals;
  const minEntry = Number(settings?.minEntryFee ?? 30);
  const fpReady = fpUnlocked && data.fpBalance >= minEntry;

  return (
    <section className="container page-section">
      <div className="page-title"><span className="eyebrow">eLeague wallet</span><h1>Your wallets</h1><p>Main Wallet holds your deposits and match winnings. FP Wallet holds referral rewards for room entry fees.</p></div>

      <div className="wallet-overview dual-wallets">
        <article className="wallet-balance-card">
          <div className="wallet-card-icon"><WalletIcon /></div>
          <span>Main Wallet</span><strong>{money(data.balance)}</strong>
          <p>Deposit, pay room entry fees, and request a cash-out.</p>
        </article>
        <article className="wallet-balance-card fp-wallet-card">
          <div className="wallet-card-icon"><Gift /></div>
          <span>FP Wallet · play only</span><strong>{money(data.fpBalance)}</strong>
          <p>Referral rewards cannot be withdrawn directly. Win a completed match to receive its prize in Main Wallet.</p>
          <div className="fp-progress">
            <span>{successfulReferrals}/{requiredReferrals} successful referrals</span>
            <b>{fpUnlocked ? "Unlocked" : "Locked"}</b>
          </div>
          <progress value={Math.min(successfulReferrals, requiredReferrals)} max={requiredReferrals} aria-label="Successful referrals toward FP unlock" />
          <small className="fp-entry-help">
            {fpReady ? "Ready to pay a room entry with FP." : fpUnlocked
              ? `Your FP balance must cover the full entry fee. Minimum entry: ${money(minEntry)}.`
              : `Complete ${requiredReferrals} successful referrals and collect enough FP for the full entry fee.`}
          </small>
        </article>
      </div>
      <div className="wallet-overview wallet-details">
        <article className="wallet-stat-card"><Clock3 /><div><span>Pending withdrawal</span><strong>{money(data.held)}</strong><p>Reserved until admin approves or rejects the request.</p></div></article>
        <article className="wallet-stat-card"><ShieldCheck /><div><span>Deposit verification</span><strong>Admin checked</strong><p>Wallet is credited only after the real transaction is verified.</p></div></article>
      </div>

      <div className="wallet-action-area">
        <div>
          <h2 className="wallet-actions-title">Main Wallet</h2>
          <div className="tab-switch"><button className={tab === "deposit" ? "active" : ""} onClick={() => setTab("deposit")}><ArrowDownLeft size={17} /> Deposit</button><button className={tab === "withdraw" ? "active" : ""} onClick={() => setTab("withdraw")}><ArrowUpRight size={17} /> Withdraw</button></div>
          {tab === "deposit" ? <DepositForm settings={settings} onDone={load} /> : <WithdrawForm settings={settings} balance={data.balance} onDone={load} />}
        </div>
      </div>

    </section>
  );
}

function DepositForm({ settings, onDone }) {
  const [form, setForm] = useState({ method: "ESEWA", amount: "", transactionId: "" });
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const key = form.method === "ESEWA" ? "esewa" : "khalti";
  const details = settings?.paymentMethods?.[key];
  const minDeposit = Number(settings?.minDeposit ?? 30);
  const maxDeposit = Number(settings?.maxDeposit ?? 10000);
  const depositAmount = Number(form.amount);
  const depositTooLow = form.amount !== "" && Number.isFinite(depositAmount) && depositAmount < minDeposit;
  const depositTooHigh = form.amount !== "" && Number.isFinite(depositAmount) && depositAmount > maxDeposit;

  async function submit(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (depositTooLow) return setError(`Minimum deposit amount is Rs. ${minDeposit}.`);
    if (depositTooHigh) return setError(`Maximum deposit amount is Rs. ${maxDeposit}.`);
    if (!screenshot) return setError("Upload the payment screenshot.");
    try {
      setLoading(true);
      const payload = new FormData();
      payload.append("method", form.method); payload.append("amount", form.amount); payload.append("transactionId", form.transactionId); payload.append("screenshot", screenshot);
      await api.post("/wallet/deposit", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage("Deposit request sent to admin for verification.");
      setForm({ ...form, amount: "", transactionId: "" }); setScreenshot(null); await onDone();
    } catch (err) { setError(err.response?.data?.message || "Could not submit deposit request."); }
    finally { setLoading(false); }
  }

  return <form className="panel form-stack wallet-form" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">Add money</span><h2>Deposit</h2></div></div>
    <div className="choice-row"><button type="button" className={`choice ${form.method === "ESEWA" ? "selected" : ""}`} onClick={() => setForm({ ...form, method: "ESEWA" })}>eSewa</button><button type="button" className={`choice ${form.method === "KHALTI" ? "selected" : ""}`} onClick={() => setForm({ ...form, method: "KHALTI" })}>Khalti</button></div>

    {(details?.qrUrl || details?.note) && <div className="payment-instructions qr-only">
      {details?.qrUrl && <PaymentQr url={details.qrUrl} method={form.method} />}
      {details?.note && <small>{details.note}</small>}
    </div>}

    <div className="field">
      <label>Deposit amount</label>
      <div className="money-input">
        <span>Rs.</span>
        <input
          type="number"
          min={minDeposit}
          max={maxDeposit}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder={`${minDeposit} - ${maxDeposit}`}
          aria-invalid={depositTooLow || depositTooHigh}
          required
        />
      </div>
      {depositTooLow && <p className="field-error">Minimum deposit amount is Rs. {minDeposit}.</p>}
      {depositTooHigh && <p className="field-error">Maximum deposit amount is Rs. {maxDeposit}.</p>}
    </div>
    <div className="field"><label>Transaction ID</label><input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="Enter transaction ID" required /></div>
    <label className="upload-field"><Upload size={19} /><span>{screenshot ? screenshot.name : "Upload payment screenshot"}</span><input hidden type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} /></label>
    <p className="field-help">The screenshot is proof only. Admin verifies the transaction in the actual wallet before crediting your eLeague balance.</p>
    {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
    <button className="btn btn-primary btn-full" disabled={loading || depositTooLow || depositTooHigh}>{loading ? "Submitting…" : "Submit deposit request"}</button>
  </form>;
}

function PaymentQr({ url, method }) {
  const [open, setOpen] = useState(false);
  const src = fileUrl(url);
  const label = method === "ESEWA" ? "eSewa" : "Khalti";

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function downloadQr() {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Could not download QR image.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `eliga-${label.toLowerCase()}-payment-qr.${blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  }

  return <>
    <button type="button" className="payment-qr-thumb" onClick={() => setOpen(true)} aria-label={`Open ${label} payment QR image`}>
      <img src={src} alt={`${label} payment QR`} />
    </button>

    {open && <div className="payment-qr-modal" role="dialog" aria-modal="true" aria-label={`${label} payment QR`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="payment-qr-modal-card">
        <button type="button" className="payment-qr-close" onClick={() => setOpen(false)} aria-label="Close QR image" title="Close"><X size={22} strokeWidth={2.4} /></button>
        <img src={src} alt={`${label} payment QR enlarged`} />
        <button type="button" className="btn btn-primary payment-qr-download" onClick={downloadQr}><Download size={17} /> Download QR</button>
      </div>
    </div>}
  </>;
}

function WithdrawForm({ settings, balance, onDone }) {
  const [form, setForm] = useState({ method: "ESEWA", amount: "", accountName: "", accountNumber: "" });
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const minWithdrawal = Number(settings?.minWithdrawal ?? 100);
  const maxWithdrawal = Number(settings?.maxWithdrawal ?? 10000);
  const withdrawalAmount = Number(form.amount);
  const withdrawalTooLow = form.amount !== "" && Number.isFinite(withdrawalAmount) && withdrawalAmount < minWithdrawal;
  const withdrawalTooHigh = form.amount !== "" && Number.isFinite(withdrawalAmount) && withdrawalAmount > maxWithdrawal;

  async function submit(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (withdrawalTooLow) return setError(`Minimum withdrawal amount is Rs. ${minWithdrawal}.`);
    if (withdrawalTooHigh) return setError(`Maximum withdrawal amount is Rs. ${maxWithdrawal}.`);
    if (Number(form.amount) > Number(balance)) return setError("Withdrawal amount is higher than your available balance.");
    try {
      setLoading(true); await api.post("/wallet/withdraw", form); setMessage("Withdrawal request sent to admin. The amount is reserved and can take up to 2 hours to arrive.");
      setForm({ ...form, amount: "" }); await onDone();
    } catch (err) { setError(err.response?.data?.message || "Could not request withdrawal."); }
    finally { setLoading(false); }
  }

  return <form className="panel form-stack wallet-form" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">Cash out</span><h2>Withdraw</h2></div></div>
    <div className="withdrawal-time-note"><Clock3 size={18} /><span>Withdrawal payments can take up to 2 hours to arrive in your eSewa or Khalti account.</span></div>
    <div className="choice-row"><button type="button" className={`choice ${form.method === "ESEWA" ? "selected" : ""}`} onClick={() => setForm({ ...form, method: "ESEWA" })}>eSewa</button><button type="button" className={`choice ${form.method === "KHALTI" ? "selected" : ""}`} onClick={() => setForm({ ...form, method: "KHALTI" })}>Khalti</button></div>
    <div className="field">
      <label>Amount</label>
      <div className="money-input">
        <span>Rs.</span>
        <input
          type="number"
          min={minWithdrawal}
          max={maxWithdrawal}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder={`${minWithdrawal} - ${maxWithdrawal}`}
          aria-invalid={withdrawalTooLow || withdrawalTooHigh}
          required
        />
      </div>
      {withdrawalTooLow && <p className="field-error">Minimum withdrawal amount is Rs. {minWithdrawal}.</p>}
      {withdrawalTooHigh && <p className="field-error">Maximum withdrawal amount is Rs. {maxWithdrawal}.</p>}
      <small className="field-help">Available: {money(balance)}</small>
    </div>
    <div className="field"><label>Wallet account name</label><input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="Name registered on wallet" required /></div>
    <div className="field"><label>{form.method === "ESEWA" ? "eSewa" : "Khalti"} number</label><input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="98XXXXXXXX" required /></div>
    <p className="field-help">Requested money is reserved immediately so it cannot be spent in a match while withdrawal is pending. If admin rejects it, the amount returns to your available balance.</p>
    {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
    <button className="btn btn-primary btn-full" disabled={loading || withdrawalTooLow || withdrawalTooHigh}>{loading ? "Submitting…" : "Request withdrawal"}</button>
  </form>;
}
