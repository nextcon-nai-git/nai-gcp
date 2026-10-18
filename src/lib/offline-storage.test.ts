import { beforeEach, describe, it, expect, vi } from "vitest";
import { offlineStorage } from "./offline-storage";
const a = { userId: "account-a", companyId: "company-a" },
  b = { userId: "account-b", companyId: "company-a" },
  c = { userId: "account-a", companyId: "company-b" };
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("scoped offline drafts", () => {
  it("isolates both account and company", () => {
    offlineStorage.addItem("FIELD_INSPECTION", { note: "only-a" }, a);
    offlineStorage.addItem("CHECKLIST_NR", { note: "only-b" }, b);
    offlineStorage.addItem("EPI_DELIVERY", { note: "only-c" }, c);
    expect(offlineStorage.getQueue(a).map((i) => i.data.note)).toEqual(["only-a"]);
    expect(offlineStorage.getQueue(b).map((i) => i.data.note)).toEqual(["only-b"]);
    expect(offlineStorage.getQueue(c).map((i) => i.data.note)).toEqual(["only-c"]);
    expect(offlineStorage.getPendingCount(a)).toBe(1);
  });
  it.each([
    undefined,
    { userId: "", companyId: "a" },
    { userId: "a", companyId: "all" },
    { userId: "a", companyId: "unauthorized" },
  ])("does not read a queue with an incomplete scope", (scope) => {
    localStorage.setItem(
      "nai_offline_queue_v1",
      JSON.stringify([{ id: "legacy", data: "private", status: "PENDING" }])
    );
    expect(offlineStorage.getQueue(scope)).toEqual([]);
    expect(() => offlineStorage.addItem("FIELD_INSPECTION", {}, scope as any)).toThrow();
    expect(localStorage.getItem("nai_offline_queue_v1")).toContain("private");
  });
  it("removes only the selected scoped record", () => {
    const first = offlineStorage.addItem("FIELD_INSPECTION", { n: 1 }, a);
    const second = offlineStorage.addItem("FIELD_INSPECTION", { n: 2 }, a);
    offlineStorage.addItem("FIELD_INSPECTION", { n: 3 }, b);
    offlineStorage.removeItem(first.id, a);
    expect(offlineStorage.getQueue(a).map((x) => x.id)).toEqual([second.id]);
    expect(offlineStorage.getQueue(b)).toHaveLength(1);
  });
  it("clears only its scope and leaves legacy records for separate reconciliation", () => {
    localStorage.setItem("nai_offline_queue_v1", "legacy");
    offlineStorage.addItem("FIELD_INSPECTION", {}, a);
    offlineStorage.addItem("FIELD_INSPECTION", {}, b);
    offlineStorage.clearQueue(a);
    expect(offlineStorage.getQueue(a)).toEqual([]);
    expect(offlineStorage.getQueue(b)).toHaveLength(1);
    expect(localStorage.getItem("nai_offline_queue_v1")).toBe("legacy");
  });
  it("tolerates malformed or nonarray storage without exposing arbitrary objects", () => {
    offlineStorage.addItem("FIELD_INSPECTION", {}, a);
    const key = localStorage.key(0)!;
    for (const value of [
      "broken",
      "{}",
      "null",
      JSON.stringify([null, { id: "x", status: "invalid" }]),
    ]) {
      localStorage.setItem(key, value);
      expect(offlineStorage.getQueue(a)).toEqual([]);
    }
  });
  it("does not claim saved when device storage rejects the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Quota exceeded");
    });
    expect(() => offlineStorage.addItem("FIELD_INSPECTION", {}, a)).toThrow("Quota exceeded");
  });
});
