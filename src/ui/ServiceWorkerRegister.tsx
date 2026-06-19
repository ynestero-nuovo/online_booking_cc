"use client";

import { useEffect } from "react";

/** Реєструє service worker у браузері (no-op на сервері/без підтримки). */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // У дев-режимі SW лише заважає (кешує старі бандли) → знімаємо реєстрацію
    // та чистимо кеші, щоб завжди була свіжа збірка.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

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
