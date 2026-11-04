import { describe, expect, it } from "vitest";
import { FirestorePermissionError } from "./errors";

describe("FirestorePermissionError", () => {
  it("does not serialize request payload fields into client-visible errors", () => {
    const error = new FirestorePermissionError({
      operation: "list",
      path: "companies/example/private",
      requestResourceData: {
        contact: "SENSITIVE_CONTACT_VALUE",
        credential: "SENSITIVE_CREDENTIAL_VALUE",
        identifier: "SENSITIVE_IDENTIFIER_VALUE",
      },
    });

    expect(error.code).toBe("permission-denied");
    expect(error.message).toContain("Firestore permission denied (list)");
    expect(error.message).toContain("companies/example/private");
    expect(error.message).not.toContain("SENSITIVE_CONTACT_VALUE");
    expect(error.message).not.toContain("SENSITIVE_CREDENTIAL_VALUE");
    expect(error.message).not.toContain("SENSITIVE_IDENTIFIER_VALUE");
    expect(JSON.stringify(error.request)).not.toContain("contact");
    expect(JSON.stringify(error.request)).not.toContain("credential");
    expect(JSON.stringify(error.request)).not.toContain("identifier");
  });
});
