// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isEsocialTransmissionEnabled } from "./esocial-transmission-policy";

afterEach(() => vi.unstubAllEnvs());

describe("eSocial transmission switch", () => {
  it.each([undefined, "", "false", "TRUE", "1", " true", "true "])(
    "blocks transmission for configuration %s",
    (value) => {
      vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", value);
      expect(isEsocialTransmissionEnabled()).toBe(false);
    }
  );

  it("requires an explicit literal true", () => {
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "true");
    expect(isEsocialTransmissionEnabled()).toBe(true);
  });
});
