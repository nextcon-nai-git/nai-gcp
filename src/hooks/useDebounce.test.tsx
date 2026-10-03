import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

let element: HTMLDivElement;
let root: Root;

function DebouncedValue({ value }: { value: string }) {
  return <span>{useDebounce(value, 250)}</span>;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  element = document.createElement("div");
  root = createRoot(element);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useDebounce", () => {
  it("publishes the latest value only after the delay", async () => {
    await act(async () => root.render(<DebouncedValue value="first" />));
    await act(async () => root.render(<DebouncedValue value="latest" />));

    await act(async () => vi.advanceTimersByTime(249));
    expect(element.textContent).toBe("first");

    await act(async () => vi.advanceTimersByTime(1));
    expect(element.textContent).toBe("latest");
  });
});
