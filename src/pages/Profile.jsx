import { CheckCircle2, Copy, Gamepad2, Gift, Mail, Share2, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api/client";
import GameLogo from "../components/GameLogo";
import { GAME_LIST, profileForGame } from "../config/games";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";

function referralLink(code) {
  if (!code) return "";
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}

function profilesFromUser(user) {
  return GAME_LIST.map((game) => {
    const current = profileForGame(user, game.key);
    return { game: game.key, username: current.username || "", playerId: current.playerId || "" };
  });
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [gameProfiles, setGameProfiles] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setGameProfiles(profilesFromUser(user));
    }
  }, [user]);

  function updateProfile(game, field, value) {
    setGameProfiles((current) => current.map((item) => item.game === game ? { ...item, [field]: value } : item));
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      setLoading(true);
      const { data } = await api.patch("/auth/me", { name, gameProfiles });
      setUser(data.user);
      setMessage("Profile and game accounts updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not update profile.");
    } finally { setLoading(false); }
  }

  return (
    <section className="container page-section narrow-page">
      <div className="page-title"><span className="eyebrow">Account</span><h1>Profile</h1><p>Manage your eLeague account and the game identities used when you create or join matches.</p></div>
      {user?.role === "user" && <div className="balance-banner"><div><UserRound size={20} /><span>Main Wallet</span></div><b>{money(user.walletBalance)}</b></div>}

      <form className="panel form-stack" onSubmit={submit}>
        <div className="profile-email"><Mail size={18} /><div><span>Email</span><b>{user?.email}</b></div></div>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>

        {user?.role !== "admin" && <div className="profile-games-block">
          <div className="form-block-title"><Gamepad2 size={20} /><div><h3>Game Accounts</h3><p>Only add the games you play. You can also save these automatically while creating or joining a room.</p></div></div>
          <div className="game-profile-list">
            {GAME_LIST.map((game) => {
              const profile = gameProfiles.find((item) => item.game === game.key) || { username: "", playerId: "" };
              const connected = Boolean(profile.username || profile.playerId);
              return <article className={`game-profile-card ${connected ? "connected" : ""}`} key={game.key}>
                <div className="game-profile-head"><GameLogo game={game} size="small" /><div><strong>{game.name}</strong><small>{connected ? "Connected" : "Not connected"}</small></div></div>
                <div className="two-col">
                  <div className="field"><label>{game.usernameLabel}</label><input value={profile.username} onChange={(e) => updateProfile(game.key, "username", e.target.value)} placeholder={game.usernamePlaceholder} /></div>
                  <div className="field"><label>{game.playerIdLabel} {game.playerIdRequired ? <small>(needed to play)</small> : <small>(optional)</small>}</label><input value={profile.playerId} onChange={(e) => updateProfile(game.key, "playerId", e.target.value)} placeholder={`Enter ${game.playerIdLabel}`} /></div>
                </div>
              </article>;
            })}
          </div>
        </div>}

        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save changes"}</button>
      </form>

      {user?.role === "user" && <ReferralSection />}
    </section>
  );
}

function ReferralSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/referrals/me").then(({ data: response }) => { if (active) setData(response); }).catch(() => { if (active) setData(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function copyText(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
      window.setTimeout(() => setNotice(""), 2200);
    } catch { setNotice("Could not copy automatically. Please copy it manually."); }
  }

  async function shareReferral() {
    if (!data?.referralCode) return;
    const url = referralLink(data.referralCode);
    const text = `Join me on eLeague Nepal for competitive gaming matches. Use my referral code ${data.referralCode}.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join eLeague Nepal", text, url }); return; }
      catch (error) { if (error?.name === "AbortError") return; }
    }
    await copyText(url, "Referral link");
  }

  if (loading) return <div className="panel referral-panel"><div className="page-state compact">Loading referral details…</div></div>;
  if (!data) return <div className="panel referral-panel"><p className="form-error">Could not load referral details.</p></div>;
  const link = referralLink(data.referralCode);

  return <section className="panel referral-panel">
    <div className="referral-heading"><div><span className="eyebrow">Refer & earn</span><h2>{data.enabled ? <>Invite friends. Earn {money(data.rewardAmount)} FP each.</> : "Referral program is currently paused."}</h2><p>{data.enabled ? <>Earn {money(data.rewardAmount)} in FP Wallet for every friend who joins with your referral and completes their first admin-verified deposit. FP cannot be withdrawn directly.</> : "Your referral code and history stay available. New rewards resume when the program is enabled again."}</p></div><span className={`referral-program-badge ${data.enabled ? "active" : "paused"}`}>{data.enabled ? "Active" : "Paused"}</span></div>
    <p className="field-help">FP balance: {money(data.fpBalance)}. FP room entry unlocks after {data.fpMinimumSuccessfulReferrals ?? 4} successful referrals, with enough FP to pay the full entry fee. Finalized winnings go to Main Wallet; refunds return to FP.</p>
    <div className="referral-code-box"><div><span>Your referral code</span><strong>{data.referralCode}</strong></div><button className="icon-action-button" type="button" onClick={() => copyText(data.referralCode, "Referral code")} aria-label="Copy referral code"><Copy size={18} /></button></div>
    <div className="referral-link-box"><span>Your referral link</span><div className="referral-link-row"><input readOnly value={link} aria-label="Referral link" /><button className="btn btn-secondary btn-small" type="button" onClick={() => copyText(link, "Referral link")}><Copy size={16} /> Copy</button><button className="btn btn-primary btn-small" type="button" onClick={shareReferral}><Share2 size={16} /> Share</button></div></div>
    {notice && <div className="referral-copy-notice"><CheckCircle2 size={16} /> {notice}</div>}
    <div className="referral-stats"><div><Users size={18} /><span>Total referrals</span><b>{data.totalCount ?? (data.successfulCount + data.pendingCount)}</b></div><div><Gift size={18} /><span>Successful</span><b>{data.successfulCount}</b></div><div><Users size={18} /><span>Pending</span><b>{data.pendingCount}</b></div><div><span className="referral-rupee">Rs.</span><span>Lifetime rewards</span><b>{money(data.totalEarned)}</b></div></div>
  </section>;
}
