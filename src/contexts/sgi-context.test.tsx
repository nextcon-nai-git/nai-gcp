import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SgiProvider, useSgi } from "./sgi-context";
const state = vi.hoisted(() => ({
  role: "GUEST" as string | null,
  companyId: null as string | null,
  servedCompanies: [] as string[],
  isUserLoading: false,
}));
vi.mock("@/firebase", () => ({ useUser: () => state }));
let root: Root;
let container: HTMLDivElement;
const seen: { activeClientId: string; isGlobalStaff: boolean; isGlobalView: boolean }[] = [];
function Consumer() {
  const value = useSgi();
  seen.push({
    activeClientId: value.activeClientId,
    isGlobalStaff: value.isGlobalStaff,
    isGlobalView: value.isGlobalView,
  });
  return (
    <>
      <output>{JSON.stringify(seen.at(-1))}</output>
      <button onClick={() => value.setActiveClientId("company-b")}>Change company</button>
    </>
  );
}
async function render() {
  await act(async () =>
    root.render(
      <SgiProvider>
        <Consumer />
      </SgiProvider>
    )
  );
}
const last = () => seen.at(-1)!;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, {
    role: "GUEST",
    companyId: null,
    servedCompanies: [],
    isUserLoading: false,
  });
  localStorage.clear();
  seen.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});
describe("seleção SGI reflete autorização atual", () => {
  it.each([null, "GUEST", "DOCTOR", "PROVIDER"])(
    "não concede escopo global a %s sem empresa",
    async (role) => {
      state.role = role;
      localStorage.setItem("nai_active_client_id", "company-a");
      await render();
      expect(last()).toEqual({
        activeClientId: "unauthorized",
        isGlobalStaff: false,
        isGlobalView: false,
      });
      await act(async () => container.querySelector("button")!.click());
      expect(last().activeClientId).toBe("unauthorized");
    }
  );
  it("preserva seleção global do administrador interno", async () => {
    state.role = "ADMIN";
    await render();
    expect(last()).toEqual({ activeClientId: "all", isGlobalStaff: true, isGlobalView: true });
    await act(async () => container.querySelector("button")!.click());
    expect(last().activeClientId).toBe("company-b");
  });
  it("troca de conta não renderiza a empresa anterior nem por um frame", async () => {
    Object.assign(state, { role: "ADMIN", companyId: null });
    localStorage.setItem("nai_active_client_id", "company-b");
    await render();
    const start = seen.length;
    Object.assign(state, { role: "ADMIN", companyId: "company-a" });
    await render();
    expect(
      seen.slice(start).every((v) => v.activeClientId === "company-a" && !v.isGlobalStaff)
    ).toBe(true);
    await act(async () => container.querySelector("button")!.click());
    expect(last().activeClientId).toBe("company-a");
  });
  it("prestador sem companyId fica restrito às empresas credenciadas", async () => {
    Object.assign(state, { role: "PROVIDER", servedCompanies: ["company-a"] });
    await render();
    expect(last().activeClientId).toBe("company-a");
    expect(last().isGlobalStaff).toBe(false);
    await act(async () => container.querySelector("button")!.click());
    expect(last().activeClientId).toBe("company-a");
    state.servedCompanies = [];
    await render();
    expect(last().activeClientId).toBe("unauthorized");
  });
  it.each(["DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "ADMIN"])(
    "%s externo pode selecionar a própria ou uma empresa explicitamente servida",
    async (role) => {
      Object.assign(state, {
        role,
        companyId: "company-home",
        servedCompanies: ["company-a", "company-b"],
      });
      localStorage.setItem("nai_active_client_id", "company-a");
      await render();
      expect(last().activeClientId).toBe("company-a");
      await act(async () => container.querySelector("button")!.click());
      expect(last().activeClientId).toBe("company-b");
    }
  );
  it("suspende consultas enquanto o perfil da próxima sessão carrega", async () => {
    Object.assign(state, { role: "ADMIN", isUserLoading: true });
    await render();
    expect(last().activeClientId).toBe("unauthorized");
  });
});
