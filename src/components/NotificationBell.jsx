import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { money, shortDate } from "../utils/format";

function methodLabel(method) {
  return method === "ESEWA" ? "eSewa" : method === "KHALTI" ? "Khalti" : method || "eLeague";
}

function itemTitle(item) {
  if (item.title) return item.title;
  if (item.type === "DEPOSIT") return `Deposit request for ${money(item.amount)}`;
  if (item.type === "WITHDRAWAL") return `Withdrawal request for ${money(item.amount)}`;
  if (item.type === "ADMIN_CREDIT") return `Admin added ${money(item.amount)} to your wallet`;
  if (item.type === "ADMIN_DEBIT") return `Admin deducted ${money(item.amount)} from your wallet`;
  if (item.type === "ENTRY_FEE") return `Entry fee paid: ${money(item.amount)}`;
  if (item.type === "PRIZE") return `Match prize won: ${money(item.amount)}`;
  if (item.type === "REFUND") return `Entry fee refunded: ${money(item.amount)}`;
  return "eLeague account update";
}

function itemMeta(item) {
  const date = shortDate(item.createdAt);
  if (item.type === "DEPOSIT" || item.type === "WITHDRAWAL") {
    return `${methodLabel(item.method)}${date ? ` · ${date}` : ""}`;
  }
  return date;
}

function statusClass(status = "") {
  const value = status.toUpperCase();
  if (["VERIFIED", "WON", "REFUNDED", "ADDED", "RESTORED", "RESOLVED", "REWARDED"].includes(value)) return "success";
  if (["REJECTED", "DEDUCTED", "BLOCKED", "PAID"].includes(value)) return "danger";
  return "pending";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/wallet/notifications");
      setItems(data.items || []);
    } catch {
      // Keep the navigation usable if the notification request fails.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  }

  return (
    <div className="notification-wrap" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell ${open ? "active" : ""}`}
        onClick={toggle}
        aria-label="Account notifications"
        aria-expanded={open}
      >
        <Bell size={18} />
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head">
            <div><span className="eyebrow">Account activity</span><h3>Notifications</h3></div>
          </div>

          {loading && !items.length ? (
            <div className="notification-empty">Loading notifications…</div>
          ) : items.length ? (
            <div className="notification-list">
              {items.map((item) => (
                <div className="notification-row" key={item.id}>
                  <div className="notification-copy">
                    <b>{itemTitle(item)}</b>
                    <span>{itemMeta(item)}</span>
                    {item.detail && <small>{item.detail}</small>}
                  </div>
                  <span className={`notification-status ${statusClass(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="notification-empty">No account activity yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
