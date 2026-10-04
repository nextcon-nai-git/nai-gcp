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

const STORAGE_KEY = "nai_offline_queue_v1";

export const offlineStorage = {
  getQueue(): PendingOfflineItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addItem(type: PendingOfflineItem["type"], data: any): PendingOfflineItem {
    const queue = this.getQueue();
    const newItem: PendingOfflineItem = {
      id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      status: "PENDING",
    };
    queue.push(newItem);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
    return newItem;
  },

  removeItem(id: string) {
    if (typeof window === "undefined") return;
    const queue = this.getQueue().filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  },

  clearQueue() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },

  getPendingCount(): number {
    return this.getQueue().filter((i) => i.status === "PENDING").length;
  },
};
