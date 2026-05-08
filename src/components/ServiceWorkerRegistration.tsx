"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      // Skip in dev — Next's HMR plays badly with a worker caching layer.
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration failures; the app still works without it.
      });
    };
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
