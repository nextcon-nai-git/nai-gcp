import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { collection, getFirestore, query, where, type Query } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionDeduped } from "./use-collection-deduped";

const mocks = vi.hoisted(() => ({ onSnapshot: vi.fn(), emit: vi.fn() }));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  onSnapshot: mocks.onSnapshot,
}));
vi.mock("@/firebase/error-emitter", () => ({ errorEmitter: { emit: mocks.emit } }));
vi.mock("@/firebase/errors", () => ({
  FirestorePermissionError: class extends Error {
    constructor() {
      super("Permission denied");
    }
  },
}));

let element: HTMLDivElement;
let root: Root;
let apps: FirebaseApp[];
let target: Query;
function Subscriber({ target, label }: { target: Query | null; label: string }) {
  const { data, isLoading, error } = useCollectionDeduped<{ name: string }>(target);
  return (
    <span data-testid={label} data-loading={String(isLoading)} data-error={error?.message || ""}>
      {data === null ? "none" : data.map((doc) => doc.name).join(",") || "empty"}
    </span>
  );
}
const read = (label: string) => element.querySelector(`[data-testid="${label}"]`)!;
async function publish(index: number, name?: string) {
  const onNext = mocks.onSnapshot.mock.calls[index][1];
  await act(async () => onNext({ docs: name ? [{ id: "doc-1", data: () => ({ name }) }] : [] }));
}
async function fail(index: number, code = "unavailable") {
  const onError = mocks.onSnapshot.mock.calls[index][2];
  await act(async () => onError(Object.assign(new Error("Database unavailable"), { code })));
}
const pair = (second = true) => (
  <>
    <Subscriber key="first" target={target} label="first" />
    {second && <Subscriber key="second" target={target} label="second" />}
  </>
);

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
  vi.resetAllMocks();
  mocks.onSnapshot.mockImplementation(() => vi.fn());
  apps = [initializeApp({ projectId: "demo-nai-subscriptions" }, `test-${crypto.randomUUID()}`)];
  target = collection(getFirestore(apps[0]), "companies");
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  await Promise.all(apps.map((app) => deleteApp(app)));
  vi.unstubAllGlobals();
});

describe("useCollectionDeduped", () => {
  it("shares one listener for equivalent public queries", async () => {
    await act(async () =>
      root.render(
        <>
          <Subscriber target={target} label="first" />
          <Subscriber target={collection(getFirestore(apps[0]), "companies")} label="second" />
        </>
      )
    );
    expect(mocks.onSnapshot).toHaveBeenCalledOnce();
    await publish(0, "Shared result");
    expect(read("first").textContent).toBe("Shared result");
    expect(read("second").textContent).toBe("Shared result");
  });

  it.each(["Shared result", undefined])(
    "replays the latest snapshot to a late subscriber (%s)",
    async (name) => {
      await act(async () => root.render(pair(false)));
      await publish(0, name);
      await act(async () => root.render(pair()));
      expect(mocks.onSnapshot).toHaveBeenCalledOnce();
      expect(read("second").textContent).toBe(name || "empty");
      expect(read("second").getAttribute("data-loading")).toBe("false");
    }
  );

  it("broadcasts errors and replays them to a late subscriber", async () => {
    await act(async () => root.render(pair()));
    await publish(0, "Old result");
    await fail(0);
    for (const label of ["first", "second"]) {
      expect(read(label).textContent).toBe("none");
      expect(read(label).getAttribute("data-loading")).toBe("false");
      expect(read(label).getAttribute("data-error")).toBe("Database unavailable");
    }
    await act(async () =>
      root.render(
        <>
          <Subscriber key="first" target={target} label="first" />
          <Subscriber key="second" target={target} label="second" />
          <Subscriber key="third" target={target} label="third" />
        </>
      )
    );
    expect(read("third").getAttribute("data-error")).toBe("Database unavailable");
  });

  it("notifies every consumer of denied permissions and emits one context event", async () => {
    await act(async () => root.render(pair()));
    await fail(0, "permission-denied");
    expect(read("first").getAttribute("data-error")).toBe("Permission denied");
    expect(read("second").getAttribute("data-error")).toBe("Permission denied");
    expect(mocks.emit).toHaveBeenCalledOnce();
  });

  it("keeps the listener when the original consumer unmounts and releases it after the last", async () => {
    await act(async () => root.render(pair()));
    const stop = mocks.onSnapshot.mock.results[0].value;
    await act(async () => root.render(<Subscriber key="second" target={target} label="second" />));
    expect(stop).not.toHaveBeenCalled();
    await publish(0, "Still listening");
    expect(read("second").textContent).toBe("Still listening");
    await act(async () => root.render(null));
    expect(stop).toHaveBeenCalledOnce();
    await act(async () => root.render(<Subscriber target={target} label="new" />));
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(2);
    expect(read("new").textContent).toBe("none");
    await publish(0, "Ignored old callback");
    expect(read("new").textContent).toBe("none");
  });

  it("clears old data on query switches and ignores callbacks from the old subscription", async () => {
    await act(async () => root.render(<Subscriber target={target} label="first" />));
    await publish(0, "Company A");
    const next = query(target, where("companyId", "==", "B"));
    await act(async () => root.render(<Subscriber target={next} label="first" />));
    expect(read("first").textContent).toBe("none");
    expect(read("first").getAttribute("data-loading")).toBe("true");
    await publish(0, "Stale company A");
    expect(read("first").textContent).toBe("none");
    await publish(1, "Company B");
    expect(read("first").textContent).toBe("Company B");
    await act(async () => root.render(<Subscriber target={null} label="first" />));
    expect(read("first").textContent).toBe("none");
    expect(read("first").getAttribute("data-loading")).toBe("false");
  });

  it("does not share collections across Firestore instances", async () => {
    apps.push(initializeApp({ projectId: "demo-nai-another" }, `test-${crypto.randomUUID()}`));
    await act(async () =>
      root.render(
        <>
          <Subscriber target={target} label="first" />
          <Subscriber target={collection(getFirestore(apps[1]), "companies")} label="second" />
        </>
      )
    );
    expect(mocks.onSnapshot).toHaveBeenCalledTimes(2);
    await publish(0, "Project A");
    expect(read("second").textContent).toBe("none");
  });

  it("shares listener setup failures instead of leaving consumers loading", async () => {
    mocks.onSnapshot.mockImplementation(() => {
      throw new Error("Setup failed");
    });
    await act(async () => root.render(pair()));
    expect(mocks.onSnapshot).toHaveBeenCalledOnce();
    expect(read("first").getAttribute("data-error")).toBe("Setup failed");
    expect(read("second").getAttribute("data-error")).toBe("Setup failed");
  });
});
