import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StructuredRecordTab } from "./StructuredRecordTab";
import { ProfessionalEvolutionTab } from "./ProfessionalEvolutionTab";
import { PsychosocialTab } from "./PsychosocialTab";
import { AttendanceTab } from "./AttendanceTab";

describe("clinical screens distinguish missing integration from clinical findings", () => {
  it("renders evolution without relying on an empty hardcoded team", () => {
    const html = renderToStaticMarkup(<ProfessionalEvolutionTab />);
    expect(html).toContain("ainda não estão conectadas");
    expect(html).not.toContain("Protocolar Atividade");
    expect(html).not.toContain("Registro auditável");
  });
  it("does not manufacture predictive findings or notification success", () => {
    const html = renderToStaticMarkup(<PsychosocialTab />);
    expect(html).toContain("Nenhuma previsão ou conclusão clínica foi calculada");
    expect(html).not.toContain("74%");
    expect(html).not.toContain("0.82");
    expect(html).not.toContain("Live");
    expect(html).not.toContain("<button");
  });
  it("does not equate disconnected structured history with no records", () => {
    const html = renderToStaticMarkup(<StructuredRecordTab />);
    expect(html).toContain("não significa ausência de histórico clínico");
    expect(html).not.toContain("Nenhum prontuário");
    expect(html).not.toContain("HIPAA");
  });
  it("displays a saved attendance without offering permanent deletion", () => {
    const html = renderToStaticMarkup(
      <AttendanceTab
        loading={false}
        attendances={[
          {
            id: "record",
            employeeName: "Paciente de teste",
            employeeId: "patient",
            complaint: "Relato de teste",
            createdAt: "2026-10-18T05:00:00Z",
          },
        ]}
      />
    );
    expect(html).toContain("Paciente de teste");
    expect(html).toContain("Não informado");
    expect(html).not.toContain("Excluir");
  });
});
