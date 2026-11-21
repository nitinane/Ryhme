import { z } from "zod";

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

export const databaseEnv = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: z.preprocess((value) => value === "" ? undefined : value, postgresUrl.optional()),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  VERCEL_TARGET_ENV: z.string().optional(),
}).refine((env) => env.VERCEL_ENV !== "production" && env.VERCEL_TARGET_ENV !== "production"
  && (env.VERCEL !== "1" || env.VERCEL_ENV === "preview"), "Vercel database access is scoped to Preview.");

export function databaseConnectionString(env: Record<string, string | undefined> = process.env) {
  const result = databaseEnv.safeParse(env);
  if (!result.success) {
    throw new Error("Configure DATABASE_URL and, if needed, DIRECT_URL with valid PostgreSQL URLs.");
  }
  return result.data.DATABASE_URL;
}
