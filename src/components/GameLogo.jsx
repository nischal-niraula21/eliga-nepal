import { useState } from "react";

export default function GameLogo({ game, size = "small", className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!game) return null;

  return (
    <span className={`game-logo game-logo-${size} ${className}`.trim()} aria-hidden="true">
      {!failed && game.logoUrl ? (
        <img src={game.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="game-logo-fallback">{game.mark}</span>
      )}
    </span>
  );
}
