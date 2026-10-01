import { Gamepad2, KeyRound, Swords, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import GameLogo from "../components/GameLogo";
import EntryWalletSelector from "../components/EntryWalletSelector";
import useEntryWallet from "../hooks/useEntryWallet";
import { GAME_LIST, gameConfig, profileForGame } from "../config/games";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";

function initialGame(searchParams) {
  const requested = String(searchParams.get("game") || "").toUpperCase();
  return GAME_LIST.some((item) => item.key === requested) ? requested : "EFOOTBALL";
}

export default function CreateRoom() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const payment = useEntryWallet(searchParams.get("wallet"));
  const [settings, setSettings] = useState({ minEntryFee: 30, maxEntryFee: 500, commissionPercent: 10 });
  const [form, setForm] = useState(() => {
    const game = initialGame(searchParams);
    const config = gameConfig(game);
    const profile = profileForGame(user, game);
    return {
      game,
      gameMode: config.modes[0].value,
      matchFormat: config.formats[0],
      entryFee: "",
      roomAccessId: "",
      roomAccessPassword: "",
      gameUsername: profile.username || "",
      gamePlayerId: profile.playerId || "",
    };
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/settings/public").then(({ data }) => setSettings(data)).catch(() => {}); }, []);

  const config = gameConfig(form.game);
  const amount = Number(form.entryFee);
  const hasAmount = form.entryFee !== "";
  const belowMin = hasAmount && amount < settings.minEntryFee;
  const aboveMax = hasAmount && amount > settings.maxEntryFee;
  const validAmount = hasAmount && Number.isFinite(amount) && !belowMin && !aboveMax;
  const insufficient = validAmount && payment.balance < amount;
  const missingIdentity = !form.gameUsername.trim() || (config.playerIdRequired && !form.gamePlayerId.trim());
  const missingAccess = (config.accessIdRequired && !form.roomAccessId.trim()) || (config.accessPasswordRequired && !form.roomAccessPassword.trim());
  const prize = useMemo(() => {
    if (!validAmount) return 0;
    const total = amount * 2;
    return total - Math.round((total * settings.commissionPercent) / 100);
  }, [amount, validAmount, settings.commissionPercent]);

  function selectGame(game) {
    const nextConfig = gameConfig(game);
    const profile = profileForGame(user, game);
    setForm((current) => ({
      ...current,
      game,
      gameMode: nextConfig.modes[0].value,
      matchFormat: nextConfig.formats[0],
      roomAccessId: "",
      roomAccessPassword: "",
      gameUsername: profile.username || "",
      gamePlayerId: profile.playerId || "",
    }));
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!validAmount || insufficient || payment.blocked || missingIdentity || missingAccess || loading) return;
    try {
      setLoading(true);
      const { data } = await api.post("/rooms", { ...form, walletType: payment.walletType });
      await refreshUser();
      navigate(`/rooms/${data.room._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create room.");
    } finally { setLoading(false); }
  }

  return (
    <section className="container page-section narrow-page">
      <div className="page-title"><span className="eyebrow">Host a match</span><h1>Create room</h1><p>Choose a game, set up the match, and pay your side's entry fee from your eLeague wallet.</p></div>
      <div className="balance-banner"><div><Wallet size={20} /><span>{payment.walletType === "FP" ? "FP Wallet" : "Main Wallet"}</span></div><b>{money(payment.balance)}</b></div>

      <form className="panel form-stack" onSubmit={submit}>
        <EntryWalletSelector payment={payment} disabled={loading} />
        <div className="form-block">
          <div className="form-block-title"><Gamepad2 size={20} /><div><h3>Choose game</h3><p>Your lobby room will be listed under this game.</p></div></div>
          <div className="game-choice-grid">
            {GAME_LIST.map((game) => <button key={game.key} type="button" className={`game-choice ${form.game === game.key ? "selected" : ""}`} onClick={() => selectGame(game.key)}><GameLogo game={game} size="small" /><span><b>{game.name}</b><small>{game.tagline}</small></span></button>)}
          </div>
        </div>

        <div className="form-block">
          <div className="form-block-title"><Swords size={20} /><div><h3>{config.name} setup</h3><p>Choose the match mode and team format.</p></div></div>
          <div className="two-col">
            <div className="field"><label>Mode</label><div className="choice-row wrap">{config.modes.map(({ value, label }) => <button type="button" key={value} className={`choice ${form.gameMode === value ? "selected" : ""}`} onClick={() => setForm({ ...form, gameMode: value })}>{label}</button>)}</div></div>
            <div className="field"><label>Format</label><div className="choice-row four">{config.formats.map((value) => <button type="button" key={value} className={`choice ${form.matchFormat === value ? "selected" : ""}`} onClick={() => setForm({ ...form, matchFormat: value })}>{value.toLowerCase()}</button>)}</div></div>
          </div>

          <div className="field">
            <label>Entry fee <span>per side</span></label>
            <div className={`money-input ${belowMin || aboveMax ? "invalid" : ""}`}><span>Rs.</span><input type="number" inputMode="numeric" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} placeholder={`Between ${settings.minEntryFee} and ${settings.maxEntryFee}`} /></div>
            {belowMin && <p className="field-error">The minimum entry fee is Rs. {settings.minEntryFee}.</p>}
            {aboveMax && <p className="field-error">The maximum entry fee is Rs. {settings.maxEntryFee}.</p>}
            {insufficient && <p className="field-error">The selected wallet does not have enough balance for this entry fee.</p>}
          </div>
        </div>

        <div className="form-block">
          <div className="form-block-title"><Gamepad2 size={20} /><div><h3>Your {config.name} identity</h3><p>We save this to your Game Accounts after the room is created.</p></div></div>
          <div className="two-col">
            <div className="field"><label>{config.usernameLabel} <span>*</span></label><input value={form.gameUsername} onChange={(e) => setForm({ ...form, gameUsername: e.target.value })} placeholder={config.usernamePlaceholder} required /></div>
            <div className="field"><label>{config.playerIdLabel} {config.playerIdRequired ? <span>*</span> : <small>(optional)</small>}</label><input value={form.gamePlayerId} onChange={(e) => setForm({ ...form, gamePlayerId: e.target.value })} placeholder={config.playerIdRequired ? `Enter ${config.playerIdLabel}` : `Optional ${config.playerIdLabel}`} required={config.playerIdRequired} /></div>
          </div>
        </div>

        <div className="form-block">
          <div className="form-block-title"><KeyRound size={20} /><div><h3>{config.name} match access</h3><p>{config.accessIdRequired || config.accessPasswordRequired ? "The room/invite ID can be shown before joining. Passwords unlock after wallet payment." : "This game can be arranged using the registered player usernames. Add an invite code only if you use one."}</p></div></div>
          <div className="two-col">
            <div className="field"><label>{config.accessIdLabel} {config.accessIdRequired ? <span>*</span> : <small>(optional)</small>}</label><input value={form.roomAccessId} onChange={(e) => setForm({ ...form, roomAccessId: e.target.value })} placeholder={config.accessIdPlaceholder} required={config.accessIdRequired} /></div>
            <div className="field"><label>{config.accessPasswordLabel} {config.accessPasswordRequired ? <span>*</span> : <small>(optional)</small>}</label><input value={form.roomAccessPassword} onChange={(e) => setForm({ ...form, roomAccessPassword: e.target.value })} placeholder={config.accessPasswordPlaceholder} required={config.accessPasswordRequired} /></div>
          </div>
        </div>

        <div className="price-preview">
          <div><span>Your wallet charge</span><b>{validAmount ? money(amount) : "—"}</b></div>
          <div><span>Total pool</span><b>{validAmount ? money(amount * 2) : "—"}</b></div>
          <div className="highlight"><span>Winner receives</span><b>{validAmount ? money(prize) : "—"}</b></div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-full" disabled={!validAmount || insufficient || payment.blocked || missingIdentity || missingAccess || loading}>{loading ? "Creating…" : validAmount ? `Create ${config.name} room & pay ${money(amount)}` : "Create room"}</button>
      </form>
    </section>
  );
}
