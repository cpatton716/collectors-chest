"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and drives a controlled update flow (L-FE19):
 *
 *  - When a new worker finishes installing while an old one still controls the
 *    page, we immediately tell it to skipWaiting so the latest assets take
 *    over rather than waiting for every tab to close.
 *  - On `controllerchange` (the new worker has taken control) we reload once so
 *    the page is served entirely by the new worker — avoiding mixed old/new
 *    asset states. A guard prevents reload loops.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (worker: ServiceWorker | null) => {
      // Only auto-skip when there's already a controller (i.e. this is an
      // update, not the first install) so the very first load isn't reloaded.
      if (worker && navigator.serviceWorker.controller) {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
    };

    let intervalId: ReturnType<typeof setInterval> | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // A worker may already be waiting from a previous visit.
        if (registration.waiting) {
          promptUpdate(registration.waiting);
        }

        // Detect newly-found workers and prompt once they're installed.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              promptUpdate(newWorker);
            }
          });
        });

        // Check for updates periodically (every hour).
        intervalId = setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        );
      })
      .catch((error) => {
        console.error("[SW] Service worker registration failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return <>{children}</>;
}
