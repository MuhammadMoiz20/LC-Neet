import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProblemBySlug } from "@/lib/problems/repo";
import { ProblemWorkspace } from "./problem-workspace";

export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string; duration?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const problem = getProblemBySlug(getDb(), slug);
  if (!problem) notFound();
  const interviewMode = sp.mode === "interview";
  const interviewDurationMin = Number(sp.duration ?? "30");
  return (
    <ProblemWorkspace
      problem={problem}
      interviewMode={interviewMode}
      interviewDurationMin={
        Number.isFinite(interviewDurationMin) ? interviewDurationMin : 30
      }
    />
  );
}
