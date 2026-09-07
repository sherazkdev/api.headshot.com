import { z, type ZodType } from "zod";
import { errors } from "./errors.js";

export function parseBody<T>(schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw errors.validation("The given data was invalid.", {
      issues: result.error.flatten(),
    });
  }
  return result.data;
}

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export function pageMeta(page: number, perPage: number, total: number) {
  return {
    page,
    per_page: perPage,
    total,
    last_page: Math.max(1, Math.ceil(total / perPage)),
  };
}
