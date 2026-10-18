import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../tests/ui/harness";
import { useToast, toast, reducer } from "./use-toast";
let v: ReturnType<typeof ui>;
function Notices() {
  const { toasts, dismiss } = useToast();
  return (
    <>
      <button onClick={() => dismiss()}>Dispensar todas</button>
      {toasts.map((t) => (
        <p key={t.id} data-open={t.open}>
          {t.title}
          {t.description}
          <button onClick={() => t.onOpenChange?.(false)}>Fechar</button>
        </p>
      ))}
    </>
  );
}
beforeEach(() => {
  v = ui();
  vi.useFakeTimers();
});
afterEach(async () => {
  await act(async () => vi.runAllTimers());
  await v.cleanup();
  vi.useRealTimers();
});
describe("toast lifecycle", () => {
  it("shows only the newest notification and updates it", async () => {
    await v.render(<Notices />);
    let item: ReturnType<typeof toast>;
    await act(async () => {
      toast({ title: "Antiga" });
      item = toast({ title: "Salvando" });
    });
    expect(v.container.textContent).not.toContain("Antiga");
    await act(async () =>
      item.update({ id: item.id, title: "Confirmado", description: "Gravado" })
    );
    expect(v.container.textContent).toContain("ConfirmadoGravado");
    await act(async () => item.dismiss());
    expect(v.container.querySelector("p")?.getAttribute("data-open")).toBe("false");
    await act(async () => vi.runAllTimers());
    expect(v.container.querySelector("p")).toBeNull();
  });
  it("dismisses through the close callback and global dismissal", async () => {
    await v.render(<Notices />);
    await act(async () => toast({ title: "Fechar esta" }));
    await v.click("Fechar");
    expect(v.container.querySelector("p")?.getAttribute("data-open")).toBe("false");
    await act(async () => toast({ title: "Todas" }));
    await v.click("Dispensar todas");
    expect(v.container.querySelector("p")?.getAttribute("data-open")).toBe("false");
  });
  it("preserves unrelated notices on targeted updates/removals", () => {
    const state = {
      toasts: [
        { id: "one", title: "Um", open: true },
        { id: "two", title: "Dois", open: true },
      ],
    };
    expect(
      reducer(state, { type: "UPDATE_TOAST", toast: { id: "one", title: "Novo" } }).toasts[1].title
    ).toBe("Dois");
    expect(
      reducer(state, { type: "REMOVE_TOAST", toastId: "one" }).toasts.map((t) => t.id)
    ).toEqual(["two"]);
    expect(reducer(state, { type: "REMOVE_TOAST" }).toasts).toEqual([]);
  });
});
