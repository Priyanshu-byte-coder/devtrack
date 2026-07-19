"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const registerServiceWorker = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("DevTrack service worker registration failed", error);
      });
    };

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker, { once: true });
      }
    }

    const refreshCachedDashboardData = () => {
      navigator.serviceWorker?.controller?.postMessage({
        type: "DEVTRACK_REFRESH_CACHES",
      });
    };

    const handleOnline = () => {
      setIsOffline(false);
      refreshCachedDashboardData();

      window.setTimeout(() => {
        window.location.reload();
      }, 750);
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-6 py-2.5 backdrop-blur-md shadow-lg shadow-amber-500/10 transition-all animate-in slide-in-from-bottom-4 duration-300">
        <div className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
        </div>
        <p className="text-sm font-semibold text-amber-500">
          Offline — showing cached data
        </p>
      </div>
    </div>
  );
}
