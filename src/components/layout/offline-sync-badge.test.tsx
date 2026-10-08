import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OfflineSyncBadge } from "./offline-sync-badge";
const mocks = vi.hoisted(() => ({ toast: vi.fn(), clear: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/offline-storage", () => ({
  offlineStorage: { getPendingCount: () => 2, clearQueue: mocks.clear },
}));
it("preserves offline records when connectivity returns and reports pending upload", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<OfflineSyncBadge />));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(container.textContent).toContain("2 pendentes");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("envio à nuvem está pendente"),
      })
    );
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
