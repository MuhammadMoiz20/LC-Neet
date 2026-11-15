import { notFound } from "next/navigation";
import { preconnect } from "react-dom";
import { getDb } from "@/lib/db";
import { getProblemBySlug } from "@/lib/problems/repo";
import { ProblemWorkspace } from "./problem-workspace";

export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string; duration?: string; focus?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const problem = getProblemBySlug(getDb(), slug);
  if (!problem) notFound();
  // Monaco and Pyodide both load from this CDN once the client boots; opening
  // the connection now takes DNS + TLS off that path.
  preconnect("https://cdn.jsdelivr.net", { crossOrigin: "anonymous" });
  const interviewMode = sp.mode === "interview" || sp.focus === "1";
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
