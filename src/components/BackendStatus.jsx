import { useSyncExternalStore } from "react";
import { backend } from "../api/client";

export default function BackendStatus() {
  const status = useSyncExternalStore(backend.subscribe, backend.getStatus);
  if (!["connecting", "unavailable"].includes(status)) return null;
  const unavailable = status === "unavailable";

  return (
    <div className={`backend-status ${unavailable ? "error" : ""}`} role="status">
      <span>{unavailable
        ? "Could not connect to eLeague. Check your connection, then reload to try again."
        : "Connecting to eLeague… The first connection may take about a minute."}</span>
      {unavailable && <button type="button" onClick={() => window.location.reload()}>Reload</button>}
    </div>
  );
}
