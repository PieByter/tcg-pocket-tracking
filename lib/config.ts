import "server-only";
import { getDb } from "@/db";
import { appConfig } from "@/db/schema";
import { parseSettings, type AppSettings } from "./settings";

export type { AppSettings };

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(appConfig);
  return parseSettings(rows);
}
