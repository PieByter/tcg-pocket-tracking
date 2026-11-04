import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appConfig } from "@/db/schema";
import { parseSettings, type AppSettings } from "./settings";

export type { AppSettings };

export async function getSettings(userId: string): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(appConfig).where(eq(appConfig.userId, userId));
  return parseSettings(rows);
}
