import { CircleDollarSign, Download, Eye, EyeOff, Gamepad2, Share2, ShieldCheck, Swords, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { FaFacebookMessenger } from "react-icons/fa";
import { FaFacebook } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import GameLogo from "../components/GameLogo";
import { GAME_LIST } from "../config/games";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";
import { getInstallState, requestPwaInstall } from "../pwa";

function personalReferralLink(code) {
  if (!code) return `${window.location.origin}/register`;
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}

export default function Home() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [balanceHidden, setBalanceHidden] = useState(() => localStorage.getItem("eliga_hide_balance") === "1");
  const [platformSettings, setPlatformSettings] = useState({ referralRewardAmount: 5, whatsappNumber: "", referralProgramEnabled: true });
  const [shareNotice, setShareNotice] = useState("");
  const [pwaState, setPwaState] = useState(() => getInstallState());

  useEffect(() => {
    const updatePwaState = (event) => setPwaState(event?.detail || getInstallState());
    window.addEventListener("eliga:pwa-state", updatePwaState);
    return () => window.removeEventListener("eliga:pwa-state", updatePwaState);
  }, []);

  useEffect(() => {
    api.get("/settings/public")
      .then(({ data }) => setPlatformSettings((current) => ({ ...current, ...data })))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (user?.role !== "user") return undefined;
    let active = true;
    const refreshBalance = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (active) setUser(data.user);
      } catch { }
    };
    refreshBalance();
    const timer = window.setInterval(refreshBalance, 15000);
    const onFocus = () => refreshBalance();
    const onVisibility = () => document.visibilityState === "visible" && refreshBalance();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?._id, user?.role, setUser]);

  function toggleBalance() {
    setBalanceHidden((current) => {
      const next = !current;
      localStorage.setItem("eliga_hide_balance", next ? "1" : "0");
      return next;
    });
  }

  async function shareELeague() {
    if (!user?.referralCode) {
      navigate("/register");
      return;
    }
    const url = personalReferralLink(user.referralCode);
    const reward = money(platformSettings.referralRewardAmount ?? 5);
    const text = platformSettings.referralProgramEnabled
      ? `Join me on eLeague Nepal for competitive gaming matches. Use my referral code ${user.referralCode}. I earn ${reward} in my FP Wallet after your first verified deposit.`
      : `Join me on eLeague Nepal for competitive gaming matches. Use my referral code ${user.referralCode}.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Join eLeague Nepal", text, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Referral link copied.");
      window.setTimeout(() => setShareNotice(""), 2200);
    } catch {
      setShareNotice("Open Account to copy your referral link.");
    }
  }

  async function installELeague() {
    const result = await requestPwaInstall();
    if (result?.outcome === "accepted" || result?.outcome === "installed") setShareNotice("eLeague installed successfully.");
    else if (result?.outcome === "ios-help") setShareNotice("On iPhone/iPad: Share → Add to Home Screen.");
    else if (result?.outcome !== "dismissed") setShareNotice("Open your browser menu and choose Install eLeague / Add to Home screen.");
    window.setTimeout(() => setShareNotice(""), 3200);
  }

  function openWhatsApp() {
    const number = String(platformSettings.whatsappNumber || "").replace(/\D/g, "");
    if (!number) {
      setShareNotice("eLeague WhatsApp support number has not been added yet.");
      window.setTimeout(() => setShareNotice(""), 2600);
      return;
    }
    window.open(`https://wa.me/${number}?text=${encodeURIComponent("Hi eLeague, I need some help.")}`, "_blank", "noopener,noreferrer");
  }
  function openMessenger() {
    window.open(
      "https://m.me/61594739707285",
      "_blank",
      "noopener,noreferrer"
    );
  }
  function openFacebook() {
    window.open(
      "https://www.facebook.com/share/1PSHyiUayG/",
      "_blank",
      "noopener,noreferrer"
    );
  }


  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="kicker">Competitive gaming • Nepal</span>
            <h1>One wallet.<br /><span>Multiple games.</span></h1>
            <p>Choose your game, create or join a match, pay the entry fee from one eLeague wallet, and receive confirmed winnings back into your balance.</p>
          </div>

          <div className="hero-wallet-card">
            <div className={`wallet-card-topline ${user?.role === "user" ? "has-live-balance" : ""}`}>
              <div className="wallet-brand-row">
                <div className="hero-wallet-icon"><Wallet /></div>
                {user?.role === "user" && <div className="live-balance-copy"><span>Main Wallet</span><strong>{balanceHidden ? "Rs. ••••••" : money(user.walletBalance)}</strong></div>}
              </div>
              {user?.role === "user" && <button type="button" className="balance-visibility-button" onClick={toggleBalance} aria-label={balanceHidden ? "Show wallet balance" : "Hide wallet balance"}>{balanceHidden ? <EyeOff size={20} /> : <Eye size={20} />}</button>}
            </div>
            <span className="meta-label">eLeague wallet</span>
            <strong>Deposit. Play. Win.</strong>
            <p>{user?.role === "user" ? "One balance works across every supported game." : "Admin-verified deposits through eSewa or Khalti."}</p>
            {user?.role === "user" ? <Link to="/wallet" className="text-link">Open wallet</Link> : <Link to="/register" className="text-link">Create account</Link>}
            <div className="mini-stats">
              <div><ShieldCheck size={17} /><span>Verified deposits</span></div>
              <div><CircleDollarSign size={17} /><span>Wallet prizes</span></div>
              <div><Swords size={17} /><span>Multi-game matches</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section games-section">
        <div className="section-head">
          <div><span className="eyebrow">Choose your game</span><h2>Play on eLeague</h2><p>Start with the game you play. Your wallet and account stay the same everywhere.</p></div>
          <Link to="/lobby" className="text-link">View all rooms</Link>
        </div>
        <div className="game-card-grid">
          {GAME_LIST.map((game) => (
            <Link key={game.key} to={`/lobby?game=${game.key}`} className={`game-select-card game-${game.key.toLowerCase().replaceAll("_", "-")}`}>
              <GameLogo game={game} size="card" />
              <div><strong>{game.name}</strong><small>{game.tagline}</small></div>
              <Gamepad2 size={19} />
            </Link>
          ))}
        </div>
      </section>

      <section className="container section connect-section">
        <div className="section-head connect-heading"><div><span className="eyebrow">Stay connected</span><h2>Connect with eLeague</h2></div>{shareNotice && <span className="connect-notice">{shareNotice}</span>}</div>
        <div className="connect-grid">
          <button type="button" className="connect-card" onClick={shareELeague}><span className="connect-icon"><Share2 size={23} /></span><span className="connect-copy"><strong>Share eLeague</strong><small>{user?.role === "user" ? platformSettings.referralProgramEnabled ? `Invite friends and earn ${money(platformSettings.referralRewardAmount ?? 5)} in FP after their first verified deposit.` : "Invite friends with your unique referral link." : "Create an account to get your referral link."}</small></span></button>
          <button type="button" className="connect-card" onClick={openFacebook}><span className="connect-icon facebook">
            <FaFacebook size={25} /></span>
            <span className="connect-copy"><strong>Facebook</strong><small>Follow Us!</small></span></button>


          <button type="button" className="connect-card" onClick={openWhatsApp}><span className="connect-icon whatsapp"><FaWhatsapp size={25} /></span><span className="connect-copy"><strong>WhatsApp</strong><small>Chat with us</small></span></button>
          <button
            type="button"
            className="connect-card"
            onClick={openMessenger}
          >
            <span className="connect-icon messenger">
              <FaFacebookMessenger size={24} />
            </span>

            <span className="connect-copy">
              <strong>Messenger</strong>
              <small>Message us</small>
            </span>
          </button>
          {!pwaState.installed && <button type="button" className="connect-card" onClick={installELeague}><span className="connect-icon"><Download size={23} /></span><span className="connect-copy"><strong>Install eLeague</strong><small>Add eLeague Nepal to your device like an app</small></span></button>}
        </div>
      </section>

      <section className="container section how-section">
        <div className="section-head"><div><span className="eyebrow">Simple flow</span><h2>One wallet, every game</h2></div></div>
        <div className="steps-grid">
          <article><span>01</span><h3>Choose a game</h3><p>Pick eFootball, Free Fire, PUBG Mobile or FC Mobile and browse open rooms.</p></article>
          <article><span>02</span><h3>Deposit</h3><p>Pay through eSewa or Khalti, then submit the amount, transaction ID and screenshot for verification.</p></article>
          <article><span>03</span><h3>Play</h3><p>Create or join a room. The entry fee is taken directly from your available eLeague wallet.</p></article>
          <article><span>04</span><h3>Get settled</h3><p>After the result is confirmed, the prize or refund is credited automatically to the correct wallet.</p></article>
        </div>
      </section>
    </>
  );
}
