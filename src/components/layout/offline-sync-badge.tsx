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
  const [pendingCount, setPendingCount] = React.useState(0);
  const { toast } = useToast();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    const scope = { userId, companyId };
    setPendingCount(offlineStorage.getPendingCount(scope));

    const handleOnline = () => {
      setIsOnline(true);
      const count = offlineStorage.getPendingCount(scope);
      setPendingCount(count);
      if (count > 0) {
        setPendingCount(count);
        toast({
          title: "Conexão restabelecida",
          description: `${count} registros continuam salvos neste dispositivo. O envio à nuvem está pendente; nenhum registro foi removido.`,
        });
      }
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
      setPendingCount(offlineStorage.getPendingCount(scope));
    }, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [toast, userId, companyId]);

  if (!isOnline) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono gap-1 px-2 py-0.5 animate-pulse">
        <WifiOff className="size-3" /> Offline {pendingCount > 0 ? `(${pendingCount})` : ""}
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono gap-1 px-2 py-0.5 hidden sm:inline-flex">
      <Wifi className="size-3" /> Online{pendingCount > 0 ? ` · ${pendingCount} pendentes` : ""}
    </Badge>
  );
}
