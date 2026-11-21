import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { databaseEnv } from "./src/lib/config/database";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const env = databaseEnv.safeParse(process.env);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env.success ? env.data.DIRECT_URL ?? env.data.DATABASE_URL : undefined },
});
