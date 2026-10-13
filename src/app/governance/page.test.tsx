import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: { uid: "internal" },
  profile: { id: "internal", role: "ADMIN" } as Record<string, unknown>,
  profileError: null as Error | null,
  logs: {
    data: [
      {
        id: "log-1",
        actorId: "actor-verified",
        actorRole: "DOCTOR",
        tenantId: "company-verified",
        patientId: "patient-verified",
        action: "ASO_VIEWED",
        timestamp: { seconds: 1791806400 },
      },
    ],
    isLoading: false,
    error: null as Error | null,
  },
  useCollection: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useFirestore: () => ({}),
  useMemoFirebase: (factory: () => unknown) => factory(),
  useDoc: () => ({ data: m.profile, isLoading: false, error: m.profileError }),
  useCollection: (target: unknown) => {
    m.useCollection(target);
    return m.logs;
  },
}));
vi.mock("firebase/firestore", () => ({
  doc: () => "profile",
  collection: () => "logs",
  query: () => "audit-query",
  orderBy: vi.fn(),
  limit: vi.fn(),
}));
import CorporateGovernance from "./page";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  m.user = { uid: "internal" };
  m.profile = { id: "internal", role: "ADMIN" };
  m.profileError = null;
  m.logs.error = null;
  m.logs.isLoading = false;
  m.useCollection.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
describe("governance evidence", () => {
  it("shows the actual server audit schema without inventing compliance or a scan result", async () => {
    await act(async () => root.render(<CorporateGovernance />));
    expect(container.textContent).toContain("Consulta de ASO");
    expect(container.textContent).toContain("actor-verified");
    expect(container.textContent).toContain("company-verified");
    expect(container.textContent).toContain("patient-verified");
    expect(container.textContent).not.toContain("SGSI ACTIVE");
    expect(container.textContent).not.toContain("100% REGULAR");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
  it.each(["account-change", "tenant-role", "permission-error", "loading"])(
    "hides old audit records for %s",
    async (state) => {
      await act(async () => root.render(<CorporateGovernance />));
      if (state === "account-change") m.user = { uid: "new-user" };
      if (state === "tenant-role")
        m.profile = { id: "internal", role: "ADMIN", tenantId: "client" };
      if (state === "permission-error") m.logs.error = new Error("Denied");
      if (state === "loading") m.logs.isLoading = true;
      await act(async () => root.render(<CorporateGovernance />));
      expect(container.textContent).not.toContain("actor-verified");
      expect(container.textContent).not.toContain("patient-verified");
      expect(container.textContent).not.toContain("Nenhum registro retornado");
      if (state === "account-change" || state === "tenant-role")
        expect(m.useCollection).toHaveBeenLastCalledWith(null);
      if (state === "permission-error")
        expect(container.querySelector('[role="alert"]')).not.toBeNull();
    }
  );
});
