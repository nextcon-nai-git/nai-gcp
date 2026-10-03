"use client";

import * as React from "react";

export function NextconLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 450 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Texto: NEXTCON - Estilo Bold Montserrat Style */}
      <text
        x="0"
        y="75"
        fill="currentColor"
        style={{ font: "900 85px Montserrat, sans-serif", letterSpacing: "-3px" }}
      >
        NEXTCON
      </text>

      {/* Texto: Inteligência NAI em SST - Estilo Sóbrio 2026 */}
      <text
        x="5"
        y="108"
        fill="#334155"
        style={{
          font: "700 26px Montserrat, sans-serif",
          letterSpacing: "1px",
          textTransform: "uppercase",
          filter: "drop-shadow(0 0 2px rgba(51,65,85,0.2))",
        }}
      >
        NAI • Intelligence 2026
      </text>
    </svg>
  );
}
