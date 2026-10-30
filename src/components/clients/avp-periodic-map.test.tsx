import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { AvpPeriodicMap } from "./avp-periodic-map";
import type { PeriodicPerson } from "@/lib/avp-periodic-control";
const v = ui();
afterEach(() => v.cleanup());
it("mantém quatro status na mesma cidade, com rótulos e seleção acessíveis", async () => {
  const onSelect = vi.fn();
  const people = ["pending", "scheduled", "received", "cancelled", "unknown"].map(
    (progress, i) => ({
      id: String(i),
      city: "Curitiba",
      uf: "PR",
      cityKey: "CURITIBA|PR",
      progress,
      status: "Fonte",
    })
  ) as PeriodicPerson[];
  await v.render(<AvpPeriodicMap people={people} onSelect={onSelect} />);
  const pins = v.container.querySelectorAll('svg [role="button"]');
  expect(pins).toHaveLength(4);
  expect([...pins].map((p) => p.querySelector("path")?.getAttribute("fill"))).toEqual([
    "#dc2626",
    "#15803d",
    "#2563eb",
    "#ca8a04",
  ]);
  expect(pins[2].getAttribute("aria-label")).toContain("1 asos recebidos");
  expect(v.container.textContent).toContain("1 registros com status desconhecido");
  await act(async () => pins[2].dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onSelect).toHaveBeenCalledWith("CURITIBA|PR", "received");
});
