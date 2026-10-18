/**
 * @fileOverview NAI Offline-First Engine & Background Sync
 * Permite que técnicos de segurança e engenheiros operem em canteiros de obras
 * e subsolos sem conexão 4G/5G, salvando dados localmente no iPhone e sincronizando
 * automaticamente assim que a conexão com a internet for restabelecida.
 */

export interface PendingOfflineItem {
  id: string;
  type: "FIELD_INSPECTION" | "CHECKLIST_NR" | "EPI_DELIVERY";
  data: any;
  timestamp: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
}

export interface OfflineScope {
  userId: string;
  companyId: string;
}
function storageKey(scope?: OfflineScope): string | null {
  if (
    !scope?.userId?.trim() ||
    !scope.companyId?.trim() ||
    ["all", "unauthorized"].includes(scope.companyId)
  )
    return null;
  return `nai_offline_queue_v2:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.companyId)}`;
}

export const offlineStorage = {
  getQueue(scope?: OfflineScope): PendingOfflineItem[] {
    if (typeof window === "undefined") return [];
    const key = storageKey(scope);
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items)
        ? items.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              ["PENDING", "SYNCING", "SYNCED", "ERROR"].includes(item.status)
          )
        : [];
    } catch {
      return [];
    }
  },

  addItem(type: PendingOfflineItem["type"], data: any, scope: OfflineScope): PendingOfflineItem {
    const key = storageKey(scope);
    if (!key) throw new Error("Selecione uma conta e empresa para salvar a cópia local.");
    const queue = this.getQueue(scope);
    const newItem: PendingOfflineItem = {
      id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      status: "PENDING",
    };
    queue.push(newItem);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(queue));
    }
    return newItem;
  },

  removeItem(id: string, scope?: OfflineScope) {
    if (typeof window === "undefined") return;
    const key = storageKey(scope);
    if (!key) return;
    const queue = this.getQueue(scope).filter((i) => i.id !== id);
    localStorage.setItem(key, JSON.stringify(queue));
  },

  clearQueue(scope?: OfflineScope) {
    if (typeof window === "undefined") return;
    const key = storageKey(scope);
    if (key) localStorage.removeItem(key);
  },

  getPendingCount(scope?: OfflineScope): number {
    return this.getQueue(scope).filter((i) => i.status === "PENDING").length;
  },
};
