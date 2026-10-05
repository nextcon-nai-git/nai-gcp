import { describe, it, expect } from "vitest";
import { clinicalEngine } from "@/services/clinical-rules/engine";
import { isPrivateOrReservedIp } from "@/lib/webhook-security-guard";

describe("Dados clínicos incompletos", () => {
  it.each(Object.keys(clinicalEngine.linhas_disponiveis))(
    "não inventa dados normais em %s",
    (code) => {
      expect(clinicalEngine.linhas_disponiveis[code].avaliar({}).escore).toBe("Não avaliado");
    }
  );
  it("aceita escore zero explicitamente preenchido e rejeita preenchimento parcial", () => {
    expect(clinicalEngine.linhas_disponiveis.puerperio.avaliar({ epds_score: 0 }).escore).toBe(
      "EPDS: 0"
    );
    expect(
      clinicalEngine.linhas_disponiveis.saude_mental.avaliar({ phq9: [0], gad7: [] }).escore
    ).toBe("Não avaliado");
  });
});
describe("Destinos de rede restritos", () => {
  it.each([
    "fd12:3456::1",
    "fc12::1",
    "fea0::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:192.168.1.1",
    "2001:db8::1",
    "2002:7f00:1::1",
    "224.0.0.1",
    "240.0.0.1",
    "198.18.0.1",
    "invalid",
  ])("bloqueia %s", (ip) => expect(isPrivateOrReservedIp(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("permite IP público %s", (ip) =>
    expect(isPrivateOrReservedIp(ip)).toBe(false)
  );
});
