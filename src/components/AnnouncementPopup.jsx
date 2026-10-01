import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import api, { fileUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

const SESSION_KEY = "eliga_dismissed_announcements";

function dismissedIds() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id) {
  const next = new Set(dismissedIds());
  next.add(String(id));
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...next].slice(-100)));
}

export default function AnnouncementPopup() {
  const { user, loading } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const userKey = user?._id || "guest";

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    api.get("/announcements/active")
      .then(({ data }) => {
        if (cancelled) return;
        const dismissed = new Set(dismissedIds());
        const next = (data.announcements || []).find((item) => !dismissed.has(String(item._id)));
        setAnnouncement(next || null);
      })
      .catch(() => {
        if (!cancelled) setAnnouncement(null);
      });

    return () => { cancelled = true; };
  }, [loading, userKey]);

  useEffect(() => {
    if (!announcement) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [announcement]);

  const link = useMemo(() => String(announcement?.linkUrl || "").trim(), [announcement]);
  const isExternal = /^https?:\/\//i.test(link);

  function close() {
    if (announcement?._id) rememberDismissed(announcement._id);
    setAnnouncement(null);
  }

  function image() {
    const content = <img src={fileUrl(announcement.imageUrl)} alt="eLeague announcement" />;
    if (!link) return content;
    return <a
      className="announcement-popup-link"
      href={link}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={close}
      aria-label="Open announcement link"
    >{content}</a>;
  }

  if (!announcement) return null;

  return <div className="announcement-popup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="announcement-popup" role="dialog" aria-modal="true" aria-label="eLeague announcement">
      <button type="button" className="announcement-popup-close" onClick={close} aria-label="Close announcement"><X size={20} /></button>
      {image()}
    </div>
  </div>;
}
