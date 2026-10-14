import { describe, expect, it } from "vitest";

import { sortCompaniesByName } from "./company-order";

describe("sortCompaniesByName", () => {
  it("orders clients alphabetically by display name ignoring case and accents", () => {
    const companies = [
      { id: "3", name: "Zebra Ltda" },
      { id: "1", name: "Água & Cia" },
      { id: "2", name: "Belo Horizonte SA" },
    ];

    expect(sortCompaniesByName(companies).map((company) => company.id)).toEqual(["1", "2", "3"]);
  });

  it("prefers displayName when the company has a different canonical field", () => {
    const companies = [
      { id: "b", displayName: "Zeta", name: "Empresa Z" },
      { id: "a", displayName: "Ágora", name: "Nome Alternativo" },
    ];

    expect(sortCompaniesByName(companies).map((company) => company.id)).toEqual(["a", "b"]);
  });
});
