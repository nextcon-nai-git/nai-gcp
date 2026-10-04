/**
 * NextCon Intelligence (NAI) - Offline-First Sync Engine
 * Gerencia o armazenamento local (IndexedDB / LocalStorage) e sincronização
 * automatizada para Checklists, Entregas de EPIs e APRs quando offline.
 */

export interface OfflineSyncItem {
  id: string;
  type: "checklist" | "ppe_kiosk" | "pt_apr" | "accident_report";
  companyId: string;
  payload: Record<string, any>;
  timestamp: number;
  synced: boolean;
}

const STORAGE_KEY = "nai_offline_sync_queue";

export class OfflineSyncEngine {
  /**
   * Enfileira uma ação para ser sincronizada quando houver conexão.
   */
  static async enqueue(
    item: Omit<OfflineSyncItem, "id" | "timestamp" | "synced">
  ): Promise<OfflineSyncItem> {
    const queue = this.getQueue();
    const newItem: OfflineSyncItem = {
      ...item,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      synced: false,
    };

    queue.push(newItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));

    if (navigator.onLine) {
      await this.processQueue();
    }

    return newItem;
  }

  /**
   * Retorna os itens pendentes na fila.
   */
  static getQueue(): OfflineSyncItem[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Processa a fila de envio quando a conexão retornar.
   */
  static async processQueue(): Promise<{ processed: number; failed: number }> {
    if (!navigator.onLine) return { processed: 0, failed: 0 };

    const queue = this.getQueue();
    if (queue.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;
    const remainingQueue: OfflineSyncItem[] = [];

    for (const item of queue) {
      try {
        // Envia item para o endpoint do Firestore / Server Action
        const response = await fetch("/api/offline-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          processed++;
        } else {
          failed++;
          remainingQueue.push(item);
        }
      } catch {
        failed++;
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingQueue));
    return { processed, failed };
  }

  /**
   * Inicializa o escutador de eventos online/offline.
   */
  static initAutoSync(onStatusChange?: (isOnline: boolean, pendingCount: number) => void) {
    if (typeof window === "undefined") return;

    const handleStatus = () => {
      const isOnline = navigator.onLine;
      const pendingCount = this.getQueue().length;
      if (isOnline) {
        this.processQueue().then(() => {
          if (onStatusChange) onStatusChange(true, this.getQueue().length);
        });
      } else if (onStatusChange) {
        onStatusChange(false, pendingCount);
      }
    };

    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);

    // Checagem inicial
    handleStatus();
  }
}
