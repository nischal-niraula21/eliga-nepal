let deferredInstallPrompt = null;
let installAvailable = false;

function emitInstallState() {
  window.dispatchEvent(new CustomEvent("eliga:pwa-state", { detail: getInstallState() }));
}

export function isStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function getInstallState() {
  return {
    available: installAvailable,
    installed: isStandaloneMode(),
    ios: isIOSDevice()
  };
}

export async function requestPwaInstall() {
  if (isStandaloneMode()) return { outcome: "installed" };

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAvailable = false;
    emitInstallState();
    return choice;
  }

  if (isIOSDevice()) return { outcome: "ios-help" };
  return { outcome: "unavailable" };
}

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAvailable = true;
    emitInstallState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installAvailable = false;
    localStorage.setItem("eliga_pwa_installed", "1");
    emitInstallState();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js?v=4.5").catch((error) => {
        console.warn("eLeague service worker registration failed", error);
      });
    });
  }
}
