import { requireUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { getLastInterviewAttempt } from "@/lib/attempts/repo";
import { PATTERN_GROUPS } from "@/lib/patterns/groups";
import { InterviewLanding } from "@/components/interview/interview-landing";

export const dynamic = "force-dynamic";

export default async function InterviewLandingPage() {
  const userId = await requireUserId();
  const last = getLastInterviewAttempt(getDb(), userId);
  return (
    <InterviewLanding
      patterns={PATTERN_GROUPS}
      lastRound={
        last
          ? {
              slug: last.slug,
              title: last.title,
              status: last.status,
              createdAt: last.createdAt,
            }
          : null
      }
    />
  );
}
