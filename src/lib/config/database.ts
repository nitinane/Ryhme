import { z } from "zod";

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

export const databaseEnv = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: z.preprocess((value) => value === "" ? undefined : value, postgresUrl.optional()),
});

export function databaseConnectionString(env: Record<string, string | undefined> = process.env) {
  const result = databaseEnv.safeParse(env);
  if (!result.success) {
    throw new Error("Configure DATABASE_URL and, if needed, DIRECT_URL with valid PostgreSQL URLs.");
  }
  return result.data.DATABASE_URL;
}
