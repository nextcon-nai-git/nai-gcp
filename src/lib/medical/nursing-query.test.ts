import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("deployed nursing query index", () => {
  it("supports company scoping and descending server receipt timestamps", () => {
    const configuration = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
    expect(configuration.indexes).toContainEqual({
      collectionGroup: "nursing_attendances",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "companyId", order: "ASCENDING" },
        { fieldPath: "timestamp", order: "DESCENDING" },
      ],
    });
  });
});
