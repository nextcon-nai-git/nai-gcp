import React, { act } from "react";
import Link from "next/link";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => m.mobile }));
import * as S from "./sidebar";
let v: ReturnType<typeof ui>;
function Menu() {
  return (
    <>
      <S.Sidebar collapsible="icon">
        <S.SidebarHeader>
          <S.SidebarInput aria-label="Buscar menu" />
        </S.SidebarHeader>
        <S.SidebarContent>
          <S.SidebarGroup>
            <S.SidebarGroupLabel>Operacional</S.SidebarGroupLabel>
            <S.SidebarGroupAction aria-label="Adicionar">+</S.SidebarGroupAction>
            <S.SidebarGroupContent>
              <S.SidebarMenu>
                <S.SidebarMenuItem>
                  <S.SidebarMenuButton asChild isActive tooltip="Clientes">
                    <Link href="/clients">Clientes</Link>
                  </S.SidebarMenuButton>
                  <S.SidebarMenuAction aria-label="Ações">+</S.SidebarMenuAction>
                  <S.SidebarMenuBadge>2</S.SidebarMenuBadge>
                  <S.SidebarMenuSub>
                    <S.SidebarMenuSubItem>
                      <S.SidebarMenuSubButton href="/employees" isActive>
                        Colaboradores
                      </S.SidebarMenuSubButton>
                    </S.SidebarMenuSubItem>
                  </S.SidebarMenuSub>
                </S.SidebarMenuItem>
                <S.SidebarMenuSkeleton showIcon />
              </S.SidebarMenu>
            </S.SidebarGroupContent>
          </S.SidebarGroup>
        </S.SidebarContent>
        <S.SidebarSeparator />
        <S.SidebarFooter>Conta</S.SidebarFooter>
        <S.SidebarRail />
      </S.Sidebar>
      <S.SidebarInset>
        <S.SidebarTrigger />
      </S.SidebarInset>
    </>
  );
}
beforeEach(() => {
  v = ui();
  m.mobile = false;
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
describe("sidebar interaction contract", () => {
  it("renders navigation semantics and toggles desktop state via button and shortcut", async () => {
    await v.render(
      <S.SidebarProvider>
        <Menu />
      </S.SidebarProvider>
    );
    expect(v.container.querySelector('[data-state="expanded"]')).not.toBeNull();
    expect(v.container.querySelector('a[href="/clients"]')?.getAttribute("data-active")).toBe(
      "true"
    );
    expect(v.container.querySelector('[data-sidebar="menu-badge"]')?.textContent).toBe("2");
    await v.click("Toggle Sidebar");
    expect(v.container.querySelector('[data-collapsible="icon"]')).not.toBeNull();
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }))
    );
    expect(v.container.querySelector('[data-state="expanded"]')).not.toBeNull();
  });
  it("honors externally controlled state and callback", async () => {
    const change = vi.fn();
    await v.render(
      <S.SidebarProvider open={false} onOpenChange={change}>
        <Menu />
      </S.SidebarProvider>
    );
    expect(v.container.querySelector('[data-state="collapsed"]')).not.toBeNull();
    await v.click("Toggle Sidebar");
    expect(change).toHaveBeenCalledWith(true);
    expect(v.container.querySelector('[data-state="collapsed"]')).not.toBeNull();
    await v.render(
      <S.SidebarProvider open={true} onOpenChange={change}>
        <Menu />
      </S.SidebarProvider>
    );
    expect(v.container.querySelector('[data-state="expanded"]')).not.toBeNull();
  });
  it("opens the mobile sheet separately and dismisses with Escape", async () => {
    m.mobile = true;
    await v.render(
      <S.SidebarProvider>
        <Menu />
      </S.SidebarProvider>
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await v.click("Toggle Sidebar");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Menu de navegação");
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("supports a permanent sidebar without hiding its navigation", async () => {
    await v.render(
      <S.SidebarProvider defaultOpen={false}>
        <S.Sidebar collapsible="none">
          <S.SidebarMenuButton>Destino permanente</S.SidebarMenuButton>
        </S.Sidebar>
      </S.SidebarProvider>
    );
    expect(v.container.textContent).toContain("Destino permanente");
  });
  it("removes shortcut listeners after leaving", async () => {
    const change = vi.fn();
    await v.render(
      <S.SidebarProvider open={true} onOpenChange={change}>
        <Menu />
      </S.SidebarProvider>
    );
    await v.render(<p>Fora do menu</p>);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }))
    );
    expect(change).not.toHaveBeenCalled();
  });
});
