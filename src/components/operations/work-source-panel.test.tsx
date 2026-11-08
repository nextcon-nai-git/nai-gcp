import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkSourcePanel } from "./work-source-panel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("atualiza apenas na frequência escolhida e encerra o timer ao sair", async () => {
  vi.useFakeTimers();
  const request = vi.fn().mockResolvedValue({ answer: "Dados do cliente selecionado" });
  const { unmount } = render(<WorkSourcePanel companyId="ONE" lastRead={null} request={request} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Atualização com o painel aberto"), {
    target: { value: "5" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toMatchObject({ companyId: "ONE", action: "read_sources" });
  expect(screen.getByRole("status").textContent).toBe("Dados do cliente selecionado");
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(request).toHaveBeenCalledTimes(1);
});
