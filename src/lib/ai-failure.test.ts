import { expect, it } from "vitest";
import { aiFailureCode, aiFailureMessage } from "./ai-failure";
it.each([
  [403, "AUTHORIZATION"],
  [404, "MODEL"],
  [429, "QUOTA"],
  [400, "FORMAT"],
])("classifies status %s without exposing payload", (status, code) => {
  const error = { status, message: "private-token patient data" };
  expect(aiFailureCode(error)).toBe(code);
  expect(aiFailureMessage(aiFailureCode(error))).not.toContain("private-token");
});
