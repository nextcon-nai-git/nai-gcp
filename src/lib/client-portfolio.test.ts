import { describe, expect, it } from "vitest";
import {
  APPROVED_PORTFOLIO,
  activeClientCount,
  portfolioGroup,
  SANTANDER_RECORD,
} from "./client-portfolio";
describe("Approved client portfolio", () => {
  it("counts approved customers once across linked records", () => {
    const records = APPROVED_PORTFOLIO.flatMap((g) =>
      g.records.map((id) => ({ id, active: true, portfolioClientId: g.id }))
    );
    expect(activeClientCount(records)).toBe(11);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
  });
  it("never classifies the bank or unknown records as approved clients", () => {
    expect(portfolioGroup(SANTANDER_RECORD)).toBeUndefined();
    expect(portfolioGroup("unknown")).toBeUndefined();
    expect(
      activeClientCount([
        { id: "inactive", active: false },
        { id: "unknown", active: null },
      ])
    ).toBe(0);
  });
});
