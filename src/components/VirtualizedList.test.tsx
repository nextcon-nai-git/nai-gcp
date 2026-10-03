import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VirtualizedList } from "./VirtualizedList";

let element: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
});

afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

describe("VirtualizedList", () => {
  it("renders only the visible rows and their overscan", async () => {
    const items = Array.from({ length: 100 }, (_, index) => `Item ${index}`);
    await act(async () =>
      root.render(
        <VirtualizedList
          items={items}
          height={100}
          itemHeight={20}
          renderItem={(item) => <span>{item}</span>}
        />
      )
    );

    const rows = element.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(items.length);
  });
});
