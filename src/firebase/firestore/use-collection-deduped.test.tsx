import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Query } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionDeduped } from "./use-collection-deduped";

const firestoreMocks = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({ onSnapshot: firestoreMocks.onSnapshot }));
vi.mock("@/firebase/error-emitter", () => ({ errorEmitter: { emit: vi.fn() } }));
vi.mock("@/firebase/errors", () => ({
  FirestorePermissionError: class extends Error {},
}));

let element: HTMLDivElement;
let root: Root;

function Subscriber({ target, label }: { target: Query; label: string }) {
  const { data } = useCollectionDeduped<{ name: string }>(target);
  return <span data-testid={label}>{data?.[0]?.name || "loading"}</span>;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
  vi.resetAllMocks();
  firestoreMocks.onSnapshot.mockReturnValue(vi.fn());
});

afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

describe("useCollectionDeduped", () => {
  it("shares one real-time listener for identical query objects", async () => {
    const target = {} as Query;
    await act(async () =>
      root.render(
        <>
          <Subscriber target={target} label="first" />
          <Subscriber target={target} label="second" />
        </>
      )
    );

    expect(firestoreMocks.onSnapshot).toHaveBeenCalledOnce();
    const onNext = firestoreMocks.onSnapshot.mock.calls[0][1] as (snapshot: unknown) => void;
    await act(async () =>
      onNext({
        docs: [{ id: "doc-1", data: () => ({ name: "Shared result" }) }],
      })
    );
    expect(element.querySelector('[data-testid="first"]')?.textContent).toBe("Shared result");
    expect(element.querySelector('[data-testid="second"]')?.textContent).toBe("Shared result");

    await act(async () => root.unmount());
    expect(firestoreMocks.onSnapshot.mock.results[0].value).toHaveBeenCalledOnce();
  });
});
