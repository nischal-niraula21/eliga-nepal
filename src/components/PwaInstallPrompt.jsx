import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstallState, requestPwaInstall } from "../pwa";

function shouldShowAutomaticPrompt(state) {
  if (state.installed) return false;
  if (sessionStorage.getItem("eliga_pwa_prompt_dismissed") === "1") return false;
  return state.available || state.ios;
}

export default function PwaInstallPrompt({ manualOpen = false, onClose }) {
  const [state, setState] = useState(() => getInstallState());
  const [open, setOpen] = useState(() => manualOpen || shouldShowAutomaticPrompt(getInstallState()));
  const [message, setMessage] = useState("");

  useEffect(() => {
    const update = (event) => {
      const next = event?.detail || getInstallState();
      setState(next);
      if (!next.installed && !manualOpen && shouldShowAutomaticPrompt(next)) {
        window.setTimeout(() => setOpen(true), 700);
      }
      if (next.installed) setOpen(false);
    };
    window.addEventListener("eliga:pwa-state", update);
    return () => window.removeEventListener("eliga:pwa-state", update);
  }, [manualOpen]);

  useEffect(() => {
    if (manualOpen) setOpen(true);
  }, [manualOpen]);

  function close() {
    setOpen(false);
    if (!manualOpen) sessionStorage.setItem("eliga_pwa_prompt_dismissed", "1");
    onClose?.();
  }

  async function install() {
    const result = await requestPwaInstall();
    if (result?.outcome === "accepted" || result?.outcome === "installed") {
      setOpen(false);
      onClose?.();
      return;
    }
    if (result?.outcome === "ios-help") {
      setMessage("On iPhone/iPad: tap Share in Safari, then choose Add to Home Screen.");
      return;
    }
    if (result?.outcome !== "dismissed") {
      setMessage("Open your browser menu and choose Install eLeague or Add to Home screen.");
    }
  }

  if (!open || state.installed) return null;

  return (
    <div className="pwa-install-popover" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <button type="button" className="pwa-install-close" onClick={close} aria-label="Close install prompt"><X size={17} /></button>
      <div className="pwa-install-brand">
        <img src="/pwa-192.png" alt="" />
        <div>
          <span>INSTALL APP</span>
          <h3 id="pwa-install-title">Install eLeague Nepal</h3>
        </div>
      </div>
      <p>Get the app-like eLeague experience directly from your home screen.</p>
      {message && <div className="pwa-install-help">{state.ios ? <Share2 size={16} /> : <Smartphone size={16} />}<span>{message}</span></div>}
      <div className="pwa-install-actions">
        <button type="button" className="ghost-button" onClick={close}>Not now</button>
        <button type="button" className="btn btn-primary" onClick={install}><Download size={17} /> Install</button>
      </div>
    </div>
  );
}
