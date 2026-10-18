import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { doc, getFirestore, type DocumentReference } from "firebase/firestore";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ listen: vi.fn(), emit: vi.fn() }));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  onSnapshot: mock.listen,
}));
vi.mock("@/firebase/error-emitter", () => ({ errorEmitter: { emit: mock.emit } }));
vi.mock("@/firebase/errors", () => ({
  FirestorePermissionError: class extends Error {
    constructor() {
      super("Permission denied");
    }
  },
}));
import { useDoc } from "./use-doc";

let host: HTMLDivElement,
  root: Root,
  app: FirebaseApp,
  first: DocumentReference,
  second: DocumentReference;
let renders: Array<{ path: string | undefined; name: string | undefined }>;
function View({ target }: { target: DocumentReference | null }) {
  const { data, isLoading, error } = useDoc<{ name: string }>(target);
  renders.push({ path: target?.path, name: data?.name });
  return (
    <span
      data-loading={String(isLoading)}
      data-error={error?.message || ""}
      data-id={data?.id || ""}
    >
      {data?.name || "none"}
    </span>
  );
}
const read = () => host.querySelector("span")!;
const publish = async (index: number, name?: string) =>
  act(async () =>
    mock.listen.mock.calls[index][1]({
      id: "real-id",
      exists: () => name !== undefined,
      data: () => ({ name, id: "untrusted-stored-id" }),
    })
  );
const fail = async (index: number, code: string) =>
  act(async () =>
    mock.listen.mock.calls[index][2](Object.assign(new Error("Server unavailable"), { code }))
  );

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  renders = [];
  mock.listen.mockImplementation(() => vi.fn());
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  app = initializeApp({ projectId: "demo-document-state" }, crypto.randomUUID());
  first = doc(getFirestore(app), "companies", "first");
  second = doc(getFirestore(app), "companies", "second");
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  await deleteApp(app);
  vi.unstubAllGlobals();
});

describe("useDoc: isolamento entre documentos e falhas", () => {
  it("usa o ID real e limpa o resultado quando o documento deixa de existir", async () => {
    await act(async () => root.render(<View target={first} />));
    expect(read().dataset.loading).toBe("true");
    await publish(0, "Empresa A");
    expect(read().dataset.id).toBe("real-id");
    expect(read().textContent).toBe("Empresa A");
    await publish(0);
    expect(read().textContent).toBe("none");
    expect(read().dataset.loading).toBe("false");
  });
  it("nunca renderiza o documento anterior sob a identidade do próximo", async () => {
    await act(async () => root.render(<View target={first} />));
    await publish(0, "Empresa A");
    await act(async () => root.render(<View target={second} />));
    expect(
      renders.filter((entry) => entry.path === second.path).every((entry) => !entry.name)
    ).toBe(true);
    expect(read().dataset.loading).toBe("true");
    await publish(0, "Resposta atrasada A");
    await fail(0, "permission-denied");
    expect(read().textContent).toBe("none");
    expect(mock.emit).not.toHaveBeenCalled();
    await publish(1, "Empresa B");
    expect(read().textContent).toBe("Empresa B");
    await act(async () => root.render(<View target={null} />));
    expect(read().textContent).toBe("none");
    expect(read().dataset.loading).toBe("false");
    for (const result of mock.listen.mock.results) expect(result.value).toHaveBeenCalledOnce();
  });
  it("trata falha de rede como falha de rede, sem emitir erro de permissão", async () => {
    await act(async () => root.render(<View target={first} />));
    await publish(0, "Anterior");
    await fail(0, "unavailable");
    expect(read().textContent).toBe("none");
    expect(read().dataset.error).toBe("Server unavailable");
    expect(read().dataset.loading).toBe("false");
    expect(mock.emit).not.toHaveBeenCalled();
    await publish(0, "Recuperado");
    expect(read().dataset.error).toBe("");
  });
  it("contextualiza somente a negativa de permissão", async () => {
    await act(async () => root.render(<View target={first} />));
    await fail(0, "permission-denied");
    expect(mock.emit).toHaveBeenCalledOnce();
    expect(read().dataset.error).toBe("Permission denied");
  });
  it("um diagnóstico que falha não deixa o carregamento travado", async () => {
    mock.emit.mockImplementation(() => {
      throw new Error("diagnostic listener failed");
    });
    await act(async () => root.render(<View target={first} />));
    await fail(0, "permission-denied");
    expect(read().dataset.error).toBe("Server unavailable");
    expect(read().dataset.loading).toBe("false");
  });
  it.each([new Error("Setup failed"), "Setup failed"])(
    "trata falha síncrona de assinatura",
    async (error) => {
      mock.listen.mockImplementation(() => {
        throw error;
      });
      await act(async () => root.render(<View target={first} />));
      expect(read().dataset.error).toBe("Setup failed");
      expect(read().dataset.loading).toBe("false");
    }
  );
});
