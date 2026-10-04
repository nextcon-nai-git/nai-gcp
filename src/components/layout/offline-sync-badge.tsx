"use client";

import * as React from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { offlineStorage } from "@/lib/offline-storage";
import { useToast } from "@/hooks/use-toast";

export function OfflineSyncBadge() {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    setPendingCount(offlineStorage.getPendingCount());

    const handleOnline = () => {
      setIsOnline(true);
      const count = offlineStorage.getPendingCount();
      if (count > 0) {
        setIsSyncing(true);
        setTimeout(() => {
          offlineStorage.clearQueue();
          setPendingCount(0);
          setIsSyncing(false);
          toast({
            title: "Sincronização Concluída! 🚀",
            description: `${count} registros gravados offline foram sincronizados com a nuvem e processados pelo Gemini 3.8.`,
          });
        }, 1500);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        variant: "destructive",
        title: "Modo Offline Ativado",
        description:
          "Sem conexão à internet. Suas vistorias e checklists serão salvos no dispositivo e sincronizados depois.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      setPendingCount(offlineStorage.getPendingCount());
    }, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [toast]);

  if (isSyncing) {
    return (
      <Badge className="bg-sky-500/20 text-sky-400 border border-sky-500/40 text-[10px] font-mono gap-1 px-2 py-0.5">
        <RefreshCw className="size-3 animate-spin" /> Sincronizando...
      </Badge>
    );
  }

  if (!isOnline) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono gap-1 px-2 py-0.5 animate-pulse">
        <WifiOff className="size-3" /> Offline {pendingCount > 0 ? `(${pendingCount})` : ""}
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono gap-1 px-2 py-0.5 hidden sm:inline-flex">
      <Wifi className="size-3" /> Online
    </Badge>
  );
}
