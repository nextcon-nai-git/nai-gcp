import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ObligationsFields, readObligations, ObligationTaskEditor } from "./obligations-editor";
import { makeTasks, type Obligation } from "@/lib/production/obligations";
const obligation: Obligation = {
  id: "pgr",
  title: "Elaborar PGR",
  serviceType: "PGR",
  owner: "Engenharia",
  due: "2026-10-30",
  deadlineRule: "Até 30/10/2026",
  trigger: "",
  sourceReference: "Contrato, cláusula 4",
  sourceExcerpt: "Elaborar PGR até 30/10/2026.",
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it("retains human corrections when adding another obligation and submits both", async () => {
  await act(async () =>
    root.render(
      <form>
        <ObligationsFields initial={[obligation]} />
      </form>
    )
  );
  const title = host.querySelector<HTMLInputElement>('[name="obligation.pgr.title"]')!;
  title.value = "Revisar PGR da unidade A";
  await act(async () =>
    Array.from(host.querySelectorAll("button"))
      .find((b) => b.textContent === "Adicionar obrigação")!
      .click()
  );
  const ids = Array.from(host.querySelectorAll<HTMLInputElement>('[name="obligationId"]')).map(
    (e) => e.value
  );
  const newId = ids[1];
  for (const [key, value] of Object.entries({
    title: "Realizar ASO",
    sourceReference: "Contrato, cláusula 5",
    sourceExcerpt: "Realizar exames ASO",
  })) {
    host.querySelector<HTMLInputElement>(`[name="obligation.${newId}.${key}"]`)!.value = value;
  }
  const parsed = readObligations(new FormData(host.querySelector("form")!));
  expect(parsed).toHaveLength(2);
  expect(parsed[0].title).toBe("Revisar PGR da unidade A");
  expect(parsed[0].sourceExcerpt).toBe(obligation.sourceExcerpt);
  expect(parsed[1].due).toBe("");
});
it("removes only the selected draft obligation", async () => {
  await act(async () =>
    root.render(
      <form>
        <ObligationsFields
          initial={[
            obligation,
            { ...obligation, id: "aso", title: "Realizar ASO", serviceType: "ASO" },
          ]}
        />
      </form>
    )
  );
  await act(async () =>
    Array.from(host.querySelectorAll("button"))
      .find((b) => b.textContent === "Remover obrigação 1 da prévia")!
      .click()
  );
  expect(readObligations(new FormData(host.querySelector("form")!)).map((o) => o.id)).toEqual([
    "aso",
  ]);
});
it("shows contractual evidence and submits only editable task execution fields", async () => {
  const save = vi.fn().mockResolvedValue(true);
  await act(async () =>
    root.render(
      <ObligationTaskEditor task={makeTasks([obligation])[0]} disabled={false} save={save} />
    )
  );
  expect(host.textContent).toContain(obligation.sourceReference);
  expect(host.textContent).toContain(obligation.sourceExcerpt);
  const form = host.querySelector("form")!;
  (form.elements.namedItem("status") as HTMLSelectElement).value = "doing";
  (form.elements.namedItem("reason") as HTMLTextAreaElement).value = "Execução iniciada";
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ status: "doing", owner: "Engenharia", due: "2026-10-30" }),
    "Execução iniciada"
  );
  expect(save.mock.calls[0][0]).not.toHaveProperty("obligation");
});

it("keeps existing duties and human edits while accepting an addendum suggestion with a colliding ID", async () => {
  const suggestion = {
    ...obligation,
    title: "Realizar ASO",
    serviceType: "ASO" as const,
    sourceReference: "Aditivo, cláusula 2",
    sourceExcerpt: "Contratada a realização de ASO.",
  };
  await act(async () =>
    root.render(
      <form>
        <ObligationsFields initial={[obligation]} suggestions={[suggestion]} />
      </form>
    )
  );
  const form = host.querySelector("form")!;
  expect(readObligations(new FormData(form))).toEqual([obligation]);
  host.querySelector<HTMLInputElement>('[name="obligation.pgr.title"]')!.value =
    "Revisar PGR da unidade A";
  const add = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "Adicionar sugestão 1 como nova obrigação"
  )!;
  await act(async () => add.click());
  const result = readObligations(new FormData(form));
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ ...obligation, title: "Revisar PGR da unidade A" });
  expect(result[1].id).not.toBe(result[0].id);
  expect(result[1]).toMatchObject({
    title: suggestion.title,
    sourceExcerpt: suggestion.sourceExcerpt,
  });
  expect(add.disabled).toBe(true);
});
