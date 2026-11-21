import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { databaseConnectionString } from "../config/database";

const database = globalThis as typeof globalThis & { oneAtlasDb?: PrismaClient };

export function getDb() {
  return database.oneAtlasDb ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseConnectionString(),
      max: 3,
      connectionTimeoutMillis: 4_000,
      statement_timeout: 4_000,
    }),
  });
}
