import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
const state = vi.hoisted(() => ({
  path: "/financial/notas-fiscais",
  role: "ADMIN",
  specialty: "",
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useRouter: () => ({}) }));
vi.mock("@/firebase", () => ({
  useAuth: () => ({}),
  useFirestore: () => null,
  useUser: () => ({ user: { uid: "teste" } }),
  useDoc: () => ({ data: { role: state.role, specialty: state.specialty } }),
  useMemoFirebase: () => null,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("next/image", () => ({ default: () => null }));
let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
  state.path = "/financial/notas-fiscais";
  state.role = "ADMIN";
  state.specialty = "";
});
afterEach(() => view.cleanup());
const render = () =>
  view.render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
describe("menu lateral por tarefa", () => {
  it("mostra três áreas e abre o grupo da página atual", async () => {
    await render();
    expect(
      Array.from(
        view.container.querySelectorAll('[data-sidebar="group-label"]'),
        (n) => n.textContent
      )
    ).toEqual(["Comercial", "Operacional", "Faturamento"]);
    expect(view.container.querySelectorAll("summary")).toHaveLength(9);
    expect(view.container.querySelector("details[open] summary")?.textContent).toBe(
      "Cobrança e notas"
    );
    expect(view.container.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe(
      "/financial/notas-fiscais"
    );
  });
  it("encontra tarefas com verbos e acentos e restaura os grupos ao limpar", async () => {
    await render();
    await view.input("input", "quero emitir uma nota");
    expect(view.container.querySelectorAll("details[open]")).toHaveLength(1);
    expect(view.container.querySelector("details a")?.getAttribute("href")).toBe(
      "/financial/notas-fiscais"
    );
    await view.click("Limpar busca");
    expect(view.container.querySelectorAll("summary")).toHaveLength(9);
    await view.input("input", "auditar s2220");
    expect(view.container.querySelector("details a")?.getAttribute("href")).toBe(
      "/esocial/messaging"
    );
  });
  it.each([
    ["ENGENHARIA", "/risk-management", "/health-control"],
    ["ENFERMAGEM", "/health-control", "/risk-management"],
  ])("respeita as telas do prestador %s", async (specialty, allowed, denied) => {
    state.role = "PROVIDER";
    state.specialty = specialty;
    await render();
    expect(view.container.querySelector('a[href="' + allowed + '"]')).not.toBeNull();
    for (const href of [denied, "/crm", "/cassi-billing", "/financial/notas-fiscais"])
      expect(view.container.querySelector('a[href="' + href + '"]')).toBeNull();
    await view.input("input", "emitir nota");
    expect(view.container.querySelectorAll("details a")).toHaveLength(0);
  });
});
