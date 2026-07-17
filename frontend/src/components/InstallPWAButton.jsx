import React, { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LS_DISMISSED_KEY = "vk_pwa_install_dismissed_at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Install-PWA prompt.
 *
 * Chrome/Edge fire a `beforeinstallprompt` event when the app satisfies
 * PWA install criteria (manifest + SW + served over HTTPS). We capture it
 * and expose our own branded "Asenna sovellus" button, giving users a
 * more prominent, on-brand install path than the address-bar hint.
 *
 * On iOS Safari there is no such event — Apple requires the user to
 * manually "Add to Home Screen" via the share sheet. For those users we
 * render a lightweight instruction banner instead.
 *
 * The banner is dismissable and hidden for 14 days after dismiss. It is
 * ALWAYS hidden once the app is running in `display-mode: standalone`
 * (i.e. already installed).
 */
export default function InstallPWAButton() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 1. Detect if we're already running as an installed PWA — hide.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // 2. Detect iOS — Safari doesn't fire beforeinstallprompt.
    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(iOS);

    // 3. Respect a recent user dismiss (14 days).
    const dismissedAt = Number(localStorage.getItem(LS_DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    // 4. Wait for beforeinstallprompt on Chrome/Android/Edge/desktop.
    const onBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // 5. Optimistically show iOS instructions after a short delay if the
    // browser is Safari and we have no BIP event (which we won't on iOS).
    let timeoutId;
    if (iOS) {
      timeoutId = setTimeout(() => setVisible(true), 4000);
    }

    // 6. Hide immediately if the browser reports "appinstalled".
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(LS_DISMISSED_KEY, String(Date.now()));
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setVisible(false);
      } else {
        handleDismiss();
      }
    } catch {
      // some browsers block prompt() if user gesture was lost
    } finally {
      setDeferredPrompt(null);
    }
  }

  if (isStandalone || !visible) return null;

  return (
    <div
      data-testid="pwa-install-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 carved-card rounded-sm p-4 shadow-2xl bg-viking-surface/95 backdrop-blur border-viking-gold/50"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("pwa.dismiss")}
        data-testid="pwa-install-dismiss"
        className="absolute top-2 right-2 text-viking-stone hover:text-viking-bone p-1"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-viking-gold/15 flex items-center justify-center">
          <Smartphone className="text-viking-gold" size={20} />
        </div>
        <div className="flex-1 pr-6">
          <div className="text-overline text-viking-gold mb-1 text-[10px]">
            {t("pwa.eyebrow")}
          </div>
          <h3 className="font-serif text-base text-viking-bone leading-snug mb-1">
            {t("pwa.title")}
          </h3>
          {isIOS ? (
            <p className="text-xs text-viking-stone leading-relaxed">
              {t("pwa.ios_hint")}
            </p>
          ) : (
            <>
              <p className="text-xs text-viking-stone leading-relaxed mb-3">
                {t("pwa.body")}
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                data-testid="pwa-install-accept"
                className="inline-flex items-center gap-1.5 bg-viking-ember hover:bg-viking-ember/90 text-viking-bone text-sm px-4 py-2 rounded-sm font-rune tracking-[0.15em] uppercase text-[10px] transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {t("pwa.install")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
