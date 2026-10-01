import { Ban, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDollarSign, ExternalLink, Eye, Gift, ImageUp, Megaphone, MessageCircle, Pencil, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, Trash2, UserRoundCog, Users, Wallet, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import api, { fileUrl } from "../api/client";
import GameLogo from "../components/GameLogo";
import { modeLabel, money, shortDate, statusLabel } from "../utils/format";
import { GAME_LIST, gameConfig } from "../config/games";

export default function Admin() {
  const [tab, setTab] = useState("deposits");
  const [summary, setSummary] = useState({});
  const [deposits, setDeposits] = useState([]); const [withdrawals, setWithdrawals] = useState([]); const [players, setPlayers] = useState([]); const [disputes, setDisputes] = useState([]); const [rooms, setRooms] = useState([]); const [announcements, setAnnouncements] = useState([]); const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [playerPage, setPlayerPage] = useState(1); const [playerLimit, setPlayerLimit] = useState(25); const [playerTotal, setPlayerTotal] = useState(0); const [playerPages, setPlayerPages] = useState(1);

  const loadSummary = useCallback(async () => { const { data } = await api.get("/admin/summary"); setSummary(data); }, []);
  const loadTab = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (tab === "deposits") setDeposits((await api.get("/admin/deposits", { params: { status: "PENDING" } })).data.deposits || []);
      if (tab === "withdrawals") setWithdrawals((await api.get("/admin/withdrawals", { params: { status: "PENDING" } })).data.withdrawals || []);
      if (tab === "players") {
        const { data } = await api.get("/admin/players", { params: { ...(search ? { search } : {}), page: playerPage, limit: playerLimit } });
        setPlayers(data.players || []);
        setPlayerTotal(Number(data.pagination?.total || 0));
        setPlayerPages(Math.max(1, Number(data.pagination?.pages || 1)));
        if (data.pagination?.page && Number(data.pagination.page) !== playerPage) setPlayerPage(Number(data.pagination.page));
      }
      if (tab === "disputes") setDisputes((await api.get("/admin/disputes")).data.results || []);
      if (tab === "rooms") setRooms((await api.get("/admin/rooms")).data.rooms || []);
      if (tab === "announcements") setAnnouncements((await api.get("/admin/announcements")).data.announcements || []);
      if (tab === "settings") setSettings((await api.get("/admin/settings")).data.settings);
    } catch (err) { setError(err.response?.data?.message || "Could not load admin data."); }
    finally { setLoading(false); }
  }, [tab, search, playerPage, playerLimit]);

  useEffect(() => { loadSummary().catch(() => {}); }, [loadSummary]);
  useEffect(() => { loadTab(); }, [loadTab]);

  async function refreshAll(success = "") { setMessage(success); await Promise.all([loadSummary(), loadTab()]); }
  async function reviewDeposit(id, action) {
    const reason = action === "REJECT" ? (window.prompt("Reason for rejecting this deposit:") || "") : "";
    if (action === "REJECT" && !reason) return;
    try { await api.patch(`/admin/deposits/${id}`, { action, reason }); await refreshAll(action === "VERIFY" ? "Deposit verified and wallet credited." : "Deposit rejected."); }
    catch (err) { setError(err.response?.data?.message || "Could not review deposit."); }
  }
  async function resolveDispute(id, finalOutcome, hostScore, challengerScore) {
    if (!window.confirm("Resolve this dispute with the selected result? Wallet settlement happens immediately.")) return;
    try {
      await api.patch(`/admin/results/${id}/resolve`, { finalOutcome, hostScore, challengerScore });
      await refreshAll("Dispute resolved and wallet settlement completed.");
    }
    catch (err) { setError(err.response?.data?.message || "Could not resolve dispute."); }
  }
  async function saveSettings(e, qrFiles = {}) {
    e.preventDefault();
    setError("");
    try {
      const formData = new FormData();
      formData.append("settings", JSON.stringify(settings));
      if (qrFiles.esewa) formData.append("esewaQr", qrFiles.esewa);
      if (qrFiles.khalti) formData.append("khaltiQr", qrFiles.khalti);
      const { data } = await api.patch("/admin/settings", formData);
      setSettings(data.settings);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save settings.");
    }
  }

  return <section className="container page-section admin-page">
    <div className="page-title-row"><div><span className="eyebrow">Control center</span><h1>Admin Dashboard</h1><p>Manage wallet requests, players, rooms, disputes, announcements and platform rules from one place.</p></div><button className="btn btn-secondary" onClick={() => Promise.all([loadSummary(), loadTab()])}><RefreshCw size={17} /> Refresh</button></div>

    <div className="admin-stats">
      <Stat icon={<CircleDollarSign />} label="Deposits" value={summary.pendingDeposits || 0} />
      <Stat icon={<Wallet />} label="Withdrawals" value={summary.pendingWithdrawals || 0} />
      <Stat icon={<ShieldAlert />} label="Disputes" value={summary.disputes || 0} />
      <Stat icon={<Users />} label="Players" value={summary.users || 0} />
      <Stat icon={<Ban />} label="Blocked" value={summary.blockedUsers || 0} />
      <Stat icon={<ShieldCheck />} label="Main Wallet liability" value={money(summary.walletLiability || 0)} />
      <Stat icon={<Gift />} label="FP Wallet balance" value={money(summary.fpBalanceTotal || 0)} />
    </div>

    <div className="admin-tabs">
      <button className={tab === "deposits" ? "active" : ""} onClick={() => setTab("deposits")}>Deposit requests <span>{summary.pendingDeposits || 0}</span></button>
      <button className={tab === "withdrawals" ? "active" : ""} onClick={() => setTab("withdrawals")}>Withdrawal requests <span>{summary.pendingWithdrawals || 0}</span></button>
      <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>Players</button>
      <button className={tab === "disputes" ? "active" : ""} onClick={() => setTab("disputes")}>Disputes <span>{summary.disputes || 0}</span></button>
      <button className={tab === "rooms" ? "active" : ""} onClick={() => setTab("rooms")}>Rooms</button>
      <button className={tab === "announcements" ? "active" : ""} onClick={() => setTab("announcements")}><Megaphone size={14} /> Announcements</button>
      <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Settings</button>
    </div>

    {message && <div className="flash success">{message}</div>}{error && <div className="flash danger">{error}</div>}
    {loading ? <div className="page-state">Loading…</div> : <>
      {tab === "deposits" && <Deposits items={deposits} onReview={reviewDeposit} />}
      {tab === "withdrawals" && <Withdrawals items={withdrawals} onDone={refreshAll} setError={setError} />}
      {tab === "players" && <Players items={players} search={search} setSearch={setSearch} reload={loadTab} setMessage={setMessage} setError={setError} page={playerPage} setPage={setPlayerPage} limit={playerLimit} setLimit={setPlayerLimit} total={playerTotal} pages={playerPages} />}
      {tab === "disputes" && <Disputes items={disputes} onResolve={resolveDispute} />}
      {tab === "rooms" && <Rooms items={rooms} />}
      {tab === "announcements" && <Announcements items={announcements} reload={loadTab} setMessage={setMessage} setError={setError} />}
      {tab === "settings" && settings && <Settings settings={settings} setSettings={setSettings} onSubmit={saveSettings} />}
    </>}
  </section>;
}

