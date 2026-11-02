import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { AvpPeriodicMap } from "./avp-periodic-map";
import type { PeriodicPerson } from "@/lib/avp-periodic-control";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
});
afterEach(() => v.cleanup());
it("preserva contagem e filtro quando a coordenada usa um nome municipal canônico", async () => {
  const onSelect = vi.fn();
  const people = [
    {
      id: "alias",
      city: "Cachoeiro do Itapemirim",
      uf: "ES",
      cityKey: "CACHOEIRO DO ITAPEMIRIM|ES",
      progress: "scheduled",
      status: "Agendado",
    },
  ] as PeriodicPerson[];
  await v.render(<AvpPeriodicMap people={people} onSelect={onSelect} />);
  const pins = v.container.querySelectorAll('svg [role="button"]');
  expect(pins).toHaveLength(1);
  expect(pins[0].getAttribute("aria-label")).toContain("1 agendados");
  await act(async () => pins[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onSelect).toHaveBeenCalledWith("CACHOEIRO DO ITAPEMIRIM|ES", "scheduled");
});
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
  people.push({ ...people[0], id: "recife", city: "Recife", uf: "PE", cityKey: "RECIFE|PE" });
  await v.render(<AvpPeriodicMap people={people} onSelect={onSelect} />);
  expect(v.container.querySelectorAll('svg [role="button"]')).toHaveLength(5);
  await v.input('select[aria-label="UF do mapa de periódicos"]', "PR");
  expect(v.container.querySelector("svg")?.getAttribute("viewBox")).not.toBe("0 0 800 800");
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
