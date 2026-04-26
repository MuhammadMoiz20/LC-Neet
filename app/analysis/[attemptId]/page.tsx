import { requireUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { getByAttempt } from "@/lib/analysis/repo";
import { notFound } from "next/navigation";
import { AnalysisView } from "./analysis-view";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  params,
}: { params: Promise<{ attemptId: string }> }) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) notFound();
  const db = getDb();
  const owner = db.prepare(
    `SELECT id FROM attempts WHERE id = ? AND user_id = ?`,
  ).get(id, userId);
  if (!owner) notFound();
  const initial = getByAttempt(db, id);
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Submission Analysis</h1>
      <AnalysisView attemptId={id} initial={initial} />
    </main>
  );
}
