import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ push: vi.fn(), setClient: vi.fn(), close: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ setActiveClientId: m.setClient }) }));
import { GlobalCommandPalette } from "./global-command-palette";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.push.mockReset();
  m.close.mockReset();
  m.setClient.mockReset();
});
afterEach(async () => {
  await v.cleanup();
});
const key = async (k: string) =>
  act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
describe("global command navigation", () => {
  it("searches by name and navigates the selected action", async () => {
    await v.render(<GlobalCommandPalette open onOpenChange={m.close} />);
    await v.input('input[placeholder^="O que"]', "NAI importa");
    await key("Enter");
    expect(m.push).toHaveBeenCalledWith("/nai-importa");
    expect(m.close).toHaveBeenCalledWith(false);
  });
  it("supports keyboard wrapping and modules", async () => {
    await v.render(<GlobalCommandPalette open onOpenChange={m.close} />);
    await v.input('input[placeholder^="O que"]', "Unidades & Clientes");
    await key("ArrowUp");
    await key("ArrowDown");
    await key("Enter");
    expect(m.push).toHaveBeenCalledWith("/clients");
  });
  it("does not navigate on empty results and resets selection after clearing", async () => {
    await v.render(<GlobalCommandPalette open onOpenChange={m.close} />);
    await v.input('input[placeholder^="O que"]', "zz-inexistente");
    await key("ArrowUp");
    await key("Enter");
    expect(m.push).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Nenhum resultado");
    await v.click("Limpar");
    await key("Enter");
    expect(m.push).toHaveBeenCalledWith("/health-control");
  });
  it("ignores shortcuts while closed", async () => {
    await v.render(<GlobalCommandPalette open={false} onOpenChange={m.close} />);
    await key("Enter");
    expect(m.push).not.toHaveBeenCalled();
  });
});
