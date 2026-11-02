import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { isoDate, parseRegistration, readBritaniaDossier } from "./britania-dossier";
import { isBritaniaSite } from "./britania-group";
describe("Britânia source reconciliation", () => {
  it("groups approved identities, never arbitrary name matches", () => {
    expect(isBritaniaSite({ id: "BRITANIA_JOINVILLE" })).toBe(true);
    expect(isBritaniaSite({ cnpj: "76.492.701/0014-71" })).toBe(true);
    expect(isBritaniaSite({ id: "other" })).toBe(false);
  });
  it("rejects impossible calendar dates and preserves open returns", () => {
    expect(isoDate("31/02/2026")).toBeNull();
    expect(isoDate("28/02/2026")).toBe("2026-02-28");
    const result = parseRegistration(`
| C.N.P.J.: 76.492.701/0011-29 |
+---------------- Histórico de Afastamento ----------------+
| 01/02/2026 03/02/2026 ATESTADO |
| 04/02/2026 ABONO CHEFIA - HRS |
+---------------- Histórico de Férias ----------------+
| 01/03/2026 03/03/2026 FERIAS |
`);
    expect(result.leaves).toEqual([
      { start: "2026-02-01", end: "2026-02-03", reason: "ATESTADO", category: "atestado" },
      { start: "2026-02-04", end: null, reason: "ABONO CHEFIA - HRS", category: "administrativo" },
    ]);
    expect(result.reportedCnpjs).toEqual(["76492701001129"]);
  });
  it("does not treat administrative reasons as disease or infer diagnosis", () => {
    const result = parseRegistration(
      "+--- Histórico de Afastamento ---+\n| 01/01/2026 01/01/2026 Saida por Transferencia Empr. |\n| 02/01/2026 COVID-19 |"
    );
    expect(result.leaves.map((l) => l.category)).toEqual(["administrativo", "covid"]);
    expect(result).not.toHaveProperty("diagnosis");
  });
  it("preserves missing fichas without inventing employees or leave events", async () => {
    const zip = new JSZip();
    zip.file("Group/76492701-0011-29/0011-29_123.456.789-09/LEIA-ME.txt", "Pendente");
    const d = await readBritaniaDossier(
      await zip.generateAsync({ type: "arraybuffer" }),
      "source.zip"
    );
    expect(d.cases).toHaveLength(1);
    expect(d.cases[0]).toMatchObject({
      hasRegistration: false,
      leaves: [],
      sourceCnpj: "76492701001129",
    });
  });
  it("rejects misfiled identity before accepting medical events", async () => {
    const zip = new JSZip();
    zip.file(
      "Group/76492701-0011-29/0011-29_123.456.789-09/01_Ficha_de_registro/sample.txt",
      "C.P.F.: 999.999.999-99"
    );
    await expect(
      readBritaniaDossier(await zip.generateAsync({ type: "arraybuffer" }), "source.zip")
    ).rejects.toThrow("CPF");
  });
  it("rejects inflated entries before parsing their content", async () => {
    const zip = new JSZip();
    zip.file("large.txt", "a".repeat(600000));
    await expect(
      readBritaniaDossier(
        await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" }),
        "source.zip"
      )
    ).rejects.toThrow("limite");
  });
});
