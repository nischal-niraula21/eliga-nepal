import { Clock3, Gamepad2, KeyRound, LogOut, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import GameLogo from "../components/GameLogo";
import EntryWalletSelector from "../components/EntryWalletSelector";
import useEntryWallet from "../hooks/useEntryWallet";
import { gameConfig, profileForGame } from "../config/games";
import { useAuth } from "../context/AuthContext";
import { formatLabel, modeLabel, money } from "../utils/format";

function secondsLeft(value) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

export default function JoinRoom() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const payment = useEntryWallet();
  const [reserving, setReserving] = useState(false);
  const [room, setRoom] = useState(null);
  const [gameUsername, setGameUsername] = useState("");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState(null);
  const [reserved, setReserved] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const userId = String(user?._id || "");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReserving(false);
    setReserved(false);
    setReservationExpiresAt(null);
    setError("");
    api.get(`/rooms/public/${id}`).then(({ data }) => {
      if (!active) return;
      const nextRoom = data.room;
      if (String(nextRoom.host?._id || nextRoom.host || "") === userId) {
        navigate(`/rooms/${nextRoom._id}`, { replace: true });
        return;
      }
      setRoom(nextRoom);
      const profile = profileForGame(user, nextRoom.game || "EFOOTBALL");
      setGameUsername(profile.username || "");
      setGamePlayerId(profile.playerId || "");
    }).catch((err) => {
      if (active) {
        setRoom(null);
        setError(err.response?.data?.message || "Room is no longer available.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, userId, navigate]);

  const canPay = Boolean(room && !payment.blocked && payment.balance >= Number(room.entryFee));
  useEffect(() => {
    if (!room || !canPay || reserved || loading) return undefined;
    let active = true;
    setReserving(true);
    setError("");
    api.post(`/rooms/${id}/reserve`, { walletType: payment.walletType }).then(({ data }) => {
      if (!active) return;
      const expiresAt = data.reservationExpiresAt || data.room?.reservationExpiresAt;
      setReserving(false);
      setReserved(true);
      setReservationExpiresAt(expiresAt || null);
      setRemaining(secondsLeft(expiresAt));
    }).catch((err) => {
      if (active) {
        setReserving(false);
        setError(err.response?.data?.message || "Could not reserve this room.");
      }
    }).finally(() => { if (active) setReserving(false); });
    return () => { active = false; };
  }, [id, room?._id, canPay, payment.walletType, reserved, loading]);

  useEffect(() => {
    if (!reservationExpiresAt) return undefined;
    const timer = window.setInterval(() => setRemaining(secondsLeft(reservationExpiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [reservationExpiresAt]);

  const config = room ? gameConfig(room.game) : null;
  const insufficient = room && payment.balance < Number(room.entryFee || 0);
  const missingIdentity = config && (!gameUsername.trim() || (config.playerIdRequired && !gamePlayerId.trim()));
  const expired = Boolean(room && reserved && remaining <= 0);
  const countdown = useMemo(() => {
    const minutes = Math.floor(remaining / 60);
    const seconds = String(remaining % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [remaining]);

  async function leaveRoom() {
    try {
      setLeaving(true);
      if (reserved) await api.post(`/rooms/${id}/leave`);
    } catch (err) {
      if (err.response?.status !== 409) setError(err.response?.data?.message || "Could not leave this room.");
    } finally {
      setLeaving(false);
      navigate("/lobby", { replace: true });
    }
  }

  async function join(e) {
    e.preventDefault();
    setError("");
    if (!agreed || insufficient || payment.blocked || missingIdentity || expired || !reserved || joining) return;
    try {
      setJoining(true);
      await api.post(`/rooms/${id}/join`, { gameUsername, gamePlayerId, walletType: payment.walletType });
      await refreshUser();
      navigate(`/rooms/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not join this room.");
    } finally { setJoining(false); }
  }

  if (loading) return <div className="container page-state">Loading room…</div>;
  if (!room || !config) return <div className="container page-state error-state">{error || "Room is unavailable."}</div>;

  return (
    <section className="container page-section narrow-page">
      <div className="page-title"><span className="eyebrow">Join {config.name}</span><h1>{room.roomCode}</h1><p>{reserved ? "Your place is held briefly while you review the match and pay from your selected wallet." : "Choose a wallet with enough balance to reserve this room. You have not been charged."}</p></div>

      <form className="panel join-panel" onSubmit={join}>
        <div className="join-topline">
          <div className="tags"><span className="tag game-tag"><GameLogo game={config} size="tag" /> {config.name}</span><span className="tag tag-purple">{modeLabel(room.gameMode, room.game)}</span><span className="tag">{formatLabel(room.matchFormat)}</span></div>
          <span className="room-code">{room.roomCode}</span>
        </div>

        <EntryWalletSelector payment={payment} disabled={joining || reserving || leaving} />
        {reserved ? <div className={`notice payment-status-note ${expired ? "error-state" : ""}`}><Clock3 size={18} /><div><b>{expired ? "Reservation expired" : `Room held for ${countdown}`}</b><p>{expired ? "Return to the lobby and join again." : "You have not been charged yet. Leave any time before payment."}</p></div></div> : <div className="notice payment-status-note unpaid"><Wallet size={18} /><div><b>{reserving ? "Reserving room…" : "Entry fee not paid yet"}</b><p>Choose an eligible wallet that covers the full entry fee.</p></div></div>}

        <div className="join-matchup"><div><span className="meta-label">Host</span><strong>{room.hostGameUsername}</strong>{room.hostGamePlayerId && <small>{room.hostGamePlayerId}</small>}</div><span>VS</span><div className="align-right"><span className="meta-label">Your side</span><strong>{gameUsername || "You"}</strong>{gamePlayerId && <small>{gamePlayerId}</small>}</div></div>

        {room.roomAccessId ? <div className="credential-preview"><KeyRound size={18} /><div><span>{config.accessIdLabel}</span><b>{room.roomAccessId}</b></div><small>{config.accessPasswordRequired ? "Password unlocks after you pay." : "Any private password unlocks after you pay."}</small></div> : <div className="credential-preview"><Gamepad2 size={18} /><div><span>{config.name} access</span><b>Use player identity</b></div><small>Connect with the host using the registered in-game usernames.</small></div>}

        <div className="join-values"><div><span>Entry fee</span><b>{money(room.entryFee)}</b></div><div><span>Winner receives</span><b>{money(room.prizeAmount)}</b></div><div><span>{payment.walletType === "FP" ? "FP Wallet" : "Main Wallet"}</span><b>{money(payment.balance)}</b></div></div>

        <div className="two-col">
          <div className="field"><label>{config.usernameLabel} <span>*</span></label><input value={gameUsername} onChange={(e) => setGameUsername(e.target.value)} placeholder={config.usernamePlaceholder} required /></div>
          <div className="field"><label>{config.playerIdLabel} {config.playerIdRequired ? <span>*</span> : <small>(optional)</small>}</label><input value={gamePlayerId} onChange={(e) => setGamePlayerId(e.target.value)} placeholder={config.playerIdRequired ? `Enter ${config.playerIdLabel}` : `Optional ${config.playerIdLabel}`} required={config.playerIdRequired} /></div>
        </div>
        <p className="field-help">This {config.name} identity is saved to your Game Accounts only after you successfully join.</p>

        <label className="check-row"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>I understand this is {formatLabel(room.matchFormat)} {config.name}, and the entry fee is charged once for my side. I arrange any extra teammates myself.</span></label>

        {insufficient && <div className="wallet-warning"><Wallet size={19} /><div><b>Not enough balance in the selected wallet</b><p>The selected wallet must cover {money(room.entryFee)}. You can choose your other wallet above.</p></div><Link to="/wallet" className="btn btn-secondary btn-small">Wallets</Link></div>}
        {error && <p className="form-error">{error}</p>}
        <div className="button-row">
          <button type="button" className="btn btn-secondary" disabled={leaving || joining} onClick={leaveRoom}><LogOut size={17} /> {leaving ? "Leaving…" : "Leave room"}</button>
          <button className="btn btn-primary" disabled={!agreed || missingIdentity || joining || insufficient || payment.blocked || expired || !reserved}>{joining ? "Joining…" : `Join & pay ${money(room.entryFee)}`}</button>
        </div>
      </form>
    </section>
  );
}
