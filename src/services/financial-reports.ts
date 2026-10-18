import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import { ReportInputSchema, type FinancialReport } from "@/lib/financial/reports";
import { AuthError, badRequest } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
const prefix = "financial-reports/v1/";
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
function path(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Relatório inválido.");
  return `${prefix}${id}/`;
}
export async function listReports(user: AuthContext) {
  requireFinancialAccess(user);
  const [files] = await bucket().getFiles({ prefix });
  const reports: FinancialReport[] = [];
  for (const f of files.filter((f) => f.name.endsWith("/report.json"))) {
    const [data] = await f.download();
    reports.push(JSON.parse(data.toString()));
  }
  return reports.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
export async function readReport(user: AuthContext, id: string): Promise<FinancialReport> {
  requireFinancialAccess(user);
  const name = `${path(id)}report.json`;
  try {
    const [data] = await bucket().file(name).download();
    return JSON.parse(data.toString());
  } catch (e) {
    if (code(e) === 404) throw new AuthError("Relatório não encontrado.", 404);
    throw e;
  }
}
export async function readReportPdf(user: AuthContext, id: string) {
  await readReport(user, id);
  const [data] = await bucket()
    .file(`${path(id)}source.pdf`)
    .download();
  return data;
}
export async function saveReport(
  user: AuthContext,
  input: unknown,
  sourceName: string,
  pdf: Buffer
) {
  requireFinancialAccess(user);
  const parsed = ReportInputSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Confira título e período do relatório.");
  if (pdf.length > 10 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== "%PDF-")
    throw badRequest("Selecione um PDF de até 10 MB.");
  const id = createHash("sha256").update(pdf).digest("hex");
  const report: FinancialReport = {
    ...parsed.data,
    id,
    sourceName: sourceName.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 240),
    importedAt: new Date().toISOString(),
    importedBy: user.uid,
  };
  const opts = {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { cacheControl: "private, no-store" },
  };
  try {
    await bucket()
      .file(`${path(id)}source.pdf`)
      .save(pdf, { ...opts, contentType: "application/pdf" });
  } catch (e) {
    if (code(e) !== 412) throw e;
  }
  try {
    await bucket()
      .file(`${path(id)}report.json`)
      .save(JSON.stringify(report), { ...opts, contentType: "application/json" });
  } catch (e) {
    if (code(e) !== 412) throw e;
    return { report: await readReport(user, id), alreadySaved: true };
  }
  return { report, alreadySaved: false };
}
