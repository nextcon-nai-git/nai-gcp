import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { WorkSourcePanel } from "./work-source-panel";

let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
  vi.useFakeTimers();
});
afterEach(async () => {
  await view.cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("atualiza apenas na frequência escolhida e encerra o timer ao sair", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const request = vi.fn().mockResolvedValue({ answer: "Dados do cliente selecionado" });
  await view.render(<WorkSourcePanel companyId="ONE" lastRead={null} request={request} />);
  const tick = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300000);
    });
  await tick();
  expect(request).not.toHaveBeenCalled();
  await view.input('select:has(option[value="15"])', "5");
  await tick();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toMatchObject({ companyId: "ONE", action: "read_sources" });
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    "Dados do cliente selecionado"
  );
  await view.render(null);
  await tick();
  expect(request).toHaveBeenCalledTimes(1);
});
