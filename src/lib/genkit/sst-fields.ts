import { z } from "zod/v3";
export const shortText = z.string().trim().min(1).max(240);
export const notes = z.string().trim().min(1).max(6000);
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
export const listOfNotes = z.array(z.string().max(600)).max(24);
export const positive = z.number().finite().positive();
