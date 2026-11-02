// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod/v3";
import { AuthError } from "@/lib/auth/errors";
import { EsocialXmlValidationError } from "./events";
import { esocialFailure } from "./http";

describe("erros públicos eSocial", () => {
  it("retorna campos legíveis em 400 sem valores recebidos ou chaves desconhecidas", async () => {
    const result = z
      .object({ sourceReference: z.string(), confirmed: z.literal(true) })
      .strict()
      .safeParse({ sourceReference: 12, confirmed: false, PRIVATE_SECRET_TEST: "sensitive-value" });
    if (result.success) throw new Error("Fixture deveria falhar");
    const response = esocialFailure(result.error),
      text = await response.text();
    expect(response.status).toBe(400);
    expect(text).toContain("referência do documento de origem");
    expect(text).toContain("confirmação da operação");
    expect(text).not.toContain("PRIVATE_SECRET_TEST");
    expect(text).not.toContain("sensitive-value");
  });
  it("retorna 422 para XML inválido sem expor texto livre do parser", async () => {
    const response = esocialFailure(new EsocialXmlValidationError("PRIVATE_XML_TEST <sensitive/>"));
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("PRIVATE_XML_TEST");
  });
  it("identifica campos de erro estrutural sem reproduzir informações clínicas", async () => {
    const response = esocialFailure(
      new EsocialXmlValidationError(
        "Dados eSocial incompletos ou inválidos. aso.dtAso: private-value; aso.medico.nmMed: private-name"
      )
    );
    const body = await response.text();
    expect(body).toContain("Data de emissão do ASO");
    expect(body).toContain("Nome do médico");
    expect(body).not.toContain("private-value");
    expect(body).not.toContain("private-name");
  });
  it("mantém status de autenticação/conflito e sanitiza falhas imprevistas", async () => {
    expect(esocialFailure(new AuthError("Registro mudou. Atualize.", 409)).status).toBe(409);
    const response = esocialFailure(new Error("SECRET_TEST"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET_TEST");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
