import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { getOrCreateDaily } from "@/lib/daily/repo";
import { pickDaily } from "@/lib/daily/pick";
import { localDate, userTzOffsetSec } from "@/lib/time/local-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  const db = getDb();
  const now = Date.now();
  const date = localDate(now, await userTzOffsetSec());
  const row = getOrCreateDaily(db, userId, date, () => pickDaily(db, userId, date, now));
  return Response.json({ daily: row });
}
