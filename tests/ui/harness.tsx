import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect } from "vitest";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function ui() {
  let root: Root;
  let container: HTMLDivElement;
  return {
    get container() {
      return container;
    },
    async render(element: ReactNode) {
      (
        globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      if (!root) {
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
      }
      await act(async () => root.render(element));
    },
    async cleanup() {
      if (root) await act(async () => root.unmount());
      container?.remove();
    },
    button(text: string) {
      const button = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) => b.getAttribute("aria-label") === text || b.textContent?.trim() === text
      );
      const match =
        button ||
        [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
          b.textContent?.includes(text)
        );
      expect(match, `button ${text}`).toBeDefined();
      return match!;
    },
    async click(text: string) {
      await act(async () => this.button(text).click());
    },
    async input(selector: string, value: string) {
      const el = document.body.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(selector);
      expect(el, selector).not.toBeNull();
      await act(async () => {
        const proto =
          el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el!.dispatchEvent(
          new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })
        );
      });
    },
    async submit() {
      await act(async () =>
        document.body
          .querySelector("form")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
    },
  };
}
