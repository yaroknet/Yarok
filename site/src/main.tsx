import React from "react";
import { createRoot } from "react-dom/client";

// Register Service Worker for offline support (production only)
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // Service Worker registered successfully

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New content is available, prompt user to refresh
                // New content is available, user will see update on next visit
              }
            });
          }
        });

        // Cache important pages after registration
        if (registration.active) {
          registration.active.postMessage({
            type: "CACHE_PAGES",
            pages: ["/fleet", "/fleet/vehicles", "/fleet/drivers", "/fleet/tasks", "/auth"],
          });
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    });
  } else {
    // In dev/preview, SW caching can cause stale module chunks and hook errors.
    window.addEventListener("load", async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {
        console.warn("Failed to cleanup service workers/caches in dev:", e);
      }
    });
  }
}

// The employees area (Yarok 360) has its own routes and styles; load only the section being visited
const isEmployeesArea = /^\/employees(\/|$)/.test(window.location.pathname);

const container = document.getElementById("root");
if (container) {
  if (isEmployeesArea) {
    import("./employees/main");
  } else {
    // A failing sub-import in the stylesheet (e.g. a web font) must not keep the site from rendering
    const styles = import("./index.css").catch((err) => console.warn("Stylesheet loaded with errors:", err));
    Promise.all([import("./App.tsx"), styles]).then(([{ default: App }]) => {
      createRoot(container).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
  }
}
