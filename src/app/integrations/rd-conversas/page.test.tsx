import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: session.user }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
import Workspace from "./page";
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  session.user = { uid: "staff", getIdToken: async () => "synthetic" };
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("does not display a fabricated connected state or send on opening", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(<Workspace />));
  expect(host.textContent).toContain("Conexão ainda não verificada");
  expect(fetcher).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Autorizar e enviar agora");
});
it("surfaces connection failures without marking the connection healthy", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Token Tallos inválido ou expirado." }),
    })
  );
  await act(async () => root.render(<Workspace />));
  const button = Array.from(host.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Testar conexão")
  )!;
  await act(async () => button.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Token Tallos inválido");
  expect(host.textContent).toContain("Conexão ainda não verificada");
});
it("clears fetched contact data on identity change", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact",
            name: "Contato sintético",
            phone: "",
            company: "",
            email: "",
            cnpj: "",
            link: null,
          },
        ],
        page: 1,
        pages: 1,
        total: 1,
      }),
    })
  );
  await act(async () => root.render(<Workspace />));
  const button = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "Contatos"
  )!;
  await act(async () => button.click());
  expect(host.textContent).toContain("Contato sintético");
  session.user = null;
  await act(async () => root.render(<Workspace />));
  expect(host.textContent).not.toContain("Contato sintético");
});
