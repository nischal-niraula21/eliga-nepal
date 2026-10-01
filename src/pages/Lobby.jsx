import { Filter, Plus, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import RoomCard from "../components/RoomCard";
import FilterDropdown from "../components/FilterDropdown";
import { GAME_LIST, gameConfig } from "../config/games";
import { useAuth } from "../context/AuthContext";

export default function Lobby() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedGame = String(searchParams.get("game") || "").toUpperCase();
  const initialGame = GAME_LIST.some((item) => item.key === requestedGame) ? requestedGame : "";
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [game, setGame] = useState(initialGame);
  const [gameMode, setGameMode] = useState("");
  const [matchFormat, setMatchFormat] = useState("");

  useEffect(() => {
    if (game) setSearchParams({ game }, { replace: true });
    else setSearchParams({}, { replace: true });
    setGameMode("");
    setMatchFormat("");
  }, [game, setSearchParams]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = {};
    if (game) params.game = game;
    if (gameMode) params.gameMode = gameMode;
    if (matchFormat) params.matchFormat = matchFormat;

    api.get("/rooms/public", { params, signal: controller.signal })
      .then(({ data }) => active && setRooms(data.rooms || []))
      .catch(() => active && setError("Could not load rooms. Check your connection and try again."))
      .finally(() => active && setLoading(false));

    return () => { active = false; controller.abort(); };
  }, [game, gameMode, matchFormat, retry]);

  const activeGame = game ? gameConfig(game) : null;
  const formatOptions = useMemo(() => {
    const values = activeGame ? activeGame.formats : [...new Set(GAME_LIST.flatMap((item) => item.formats))];
    return [{ value: "", label: "All formats" }, ...values.map((value) => ({ value, label: value.toLowerCase() }))];
  }, [activeGame]);
  const emptyCopy = useMemo(() => game || gameMode || matchFormat ? "No rooms match those filters right now." : "No open rooms right now.", [game, gameMode, matchFormat]);

  return (
    <section className="container page-section lobby-page">
      <div className="section-head lobby-head">
        <div className="lobby-heading-copy">
          <div className="lobby-mobile-label mobile-only"><span className="eyebrow">Lobby play</span></div>
          <div className="lobby-kicker-row">
            <span className="eyebrow lobby-desktop-label">Lobby play</span>
            {user?.role === "user" && <Link to="/matches" className="btn btn-secondary btn-small lobby-matches-button mobile-only"><Trophy size={16} /> Matches</Link>}
            <Link to={user?.role === "user" ? `/create${game ? `?game=${game}` : ""}` : "/login"} className="btn btn-primary btn-small lobby-create-button"><Plus size={16} /> Create room</Link>
          </div>
          <h2>{activeGame ? `${activeGame.name} rooms` : "Available rooms"}</h2>
          <p>Choose a game and find a match that fits your mode, format and wallet balance.</p>
        </div>
        <div className="filters">
          <Filter className="filter-icon" size={17} />
          <FilterDropdown value={game} onChange={setGame} ariaLabel="Filter by game" options={[{ value: "", label: "All games" }, ...GAME_LIST.map((item) => ({ value: item.key, label: item.name }))]} />
          <FilterDropdown value={gameMode} onChange={setGameMode} ariaLabel="Filter by game mode" options={[{ value: "", label: activeGame ? "All modes" : "Choose game for modes" }, ...(activeGame?.modes || []).map((item) => ({ value: item.value, label: item.label }))]} />
          <FilterDropdown value={matchFormat} onChange={setMatchFormat} ariaLabel="Filter by match format" options={formatOptions} />
        </div>
      </div>

      <div className="lobby-game-strip" aria-label="Game shortcuts">
        <button type="button" className={!game ? "active" : ""} onClick={() => setGame("")}>All</button>
        {GAME_LIST.map((item) => <button type="button" key={item.key} className={game === item.key ? "active" : ""} onClick={() => setGame(item.key)}>{item.filterLabel || item.shortName}</button>)}
      </div>

      {loading ? <div className="page-state" role="status">Loading rooms…</div> : error ? (
        <div className="empty-state" role="alert"><h3>{error}</h3><button type="button" className="btn btn-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
      ) : rooms.length ? (
        <div className="room-grid">{rooms.map((room) => {
          const hostId = String(room.host?._id || room.host || "");
          const userId = String(user?._id || "");
          return <RoomCard key={room._id} room={room} mine={Boolean(userId && hostId === userId)} />;
        })}</div>
      ) : <div className="empty-state"><h3>{emptyCopy}</h3><p>Only rooms waiting for a challenger appear here.</p></div>}
    </section>
  );
}