function Stat({ icon, label, value }) { return <article className="admin-stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>; }

function playerGames(user) {
  const profiles = user?.gameProfiles || [];
  if (profiles.length) return profiles.map((item) => `${gameConfig(item.game).shortName}: ${item.username || item.playerId || "connected"}`).join(" · ");
  return user?.efootballUsername ? `eFootball: ${user.efootballUsername}` : "No game accounts connected";
}

function firstGameIdentity(user) {
  const profile = user?.gameProfiles?.find((item) => item.username || item.playerId);
  return profile?.username || profile?.playerId || user?.efootballUsername || user?.name || "eLeague player";
}

function idOf(value) { return String(value?._id || value || ""); }

function outcomeLabel(outcome, room) {
  if (outcome === "HOST_WIN") return `${room?.hostGameUsername || "Host"} won`;
  if (outcome === "CHALLENGER_WIN") return `${room?.challengerGameUsername || "Challenger"} won`;
  if (outcome === "DRAW") return "Draw";
  if (outcome === "VOID") return "Void / refund";
  return "Not decided";
}

function opponentForResult(result, room) {
  const submitterId = idOf(result?.submittedBy);
  if (!room) return null;
  return submitterId === idOf(room.host) ? room.challenger : room.host;
}

function Deposits({ items, onReview }) {
  if (!items.length) return <Empty title="No deposit requests" text="New deposit proofs will appear here." />;
  return <div className="admin-list">{items.map((item) => <article className="panel admin-item" key={item._id}><div className="admin-item-main"><div><span className="eyebrow">{item.method} deposit</span><h3>{item.user?.name}</h3><p>{item.user?.email} · {playerGames(item.user)}</p></div><div className="admin-amount"><span>Requested</span><b>{money(item.amount)}</b><code>{item.transactionId}</code></div></div><div className="admin-detail-grid"><div><span>Current wallet</span><b>{money(item.user?.walletBalance)}</b></div><div><span>Submitted</span><b>{shortDate(item.createdAt)}</b></div></div><div className="admin-proof-row"><a className="evidence-link" href={fileUrl(item.screenshotUrl)} target="_blank" rel="noreferrer">View payment screenshot</a><div className="button-row"><button className="btn btn-danger-soft" onClick={() => onReview(item._id, "REJECT")}><X size={17} /> Reject</button><button className="btn btn-primary" onClick={() => onReview(item._id, "VERIFY")}><Check size={17} /> Verify & credit</button></div></div></article>)}</div>;
}

function Withdrawals({ items, onDone, setError }) {
  if (!items.length) return <Empty title="No withdrawal requests" text="Player withdrawal requests will appear here." />;
  return <div className="admin-list">{items.map((item) => <WithdrawalCard key={item._id} item={item} onDone={onDone} setError={setError} />)}</div>;
}

function WithdrawalCard({ item, onDone, setError }) {
  const [transactionId, setTransactionId] = useState(""); const [screenshot, setScreenshot] = useState(null); const [loading, setLoading] = useState(false);
  async function approve() {
    if (!transactionId.trim()) return setError("Enter the payout transaction ID before approving the withdrawal.");
    try { setLoading(true); const form = new FormData(); form.append("action", "APPROVE"); form.append("transactionId", transactionId); if (screenshot) form.append("screenshot", screenshot); await api.patch(`/admin/withdrawals/${item._id}`, form, { headers: { "Content-Type": "multipart/form-data" } }); await onDone("Withdrawal marked paid and reserved balance deducted."); }
    catch (err) { setError(err.response?.data?.message || "Could not approve withdrawal."); }
    finally { setLoading(false); }
  }
  async function reject() {
    const reason = window.prompt("Reason for rejecting this withdrawal:"); if (!reason) return;
    try { setLoading(true); const form = new FormData(); form.append("action", "REJECT"); form.append("reason", reason); await api.patch(`/admin/withdrawals/${item._id}`, form); await onDone("Withdrawal rejected and reserved money returned to wallet."); }
    catch (err) { setError(err.response?.data?.message || "Could not reject withdrawal."); }
    finally { setLoading(false); }
  }
  return <article className="panel admin-item"><div className="admin-item-main"><div><span className="eyebrow">{item.method} withdrawal</span><h3>{item.user?.name}</h3><p>{item.user?.email} · {playerGames(item.user)}</p></div><div className="admin-amount"><span>Withdraw</span><b>{money(item.amount)}</b><small>{item.accountName} · {item.accountNumber}</small></div></div><div className="admin-detail-grid"><div><span>Available wallet</span><b>{money(item.user?.walletBalance)}</b></div><div><span>Reserved</span><b>{money(item.user?.walletHeld)}</b></div></div><div className="two-col"><div className="field"><label>Your payout transaction ID</label><input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Enter after sending payment" /></div><div className="field"><label>Payout screenshot (optional)</label><label className="upload-field compact"><span>{screenshot ? screenshot.name : "Choose image"}</span><input hidden type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} /></label></div></div><div className="button-row"><button className="btn btn-danger-soft" onClick={reject} disabled={loading}>Reject & return</button><button className="btn btn-primary" onClick={approve} disabled={loading}>Mark paid</button></div></article>;
}

function Players({ items, search, setSearch, reload, setMessage, setError, page, setPage, limit, setLimit, total, pages }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => {
    if (!selectedPlayer) return;
    const fresh = items.find((item) => item._id === selectedPlayer._id);
    if (fresh) setSelectedPlayer(fresh);
  }, [items]);

  const first = total ? ((page - 1) * limit) + 1 : 0;
  const last = total ? Math.min(page * limit, total) : 0;

  return <>
    <div className="players-toolbar">
      <form className="admin-search players-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
        <Search size={18} />
        <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search name, email, username or player ID" />
        {searchDraft && <button type="button" className="player-search-clear" aria-label="Clear player search" onClick={() => { setSearchDraft(""); setPage(1); setSearch(""); }}><X size={15} /></button>}
        <button className="btn btn-secondary btn-small">Search</button>
      </form>
      <div className="players-page-size">
        <span>Show</span>
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <span>players</span>
      </div>
      <span className="players-count">Showing {first}-{last} of {total}</span>
    </div>

    {items.length ? <>
      <div className="admin-table-wrap players-table-wrap">
        <table className="admin-table players-table">
          <thead><tr><th>Player</th><th>Email</th><th>Games</th><th>Wallet</th><th>Deposited</th><th>Withdrawn</th><th>Referrals</th><th>Status</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {items.map((player) => {
              const financialStats = player.financialStats || {};
              const referralStats = player.referralStats || {};
              return <tr key={player._id} className={`player-table-row ${player.isBlocked ? "blocked" : ""}`} tabIndex="0" role="button" onClick={() => setSelectedPlayer(player)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPlayer(player); } }}>
                <td><div className="player-table-identity"><strong>{firstGameIdentity(player)}</strong><small>{player.name}</small></div></td>
                <td><span className="player-table-email">{player.email}</span></td>
                <td><GameAccountPills player={player} compact /></td>
                <td><strong className="wallet-cell">{money(player.walletBalance)} Main</strong><small className="table-subline">{money(player.fpWalletBalance || 0)} FP</small>{Number(player.walletHeld || 0) > 0 && <small className="table-subline">Held {money(player.walletHeld)}</small>}</td>
                <td><strong className="money-positive">{money(financialStats.totalDeposited || 0)}</strong><small className="table-subline">{financialStats.depositCount || 0} verified</small></td>
                <td><strong>{money(financialStats.totalWithdrawn || 0)}</strong><small className="table-subline">{financialStats.withdrawalCount || 0} paid</small></td>
                <td><strong>{referralStats.totalCount || 0}</strong><small className="table-subline">{referralStats.successfulCount || 0} successful</small></td>
                <td><span className={`player-status-chip ${player.isBlocked ? "blocked" : "active"}`}>{player.isBlocked ? "Blocked" : "Active"}</span></td>
                <td>{shortDate(player.createdAt)}</td>
                <td><button type="button" className="player-view-button" onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}><Eye size={16} /> View</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="players-pagination">
        <button className="btn btn-secondary btn-small" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={16} /> Previous</button>
        <span>Page <b>{page}</b> of <b>{pages}</b></span>
        <button className="btn btn-secondary btn-small" disabled={page >= pages} onClick={() => setPage(Math.min(pages, page + 1))}>Next <ChevronRight size={16} /></button>
      </div>
    </> : <Empty title="No players found" text="Try a different search." />}

    {selectedPlayer && <PlayerDetailDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(null)} reload={reload} setMessage={setMessage} setError={setError} />}
  </>;
}

