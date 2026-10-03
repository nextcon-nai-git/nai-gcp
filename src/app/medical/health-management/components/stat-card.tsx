"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl group hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      <CardContent className="p-6 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
          <Icon className="size-24" />
        </div>
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div
            className={cn(
              "p-3.5 rounded-2xl transition-colors duration-300",
              bg,
              color,
              "group-hover:bg-primary group-hover:text-white"
            )}
          >
            <Icon className="size-6" />
          </div>
          <Badge
            variant="outline"
            className="text-[8px] font-black uppercase text-primary border-primary/20 bg-primary/5 animate-pulse"
          >
            Live
          </Badge>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">
            {label}
          </p>
          <h3 className={cn("text-3xl font-black leading-none tracking-tight", color)}>{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
