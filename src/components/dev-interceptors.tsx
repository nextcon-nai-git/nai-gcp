"use client";

import { useEffect } from "react";

/**
 * DevInterceptors Component
 * Intercepta ruídos de HMR/Dev/Firestore e registra o ServiceWorker do PWA.
 * Organizado como componente cliente limpo para a arquitetura Next.js App Router.
 */
export function DevInterceptors() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Intercepta e filtra logs de erro de asserção interna do Firestore SDK
    const origError = console.error;
    console.error = function (...args: any[]) {
      const fullMsg = args
        .map((a) => {
          if (!a) return "";
          if (typeof a === "object") {
            try {
              return JSON.stringify(a);
            } catch (e) {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" ");

      if (
        fullMsg.includes("FIRESTORE") ||
        fullMsg.includes("ca9") ||
        fullMsg.includes("permission-denied") ||
        fullMsg.includes("INTERNAL ASSERTION FAILED") ||
        fullMsg.includes("Unexpected state")
      ) {
        console.warn("[NAI Stability Shield - Intercepted Firestore Noise]", fullMsg.slice(0, 150));
        return;
      }
      origError.apply(console, args);
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason ? String(e.reason.message || e.reason) : "";
      if (reason.includes("FIRESTORE") || reason.includes("ca9")) {
        e.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Registro do ServiceWorker para PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        () => {},
        (err) => console.warn("NAI PWA: Falha ao registrar ServiceWorker:", err)
      );
    }

    return () => {
      console.error = origError;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
