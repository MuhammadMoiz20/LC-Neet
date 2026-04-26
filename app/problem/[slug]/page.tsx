import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProblemBySlug } from "@/lib/problems/repo";
import { ProblemWorkspace } from "./problem-workspace";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const problem = getProblemBySlug(getDb(), slug);
  if (!problem) notFound();
  return <ProblemWorkspace problem={problem} />;
}
