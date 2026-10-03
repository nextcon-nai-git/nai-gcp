import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

let element: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(logger.error).mockClear();
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
});

afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function BrokenScreen(): React.ReactNode {
  throw new Error("synthetic screen failure");
}

describe("screen error recovery", () => {
  it("shows an accessible recovery action and logs a rendering failure", async () => {
    await act(async () =>
      root.render(
        <ErrorBoundary>
          <BrokenScreen />
        </ErrorBoundary>
      )
    );
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).toContain("Tentar novamente");
    expect(element.textContent).not.toContain("synthetic screen failure");
    expect(document.activeElement).toBe(element.querySelector("button"));
    expect(logger.error).toHaveBeenCalledWith(
      "React render error",
      expect.objectContaining({
        error: expect.objectContaining({ message: "synthetic screen failure" }),
      })
    );
  });

  it("remounts the screen after an explicit retry when the cause is resolved", async () => {
    let unavailable = true;
    function Screen() {
      if (unavailable) throw new Error("synthetic temporary failure");
      return <p>Tela recuperada</p>;
    }
    await act(async () =>
      root.render(
        <ErrorBoundary>
          <Screen />
        </ErrorBoundary>
      )
    );
    unavailable = false;
    await act(async () => element.querySelector("button")!.click());
    expect(element.textContent).toContain("Tela recuperada");
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it("continues containing an error if retry cannot resolve it", async () => {
    await act(async () =>
      root.render(
        <ErrorBoundary>
          <BrokenScreen />
        </ErrorBoundary>
      )
    );
    await act(async () => element.querySelector("button")!.click());
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).toContain("Tentar novamente");
  });

  it.each([null, "synthetic thrown value", { password: "synthetic-password" }])(
    "keeps recovery available for a non-Error exception (%j)",
    async (value) => {
      function InvalidException(): React.ReactNode {
        throw value;
      }
      await act(async () =>
        root.render(
          <ErrorBoundary>
            <InvalidException />
          </ErrorBoundary>
        )
      );
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
      expect(element.textContent).toContain("Tentar novamente");
      expect(logger.error).toHaveBeenCalledWith(
        "React render error",
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
        "synthetic-password"
      );
    }
  );

  it("preserves an explicitly supplied fallback", async () => {
    await act(async () =>
      root.render(
        <ErrorBoundary fallback={<p>Recuperação específica</p>}>
          <BrokenScreen />
        </ErrorBoundary>
      )
    );
    expect(element.textContent).toBe("Recuperação específica");
  });
});
