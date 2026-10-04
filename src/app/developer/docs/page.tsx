"use client";

/**
 * NAI DEVELOPER DOCUMENTATION
 * Interface Scalar integrada via IFrame para consumo das APIs v3.3.
 */

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DeveloperDocsPage() {
  return (
    <div className="min-h-screen bg-[#050811] flex flex-col">
      <header className="h-16 border-b border-white/5 bg-[#050811] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/developer"
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
            NAI Developer Hub Docs
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <BadgeCheck className="size-4 text-emerald-500" />
          <span className="text-[10px] font-black uppercase text-emerald-500/60">
            API v3.3 Live
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <iframe
          src="/api/docs"
          className="w-full h-full border-none min-h-[85vh]"
          title="NAI API Reference"
        />
      </div>
    </div>
  );
}

function BadgeCheck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
