"use client";

import * as React from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CalendarSyncButtonProps {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location?: string;
}

/**
 * Componente para sincronização manual de consultas com calendários externos.
 */
export function CalendarSyncButton({
  title,
  description,
  startDate,
  endDate,
  location,
}: CalendarSyncButtonProps) {
  const formatForGoogle = () => {
    const start = new Date(startDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(endDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location || "")}`;
  };

  const formatForOutlook = () => {
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${start}&enddt=${end}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location || "")}`;
  };

  const handleSync = (type: "google" | "outlook") => {
    const url = type === "google" ? formatForGoogle() : formatForOutlook();
    window.open(url, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 gap-2 text-slate-400 hover:text-primary rounded-xl border border-transparent hover:border-slate-100"
        >
          <CalendarPlus className="size-3.5" />
          <span className="text-[9px] font-black uppercase">Sincronizar</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
        <DropdownMenuItem
          onClick={() => handleSync("google")}
          className="gap-2 text-[10px] font-bold py-3 cursor-pointer"
        >
          <div className="size-2 rounded-full bg-blue-500" /> Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSync("outlook")}
          className="gap-2 text-[10px] font-bold py-3 cursor-pointer"
        >
          <div className="size-2 rounded-full bg-sky-600" /> Outlook / Hotmail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
