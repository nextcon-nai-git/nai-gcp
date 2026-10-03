"use client";

import * as React from "react";

/**
 * Error boundary de nível global (HTML Root).
 * Fornece recuperação segura para falhas críticas no motor da plataforma.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const handleReset = () => {
    // Fallback robusto caso a função reset não tenha sido injetada pelo Next.js
    if (reset && typeof reset === "function") {
      try {
        reset();
      } catch (e) {
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Fatal Platform Crash:", error);
    }
  }, [error]);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-[#003366] text-white flex flex-col items-center justify-center h-screen p-10 text-center font-sans">
        <div className="space-y-6 max-w-lg animate-in fade-in duration-700">
          <div className="size-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter font-headline">
            Falha Crítica NAI
          </h1>
          <div className="space-y-2">
            <p className="opacity-70 font-medium leading-relaxed text-sm">
              Detectamos uma instabilidade no motor de sincronização de dados ou permissões.
            </p>
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">
              <p className="text-[10px] font-mono text-white/40 truncate">
                {error?.message || "Erro desconhecido na sincronização"}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="bg-slate-700 text-white font-black uppercase text-xs py-4 px-10 rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            Reiniciar Engine Nextcon
          </button>
        </div>
      </body>
    </html>
  );
}
