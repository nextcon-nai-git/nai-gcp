import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";

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

describe("calendar interactions with DayPicker 10", () => {
  it("selects a date while preserving disabled dates", async () => {
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <Calendar
          mode="single"
          defaultMonth={new Date(2026, 9, 1)}
          selected={new Date(2026, 9, 3)}
          disabled={new Date(2026, 9, 4)}
          onSelect={onSelect}
        />
      )
    );
    const disabled = element.querySelector<HTMLButtonElement>('[data-day="2026-10-04"] button');
    expect(disabled?.disabled).toBe(true);
    await act(async () => disabled!.click());
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () =>
      element.querySelector<HTMLButtonElement>('[data-day="2026-10-07"] button')!.click()
    );
    expect(onSelect.mock.calls[0][0]).toEqual(new Date(2026, 9, 7));
  });

  it("navigates between months with the accessible navigation controls", async () => {
    await act(async () => root.render(<Calendar defaultMonth={new Date(2026, 9, 1)} />));
    expect(element.textContent).toContain("October 2026");
    await act(async () =>
      element.querySelector<HTMLButtonElement>('button[aria-label="Go to the Next Month"]')!.click()
    );
    expect(element.textContent).toContain("November 2026");
    await act(async () =>
      element
        .querySelector<HTMLButtonElement>('button[aria-label="Go to the Previous Month"]')!
        .click()
    );
    expect(element.textContent).toContain("October 2026");
  });
});
