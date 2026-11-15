import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { getBoard } from "@/lib/lifecycle/board";
import { BoardView } from "@/components/board/board-view";
import { endOfLocalDay, userTzOffsetSec } from "@/lib/time/local-day";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const userId = await requireUserId();
  // Server component: Date.now() is intentionally per-request (not a hook).
  // eslint-disable-next-line react-hooks/purity
  const dueBy = endOfLocalDay(Date.now(), await userTzOffsetSec());
  // Anything due by the end of today counts as due now.
  return <BoardView columns={getBoard(getDb(), userId, dueBy)} nowMs={dueBy} />;
}
