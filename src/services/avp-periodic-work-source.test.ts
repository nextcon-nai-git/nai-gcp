// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CAMPAIGN_HEADERS, type PeriodicPerson } from "@/lib/avp-periodic-control";
import { adaptLiveCampaign } from "@/lib/avp-periodic-live";
import { attachPeriodicWorkSource } from "./avp-periodic-work-source";

const participant = (id: string): PeriodicPerson => ({
  id: `periodico-2026-${id}`,
  name: "Pessoa sintética",
  city: "Curitiba",
  uf: "PR",
  cityKey: "CURITIBA|PR",
  unit: "Unidade sintética",
  status: "Agendado",
  review: "OK",
  phone: "",
  email: "",
  admission: "01/01/2020",
  classification: "listed",
  duplicateRows: 0,
  sourceRows: [2],
});
const row = (id = "1") =>
  CAMPAIGN_HEADERS.map(
    (header) =>
      (
        ({
          ID: id,
          Cidade: "Curitiba",
          UF: "PR",
          Nome: "Pessoa sintética",
          CPF: "00000000001",
          Status: "Agendado",
          "Dt. admissão": "01/01/2020",
          "Unidade (empresa)": "Unidade sintética",
          "Linha de origem": id,
        }) as Record<string, string>
      )[header] || ""
  );
const source = (rows: string[][], first = "1") =>
  attachPeriodicWorkSource([participant(first)], [CAMPAIGN_HEADERS, ...rows])[0];

describe("vínculo privado da fila à origem", () => {
  it("preserva a liberação ao mover linhas ou inserir outro participante na campanha online", () => {
    const first = row("1");
    const second = row("2");
    second[4] = "00000000002";
    const added = row("3");
    added[4] = "00000000003";
    const liveSource = (rows: string[][]) => {
      const campaign = adaptLiveCampaign([
        [],
        [],
        [],
        CAMPAIGN_HEADERS.slice(0, -1),
        ...rows.map((entry) => entry.slice(0, -1)),
      ]);
      const people = attachPeriodicWorkSource(
        rows.map((entry) => participant(entry[0])),
        campaign
      );
      return {
        person: people.find((entry) => entry.id === "periodico-2026-1")!,
        physicalRow: campaign.find((entry) => entry[0] === "1")![30],
      };
    };
    const original = liveSource([first, second]);
    const reordered = liveSource([second, first]);
    const inserted = liveSource([added, second, first]);
    expect([original.physicalRow, reordered.physicalRow, inserted.physicalRow]).toEqual([
      "5",
      "6",
      "7",
    ]);
    for (const moved of [reordered, inserted]) {
      expect(moved.person.workId).toBe(original.person.workId);
      expect(moved.person.workSourceVersion).toBe(original.person.workSourceVersion);
    }
  });
  it("preserva a identidade e a trilha ao reordenar e remover a primeira duplicata", () => {
    const original = source([row("1"), row("2")]);
    const reordered = source([row("2"), row("1")], "2");
    const resolved = source([row("2")], "2");
    expect(reordered.workId).toBe(original.workId);
    expect(reordered.workSourceVersion).toBe(original.workSourceVersion);
    expect(resolved.workId).toBe(original.workId);
    expect(resolved.workSourceVersion).not.toBe(original.workSourceVersion);
  });
  it.each([4, 7, 8, 9, 14, 19, 20, 21, 23, 26, 27, 28, 29])(
    "invalida a aprovação quando a coluna de origem %s muda",
    (column) => {
      const original = row();
      const changed = [...original];
      changed[column] = column === 4 ? "00000000002" : "valor corrigido";
      expect(source([changed]).workSourceVersion).not.toBe(source([original]).workSourceVersion);
    }
  );
  it("não expõe CPF e não libera identidade incompleta", () => {
    const valid = source([row()]);
    expect(valid.workIdentityComplete).toBe(true);
    expect(JSON.stringify(valid)).not.toContain("00000000001");
    const incomplete = row();
    incomplete[4] = "";
    expect(source([incomplete]).workIdentityComplete).toBe(false);
  });
  it("isola vínculos do mesmo CPF em organizações diferentes", () => {
    const otherUnit = row();
    otherUnit[19] = "Outra unidade";
    expect(source([otherUnit]).workId).not.toBe(source([row()]).workId);
  });
  it("recusa IDs de origem repetidos entre vínculos diferentes", () => {
    const otherPerson = row();
    otherPerson[4] = "00000000002";
    expect(() => source([row(), otherPerson])).toThrow("IDs de origem repetidos");
  });
});
