import "server-only";
import { getDb } from "@/lib/db/client";

export async function catalogCount() {
  try {
    return await getDb().modelVersion.count();
  } catch {
    return null;
  }
}
