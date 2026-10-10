import { z } from "zod";
export const ClientActions = z
  .array(
    z.object({
      title: z.string().trim().min(3).max(180),
      instructions: z.string().trim().min(3).max(3000),
    })
  )
  .max(50);
export interface ClientDocument {
  id: string;
  name: string;
  createdAt: string;
  taskCount: number;
}
export function parseActionLines(text: string) {
  return ClientActions.parse(
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const split = line.indexOf("|");
        return {
          title: split < 0 ? line : line.slice(0, split).trim(),
          instructions: split < 0 ? line : line.slice(split + 1).trim(),
        };
      })
  );
}
