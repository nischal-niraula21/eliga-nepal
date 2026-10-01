import { Check, Clipboard, Gamepad2, KeyRound, RefreshCw, ShieldAlert, Trophy, Upload, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fileUrl } from "../api/client";
import GameLogo from "../components/GameLogo";
import StatusBadge from "../components/StatusBadge";
import { gameConfig } from "../config/games";
import { useAuth } from "../context/AuthContext";
import { formatLabel, modeLabel, money } from "../utils/format";

function idOf(value) { return String(value?._id || value || ""); }

function CopyBox({ label, value, secret = false }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return <div className={`credential-box ${secret ? "secret" : ""}`}><span>{label}</span><div><b>{value || "Not required"}</b>{value && <button type="button" className="icon-button" onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />}</button>}</div></div>;
}

export default function RoomDetail() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get(`/rooms/${id}`);
    setRoom(data.room);
    if (data.room.status === "COMPLETED") await refreshUser();
  }, [id, refreshUser]);

  useEffect(() => { load().catch((err) => setError(err.response?.data?.message || "Could not load room.")).finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!room || !["OPEN", "READY", "RESULT_PENDING", "DISPUTED"].includes(room.status)) return undefined;
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [room?.status, load]);

  async function cancelRoom() {
    if (!window.confirm("Cancel this room and return the entry fee to your wallet?")) return;
    try { await api.post(`/rooms/${id}/cancel`); await Promise.all([load(), refreshUser()]); }
    catch (err) { setError(err.response?.data?.message || "Could not cancel room."); }
  }

  if (loading) return <div className="container page-state">Loading match…</div>;
  if (!room) return <div className="container page-state error-state">{error}</div>;

  const isHost = idOf(room.host) === idOf(user?._id);
  const isChallenger = idOf(room.challenger) === idOf(user?._id);
  const game = gameConfig(room.game || "EFOOTBALL");
  const entryRefunded = room.status === "CANCELLED" || room.settlementType === "REFUND";
  const entryPaid = isHost || isChallenger;
  const paymentText = entryRefunded ? "Entry fee refunded" : entryPaid ? "Entry fee paid" : "Entry fee not paid";
  const entryWallet = (isHost ? room.hostWalletType : room.challengerWalletType) === "FP" ? "FP Wallet" : "Main Wallet";

  return <section className="container page-section match-page">
    <div className="match-header">
      <div>
        <div className="tags"><span className="tag game-tag"><GameLogo game={game} size="tag" /> {game.name}</span><span className="tag tag-purple">{modeLabel(room.gameMode, room.game)}</span><span className="tag">{formatLabel(room.matchFormat)}</span></div>
        <h1>{room.roomCode}</h1>
        <p>{room.hostGameUsername} <span>vs</span> {room.challengerGameUsername || "Waiting for challenger"}</p>
      </div>
      <StatusBadge status={room.status} />
    </div>

    {error && <div className="flash danger">{error}</div>}

    <div className="match-summary-grid">
      <article className="summary-card"><span>Entry fee / side</span><strong>{money(room.entryFee)}</strong></article>
      <article className="summary-card"><span>Total pool</span><strong>{money(room.totalPool)}</strong></article>
      <article className="summary-card purple"><span>Winner receives</span><strong><Trophy size={20} /> {money(room.prizeAmount)}</strong></article>
    </div>

    <div className={`match-entry-status ${entryRefunded ? "refunded" : entryPaid ? "paid" : "unpaid"}`}>
      {entryRefunded ? <RefreshCw size={15} /> : entryPaid ? <Check size={15} /> : <Wallet size={15} />}
      <span>{paymentText}</span>
      <small>{entryRefunded ? `The entry fee was returned to ${entryWallet}.` : entryPaid ? `Paid from ${entryWallet}. A finalized win pays its prize to Main Wallet.` : "Pay the entry fee before joining this match."}</small>
    </div>

    <div className="match-content-grid single-column">
      <div className="main-column">
        <div className="panel match-players">
          <div><span className="meta-label">Host</span><strong>{room.hostGameUsername}</strong>{room.hostGamePlayerId && <small>{room.hostGamePlayerId}</small>}<small>{room.host?.name}</small></div>
          <span className="versus large">VS</span>
          <div className="align-right"><span className="meta-label">Challenger</span><strong>{room.challengerGameUsername || "Waiting"}</strong>{room.challengerGamePlayerId && <small>{room.challengerGamePlayerId}</small>}<small>{room.challenger?.name || "Open slot"}</small></div>
        </div>

        <div className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Match access</span><h2>{game.name}</h2></div><KeyRound size={20} /></div>
          <div className="credential-grid"><CopyBox label={game.accessIdLabel} value={room.roomAccessId} /><CopyBox label={game.accessPasswordLabel} value={room.roomAccessPassword} secret /></div>
          {!room.roomAccessId && !room.roomAccessPassword && <div className="notice"><Gamepad2 size={18} /> Use the registered {game.name} player identities above to connect and start the match.</div>}
          {room.status === "OPEN" && isHost && <div className="notice"><RefreshCw size={18} /> {room.reservationActive ? "A player is preparing to join. Their place is held briefly until payment." : "Waiting for someone to join. Your entry fee is already secured from your wallet."}</div>}
          {room.status === "READY" && <div className="notice success"><Check size={18} /> Both sides have paid from their eLeague wallets. You can play now.</div>}
        </div>

        {room.status === "READY" && <ResultSubmission room={room} onDone={load} />}
        {room.status === "RESULT_PENDING" && room.result && <ResultReview room={room} user={user} onDone={async () => { await load(); await refreshUser(); }} />}
        {room.status === "DISPUTED" && <div className="panel dispute-state"><ShieldAlert /><div><span className="eyebrow">Admin review</span><h2>Result disputed</h2><p>No prize will move until an admin reviews the evidence and resolves this match.</p></div></div>}
        {room.status === "COMPLETED" && <Completed room={room} user={user} />}
        {room.status === "CANCELLED" && <div className="panel notice"><Wallet size={18} /><div>Your room was cancelled and the entry fee was returned to the host wallet.</div></div>}
      </div>

      {room.status === "OPEN" && isHost && <div className="match-room-actions"><button className="btn btn-danger-soft" onClick={cancelRoom}>Cancel room & refund</button></div>}
    </div>
  </section>;
}

