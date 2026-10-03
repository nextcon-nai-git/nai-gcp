import { describe, expect, it } from "vitest";
import { calculateRiskScore, getRiskLevel } from "./risk-assessment";

describe("risk assessment", () => {
  it.each([
    [1, 1, 1, "baixo"],
    [2, 3, 6, "moderado"],
    [3, 4, 12, "alto"],
    [4, 5, 20, "critico"],
  ])("classifies probability %i and severity %i", (probability, severity, score, level) => {
    expect(calculateRiskScore(probability, severity)).toBe(score);
    expect(getRiskLevel(score)).toBe(level);
  });

  it.each([
    [4, "baixo"],
    [5, "moderado"],
    [11, "moderado"],
    [12, "alto"],
    [19, "alto"],
    [20, "critico"],
  ])("classifies score %i at a risk-level boundary", (score, level) => {
    expect(getRiskLevel(score)).toBe(level);
  });

  it("keeps the score inside the 1–25 matrix", () => {
    expect(calculateRiskScore(0, 0)).toBe(1);
    expect(calculateRiskScore(8, 8)).toBe(25);
  });
});