function GameAccountPills({ player, compact = false }) {
  const profiles = player?.gameProfiles || [];
  const normalized = profiles.length ? profiles : (player?.efootballUsername ? [{ game: "EFOOTBALL", username: player.efootballUsername }] : []);
  if (!normalized.length) return <span className="game-account-empty">None</span>;
  return <div className={`admin-game-pills ${compact ? "compact" : ""}`}>
    {normalized.map((profile, index) => {
      const game = gameConfig(profile.game || "EFOOTBALL");
      return <span className="admin-game-pill" key={`${profile.game || "EFOOTBALL"}-${index}`} title={`${game.name}: ${profile.username || profile.playerId || "Connected"}`}>
        {!compact && <GameLogo game={game} size="tiny" />}
        {game.shortName}
      </span>;
    })}
  </div>;
}

function PlayerDetailDrawer({ player, onClose, reload, setMessage, setError }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [livePlayer, setLivePlayer] = useState(player);
  const stats = livePlayer.referralStats || { totalCount: 0, successfulCount: 0, pendingCount: 0, totalEarned: 0 };
  const financialStats = livePlayer.financialStats || { totalDeposited: 0, depositCount: 0, totalWithdrawn: 0, withdrawalCount: 0 };

  useEffect(() => { setLivePlayer(player); }, [player]);
  useEffect(() => {
    function onKeyDown(event) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function adjust(action) {
    try {
      setBusy(true);
      const { data } = await api.patch(`/admin/players/${livePlayer._id}/wallet`, { action, amount, reason });
      setLivePlayer((current) => ({ ...current, walletBalance: data.user?.walletBalance ?? current.walletBalance, walletHeld: data.user?.walletHeld ?? current.walletHeld }));
      setAmount(""); setReason("");
      setMessage(action === "CREDIT" ? "Wallet balance added." : "Wallet balance deducted.");
      await reload();
    } catch (err) { setError(err.response?.data?.message || "Could not adjust wallet."); }
    finally { setBusy(false); }
  }

  async function toggleBlock() {
    const blocked = !livePlayer.isBlocked;
    const reasonText = blocked ? window.prompt("Why are you blocking this player?", "Account blocked by eLeague admin.") : "";
    if (blocked && reasonText === null) return;
    try {
      setBusy(true);
      const { data } = await api.patch(`/admin/players/${livePlayer._id}/block`, { blocked, reason: reasonText });
      setLivePlayer((current) => ({ ...current, isBlocked: data.player?.isBlocked ?? blocked, blockReason: data.player?.blockReason ?? reasonText }));
      setMessage(blocked ? "Player blocked." : "Player unblocked.");
      await reload();
    } catch (err) { setError(err.response?.data?.message || "Could not update player."); }
    finally { setBusy(false); }
  }

  async function toggleReferrals() {
    if (showReferrals) { setShowReferrals(false); return; }
    setShowReferrals(true);
    if (referralData) return;
    try {
      setReferralLoading(true);
      const { data } = await api.get(`/admin/players/${livePlayer._id}/referrals`);
      setReferralData(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load referral details.");
      setShowReferrals(false);
    } finally { setReferralLoading(false); }
  }

  const profiles = livePlayer.gameProfiles?.length ? livePlayer.gameProfiles : (livePlayer.efootballUsername ? [{ game: "EFOOTBALL", username: livePlayer.efootballUsername }] : []);

  return <div className="player-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="player-drawer" role="dialog" aria-modal="true" aria-label={`Player details for ${livePlayer.name}`}>
      <div className="player-drawer-head">
        <div><span className="eyebrow">Player details</span><h2>{livePlayer.name}</h2><p>{livePlayer.email}</p></div>
        <button className="player-drawer-close" type="button" onClick={onClose} aria-label="Close player details"><X size={20} /></button>
      </div>

      <div className="player-drawer-body">
        <div className="player-detail-topline">
          <span className={`player-status-chip ${livePlayer.isBlocked ? "blocked" : "active"}`}>{livePlayer.isBlocked ? "Blocked" : "Active"}</span>
          <span>Joined {shortDate(livePlayer.createdAt)}</span>
        </div>
        {livePlayer.isBlocked && <div className="flash danger compact">{livePlayer.blockReason || "Account blocked."}</div>}

        <section className="player-detail-section">
          <h3>Wallet & payments</h3>
          <div className="player-detail-stats">
            <div><span>Main Wallet</span><b>{money(livePlayer.walletBalance)}</b></div>
            <div><span>FP Wallet</span><b>{money(livePlayer.fpWalletBalance || 0)}</b><small>Room entry only</small></div>
            <div><span>Reserved</span><b>{money(livePlayer.walletHeld)}</b></div>
            <div><span>Total deposited</span><b>{money(financialStats.totalDeposited)}</b><small>{financialStats.depositCount} verified</small></div>
            <div><span>Total withdrawn</span><b>{money(financialStats.totalWithdrawn)}</b><small>{financialStats.withdrawalCount} paid</small></div>
          </div>
        </section>

        <section className="player-detail-section">
          <h3>Connected games</h3>
          {profiles.length ? <div className="player-game-accounts">
            {profiles.map((profile, index) => {
              const game = gameConfig(profile.game || "EFOOTBALL");
              return <div className="player-game-account" key={`${profile.game || "EFOOTBALL"}-${index}`}>
                <GameLogo game={game} size="small" />
                <div><strong>{game.name}</strong><span>{profile.username || "No username"}</span>{profile.playerId && <small>ID: {profile.playerId}</small>}</div>
              </div>;
            })}
          </div> : <div className="game-account-empty large">No game accounts connected.</div>}
        </section>

        <section className="player-detail-section">
          <div className="player-detail-section-head"><h3>Referral program</h3><span>{livePlayer.referralCode || "No code"}</span></div>
          <div className="player-detail-stats referral">
            <div><span>Total</span><b>{stats.totalCount}</b></div>
            <div><span>Successful</span><b>{stats.successfulCount}</b></div>
            <div><span>Pending</span><b>{stats.pendingCount}</b></div>
            <div><span>Rewards</span><b>{money(stats.totalEarned)}</b></div>
          </div>
          <button className="btn btn-secondary btn-small" type="button" onClick={toggleReferrals}>
            {showReferrals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showReferrals ? "Hide referrals" : `View referrals (${stats.totalCount})`}
          </button>
          {showReferrals && <div className="admin-referral-details">
            {referralLoading ? <div className="page-state compact">Loading referrals…</div> : referralData?.referrals?.length ? <div className="admin-referral-list">
              {referralData.referrals.map((referral) => <div className="admin-referral-row" key={referral._id}>
                <div><b>{firstGameIdentity(referral.referredUser)}</b><span>{referral.referredUser?.name || "Unknown player"} · {referral.referredUser?.email || "No email"}</span><small>Joined referral: {shortDate(referral.createdAt)}</small></div>
                <div className="admin-referral-row-side"><span className={`referral-row-status ${referral.status === "REWARDED" ? "success" : "pending"}`}>{referral.status === "REWARDED" ? "SUCCESSFUL" : "PENDING"}</span>{referral.status === "REWARDED" && <small>Reward: {money(referral.rewardAmount)} · {referral.rewardWalletType === "FP" ? "FP Wallet" : "Main Wallet"}</small>}</div>
              </div>)}
            </div> : <div className="referral-empty">This player has not referred anyone yet.</div>}
          </div>}
        </section>

        <section className="player-detail-section">
          <h3>Main Wallet adjustment</h3>
          <div className="wallet-adjust player-drawer-wallet-adjust">
            <div className="field"><label>Amount</label><input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Rs." /></div>
            <div className="field grow"><label>Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for audit history" /></div>
            <div className="button-row"><button className="btn btn-secondary btn-small" disabled={busy || !amount || !reason.trim()} onClick={() => adjust("CREDIT")}>+ Add</button><button className="btn btn-secondary btn-small" disabled={busy || !amount || !reason.trim()} onClick={() => adjust("DEBIT")}>− Deduct</button></div>
          </div>
        </section>

        <section className="player-detail-section danger-zone">
          <div><h3>Account access</h3><p>{livePlayer.isBlocked ? "Restore this player's access to eLeague." : "Blocking prevents the player from using protected platform features."}</p></div>
          <button className={`btn btn-small ${livePlayer.isBlocked ? "btn-secondary" : "btn-danger-soft"}`} disabled={busy} onClick={toggleBlock}>{livePlayer.isBlocked ? <ShieldCheck size={16} /> : <Ban size={16} />} {livePlayer.isBlocked ? "Unblock player" : "Block player"}</button>
        </section>
      </div>
    </aside>
  </div>;
}

function Disputes({ items, onResolve }) {
  if (!items.length) return <Empty title="No active disputes" text="Disputed results will appear here." />;
  return <div className="admin-list">{items.map((result) => <DisputeCard key={result._id} result={result} onResolve={onResolve} />)}</div>;
}

function DisputeCard({ result, onResolve }) {
  const room = result.room;
  const opponent = result.disputedBy || opponentForResult(result, room);
  const [hostScore, setHostScore] = useState(result.hostScore ?? 0);
  const [challengerScore, setChallengerScore] = useState(result.challengerScore ?? 0);

  return <article className="panel admin-item dispute-admin-card">
    <div className="admin-item-main">
      <div>
        <span className="eyebrow">Result dispute</span>
        <h3>{room?.roomCode}</h3>
        <p>{room?.hostGameUsername} vs {room?.challengerGameUsername}</p>
      </div>
      <div className="admin-amount">
        <span className="admin-game-inline"><GameLogo game={gameConfig(room?.game || "EFOOTBALL")} size="tiny" />{gameConfig(room?.game || "EFOOTBALL").name} · {modeLabel(room?.gameMode, room?.game)} · {room?.matchFormat?.toLowerCase()}</span>
        <b>{money(room?.entryFee)} / side</b>
      </div>
    </div>

    <div className="admin-evidence-grid">
      <section className="admin-evidence-card">
        <div className="admin-evidence-head">
          <div><small>Player 1 claim</small><strong>{outcomeLabel(result.claimedOutcome, room)}</strong></div>
          <span>{result.hostScore} - {result.challengerScore}</span>
        </div>
        <p>Submitted by <b>{result.submittedBy?.name || result.submittedBy?.email || "Player"}</b> · {shortDate(result.createdAt)}</p>
        {result.screenshotUrl ? <a className="admin-evidence-preview" href={fileUrl(result.screenshotUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(result.screenshotUrl)} alt="Submitted result evidence" /><span>Open full evidence</span></a> : <div className="admin-no-evidence">No result screenshot stored.</div>}
      </section>

      <section className="admin-evidence-card disputed">
        <div className="admin-evidence-head">
          <div><small>Opponent claim</small><strong>{outcomeLabel(result.disputeOutcome, room)}</strong></div>
          <span>{result.disputeHostScore ?? "—"} - {result.disputeChallengerScore ?? "—"}</span>
        </div>
        <p>Disputed by <b>{opponent?.name || opponent?.email || "Opponent"}</b>{result.disputedAt ? ` · ${shortDate(result.disputedAt)}` : ""}</p>
        <div className="admin-dispute-reason"><small>Reason</small><p>{result.disputeReason || "No reason supplied."}</p></div>
        {result.disputeScreenshotUrl ? <a className="admin-evidence-preview" href={fileUrl(result.disputeScreenshotUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(result.disputeScreenshotUrl)} alt="Dispute evidence" /><span>Open full evidence</span></a> : <div className="admin-no-evidence">No opponent screenshot stored.</div>}
      </section>
    </div>

    <div className="admin-final-score-row">
      <div><span>Final score after review</span><small>Change these only if the evidence shows a different score.</small></div>
      <div className="admin-score-inputs"><label>{room?.hostGameUsername}<input type="number" min="0" max="9999" value={hostScore} onChange={(e) => setHostScore(e.target.value)} /></label><span>—</span><label>{room?.challengerGameUsername}<input type="number" min="0" max="9999" value={challengerScore} onChange={(e) => setChallengerScore(e.target.value)} /></label></div>
    </div>

    <div className="button-row wrap">
      <button className="btn btn-secondary" onClick={() => onResolve(result._id, "HOST_WIN", hostScore, challengerScore)}>{room?.hostGameUsername} won</button>
      <button className="btn btn-secondary" onClick={() => onResolve(result._id, "CHALLENGER_WIN", hostScore, challengerScore)}>{room?.challengerGameUsername} won</button>
      <button className="btn btn-secondary" onClick={() => onResolve(result._id, "DRAW", hostScore, challengerScore)}>Draw</button>
      <button className="btn btn-danger-soft" onClick={() => onResolve(result._id, "VOID", hostScore, challengerScore)}>Void & refund</button>
    </div>
  </article>;
}

function Rooms({ items }) {
  const [game, setGame] = useState("");
  const [expandedRoom, setExpandedRoom] = useState("");
  const filtered = game ? items.filter((room) => (room.game || "EFOOTBALL") === game) : items;
  if (!items.length) return <Empty title="No rooms yet" text="Platform rooms will appear here." />;

  return <>
    <div className="admin-room-filter"><label>Game</label><select value={game} onChange={(e) => setGame(e.target.value)}><option value="">All games</option>{GAME_LIST.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></div>
    <div className="admin-table-wrap"><table className="admin-table admin-room-table"><thead><tr><th>Room</th><th>Game</th><th>Mode</th><th>Host</th><th>Challenger</th><th>Entry</th><th>Prize</th><th>Status</th><th>Result</th></tr></thead><tbody>{filtered.map((room) => {
      const isOpen = expandedRoom === room._id;
      return <Fragment key={room._id}><tr><td><b>{room.roomCode}</b></td><td><span className="admin-game-inline"><GameLogo game={gameConfig(room.game || "EFOOTBALL")} size="tiny" />{gameConfig(room.game || "EFOOTBALL").name}</span></td><td>{modeLabel(room.gameMode, room.game)} · {room.matchFormat?.toLowerCase()}</td><td>{room.hostGameUsername}</td><td>{room.challengerGameUsername || "—"}</td><td>{money(room.entryFee)}</td><td>{money(room.prizeAmount)}</td><td>{statusLabel(room.status)}</td><td>{room.result ? <button className="admin-result-toggle" onClick={() => setExpandedRoom(isOpen ? "" : room._id)}>{isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {isOpen ? "Hide" : "View result"}</button> : <span className="admin-result-empty">No result</span>}</td></tr>{isOpen && room.result && <tr className="admin-result-row"><td colSpan="9"><RoomResultDetails room={room} /></td></tr>}</Fragment>;
    })}</tbody></table></div>
  </>;
}

function RoomResultDetails({ room }) {
  const result = room.result;
  const opponent = result.disputedBy || opponentForResult(result, room);
  return <div className="admin-room-result-details">
    <div className="admin-room-result-summary">
      <div><span>Submitted claim</span><strong>{outcomeLabel(result.claimedOutcome, room)}</strong><small>{result.hostScore} - {result.challengerScore}</small></div>
      <div><span>Submitted by</span><strong>{result.submittedBy?.name || result.submittedBy?.email || "Player"}</strong><small>{shortDate(result.createdAt)}</small></div>
      <div><span>Opponent response</span><strong>{result.opponentResponse || "PENDING"}</strong><small>{statusLabel(result.status)}</small></div>
      <div><span>Final result</span><strong>{result.finalOutcome ? outcomeLabel(result.finalOutcome, room) : "Not settled"}</strong><small>{result.resolvedAt ? shortDate(result.resolvedAt) : "—"}</small></div>
    </div>
    <div className="admin-evidence-grid compact">
      <section className="admin-evidence-card">
        <small>Submitted evidence</small>
        {result.screenshotUrl ? <a className="admin-evidence-preview" href={fileUrl(result.screenshotUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(result.screenshotUrl)} alt="Result evidence" /><span>Open full evidence</span></a> : <div className="admin-no-evidence">No screenshot stored.</div>}
      </section>
      {result.opponentResponse === "DISPUTED" && <section className="admin-evidence-card disputed"><small>Dispute from {opponent?.name || opponent?.email || "opponent"}</small><strong>{outcomeLabel(result.disputeOutcome, room)} · {result.disputeHostScore ?? "—"} - {result.disputeChallengerScore ?? "—"}</strong><p>{result.disputeReason || "No reason supplied."}</p>{result.disputeScreenshotUrl ? <a className="admin-evidence-preview" href={fileUrl(result.disputeScreenshotUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(result.disputeScreenshotUrl)} alt="Dispute evidence" /><span>Open opponent evidence</span></a> : <div className="admin-no-evidence">No opponent screenshot stored.</div>}</section>}
    </div>
  </div>;
}


function Announcements({ items, reload, setMessage, setError }) {
  const emptyDraft = () => ({ image: null, linkUrl: "", audience: "ALL", startsAt: "", expiresAt: "", displayOrder: "0", isActive: true });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function resetForm() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setDraft(emptyDraft());
    setEditingId("");
  }

  function selectImage(file) {
    setDraft((current) => ({ ...current, image: file || null }));
    setPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : "";
    });
  }

  function startEdit(item) {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setEditingId(item._id);
    setDraft({
      image: null,
      linkUrl: item.linkUrl || "",
      audience: item.audience || "ALL",
      startsAt: toLocalInput(item.startsAt),
      expiresAt: toLocalInput(item.expiresAt),
      displayOrder: String(item.displayOrder ?? 0),
      isActive: Boolean(item.isActive)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event) {
    event.preventDefault();
    if (!editingId && !draft.image) {
      setError("Upload an announcement image.");
      return;
    }
    try {
      setBusy(true); setError("");
      const formData = new FormData();
      if (draft.image) formData.append("image", draft.image);
      formData.append("linkUrl", draft.linkUrl.trim());
      formData.append("audience", draft.audience);
      formData.append("startsAt", draft.startsAt ? new Date(draft.startsAt).toISOString() : "");
      formData.append("expiresAt", draft.expiresAt ? new Date(draft.expiresAt).toISOString() : "");
      formData.append("displayOrder", draft.displayOrder || "0");
      formData.append("isActive", String(draft.isActive));
      if (editingId) await api.patch(`/admin/announcements/${editingId}`, formData);
      else await api.post("/admin/announcements", formData);
      setMessage(editingId ? "Announcement updated." : "Announcement created.");
      resetForm();
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save announcement.");
    } finally { setBusy(false); }
  }

  async function toggle(item) {
    try {
      setError("");
      const formData = new FormData();
      formData.append("isActive", String(!item.isActive));
      await api.patch(`/admin/announcements/${item._id}`, formData);
      setMessage(item.isActive ? "Announcement disabled." : "Announcement enabled.");
      await reload();
    } catch (err) { setError(err.response?.data?.message || "Could not update announcement."); }
  }

  async function remove(item) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    try {
      setError("");
      await api.delete(`/admin/announcements/${item._id}`);
      if (editingId === item._id) resetForm();
      setMessage("Announcement deleted.");
      await reload();
    } catch (err) { setError(err.response?.data?.message || "Could not delete announcement."); }
  }

  const currentImage = previewUrl || (editingId ? fileUrl(items.find((item) => item._id === editingId)?.imageUrl || "") : "");

  return <div className="announcements-admin-grid">
    <form className="panel form-stack announcement-form" onSubmit={submit}>
      <div className="panel-heading"><div><span className="eyebrow">Player popup</span><h2>{editingId ? "Edit announcement" : "Create announcement"}</h2><p>Upload an image. Add a link only when clicking the image should open somewhere.</p></div><Megaphone size={21} /></div>

      <div className="field">
        <label>Popup image {editingId ? "(optional replacement)" : ""}</label>
        <label className="upload-field announcement-upload-field">
          <ImageUp size={19} />
          <span>{draft.image?.name || (editingId ? "Replace current image" : "Upload announcement image")}</span>
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => selectImage(e.target.files?.[0] || null)} />
        </label>
        <small>PNG, JPG or WebP · maximum 5 MB.</small>
      </div>

      {currentImage && <div className="announcement-form-preview"><img src={currentImage} alt="Announcement preview" /></div>}

      <div className="field"><label>Follow-up link <span className="optional-label">Optional</span></label><input type="text" value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} placeholder="https://facebook.com/... or /lobby" /><small>The whole announcement image becomes clickable when a link is added.</small></div>

      <div className="two-col announcement-fields">
        <div className="field"><label>Audience</label><select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}><option value="ALL">Everyone</option><option value="LOGGED_IN">Logged-in players</option><option value="NEW_SIGNUPS">New signups</option></select><small>New signups means accounts created after this announcement begins.</small></div>
        <div className="field"><label>Display order</label><input type="number" min="0" max="9999" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })} /><small>Lower numbers are shown first.</small></div>
      </div>

      <div className="two-col announcement-fields">
        <div className="field"><label>Starts at <span className="optional-label">Optional</span></label><input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></div>
        <div className="field"><label>Expires at <span className="optional-label">Optional</span></label><input type="datetime-local" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} /></div>
      </div>

      <label className="announcement-active-toggle"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /><span><b>Active</b><small>Inactive announcements stay saved but never appear to players.</small></span></label>

      <div className="button-row wrap">
        <button className="btn btn-primary" disabled={busy}><Save size={17} /> {busy ? "Saving…" : editingId ? "Save changes" : "Publish announcement"}</button>
        {editingId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel edit</button>}
      </div>
    </form>

    <div className="announcement-list-panel">
      <div className="announcement-list-head"><div><span className="eyebrow">Manage popups</span><h2>Announcements</h2></div><span>{items.length} total</span></div>
      {items.length ? <div className="announcement-admin-list">{items.map((item) => <article className={`announcement-admin-card ${item.isActive ? "" : "inactive"}`} key={item._id}>
        <div className="announcement-admin-image"><img src={fileUrl(item.imageUrl)} alt="Announcement" />{item.linkUrl && <span className="announcement-linked-badge"><ExternalLink size={12} /> Linked</span>}</div>
        <div className="announcement-admin-copy">
          <div className="announcement-admin-meta"><span className={`player-status-chip ${item.isActive ? "active" : "blocked"}`}>{item.isActive ? "Active" : "Inactive"}</span><span>{announcementAudienceLabel(item.audience)}</span><span>Order {item.displayOrder ?? 0}</span></div>
          <div className="announcement-schedule"><span>Starts: <b>{item.startsAt ? shortDate(item.startsAt) : "Immediately"}</b></span><span>Expires: <b>{item.expiresAt ? shortDate(item.expiresAt) : "No expiry"}</b></span></div>
          {item.linkUrl && <a className="announcement-admin-link" href={item.linkUrl} target={/^https?:\/\//i.test(item.linkUrl) ? "_blank" : undefined} rel="noreferrer">{item.linkUrl}<ExternalLink size={13} /></a>}
          <div className="button-row wrap announcement-actions"><button type="button" className="btn btn-secondary btn-small" onClick={() => window.open(fileUrl(item.imageUrl), "_blank", "noopener,noreferrer")}><Eye size={15} /> Preview</button><button type="button" className="btn btn-secondary btn-small" onClick={() => startEdit(item)}><Pencil size={15} /> Edit</button><button type="button" className="btn btn-secondary btn-small" onClick={() => toggle(item)}>{item.isActive ? "Disable" : "Enable"}</button><button type="button" className="btn btn-danger-soft btn-small" onClick={() => remove(item)}><Trash2 size={15} /> Delete</button></div>
        </div>
      </article>)}</div> : <Empty title="No announcements yet" text="Create the first popup announcement for eLeague players." />}
    </div>
  </div>;
}

function announcementAudienceLabel(value) {
  if (value === "LOGGED_IN") return "Logged-in players";
  if (value === "NEW_SIGNUPS") return "New signups";
  return "Everyone";
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function Settings({ settings, setSettings, onSubmit }) {
  const [qrFiles, setQrFiles] = useState({ esewa: null, khalti: null });
  const [previewUrls, setPreviewUrls] = useState({ esewa: "", khalti: "" });

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  function method(key, field, value) {
    setSettings((current) => ({
      ...current,
      paymentMethods: {
        ...current.paymentMethods,
        [key]: { ...current.paymentMethods[key], [field]: value }
      }
    }));
  }

  function selectQr(key, file) {
    setQrFiles((current) => ({ ...current, [key]: file || null }));
    setPreviewUrls((current) => {
      if (current[key]?.startsWith("blob:")) URL.revokeObjectURL(current[key]);
      return { ...current, [key]: file ? URL.createObjectURL(file) : "" };
    });
  }

  async function submit(e) {
    await onSubmit(e, qrFiles);
    setQrFiles({ esewa: null, khalti: null });
    setPreviewUrls((current) => {
      Object.values(current).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      return { esewa: "", khalti: "" };
    });
  }

  return <form className="panel form-stack settings-panel" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">Platform rules</span><h2>Settings</h2></div><UserRoundCog size={21} /></div>
    <div className="settings-section"><h3>Match wallet rules</h3><div className="three-col"><Field label="Minimum entry" value={settings.minEntryFee} onChange={(v) => setSettings({ ...settings, minEntryFee: v })} /><Field label="Maximum entry" value={settings.maxEntryFee} onChange={(v) => setSettings({ ...settings, maxEntryFee: v })} /><Field label="Platform fee %" value={settings.commissionPercent} onChange={(v) => setSettings({ ...settings, commissionPercent: v })} /></div></div>
    <div className="settings-section"><h3>Wallet limits</h3><div className="four-col"><Field label="Min deposit" value={settings.minDeposit} onChange={(v) => setSettings({ ...settings, minDeposit: v })} /><Field label="Max deposit" value={settings.maxDeposit} onChange={(v) => setSettings({ ...settings, maxDeposit: v })} /><Field label="Min withdrawal" value={settings.minWithdrawal} onChange={(v) => setSettings({ ...settings, minWithdrawal: v })} /><Field label="Max withdrawal" value={settings.maxWithdrawal} onChange={(v) => setSettings({ ...settings, maxWithdrawal: v })} /></div></div>
    <div className="settings-section">
      <div className="settings-section-title"><div><Gift size={18} /><h3>Referral program</h3></div><label className="settings-toggle"><input type="checkbox" checked={Boolean(settings.referralProgramEnabled)} onChange={(e) => setSettings({ ...settings, referralProgramEnabled: e.target.checked })} /><span>{settings.referralProgramEnabled ? "Enabled" : "Disabled"}</span></label></div>
      <div className="two-col">
        <Field label="Reward per successful referral" value={settings.referralRewardAmount ?? 5} onChange={(v) => setSettings({ ...settings, referralRewardAmount: v })} />
        <div className="field"><label>WhatsApp support number</label><div className="settings-icon-input"><MessageCircle size={17} /><input value={settings.whatsappNumber || ""} onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })} placeholder="97798XXXXXXXX" /></div><small>Use country code. This powers the Chat with us button on the home page.</small></div>
      </div>
      <p className="settings-help">New referral rewards go to FP Wallet after the referred player's first admin-verified deposit. FP entry requires four successful referrals and enough FP for the full entry fee. Four rewards of Rs. 5 cover an entry of Rs. 20; a higher minimum entry needs more FP. Admin wallet credits do not qualify.</p>
    </div>
    {[["esewa", "eSewa"], ["khalti", "Khalti"]].map(([key, label]) => {
      const currentQr = previewUrls[key] || settings.paymentMethods?.[key]?.qrUrl || "";
      return <div className="settings-section" key={key}>
        <h3>{label} deposit details</h3>
        <div className="three-col payment-settings-grid">
          <div className="field"><label>Account name</label><input value={settings.paymentMethods?.[key]?.accountName || ""} onChange={(e) => method(key, "accountName", e.target.value)} /></div>
          <div className="field"><label>Account number</label><input value={settings.paymentMethods?.[key]?.accountNumber || ""} onChange={(e) => method(key, "accountNumber", e.target.value)} /></div>
          <div className="field">
            <label>Payment QR image</label>
            <label className="upload-field qr-upload-field">
              <ImageUp size={18} />
              <span>{qrFiles[key]?.name || (settings.paymentMethods?.[key]?.qrUrl ? "Replace QR image" : "Upload QR image")}</span>
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => selectQr(key, e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        {currentQr && <div className="admin-qr-preview"><img src={currentQr.startsWith("blob:") ? currentQr : fileUrl(currentQr)} alt={`${label} payment QR preview`} /><div><b>{qrFiles[key] ? "New QR selected" : "Current QR image"}</b><span>{qrFiles[key] ? "Save settings to upload and use this image." : "Upload another image above to replace it."}</span></div></div>}
        <div className="field"><label>Payment note</label><input value={settings.paymentMethods?.[key]?.note || ""} onChange={(e) => method(key, "note", e.target.value)} placeholder="Optional payment instructions" /></div>
      </div>;
    })}
    <button className="btn btn-primary"><Save size={17} /> Save settings</button>
  </form>;
}
function Field({ label, value, onChange }) { return <div className="field"><label>{label}</label><input type="number" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Empty({ title, text }) { return <div className="empty-state"><h3>{title}</h3><p>{text}</p></div>; }