function ResultSubmission({ room, onDone }) {
  const [outcome, setOutcome] = useState("HOST_WIN");
  const [hostScore, setHostScore] = useState(0);
  const [challengerScore, setChallengerScore] = useState(0);
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!screenshot) return setError("Upload the final result screenshot.");
    try {
      setLoading(true);
      const form = new FormData();
      form.append("claimedOutcome", outcome);
      form.append("hostScore", hostScore);
      form.append("challengerScore", challengerScore);
      form.append("screenshot", screenshot);
      await api.post(`/rooms/${room._id}/result`, form, { headers: { "Content-Type": "multipart/form-data" } });
      await onDone();
    } catch (err) { setError(err.response?.data?.message || "Could not submit result."); }
    finally { setLoading(false); }
  }
  return <form className="panel form-stack" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">After the match</span><h2>Submit result</h2></div></div><div className="field"><label>Result</label><select value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="HOST_WIN">{room.hostGameUsername} won</option><option value="CHALLENGER_WIN">{room.challengerGameUsername} won</option><option value="DRAW">Draw</option><option value="VOID">Void / match not completed</option></select></div><div className="score-grid"><div className="field"><label>{room.hostGameUsername}</label><input type="number" min="0" max="9999" value={hostScore} onChange={(e) => setHostScore(e.target.value)} /></div><span>—</span><div className="field"><label>{room.challengerGameUsername}</label><input type="number" min="0" max="9999" value={challengerScore} onChange={(e) => setChallengerScore(e.target.value)} /></div></div><label className="upload-field"><Upload size={19} /><span>{screenshot ? screenshot.name : "Upload final result screenshot"}</span><input hidden type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} /></label><p className="field-help">Upload clear evidence that identifies the players and the final result.</p>{error && <p className="form-error">{error}</p>}<button className="btn btn-primary btn-full" disabled={loading}>{loading ? "Submitting…" : "Submit result"}</button></form>;
}

