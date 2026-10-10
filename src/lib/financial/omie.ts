import { z } from "zod";
export const OmieCredentialsSchema = z.object({
  appKey: z
    .string()
    .trim()
    .min(5)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  appSecret: z
    .string()
    .trim()
    .min(10)
    .max(200)
    .regex(/^[a-zA-Z0-9_-]+$/),
});
export const OmieQuerySchema = z.object({
  kind: z.enum(["payable", "receivable"]).default("receivable"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: z
    .enum(["ALL", "EMABERTO", "ATRASADO", "VENCEHOJE", "AVENCER", "LIQUIDADO", "CANCELADO"])
    .default("ALL"),
});
export type OmieConnection = {
  connected: boolean;
  company?: string;
  cnpj?: string;
  verifiedAt?: string;
};
export type OmiePage = {
  page: number;
  pages: number;
  total: number;
  queriedAt: string;
  rows: {
    id: string;
    document: string;
    partyCode: string;
    dueDate: string;
    amount: number;
    status: string;
    category: string;
  }[];
};
