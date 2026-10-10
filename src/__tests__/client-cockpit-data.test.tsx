// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
let output = "";
const render = (element: React.ReactNode) => {
  output = renderToStaticMarkup(element);
};
const state = vi.hoisted(() => ({
  company: null as unknown,
  error: null as unknown,
  employees: [] as unknown[],
  active: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "synthetic-company" }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useFirestore: () => ({}),
  useMemoFirebase: () => null,
  useDoc: () => ({ data: state.company, error: state.error, isLoading: false }),
  useCollection: () => ({ data: state.employees, error: null, isLoading: false }),
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ setActiveClientId: state.active }) }));
vi.mock("@/components/clients/client-documents", () => ({
  ClientDocuments: () => <div>Documentos persistidos</div>,
}));
import ClientPage from "@/app/clients/[id]/page";
import FieldControl from "@/app/field-control/page";

beforeEach(() => {
  output = "";
  state.company = null;
  state.error = null;
  state.employees = [];
  state.active.mockClear();
});
describe("Client cockpit source integrity", () => {
  it("does not invent an unknown company", () => {
    render(<ClientPage />);
    expect(output).toContain("Cliente não encontrado");
    expect(state.active).not.toHaveBeenCalled();
  });
  it("does not substitute sample data after an access failure", () => {
    state.error = new Error("permission-denied");
    render(<ClientPage />);
    expect(output).toContain('role="alert"');
    expect(output).not.toContain("Documentos persistidos");
  });
  it("shows only saved employees and never assumes ASO validity", () => {
    state.company = { id: "synthetic-company", name: "Empresa teste", active: false };
    state.employees = [
      { id: "a", name: "Colaborador salvo", job_role: { title: "Analista" } },
      { id: "b", name: "Excluído", isDeleted: true },
    ];
    render(<ClientPage />);
    expect(output).toContain("Colaborador salvo");
    expect(output).not.toContain("Excluído");
    expect(output).not.toContain("Carlos Eduardo Silva");
    expect(output).not.toContain("100% OK");
    expect(output).not.toContain("eSocial Sincronizado");
  });
  it("does not generate employees for an empty unit", () => {
    state.company = { id: "synthetic-company", name: "Empresa teste" };
    render(<ClientPage />);
    expect(output).toContain("Nenhum colaborador cadastrado nesta unidade.");
  });
  it("does not offer a simulated access decision", () => {
    render(<FieldControl />);
    expect(output).toContain("Nenhuma liberação ou bloqueio");
    expect(output).not.toContain("<button");
  });
});
