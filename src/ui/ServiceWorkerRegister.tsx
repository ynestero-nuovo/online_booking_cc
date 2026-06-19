"use client";

import { useEffect } from "react";

/** Реєструє service worker у браузері (no-op на сервері/без підтримки). */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Реєстрація не критична — застосунок працює і без офлайн-кешу.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
