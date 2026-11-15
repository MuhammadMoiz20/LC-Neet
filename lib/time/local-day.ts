import { cookies } from "next/headers";

/**
 * Day boundaries (today's daily, streaks, the heatmap, the greeting) follow the
 * user's clock, not the server's — on Vercel the server is always UTC. The app
 * shell stores the browser's UTC offset in the `tz` cookie, in minutes east of
 * UTC. A fixed offset is used rather than a zone name, so a day right at a DST
 * change can be off by an hour.
 */

/** The server's own offset: the fallback before the cookie exists, and in tests. */
export function serverTzOffsetSec(): number {
  return -new Date().getTimezoneOffset() * 60;
}

/** Seconds to add to a UTC timestamp to get the signed-in user's wall clock. */
export async function userTzOffsetSec(): Promise<number> {
  const minutes = Number((await cookies()).get("tz")?.value);
  return Number.isInteger(minutes) && Math.abs(minutes) <= 14 * 60
    ? minutes * 60
    : serverTzOffsetSec();
}

/** Calendar date (YYYY-MM-DD) at `ms` for a clock `tzOffsetSec` east of UTC. */
export function localDate(ms: number, tzOffsetSec: number): string {
  return new Date(ms + tzOffsetSec * 1000).toISOString().slice(0, 10);
}

/**
 * The last millisecond of the calendar day containing `ms` on that clock.
 * Reviews are due by the day, not the minute: something flagged at 9pm must
 * count as due when the user sits down at 6pm the next day.
 */
export function endOfLocalDay(ms: number, tzOffsetSec: number): number {
  const DAY = 86_400_000;
  const off = tzOffsetSec * 1000;
  return Math.floor((ms + off) / DAY) * DAY + DAY - 1 - off;
}
