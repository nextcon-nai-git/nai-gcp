// @vitest-environment node
import { describe, expect, it } from "vitest";
import { attachmentReplacements } from "../../scripts/security/migrate-employee-attachments";
import { employeeAttachmentPath } from "./employee-attachment-path";
const target = { companyId: "c", employeeId: "e" },
  path = "clientes/c/colaboradores/e/abc";
const legacy = (p: string, b = "bucket") =>
  "https://firebasestorage.googleapis.com/v0/b/" +
  b +
  "/o/" +
  encodeURIComponent(p) +
  "?alt=media&token=private";
describe("employee file references", () => {
  it("resolves old tokens and new metadata to the same authorized path", () => {
    expect(employeeAttachmentPath({ url: legacy(path) }, target, "bucket")).toBe(path);
    expect(employeeAttachmentPath({ storagePath: path }, target, "bucket")).toBe(path);
  });
  it("can repeat a migration without changing unrelated or already converted attachments", () => {
    const rows = [
      { id: "a", name: "A.pdf", url: legacy(path) },
      { id: "b", url: "https://example.test/externo" },
      { id: "c", storagePath: path },
    ];
    const first = attachmentReplacements(rows, target, "bucket");
    expect([...first.paths]).toEqual([path]);
    expect(first.updated).toEqual([
      { id: "a", name: "A.pdf", storagePath: path },
      rows[1],
      rows[2],
    ]);
    expect(attachmentReplacements(first.updated, target, "bucket").paths.size).toBe(0);
  });
  it("rejects a different bucket, company, employee or malformed path", () => {
    for (const url of [
      legacy(path, "other"),
      legacy(path.replace("/c/", "/d/")),
      legacy(path.replace("/e/", "/z/")),
      legacy(path + "/../x"),
      legacy(path).replace("https:", "http:"),
    ])
      expect(employeeAttachmentPath({ url }, target, "bucket")).toBeUndefined();
  });
  it("supports an internal attachment uploaded before the employee profile was saved", () => {
    const draft = "internos_nextcon/colaboradores/draft_00000000-0000-4000-a000-000000000001/file";
    expect(
      employeeAttachmentPath(
        { storagePath: draft },
        { internal: true, employeeId: "saved" },
        "bucket"
      )
    ).toBe(draft);
    expect(employeeAttachmentPath({ storagePath: draft }, target, "bucket")).toBeUndefined();
  });
});
