import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { getOrCreateDaily } from "@/lib/daily/repo";
import { pickDaily } from "@/lib/daily/pick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  const db = getDb();
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const row = getOrCreateDaily(db, userId, date, () => pickDaily(db, userId, date, now));
  return Response.json({ daily: row });
}
