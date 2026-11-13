import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PtAprDigital from "./page";
import type { WorkPermit } from "@/lib/pt-apr";

const user = { uid: "tecnico", getIdToken: async () => "teste" };
vi.mock("@/firebase", () => ({
  useUser: () => ({
    user,
    role: "SAFETY_TECH",
    tenantId: "unit",
    servedCompanies: [],
    isUserLoading: false,
  }),
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: "unit" }) }));
it("só informa conclusão após persistência, exige checklist, comprovante e confirmação técnica", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const permit: WorkPermit = {
    id: "pt-teste",
    employeeId: "e",
    employeeName: "Responsável Teste",
    task: "Inspeção",
    location: "Unidade",
    createdBy: "admin",
    createdAt: "2026-11-13",
    status: "awaiting_review",
  };
  const hash = "a".repeat(64);
  let writes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("/documents"))
        return Response.json({ documents: [{ companyId: "unit", id: hash, name: "Equipe.pdf" }] });
      if (options?.method === "POST") {
        writes++;
        if (writes === 1) return Response.json({ error: "Gravação indisponível" }, { status: 503 });
        return Response.json({
          ...permit,
          status: "awaiting_signature",
          reviewerName: "Técnico",
          reviewedAt: "2026-11-13",
          evidence: JSON.parse(String(options.body)).evidence,
        });
      }
      return Response.json({ items: [permit], canReview: true, next: null });
    })
  );
  const button = (name: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(name))!;
  try {
    await act(async () => root.render(<PtAprDigital />));
    await act(async () => button("Abrir PT").click());
    expect(button("Registrar APR").disabled).toBe(true);
    const form = host.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(writes).toBe(0);
    for (const el of form.querySelectorAll("textarea,input:not([type=checkbox])")) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(
          el,
          "Evidência de teste"
        );
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    for (const el of form.querySelectorAll("select")) {
      await act(async () => {
        el.value = el.querySelector('option[value="confirmed"]') ? "confirmed" : hash;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    expect(button("Registrar APR").disabled).toBe(true);
    await act(async () => form.querySelector<HTMLInputElement>("input[type=checkbox]")!.click());
    expect(button("Registrar APR").disabled).toBe(false);
    await act(async () => button("Registrar APR").click());
    expect(host.textContent).toContain("Gravação indisponível");
    expect(host.textContent).not.toContain("APR registrada por");
    await act(async () => button("Registrar APR").click());
    expect(writes).toBe(2);
    expect(host.textContent).toContain("APR registrada por Técnico");
    expect(host.textContent).toContain("PT aguardando assinatura.");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
