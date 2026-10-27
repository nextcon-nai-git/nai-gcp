import { describe, it, expect } from "vitest";
import type { OpsTask } from "@/types/schema";
import { taskDate, taskCalendar, isOverdue, hasCoordinates, taskKey } from "./task-workspace";
const fixture = {
  id: "same-id",
  companyId: "a",
  companyName: "Time Now",
  title: "Avaliação; ruído, calor\nJuruti",
  dueDate: "2026-10-27T00:00:00Z",
  status: "todo",
} as OpsTask;
describe("task workspace", () => {
  it("preserves the contractual day without UTC shifting and rejects impossible dates", () => {
    expect(taskDate(fixture.dueDate)).toBe("2026-10-27");
    expect(taskDate("2026-02-30")).toBe("");
    expect(taskDate("bad")).toBe("");
  });
  it("keeps same-id tasks from different clients distinct", () => {
    expect(taskKey(fixture)).not.toBe(taskKey({ ...fixture, companyId: "b" }));
  });
  it("excludes completed cards from overdue counts", () => {
    expect(isOverdue(fixture, "2026-10-28")).toBe(true);
    expect(isOverdue({ ...fixture, status: "done" }, "2026-10-28")).toBe(false);
    expect(isOverdue({ ...fixture, dueDate: "" }, "2026-10-28")).toBe(false);
  });
  it("exports escaped all-day events with exclusive end and no undated phantom events", () => {
    const ics = taskCalendar(
      [fixture, { ...fixture, id: "undated", dueDate: "" }],
      new Date("2026-10-01T00:00:00Z")
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261027\r\nDTEND;VALUE=DATE:20261028");
    expect(ics).toContain("SUMMARY:Avaliação\\; ruído\\, calor\\nJuruti");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain("ATTENDEE");
  });
  it("folds UTF-8 lines without breaking characters", () => {
    const ics = taskCalendar([{ ...fixture, title: "ç".repeat(150) }]);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true
    );
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:" + "ç".repeat(150));
  });
  it("requires valid coordinates instead of inventing locations", () => {
    expect(hasCoordinates(fixture)).toBe(false);
    expect(hasCoordinates({ ...fixture, latitude: 0, longitude: 0 })).toBe(true);
    expect(hasCoordinates({ ...fixture, latitude: 91, longitude: 0 })).toBe(false);
  });
});
