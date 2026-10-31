import { z } from "zod";

export const KitId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine(
    (id) => !/[\/\\\u0000-\u001f]/.test(id) && !["all", "unauthorized", ".", ".."].includes(id)
  );
const text = z.string().trim().min(1).max(200);
export const KitSelection = z
  .object({
    employeeIds: z
      .array(KitId)
      .min(1)
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length),
    clinicId: KitId,
    // A cycle represents the actual examination campaign; it is not a retry key.
    cycle: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    examType: z.enum([
      "admissional",
      "periodico",
      "demissional",
      "retorno_trabalho",
      "mudanca_funcao",
    ]),
    pcmsoDocumentId: z.string().regex(/^[a-f0-9]{64}$/),
    pgrDocumentId: z.string().regex(/^[a-f0-9]{64}$/),
    exams: z
      .array(text)
      .min(1)
      .max(30)
      .refine(
        (items) => new Set(items.map((x) => x.toLocaleLowerCase("pt-BR"))).size === items.length
      ),
    risks: z.array(text).min(1).max(30),
    pcmsoDoctor: text,
    pcmsoCrm: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase().replace(/\s/g, "").replace("-", "/"))
      .pipe(
        z
          .string()
          .regex(
            /^[0-9]{1,10}\/(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/
          )
      ),
  })
  .strict()
  .refine((v) => v.pcmsoDocumentId !== v.pgrDocumentId, "Selecione os dois documentos.");
export type KitSelectionData = z.infer<typeof KitSelection>;
export type KitResult = { id: string; employeeName: string; filename: string; reused: boolean };
export type KitPreview = {
  proposalId: string;
  expiresAt: number;
  company: string;
  clinic: string;
  clinicAddress: string;
  cycle: string;
  examType: string;
  employees: { id: string; name: string; role: string; department: string }[];
  documents: { id: string; name: string; purpose: string }[];
  exams: string[];
  risks: string[];
  pcmsoDoctor: string;
  pcmsoCrm: string;
};
export type KitCatalog = {
  history: KitResult[];
  employees: { id: string; name: string; role: string; department: string }[];
  clinics: { id: string; name: string; city: string }[];
  documents: { id: string; name: string }[];
  campaign?: { checkedAt: string; people: number; review: number; cities: number; status: string };
  campaignWarning?: string;
};
