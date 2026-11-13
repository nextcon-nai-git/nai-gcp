"use client";

import * as React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { offlineStorage } from "@/lib/offline-storage";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";

export function OfflineSyncBadge() {
  const { user } = useUser();
  const { activeClientId } = useSgi();
  return (
    <ScopedOfflineBadge
      key={JSON.stringify([user?.uid, activeClientId])}
      userId={user?.uid || ""}
      companyId={activeClientId}
    />
  );
}
function ScopedOfflineBadge({ userId, companyId }: { userId: string; companyId: string }) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState<number | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    const scope = { userId, companyId };
    let current = true;
    const refresh = async (notify = false) => {
      try {
        const count = await offlineStorage.getPendingCount(scope);
        if (!current) return;
        setPendingCount(count);
        if (notify && count > 0)
          toast({
            title: "Conexão restabelecida",
            description: `${count} registros continuam salvos neste dispositivo. O envio à nuvem está pendente; nenhum registro foi removido.`,
          });
      } catch {
        if (current) setPendingCount(null);
      }
    };
    void refresh();
    const handleOnline = () => {
      setIsOnline(true);
      void refresh(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        variant: "destructive",
        title: "Modo Offline Ativado",
        description:
          "Sem conexão à internet. Os registros salvos neste dispositivo permanecem pendentes de envio.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      void refresh();
    }, 4000);

    return () => {
      current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [toast, userId, companyId]);

  if (!isOnline) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono gap-1 px-2 py-0.5 animate-pulse">
        <WifiOff className="size-3" /> Offline{" "}
        {pendingCount === null
          ? " · pendências indisponíveis"
          : pendingCount > 0
            ? `(${pendingCount})`
            : ""}
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono gap-1 px-2 py-0.5 hidden sm:inline-flex">
      <Wifi className="size-3" /> Online
      {pendingCount === null
        ? " · pendências indisponíveis"
        : pendingCount > 0
          ? ` · ${pendingCount} pendentes`
          : ""}
    </Badge>
  );
}
