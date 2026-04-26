import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { listAttemptsByProblem } from "@/lib/attempts/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const problemIdRaw = req.nextUrl.searchParams.get("problemId");
  const problemId = Number(problemIdRaw);
  if (!Number.isFinite(problemId)) {
    return new Response("bad problemId", { status: 400 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 10;
  const attempts = listAttemptsByProblem(getDb(), userId, problemId, limit);
  return Response.json({ attempts });
}
