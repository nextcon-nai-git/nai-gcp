import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  collection,
  documentId,
  getFirestore,
  orderBy,
  query,
  queryEqual,
  where,
  type Firestore,
} from "firebase/firestore";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ listen: vi.fn(), off: [] as Array<ReturnType<typeof vi.fn>> }));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  onSnapshot: mock.listen,
}));
import { useCompanyDirectory } from "./use-company-directory";
let host: HTMLDivElement, root: Root, app: FirebaseApp, db: Firestore;
let renders: Array<{
  uid: string | undefined;
  ids: string[];
  error: string | undefined;
  loading: boolean;
}>;
function View({
  uid = "A",
  ids = ["company-a"],
  global = false,
  enabled = true,
}: {
  uid?: string;
  ids?: string[];
  global?: boolean;
  enabled?: boolean;
}) {
  const result = useCompanyDirectory(db, uid, global, ids, enabled);
  renders.push({
    uid,
    ids: result.data.map((item) => item.id),
    error: result.error?.message,
    loading: result.isLoading,
  });
  return <output>{JSON.stringify(result)}</output>;
}
const render = (props: React.ComponentProps<typeof View> = {}) =>
  act(async () => root.render(<View {...props} />));
const publish = (index: number, rows: Array<{ id: string; data: Record<string, unknown> }>) =>
  act(async () =>
    mock.listen.mock.calls[index][1]({
      docs: rows.map((item) => ({ id: item.id, data: () => item.data })),
    })
  );
const fail = (index: number) =>
  act(async () => mock.listen.mock.calls[index][2](new Error("Sem acesso")));
const last = () => renders.at(-1)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  mock.off = [];
  mock.listen.mockImplementation(() => {
    const off = vi.fn();
    mock.off.push(off);
    return off;
  });
  app = initializeApp({ projectId: "demo-company-directory" }, crypto.randomUUID());
  db = getFirestore(app);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  renders = [];
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  await deleteApp(app);
  vi.unstubAllGlobals();
});

describe("authorized company directory", () => {
  it("never subscribes without a valid session and scope", async () => {
    await render({ uid: "", global: true });
    expect(mock.listen).not.toHaveBeenCalled();
    await render({ ids: [] });
    expect(mock.listen).not.toHaveBeenCalled();
    await render({ enabled: false });
    expect(mock.listen).not.toHaveBeenCalled();
    expect(last().loading).toBe(false);
  });
  it("uses the exact scoped query rather than reading every company", async () => {
    await render({ ids: ["company-b", "company-a", "company-a"] });
    expect(mock.listen).toHaveBeenCalledTimes(1);
    expect(
      queryEqual(
        mock.listen.mock.calls[0][0],
        query(collection(db, "companies"), where(documentId(), "in", ["company-a", "company-b"]))
      )
    ).toBe(true);
  });
  it("only uses an unfiltered directory for an explicitly global scope", async () => {
    await render({ global: true });
    expect(
      queryEqual(
        mock.listen.mock.calls[0][0],
        query(collection(db, "companies"), orderBy("name", "asc"))
      )
    ).toBe(true);
  });
  it("batches more than 30 companies and waits for every response", async () => {
    const ids = Array.from({ length: 31 }, (_, i) => `company-${String(i).padStart(2, "0")}`);
    await render({ ids });
    expect(mock.listen).toHaveBeenCalledTimes(2);
    expect(
      queryEqual(
        mock.listen.mock.calls[0][0],
        query(collection(db, "companies"), where(documentId(), "in", ids.slice(0, 30)))
      )
    ).toBe(true);
    expect(
      queryEqual(
        mock.listen.mock.calls[1][0],
        query(collection(db, "companies"), where(documentId(), "in", ids.slice(30)))
      )
    ).toBe(true);
    await publish(1, [{ id: ids[30], data: { name: "Zulu" } }]);
    expect(last().ids).toEqual([]);
    expect(last().loading).toBe(true);
    await publish(0, [{ id: ids[0], data: { name: "Alfa", id: "forged" } }]);
    expect(last().ids).toEqual([ids[0], ids[30]]);
    expect(last().loading).toBe(false);
  });
  it("removes deleted companies and trusts document IDs over stored values", async () => {
    await render();
    await publish(0, [
      { id: "company-a", data: { name: "A", id: "forged" } },
      { id: "deleted", data: { name: "D", isDeleted: true } },
    ]);
    expect(last().ids).toEqual(["company-a"]);
  });
  it("clears prior account data in the first render of a new account", async () => {
    await render();
    await publish(0, [{ id: "company-a", data: { name: "A" } }]);
    await render({ uid: "B", ids: ["company-b"] });
    expect(renders.filter((r) => r.uid === "B").every((r) => r.ids.length === 0)).toBe(true);
    await publish(0, [{ id: "company-a", data: { name: "Late" } }]);
    await fail(0);
    expect(last().error).toBeUndefined();
    expect(last().ids).toEqual([]);
    expect(mock.off[0]).toHaveBeenCalled();
  });
  it("drops data and ignores late events after scope revocation", async () => {
    await render();
    await publish(0, [{ id: "company-a", data: { name: "A" } }]);
    await render({ ids: [] });
    await publish(0, [{ id: "company-a", data: { name: "Late" } }]);
    expect(last()).toMatchObject({ ids: [], loading: false });
  });
  it("keeps a partial batch failure visible and never publishes the other batches", async () => {
    await render({ ids: Array.from({ length: 31 }, (_, i) => `company-${i}`) });
    await fail(0);
    await publish(1, [{ id: "late", data: { name: "Late" } }]);
    expect(last()).toMatchObject({ ids: [], loading: false, error: "Sem acesso" });
    expect(mock.off.every((off) => off.mock.calls.length > 0)).toBe(true);
  });
  it("reports synchronous subscription failures without leaving loading stuck", async () => {
    mock.listen.mockImplementationOnce(() => {
      throw new Error("setup failed");
    });
    await render();
    expect(last()).toMatchObject({ ids: [], loading: false, error: "setup failed" });
  });
});
