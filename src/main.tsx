import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function start() {
  // Clear the old PWA controller once: an updated APK can otherwise serve the obsolete 2D bundle.
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => /workbox|soniclab/i.test(key))
          .map((key) => caches.delete(key)),
      );
    }
    if (
      navigator.serviceWorker.controller &&
      !sessionStorage.getItem("soniclab-orbit-migrated")
    ) {
      sessionStorage.setItem("soniclab-orbit-migrated", "1");
      location.reload();
      return;
    }
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
start().catch(() =>
  createRoot(document.getElementById("root")!).render(<App />),
);
