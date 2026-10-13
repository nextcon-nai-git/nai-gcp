import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/real-data", () => {
  throw new Error("The provider fallback must not import embedded operational records.");
});

import { getConsolidatedProviders } from "./all-consolidated-providers";

describe("provider fallback without an authorized database result", () => {
  it("does not present embedded providers as registered records", () => {
    expect(getConsolidatedProviders()).toEqual([]);
  });

  it("does not invent identities, locations, assessments or company links", () => {
    const providers = getConsolidatedProviders();

    expect(providers).toHaveLength(0);
    expect(providers.some((provider) => provider.active || provider.rating)).toBe(false);
  });

  it("does not reuse records added to a previous fallback result", () => {
    const previous = getConsolidatedProviders();
    previous.push({
      id: "local-test-only",
      name: "Fictional test provider",
      cnpj: "",
      profession: "",
      type: "DOCTOR",
      specialty: "",
      city: "",
      state: "",
      active: false,
    });

    expect(getConsolidatedProviders()).toEqual([]);
    expect(getConsolidatedProviders()).not.toBe(previous);
  });
});
