import { z } from "zod";

export const GraphRoutesQuerySchema = z.object({
  filters: z
    .string()
    .optional()
    .transform((s) =>
      s === undefined || s === ""
        ? []
        : s
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
    ),
  operator: z
    .enum(["AND", "OR"])
    .optional()
    .default("AND"),
  severity: z.enum(["high", "medium", "low"]).optional(),
});

export type GraphRoutesQuery = z.infer<typeof GraphRoutesQuerySchema>;
