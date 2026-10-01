import { statusLabel } from "../utils/format";

export default function StatusBadge({ status }) {
  const tone = status === "OPEN" || status === "READY" || status === "COMPLETED"
    ? "success"
    : status === "DISPUTED" || status === "CANCELLED"
      ? "danger"
      : "neutral";
  return <span className={`status-badge ${tone}`}>{statusLabel(status)}</span>;
}
