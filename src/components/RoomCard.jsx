import { ArrowUpRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { gameConfig } from "../config/games";
import GameLogo from "./GameLogo";
import { formatLabel, modeLabel, money } from "../utils/format";

export default function RoomCard({ room, mine = false }) {
  const game = gameConfig(room.game || "EFOOTBALL");
  return (
    <article className="room-card">
      <div className="room-card-head">
        <div className="room-code-stack"><span className="game-badge"><GameLogo game={game} size="tiny" />{game.shortName}</span><span className="room-code">{room.roomCode}</span></div>
        <div className="tags"><span className="tag tag-purple">{modeLabel(room.gameMode, room.game)}</span><span className="tag">{formatLabel(room.matchFormat)}</span></div>
      </div>

      <div className="matchup">
        <div><span className="meta-label">Host</span><strong>{room.hostGameUsername}</strong></div>
        <span className="versus">VS</span>
        <div className="align-right"><span className="meta-label">Challenger</span><strong>{room.challengerGameUsername || "Waiting"}</strong></div>
      </div>

      <div className="room-values">
        <div><span>Entry / side</span><b>{money(room.entryFee)}</b></div>
        <div><span>Winner gets</span><b className="prize-value"><Trophy size={16} /> {money(room.prizeAmount)}</b></div>
      </div>

      <Link className={`btn btn-full ${mine ? "btn-secondary" : "btn-primary"}`} to={mine ? `/rooms/${room._id}` : `/join/${room._id}`}>
        {mine ? "View your room" : `Join ${game.shortName}`} <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}
