import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Slim top-of-page banner that appears when the browser reports it is
 * offline. Complements the service worker's cache fallbacks — the SW keeps
 * the app functional, this banner just tells the user why they're seeing
 * possibly-stale data.
 */
export default function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      data-testid="offline-banner"
      role="status"
      aria-live="polite"
      className="w-full bg-viking-ember/95 text-viking-bone text-sm py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-40"
    >
      <WifiOff size={14} />
      <span>{t("pwa.offline_banner")}</span>
    </div>
  );
}