function ResultReview({ room, user, onDone }) {
  const result = room.result;
  const isSubmitter = idOf(result?.submittedBy) === idOf(user?._id);
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [disputeOutcome, setDisputeOutcome] = useState(result?.claimedOutcome || "HOST_WIN");
  const [disputeHostScore, setDisputeHostScore] = useState(result?.hostScore ?? 0);
  const [disputeChallengerScore, setDisputeChallengerScore] = useState(result?.challengerScore ?? 0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const outcome = result.claimedOutcome === "HOST_WIN" ? `${room.hostGameUsername} won` : result.claimedOutcome === "CHALLENGER_WIN" ? `${room.challengerGameUsername} won` : result.claimedOutcome === "DRAW" ? "Draw" : "Match void";

  async function confirm() {
    try {
      setLoading(true);
      await api.post(`/rooms/${room._id}/result/confirm`);
      await onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm result.");
    } finally {
      setLoading(false);
    }
  }

  async function dispute(e) {
    e.preventDefault();
    setError("");
    if (!screenshot) return setError("Upload evidence that supports your disputed result.");
    try {
      setLoading(true);
      const form = new FormData();
      form.append("reason", reason);
      form.append("claimedOutcome", disputeOutcome);
      form.append("hostScore", disputeHostScore);
      form.append("challengerScore", disputeChallengerScore);
      form.append("screenshot", screenshot);
      await api.post(`/rooms/${room._id}/result/dispute`, form, { headers: { "Content-Type": "multipart/form-data" } });
      await onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not dispute result.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="panel form-stack">
    <div className="panel-heading"><div><span className="eyebrow">Result submitted</span><h2>{outcome}</h2></div></div>
    <div className="result-score"><strong>{room.hostGameUsername}</strong><b>{result.hostScore} - {result.challengerScore}</b><strong>{room.challengerGameUsername}</strong></div>
    {result.screenshotUrl && <a className="evidence-link" href={fileUrl(result.screenshotUrl)} target="_blank" rel="noreferrer">View result screenshot</a>}
    {isSubmitter ? <div className="notice"><RefreshCw size={18} /> Waiting for your opponent to confirm or dispute the result.</div> : !showDispute ? <div className="button-row"><button className="btn btn-primary" disabled={loading} onClick={confirm}><Check size={17} /> Confirm result</button><button className="btn btn-danger-soft" onClick={() => setShowDispute(true)}><X size={17} /> Dispute</button></div> : <form className="form-stack dispute-form" onSubmit={dispute}>
      <div className="field"><label>What result is correct?</label><select value={disputeOutcome} onChange={(e) => setDisputeOutcome(e.target.value)}><option value="HOST_WIN">{room.hostGameUsername} won</option><option value="CHALLENGER_WIN">{room.challengerGameUsername} won</option><option value="DRAW">Draw</option><option value="VOID">Void / match not completed</option></select></div>
      <div className="score-grid"><div className="field"><label>{room.hostGameUsername}</label><input type="number" min="0" max="9999" value={disputeHostScore} onChange={(e) => setDisputeHostScore(e.target.value)} /></div><span>—</span><div className="field"><label>{room.challengerGameUsername}</label><input type="number" min="0" max="9999" value={disputeChallengerScore} onChange={(e) => setDisputeChallengerScore(e.target.value)} /></div></div>
      <div className="field"><label>What is wrong with the submitted result?</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what happened and why this result is incorrect" required /></div>
      <label className="upload-field"><Upload size={19} /><span>{screenshot ? screenshot.name : "Upload your result evidence"}</span><input hidden type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} /></label>
      <p className="field-help">Evidence is required for disputes so the admin can compare both players' claims.</p>
      <div className="button-row"><button className="btn btn-danger-soft" disabled={loading}>{loading ? "Submitting…" : "Submit dispute"}</button><button type="button" className="btn btn-secondary" onClick={() => setShowDispute(false)}>Back</button></div>
    </form>}
    {error && <p className="form-error">{error}</p>}
  </div>;
}

function Completed({ room, user }) {
  const result = room.result;
  const finalOutcome = result?.finalOutcome || result?.claimedOutcome;
  const winnerId = idOf(result?.finalWinner || result?.claimedWinner);
  const winnerName = winnerId === idOf(room.host) ? room.hostGameUsername : winnerId === idOf(room.challenger) ? room.challengerGameUsername : "";
  const userWon = winnerId && winnerId === idOf(user?._id);
  return <div className="panel completed-card"><div className="completed-icon"><Trophy /></div><span className="eyebrow">Match completed</span><h2>{["DRAW", "VOID"].includes(finalOutcome) ? "Entry fees refunded" : `${winnerName} won`}</h2><p>{["DRAW", "VOID"].includes(finalOutcome) ? "Both sides received their entry fee back in the eLeague wallet." : userWon ? `${money(room.prizeAmount)} has been credited to your wallet.` : `${money(room.prizeAmount)} was credited to the winner's wallet.`}</p>{result && <strong className="final-score">{result.hostScore} - {result.challengerScore}</strong>}</div>;
}
