import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AsoDocument } from "./aso-document";
import { SSTDocument } from "./sst-documents";

vi.mock("@react-pdf/renderer", () => {
  const container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Document: container,
    Page: container,
    Text: container,
    View: container,
    Image: () => null,
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

describe("Saídas documentais não certificam atos não realizados", () => {
  it("resumo de ASO preserva inaptidão informada sem declarar aptidão ou assinatura", () => {
    const output = renderToStaticMarkup(
      <AsoDocument patientName="PESSOA SINTÉTICA" status="Inapto" />
    );
    expect(output).toContain("Resumo de registro de ASO");
    expect(output).toContain("INAPTO");
    expect(output).not.toContain("encontra-se apto");
    expect(output).not.toContain("Assinado Digitalmente");
    expect(output).not.toContain("Validade Jurídica");
    expect(output).not.toContain("Periódico");
    expect(output).toContain("não substitui o documento");
  });

  it("ausência de resultado não determina aptidão", () => {
    const output = renderToStaticMarkup(<AsoDocument patientName="PESSOA SINTÉTICA" />);
    expect(output).toContain("NÃO INFORMADO");
  });

  it("minuta SST sem dados não inventa conformidade nem assinatura nominal", () => {
    const output = renderToStaticMarkup(
      <SSTDocument data={{}} company={{ name: "EMPRESA SINTÉTICA" }} type="PGR" />
    );
    expect(output).toContain("Rascunho");
    expect(output).toContain("Não há análise documental registrada");
    expect(output).not.toContain("94%");
    expect(output).not.toContain("Felipe");
    expect(output).not.toContain("Assinado Digitalmente");
    expect(output).toContain("Revisão e aprovação pendentes");
  });
});
