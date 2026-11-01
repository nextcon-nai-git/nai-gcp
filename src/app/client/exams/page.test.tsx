import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({
  records: [
    {
      id: "test",
      employeeName: "Pessoa fictícia",
      status_esocial: "Enviado",
      protocolo_governo: "LOTE-SINTETICO",
      data_emissao: "2026-01-10",
      resultado: "Apto",
    },
  ],
  error: null as Error | null,
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: { uid: "synthetic-client" } }),
  useFirestore: () => ({}),
  useMemoFirebase: () => ({}),
  useDoc: () => ({
    data: { companyId: "company-test", companyName: "Empresa fictícia" },
    error: null,
  }),
  useCollection: () => ({ data: source.records, error: source.error, isLoading: false }),
}));
vi.mock("@/components/documents/download-aso-button", () => ({
  DownloadAsoButton: () => <button>Baixar resumo de ASO</button>,
}));
import ClientExamsHistory from "./page";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  source.error = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("não presume assinatura ou aceite do eSocial a partir de um status legado", async () => {
  await act(async () => root.render(<ClientExamsHistory />));
  expect(host.textContent).toContain("Status interno: Enviado");
  expect(host.textContent).toContain("Protocolo informado: LOTE-SINTETICO");
  expect(host.textContent).toContain("Recibo do evento não verificado");
  expect(host.textContent).toContain("gera um resumo do cadastro");
  for (const claim of [
    "PROTOCOLADO",
    "PROCESSANDO",
    "Assinado via NAI Cloud",
    "Blindagem Legal",
    "automaticamente",
    "Exportar Tudo",
  ])
    expect(host.textContent).not.toContain(claim);
});
it("informa erro de leitura sem exibir um histórico como confirmado", async () => {
  source.error = new Error("private diagnostic");
  await act(async () => root.render(<ClientExamsHistory />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Não foi possível consultar os exames"
  );
  expect(host.textContent).not.toContain("Pessoa fictícia");
  expect(host.textContent).not.toContain("private diagnostic");
});
