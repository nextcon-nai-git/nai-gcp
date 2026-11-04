import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod/v3";
import { adminDb } from "@/lib/firebase-admin";
import { CATEGORIAS_COMPLIANCE } from "@/lib/compliance";
import { AuthError, badRequest } from "@/lib/auth/errors";

const categories = Object.keys(CATEGORIAS_COMPLIANCE) as [
  keyof typeof CATEGORIAS_COMPLIANCE,
  ...(keyof typeof CATEGORIAS_COMPLIANCE)[],
];

const calendarDate = z
  .string()
  .max(10)
  .refine((value) => {
    if (!value) return true;
    if (!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, "Data do fato inválida.");

export const ComplianceReportSchema = z
  .object({
    isAnonimo: z.boolean(),
    nome: z.string().trim().max(200),
    email: z.string().trim().max(320),
    categoria: z.enum(categories),
    descricao: z.string().trim().min(20).max(10000),
    dataFato: calendarDate,
    local: z.string().trim().max(300),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.isAnonimo) {
      if (value.nome.length < 2)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nome"],
          message: "Informe seu nome ou selecione relato anônimo.",
        });
      if (!z.string().email().safeParse(value.email).success)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Informe um e-mail válido ou selecione relato anônimo.",
        });
    }
    if (value.dataFato && value.dataFato > new Date().toISOString().slice(0, 10))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataFato"],
        message: "A data do fato não pode estar no futuro.",
      });
  });

function protocol() {
  return `DEN-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

function alreadyExists(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === 6 || code === "already-exists";
}

export async function createComplianceReport(input: unknown) {
  const report = ComplianceReportSchema.parse(input);
  const severity = CATEGORIAS_COMPLIANCE[report.categoria].severidade;
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = protocol();
    try {
      await adminDb
        .collection("denuncias")
        .doc(id)
        .create({
          protocolo: id,
          tipoRelato: report.isAnonimo ? "anonimo" : "identificado",
          dadosIdentificacao: report.isAnonimo
            ? { nome: null, email: null }
            : { nome: report.nome, email: report.email.toLowerCase() },
          categoria: report.categoria,
          detalhes: {
            descricao: report.descricao,
            dataFato: report.dataFato || null,
            local: report.local || null,
          },
          status: "triagem",
          prioridade: severity,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
        });
      return id;
    } catch (error) {
      if (alreadyExists(error)) continue;
      throw error;
    }
  }
  throw new AuthError("Não foi possível reservar um protocolo. Tente novamente.", 503);
}

export function complianceBadRequest(error: z.ZodError) {
  return badRequest(error.issues[0]?.message || "Relato inválido.");
}
